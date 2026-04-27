// src/modules/inmuebles/import/ImportarInmuebles.tsx
// ATLAS HORIZON: Excel importer for properties with merge support.
// T20 Fase 3a (sub-tarea 20.3a): re-ubicado per decisión D3 de Jose
// · cada importador legacy migra a su módulo natural.

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
  alias: string;
  codigo_postal: string;
  direccion: string;
  referencia_catastral: string;
  fecha_compra: string;
  precio_compra: number;
  tipo_transmision: string;
  notaria: number;
  registro: number;
  gestoria: number;
  otros_gastos: number;
  superficie_m2: number;
  habitaciones: number;
  banos: number;
  valor_catastral: number;
  valor_catastral_construccion: number;
  _accion: 'crear' | 'completar';
  _matchId?: number;
  _matchAlias?: string;
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

const normalizeForMatch = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

const ImportarInmuebles: React.FC<ImportarInmueblesProps> = ({ onComplete, onBack }) => {
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Download template ───────────────────────────────────────────────────────

  const handleDescargarPlantilla = () => {
    const datos = [
      {
        alias: 'Piso Oviedo Centro',
        codigo_postal: '33003',
        direccion: 'Calle Uria 15, 3A',
        referencia_catastral: '7949807TP6074N0006YM',
        fecha_compra: '2019-06-15',
        precio_compra: 185000,
        tipo_transmision: 'usada',
        notaria: 850,
        registro: 450,
        gestoria: 350,
        otros_gastos: 0,
        superficie_m2: 92,
        habitaciones: 3,
        banos: 2,
        valor_catastral: 75285,
        valor_catastral_construccion: 20776,
      },
      {
        alias: 'Estudio Barcelona',
        codigo_postal: '08029',
        direccion: 'Av. Diagonal 450, 7-2',
        referencia_catastral: '',
        fecha_compra: '2021-11-20',
        precio_compra: 320000,
        tipo_transmision: 'nueva',
        notaria: 1100,
        registro: 600,
        gestoria: 400,
        otros_gastos: 500,
        superficie_m2: 78,
        habitaciones: 2,
        banos: 1,
        valor_catastral: 0,
        valor_catastral_construccion: 0,
      },
    ];
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inmuebles');
    XLSX.writeFile(wb, 'plantilla-inmuebles-atlas.xlsx');
    toast.success('Plantilla descargada correctamente');
  };

  // ── File parsing ────────────────────────────────────────────────────────────

  const parseFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Formato no valido. Usa .xlsx o .xls');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet);

        if (!rows.length) {
          toast.error('El archivo esta vacio');
          return;
        }

        const keys = Object.keys(rows[0]).map(normalizeHeader);
        const required = ['alias', 'codigo_postal', 'fecha_compra', 'precio_compra', 'tipo_transmision'];
        const missing = required.filter((r) => !keys.includes(r));
        if (missing.length) {
          toast.error(`Columnas requeridas: ${missing.join(', ')}`);
          return;
        }

        // Load existing properties for merge detection
        const db = await initDB();
        const existingProperties = await db.getAll('properties');

        const parsed: PreviewRow[] = rows.map((row) => {
          const byKey = Object.fromEntries(
            Object.entries(row).map(([k, v]) => [normalizeHeader(k), v])
          );

          const refCatastral = String(byKey.referencia_catastral || '').trim();
          const direccion = String(byKey.direccion || '').trim();

          // Match logic: 1) ref catastral exact, 2) address contains
          let match: (typeof existingProperties)[number] | undefined;

          if (refCatastral) {
            const refNorm = refCatastral.toLowerCase();
            match = existingProperties.find(
              (p) => p.cadastralReference && p.cadastralReference.toLowerCase() === refNorm
            );
          }

          if (!match && direccion) {
            const dirNorm = normalizeForMatch(direccion);
            match = existingProperties.find((p) => {
              const pAddr = normalizeForMatch(p.address || '');
              return pAddr && (pAddr.includes(dirNorm) || dirNorm.includes(pAddr));
            });
          }

          return {
            alias: String(byKey.alias || '').trim(),
            codigo_postal: String(byKey.codigo_postal || '').trim(),
            direccion,
            referencia_catastral: refCatastral,
            fecha_compra: parseDate(byKey.fecha_compra),
            precio_compra: parseNumber(byKey.precio_compra),
            tipo_transmision: String(byKey.tipo_transmision || 'usada').trim().toLowerCase(),
            notaria: parseNumber(byKey.notaria),
            registro: parseNumber(byKey.registro),
            gestoria: parseNumber(byKey.gestoria),
            otros_gastos: parseNumber(byKey.otros_gastos),
            superficie_m2: parseNumber(byKey.superficie_m2),
            habitaciones: Number(byKey.habitaciones) || 0,
            banos: Number(byKey.banos) || 0,
            valor_catastral: parseNumber(byKey.valor_catastral),
            valor_catastral_construccion: parseNumber(byKey.valor_catastral_construccion),
            _accion: match ? 'completar' : 'crear',
            _matchId: match?.id as number | undefined,
            _matchAlias: match ? (match.alias || match.address) : undefined,
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
        (r) => r.alias && r.codigo_postal && r.fecha_compra && r.precio_compra > 0
      );

      if (!validRows.length) {
        toast.error('No hay filas validas para importar');
        return;
      }

      const db = await initDB();
      let nuevos = 0;
      let completados = 0;

      for (const row of validRows) {
        try {
          const regimen = row.tipo_transmision === 'nueva' ? 'obra-nueva' as const : 'usada' as const;

          if (row._accion === 'completar' && row._matchId != null) {
            // ── Merge: fill empty fields without overwriting ──
            const existing = await db.get('properties', row._matchId);
            if (!existing) continue;

            const updated = {
              ...existing,
              alias: existing.alias || row.alias,
              postalCode: existing.postalCode || row.codigo_postal,
              address: existing.address || row.direccion,
              cadastralReference: existing.cadastralReference || row.referencia_catastral || undefined,
              purchaseDate: existing.purchaseDate || row.fecha_compra,
              transmissionRegime: existing.transmissionRegime || regimen,
              squareMeters: existing.squareMeters || row.superficie_m2,
              bedrooms: existing.bedrooms || row.habitaciones,
              bathrooms: existing.bathrooms || row.banos,
              acquisitionCosts: {
                ...existing.acquisitionCosts,
                price: existing.acquisitionCosts?.price || row.precio_compra,
                notary: existing.acquisitionCosts?.notary || row.notaria || 0,
                registry: existing.acquisitionCosts?.registry || row.registro || 0,
                management: existing.acquisitionCosts?.management || row.gestoria || 0,
                psi: existing.acquisitionCosts?.psi || 0,
                realEstate: existing.acquisitionCosts?.realEstate || 0,
                other: existing.acquisitionCosts?.other?.length
                  ? existing.acquisitionCosts.other
                  : (row.otros_gastos > 0 ? [{ concept: 'Gastos importados', amount: row.otros_gastos }] : []),
              },
              fiscalData: {
                ...existing.fiscalData,
                cadastralValue: existing.fiscalData?.cadastralValue || row.valor_catastral || undefined,
                constructionCadastralValue: existing.fiscalData?.constructionCadastralValue || row.valor_catastral_construccion || undefined,
                constructionPercentage: existing.fiscalData?.constructionPercentage ||
                  (row.valor_catastral && row.valor_catastral_construccion
                    ? Math.round((row.valor_catastral_construccion / row.valor_catastral) * 10000) / 100
                    : undefined),
              },
            };

            await db.put('properties', updated);
            completados++;
          } else {
            // ── Create new property ──
            await db.add('properties', {
              alias: row.alias,
              address: row.direccion,
              postalCode: row.codigo_postal,
              province: '',
              municipality: '',
              ccaa: '',
              purchaseDate: row.fecha_compra,
              cadastralReference: row.referencia_catastral || undefined,
              squareMeters: row.superficie_m2 || 0,
              bedrooms: row.habitaciones || 0,
              bathrooms: row.banos || 0,
              transmissionRegime: regimen,
              state: 'activo' as const,
              notes: '',
              acquisitionCosts: {
                price: row.precio_compra,
                notary: row.notaria || 0,
                registry: row.registro || 0,
                management: row.gestoria || 0,
                psi: 0,
                realEstate: 0,
                other: row.otros_gastos > 0 ? [{ concept: 'Gastos importados', amount: row.otros_gastos }] : [],
              },
              fiscalData: row.valor_catastral ? {
                cadastralValue: row.valor_catastral,
                constructionCadastralValue: row.valor_catastral_construccion || undefined,
                constructionPercentage: row.valor_catastral && row.valor_catastral_construccion
                  ? Math.round((row.valor_catastral_construccion / row.valor_catastral) * 10000) / 100
                  : undefined,
              } : undefined,
              documents: [],
            });
            nuevos++;
          }
        } catch (rowErr) {
          console.error('Error importing row:', row.alias, rowErr);
        }
      }

      const parts: string[] = [];
      if (nuevos) parts.push(`${nuevos} inmuebles creados`);
      if (completados) parts.push(`${completados} completados`);
      toast.success(parts.join(' · ') || 'Importacion completada');

      setPreview(null);
      onComplete();
    } catch (err) {
      console.error('Error importing:', err);
      toast.error('Error al importar los inmuebles');
    } finally {
      setImporting(false);
    }
  };

  const totalCrear = preview?.filter((r) => r._accion === 'crear').length || 0;
  const totalCompletar = preview?.filter((r) => r._accion === 'completar').length || 0;

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
        Volver a Migracion de Datos
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: 'var(--atlas-v5-brand-wash)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Home size={20} strokeWidth={1.5} style={{ color: 'var(--atlas-blue)' }} aria-hidden="true" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--atlas-navy-1)' }}>
            Importar inmuebles
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-gray)' }}>
            Importa tu cartera de inmuebles desde Excel o completa los que ya existen
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
          Columnas obligatorias: alias, codigo_postal, fecha_compra, precio_compra, tipo_transmision.
          Opcionales: direccion, referencia_catastral, notaria, registro, gestoria, otros_gastos, superficie_m2, habitaciones, banos, valor_catastral, valor_catastral_construccion.
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
              backgroundColor: dragging ? 'var(--atlas-v5-brand-wash)' : 'var(--bg)',
              transition: 'border-color 0.2s, background-color 0.2s',
            }}
          >
            <Upload size={32} strokeWidth={1.5} style={{ color: dragging ? 'var(--atlas-blue)' : 'var(--text-gray)' }} aria-hidden="true" />
            <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 500, color: 'var(--atlas-navy-1)' }}>
              Arrastra tu archivo aqui o{' '}
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
              aria-label="Cancelar importacion"
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

          {/* Info banner */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              padding: '10px 12px',
              backgroundColor: 'var(--atlas-v5-brand-wash)',
              borderRadius: '8px',
              marginBottom: '12px',
            }}
          >
            <AlertCircle size={16} strokeWidth={1.5} style={{ color: 'var(--atlas-blue)', flexShrink: 0 }} aria-hidden="true" />
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--atlas-navy-1)' }}>
              {totalCompletar > 0
                ? `${totalCrear} nuevos y ${totalCompletar} existentes detectados (por ref. catastral o direccion). Los existentes se completaran sin machacar datos.`
                : 'Se crearan nuevos inmuebles en tu cartera. Si ya tienes inmuebles del XML, incluye la referencia catastral para completarlos.'}
            </p>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--hz-neutral-300)' }}>
                  {['Accion', 'Alias', 'Direccion', 'Fecha compra', 'Precio compra'].map((col) => (
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
                      backgroundColor: i % 2 === 0 ? 'var(--bg)' : 'var(--atlas-v5-card-alt)',
                    }}
                  >
                    <td style={{ padding: '8px 12px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: row._accion === 'completar'
                            ? 'var(--atlas-v5-pos-wash)'
                            : 'var(--atlas-v5-brand-wash)',
                          color: row._accion === 'completar'
                            ? 'var(--atlas-v5-pos)'
                            : 'var(--atlas-blue)',
                        }}
                      >
                        {row._accion === 'completar' ? 'completar' : 'crear'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--atlas-navy-1)' }}>
                      {row.alias}
                      {row._matchAlias && (
                        <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-gray)' }}>
                          → {row._matchAlias}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--atlas-navy-1)' }}>
                      {row.direccion || '-'}
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
                ... y {preview.length - PREVIEW_ROW_LIMIT} filas mas
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
                color: 'var(--atlas-v5-white)',
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
