// src/pages/account/migracion/ImportarPrestamos.tsx
// ATLAS HORIZON: Excel importer for loans & mortgages

import React, { useCallback, useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, X, Landmark, ArrowLeft, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { prestamosService } from '../../../services/prestamosService';
import { initDB } from '../../../services/db';

interface ImportarPrestamosProps {
  onComplete: () => void;
  onBack: () => void;
}

interface PreviewRow {
  inmueble_direccion: string;
  tipo: string;
  importe_inicial: number;
  fecha_inicio: string;
  plazo_meses: number;
  interes_anual: number;
  entidad: string;
  referencia: string;
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

const ImportarPrestamos: React.FC<ImportarPrestamosProps> = ({ onComplete, onBack }) => {
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Download template ───────────────────────────────────────────────────────

  const handleDescargarPlantilla = () => {
    const datos = [
      {
        inmueble_direccion: 'Calle Gran Vía 25, Madrid',
        tipo: 'hipoteca',
        importe_inicial: 180000,
        fecha_inicio: '2022-03-15',
        plazo_meses: 300,
        interes_anual: 2.5,
        entidad: 'CaixaBank',
        referencia: 'HIP-2022-001',
      },
      {
        inmueble_direccion: '',
        tipo: 'personal',
        importe_inicial: 15000,
        fecha_inicio: '2023-06-01',
        plazo_meses: 60,
        interes_anual: 6.9,
        entidad: 'BBVA',
        referencia: 'PRES-2023-045',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Prestamos');
    XLSX.writeFile(wb, 'plantilla-prestamos-atlas.xlsx');
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
        const required = ['importe_inicial', 'fecha_inicio', 'plazo_meses', 'interes_anual'];
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
            inmueble_direccion: String(byKey.inmueble_direccion || '').trim(),
            tipo: String(byKey.tipo || 'hipoteca').trim().toLowerCase(),
            importe_inicial: parseNumber(byKey.importe_inicial),
            fecha_inicio: parseDate(byKey.fecha_inicio),
            plazo_meses: Number(byKey.plazo_meses) || 0,
            interes_anual: parseNumber(byKey.interes_anual),
            entidad: String(byKey.entidad || '').trim(),
            referencia: String(byKey.referencia || '').trim(),
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
        (r) => r.importe_inicial > 0 && r.fecha_inicio && r.plazo_meses > 0 && r.interes_anual >= 0
      );

      if (!validRows.length) {
        toast.error('No hay filas válidas para importar');
        return;
      }

      // Look up properties and accounts once before the loop
      const db = await initDB();
      const allProperties = await db.getAll('properties');
      const allAccounts = await db.getAll('accounts');
      const defaultAccountId = allAccounts[0]?.id ? String(allAccounts[0].id) : '';

      if (!defaultAccountId) {
        toast.error('No hay cuentas bancarias registradas. Crea una cuenta antes de importar préstamos.');
        return;
      }

      let importados = 0;

      for (const row of validRows) {
        const ambitoValue = row.tipo === 'personal' ? 'PERSONAL' : 'INMUEBLE';

        // Try to match property by address
        let matchedPropertyId: string | undefined;
        if (row.inmueble_direccion && ambitoValue === 'INMUEBLE') {
          const target = row.inmueble_direccion.toLowerCase();
          const matched = allProperties.find((p) => {
            const candidate = `${p.alias} ${p.address}`.toLowerCase();
            return candidate.includes(target) || target.includes(candidate);
          });
          if (matched?.id) matchedPropertyId = String(matched.id);
        }

        // Derive diaCargoMes from fecha_inicio
        const fechaParts = row.fecha_inicio.split('-');
        const diaCargoMes = Math.min(Number(fechaParts[2]) || 1, 28);

        await prestamosService.createPrestamo({
          ambito: ambitoValue as 'PERSONAL' | 'INMUEBLE',
          inmuebleId: matchedPropertyId,
          nombre: row.referencia || `${row.entidad} - ${row.tipo}`,
          principalInicial: row.importe_inicial,
          principalVivo: row.importe_inicial,
          fechaFirma: row.fecha_inicio,
          fechaPrimerCargo: row.fecha_inicio,
          plazoMesesTotal: row.plazo_meses,
          diaCargoMes,
          esquemaPrimerRecibo: 'NORMAL',
          tipo: 'FIJO',
          sistema: 'FRANCES',
          tipoNominalAnualFijo: row.interes_anual,
          carencia: 'NINGUNA',
          cuotasPagadas: 0,
          cuentaCargoId: defaultAccountId,
          origenCreacion: 'IMPORTACION',
          activo: true,
          estado: 'vivo',
        });

        importados++;
      }

      toast.success(`${importados} préstamos importados correctamente`);
      setPreview(null);
      onComplete();
    } catch (err) {
      console.error('Error importing:', err);
      toast.error('Error al importar los préstamos');
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
          <Landmark size={20} strokeWidth={1.5} style={{ color: 'var(--navy-700, var(--atlas-navy-1))' }} aria-hidden="true" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--atlas-navy-1)' }}>
            Importar préstamos e hipotecas
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-gray)' }}>
            Importa tus préstamos e hipotecas históricas desde Excel
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
          Usa nuestra plantilla con el formato correcto: importe_inicial, fecha_inicio, plazo_meses, interes_anual.
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
              Si se indica inmueble_direccion, se intentará vincular al inmueble registrado en ATLAS. Los no encontrados se importarán sin vincular.
            </p>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--hz-neutral-300)' }}>
                  {['Dirección', 'Tipo', 'Importe', 'Fecha inicio', 'Plazo', 'Interés'].map((col) => (
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
                      {row.inmueble_direccion || '-'}
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
                    <td style={{ padding: '8px 12px', color: 'var(--atlas-navy-1)', fontFamily: 'var(--font-mono, "IBM Plex Mono", monospace)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                      {formatCurrency(row.importe_inicial)}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--atlas-navy-1)', fontVariantNumeric: 'tabular-nums' }}>
                      {row.fecha_inicio}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--atlas-navy-1)', fontVariantNumeric: 'tabular-nums' }}>
                      {row.plazo_meses} meses
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--atlas-navy-1)', fontFamily: 'var(--font-mono, "IBM Plex Mono", monospace)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                      {row.interes_anual}%
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
              {importing ? 'Importando...' : `Importar ${preview.length} préstamos`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportarPrestamos;
