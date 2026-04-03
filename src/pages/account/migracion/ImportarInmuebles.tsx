// src/pages/account/migracion/ImportarInmuebles.tsx
// ATLAS HORIZON: Excel importer for properties

import React, { useCallback, useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, X, Home, ArrowLeft, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { initDB } from '../../../services/db';

interface ImportarInmueblesProps {
  onComplete: () => void;
  onBack: () => void;
}

interface PreviewRow {
  direccion: string;
  ciudad: string;
  provincia: string;
  tipo: string;
  fecha_compra: string;
  precio_compra: number;
  gastos_compra: number;
  superficie: number;
  habitaciones: number;
  referencia_catastral: string;
}

const PREVIEW_ROW_LIMIT = 10;

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const normalizeHeader = (header: string): string =>
  header
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '');

const isValidISODate = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());

const parseDate = (value: unknown): string => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed?.y && parsed?.m && parsed?.d) {
      const result = `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
      return isValidISODate(result) ? result : '';
    }
    return '';
  }

  const raw = String(value || '').trim();
  if (!raw) return '';

  const normalized = raw.replace(/\./g, '/').replace(/-/g, '/');
  const parts = normalized.split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    let result = '';
    if (y.length === 4) result = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    else if (d.length === 4) result = `${d}-${m.padStart(2, '0')}-${y.padStart(2, '0')}`;
    if (result && isValidISODate(result)) return result;
  }

  return '';
};

const parseNumber = (value: unknown): number => {
  if (typeof value === 'number') return value;
  const normalized = String(value || '')
    .replace(/€/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const ImportarInmuebles: React.FC<ImportarInmueblesProps> = ({ onComplete, onBack }) => {
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Download template ───────────────────────────────────────────────────────

  const handleDescargarPlantilla = () => {
    const datos = [
      {
        direccion: 'Calle Uría 15, 3ºA',
        ciudad: 'Oviedo',
        provincia: 'Asturias',
        tipo: 'piso',
        fecha_compra: '2019-06-15',
        precio_compra: 185000,
        gastos_compra: 18500,
        superficie: 92,
        habitaciones: 3,
        referencia_catastral: '1234567AB1234C0001XY',
      },
      {
        direccion: 'Av. Diagonal 450, 7º2ª',
        ciudad: 'Barcelona',
        provincia: 'Barcelona',
        tipo: 'piso',
        fecha_compra: '2021-11-20',
        precio_compra: 320000,
        gastos_compra: 38000,
        superficie: 78,
        habitaciones: 2,
        referencia_catastral: '9876543CD5678E0002ZW',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inmuebles');
    XLSX.writeFile(wb, 'plantilla-inmuebles-atlas.xlsx');
    toast.success('Plantilla descargada correctamente');
  };

  // ── File parsing ────────────────────────────────────────────────────────────

  const parseFile = useCallback((file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Formato no válido. Usa .xlsx o .xls');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet);

        if (!rows.length) {
          toast.error('El archivo está vacío');
          return;
        }

        const keys = Object.keys(rows[0]).map(normalizeHeader);
        const required = ['direccion', 'fecha_compra', 'precio_compra'];
        const missing = required.filter((r) => !keys.includes(r));
        if (missing.length) {
          toast.error(`Columnas requeridas: ${missing.join(', ')}`);
          return;
        }

        const parsed: PreviewRow[] = rows.map((row) => {
          const byKey = Object.fromEntries(
            Object.entries(row).map(([k, v]) => [normalizeHeader(k), v])
          );
          return {
            direccion: String(byKey.direccion || '').trim(),
            ciudad: String(byKey.ciudad || byKey.municipio || '').trim(),
            provincia: String(byKey.provincia || '').trim(),
            tipo: String(byKey.tipo || 'piso').trim().toLowerCase(),
            fecha_compra: parseDate(byKey.fecha_compra),
            precio_compra: parseNumber(byKey.precio_compra),
            gastos_compra: parseNumber(byKey.gastos_compra),
            superficie: parseNumber(byKey.superficie || byKey.m2),
            habitaciones: Number(byKey.habitaciones) || 0,
            referencia_catastral: String(byKey.referencia_catastral || '').trim(),
          };
        });

        setPreview(parsed);
      } catch (err) {
        console.error('Error parsing file:', err);
        toast.error('Error al leer el archivo Excel');
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  // ── Drag & Drop ─────────────────────────────────────────────────────────────

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) parseFile(file);
    },
    [parseFile]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
    e.target.value = '';
  };

  // ── Import ──────────────────────────────────────────────────────────────────

  const handleImportar = async () => {
    if (!preview?.length) return;
    setImporting(true);
    try {
      const validRows = preview.filter(
        (r) => r.direccion && r.fecha_compra && r.precio_compra > 0
      );

      if (!validRows.length) {
        toast.error('No hay filas válidas para importar');
        return;
      }

      const db = await initDB();
      let importados = 0;

      for (const row of validRows) {
        const now = new Date().toISOString();

        await db.add('properties', {
          alias: row.tipo ? `${row.tipo.charAt(0).toUpperCase() + row.tipo.slice(1)} ${row.ciudad || ''}`.trim() : row.direccion.substring(0, 30),
          address: row.direccion,
          postalCode: '',
          province: row.provincia,
          municipality: row.ciudad,
          ccaa: '',
          purchaseDate: row.fecha_compra,
          cadastralReference: row.referencia_catastral || undefined,
          squareMeters: row.superficie || 0,
          bedrooms: row.habitaciones || 0,
          bathrooms: 0,
          transmissionRegime: 'usada' as const,
          state: 'activo' as const,
          notes: '',
          acquisitionCosts: {
            price: row.precio_compra,
            notary: 0,
            registry: 0,
            management: 0,
            psi: 0,
            realEstate: 0,
            other: row.gastos_compra > 0 ? [{ concept: 'Gastos importados', amount: row.gastos_compra }] : [],
          },
          documents: [],
          createdAt: now,
          updatedAt: now,
        });

        importados++;
      }

      toast.success(`${importados} inmuebles importados correctamente`);
      setPreview(null);
      onComplete();
    } catch (err) {
      console.error('Error importing:', err);
      toast.error('Error al importar los inmuebles');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div style={{ fontFamily: 'var(--font-inter)' }}>
      {/* Back button */}
      <button
        onClick={onBack}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--atlas-blue)',
          fontSize: '0.875rem',
          fontWeight: 500,
          padding: '0',
          marginBottom: '20px',
          fontFamily: 'var(--font-inter)',
        }}
      >
        <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" />
        Volver a Migración de Datos
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: 'var(--navy-700-light, #E8EAF0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Home size={20} strokeWidth={1.5} style={{ color: 'var(--navy-700, var(--atlas-navy-1))' }} aria-hidden="true" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--atlas-navy-1)' }}>
            Importar inmuebles
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-gray)' }}>
            Importa tu cartera de inmuebles con sus datos de adquisición desde Excel
          </p>
        </div>
      </div>

      {/* Step 1: Download template */}
      <div
        style={{
          border: '1px solid var(--hz-neutral-300)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '16px',
        }}
      >
        <h3 style={{ margin: '0 0 8px', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--atlas-navy-1)' }}>
          1. Descarga la plantilla
        </h3>
        <p style={{ margin: '0 0 14px', fontSize: '0.875rem', color: 'var(--text-gray)' }}>
          Usa nuestra plantilla con el formato correcto: direccion, fecha_compra, precio_compra y campos opcionales.
        </p>
        <button
          onClick={handleDescargarPlantilla}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            border: '1px solid var(--atlas-blue)',
            borderRadius: '8px',
            backgroundColor: 'transparent',
            color: 'var(--atlas-blue)',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'var(--font-inter)',
          }}
        >
          <Download size={16} strokeWidth={1.5} aria-hidden="true" />
          Descargar plantilla Excel
        </button>
      </div>

      {/* Step 2: Upload */}
      {!preview && (
        <div
          style={{
            border: '1px solid var(--hz-neutral-300)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '16px',
          }}
        >
          <h3 style={{ margin: '0 0 12px', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--atlas-navy-1)' }}>
            2. Sube tu archivo
          </h3>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            aria-label="Subir archivo Excel"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? 'var(--atlas-blue)' : 'var(--hz-neutral-300)'}`,
              borderRadius: '10px',
              padding: '40px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              backgroundColor: dragging ? 'var(--atlas-blue-light, #EBF3FF)' : 'var(--bg)',
              transition: 'border-color 0.2s, background-color 0.2s',
            }}
          >
            <Upload size={32} strokeWidth={1.5} style={{ color: dragging ? 'var(--atlas-blue)' : 'var(--text-gray)' }} aria-hidden="true" />
            <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 500, color: 'var(--atlas-navy-1)' }}>
              Arrastra tu archivo aquí o{' '}
              <span style={{ color: 'var(--atlas-blue)', textDecoration: 'underline' }}>haz clic para seleccionar</span>
            </p>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-gray)' }}>
              Formatos admitidos: .xlsx, .xls
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            aria-hidden="true"
          />
        </div>
      )}

      {/* Step 3: Preview */}
      {preview && (
        <div
          style={{
            border: '1px solid var(--hz-neutral-300)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--atlas-navy-1)' }}>
              3. Vista previa ({preview.length} filas)
            </h3>
            <button
              onClick={() => setPreview(null)}
              aria-label="Cancelar importación"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-gray)',
                fontSize: '0.8125rem',
                fontFamily: 'var(--font-inter)',
              }}
            >
              <X size={14} strokeWidth={1.5} aria-hidden="true" />
              Cancelar
            </button>
          </div>

          {/* Validation warning */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              padding: '10px 12px',
              backgroundColor: 'var(--atlas-blue-light, #EBF3FF)',
              borderRadius: '8px',
              marginBottom: '12px',
            }}
          >
            <AlertCircle size={16} strokeWidth={1.5} style={{ color: 'var(--atlas-blue)', flexShrink: 0 }} aria-hidden="true" />
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--atlas-navy-1)' }}>
              Se crearán nuevos inmuebles en tu cartera. Podrás completar datos fiscales y catastrales después desde la ficha del inmueble.
            </p>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--hz-neutral-300)' }}>
                  {['Dirección', 'Ciudad', 'Tipo', 'Fecha compra', 'Precio compra'].map((col) => (
                    <th
                      key={col}
                      style={{
                        padding: '8px 12px',
                        textAlign: 'left',
                        fontWeight: 600,
                        color: 'var(--text-gray)',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, PREVIEW_ROW_LIMIT).map((row, i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom: '1px solid var(--hz-neutral-300)',
                      backgroundColor: i % 2 === 0 ? 'var(--bg)' : 'var(--atlas-blue-light, #f9fafb)',
                    }}
                  >
                    <td style={{ padding: '8px 12px', color: 'var(--atlas-navy-1)' }}>
                      {row.direccion}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--atlas-navy-1)' }}>
                      {row.ciudad || '-'}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: 'var(--atlas-blue-light, #EBF3FF)',
                          color: 'var(--atlas-navy-1)',
                        }}
                      >
                        {row.tipo}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--atlas-navy-1)', fontVariantNumeric: 'tabular-nums' }}>
                      {row.fecha_compra}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--atlas-navy-1)', fontFamily: 'var(--font-mono, "IBM Plex Mono", monospace)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                      {formatCurrency(row.precio_compra)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > PREVIEW_ROW_LIMIT && (
              <p style={{ padding: '8px 12px', margin: 0, fontSize: '0.75rem', color: 'var(--text-gray)' }}>
                ... y {preview.length - PREVIEW_ROW_LIMIT} filas más
              </p>
            )}
          </div>

          {/* Import button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button
              onClick={handleImportar}
              disabled={importing}
              style={{
                padding: '10px 24px',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: importing ? 'var(--hz-neutral-300)' : 'var(--atlas-blue)',
                color: '#fff',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: importing ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-inter)',
              }}
            >
              {importing ? 'Importando...' : `Importar ${preview.length} inmuebles`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportarInmuebles;
