// src/components/valoraciones/ImportValoracionesWizard.tsx
// T-VALORACIONES PR3 · wizard embebido para importar histórico de
// valoraciones de UN único activo desde su ficha detalle.
//
// Diferente al wizard genérico de menú (`src/modules/inmuebles/import/
// ImportarValoraciones.tsx`) · aquí el `activoId` y `tipoActivo` vienen
// pre-rellenados desde la ficha · no hay selector de tipo ni matching
// por nombre. Acepta CSV/Excel de 2 columnas (fecha + valor).
//
// Escribe directamente al store nuevo `valoracionesActivos` vía
// `bulkInsert` del valoracionesService v2 (no usa la API legacy
// importarHistorico).
//
// Contrato de callbacks (review Copilot):
// - `onClose()` · cierre manual (botón X · click overlay · botón
//   "Volver"). El wizard NO se cierra solo · el parent es quien
//   pone `setShowWizard(false)`.
// - `onSuccess(count)` · tras importar correctamente. El parent
//   decide qué hacer (típicamente cerrar y refrescar la ficha). El
//   wizard NO llama a `onClose` después de `onSuccess` · evita
//   doble cierre.

import React, { useCallback, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { bulkInsert } from '../../services/valoracionesService';
import type {
  TipoActivoValoracion,
  SubtipoInversion,
  ValoracionInput,
} from '../../types/valoracionActivo';
import {
  detectColumns,
  detectDelimiter,
  parseRow,
  type ParsedImportRow,
} from './importParsers';

export interface ImportValoracionesWizardProps {
  /** activoId pre-rellenado · todas las filas se importarán a este activo. */
  activoId: string;
  /** Tipo del activo (inmueble | inversion | plan_pensiones | deposito | otro). */
  tipoActivo: TipoActivoValoracion;
  /** Solo válido cuando `tipoActivo === 'inversion'`. */
  subtipoInversion?: SubtipoInversion;
  /** Etiqueta visible para el activo en el header del wizard. */
  activoNombre?: string;
  /** Callback al cerrar (sin importar · cancel/X/overlay). El parent gestiona el cierre. */
  onClose: () => void;
  /** Callback tras importar correctamente · parent decide cierre + refresh. */
  onSuccess: (count: number) => void;
}

const PREVIEW_LIMIT = 12;

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const ImportValoracionesWizard: React.FC<ImportValoracionesWizardProps> = ({
  activoId,
  tipoActivo,
  subtipoInversion,
  activoNombre,
  onClose,
  onSuccess,
}) => {
  const [rows, setRows] = useState<ParsedImportRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseFile = useCallback((file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error('Formato no válido · usa .xlsx, .xls o .csv');
      return;
    }
    const isCsv = file.name.toLowerCase().endsWith('.csv');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        // Para CSV · detectar delimitador y pasarlo a XLSX (review Copilot ·
        // CSVs europeos con `;` no se parseaban correctamente con el default).
        const csvOpts = isCsv
          ? { type: 'string' as const, FS: detectDelimiter(String(data)) }
          : { type: 'array' as const };
        const workbook = XLSX.read(data, csvOpts);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const raw: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        if (!raw.length) {
          toast.error('El archivo está vacío');
          return;
        }
        const headers = Object.keys(raw[0]);
        if (headers.length < 2) {
          toast.error('Se esperan al menos 2 columnas · fecha y valor');
          return;
        }
        const { fechaCol, valorCol } = detectColumns(headers);
        const parsed = raw.map((r) => parseRow(r[fechaCol], r[valorCol]));
        setRows(parsed);
      } catch (err) {
        console.error('[ImportValoracionesWizard] parse error:', err);
        toast.error('Error al leer el archivo');
      }
    };
    if (isCsv) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) parseFile(file);
    },
    [parseFile],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
    e.target.value = '';
  };

  const validRows = rows?.filter((r) => !r.invalid) ?? [];
  const invalidRows = rows?.filter((r) => r.invalid) ?? [];

  const handleImportar = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    try {
      const inputs: ValoracionInput[] = validRows.map((r) => ({
        activoId,
        tipoActivo,
        subtipoInversion: tipoActivo === 'inversion' ? subtipoInversion : undefined,
        fecha: r.fecha,
        valor: r.valor,
        origen: 'import_csv',
        notas: `Importado desde ficha · activo "${activoNombre ?? activoId}"`,
      }));
      const ids = await bulkInsert(inputs);
      toast.success(`${ids.length} valoración${ids.length === 1 ? '' : 'es'} importada${ids.length === 1 ? '' : 's'}`);
      // Solo onSuccess · el parent gestiona el cierre (review Copilot ·
      // evita doble cierre cuando el parent ya hace setShowWizard(false)).
      onSuccess(ids.length);
    } catch (err) {
      console.error('[ImportValoracionesWizard] import error:', err);
      toast.error('Error al importar las valoraciones');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Importar histórico de valoraciones"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-inter)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(720px, 92vw)',
          maxHeight: '92vh',
          overflow: 'auto',
          backgroundColor: 'var(--atlas-v5-white, #fff)',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--atlas-navy-1)' }}>
              Importar histórico
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--text-gray)' }}>
              {activoNombre ? `Activo: ${activoNombre} · ` : ''}Tipo: {tipoActivo}
              {subtipoInversion ? ` · ${subtipoInversion}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-gray)',
              padding: '4px',
            }}
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {!rows && (
          <>
            <p style={{ margin: '0 0 12px', fontSize: '0.875rem', color: 'var(--text-gray)' }}>
              Sube un archivo <strong>.xlsx</strong>, <strong>.xls</strong> o <strong>.csv</strong> con 2 columnas:
              <code style={{ padding: '0 4px', backgroundColor: 'var(--atlas-v5-card-alt)', borderRadius: '3px', marginLeft: '4px' }}>fecha</code> y
              <code style={{ padding: '0 4px', backgroundColor: 'var(--atlas-v5-card-alt)', borderRadius: '3px', marginLeft: '4px' }}>valor</code>.
              Fecha acepta YYYY-MM-DD, YYYY-MM o DD/MM/YYYY · CSV admite separador <code>,</code> o <code>;</code>.
            </p>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
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
                backgroundColor: dragging ? 'var(--atlas-v5-brand-wash)' : 'var(--bg, #f9fafb)',
                transition: 'border-color 0.2s, background-color 0.2s',
              }}
            >
              <Upload size={32} strokeWidth={1.5} style={{ color: dragging ? 'var(--atlas-blue)' : 'var(--text-gray)' }} />
              <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 500, color: 'var(--atlas-navy-1)' }}>
                Arrastra el archivo aquí o haz clic para seleccionar
              </p>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-gray)' }}>
                Formatos admitidos: .xlsx, .xls, .csv
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              aria-hidden="true"
            />
          </>
        )}

        {rows && (
          <>
            {/* Resumen */}
            <div
              style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '12px',
              }}
            >
              <div
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--atlas-v5-brand-wash, #eef2ff)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <CheckCircle2 size={16} strokeWidth={1.5} style={{ color: 'var(--atlas-blue)' }} />
                <div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-gray)' }}>Importables</div>
                  <div style={{ fontWeight: 600, color: 'var(--atlas-navy-1)' }}>{validRows.length}</div>
                </div>
              </div>
              {invalidRows.length > 0 && (
                <div
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--s-warn-bg, #fef3c7)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertCircle size={16} strokeWidth={1.5} style={{ color: 'var(--s-warn, #b45309)' }} />
                  <div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-gray)' }}>Filas inválidas</div>
                    <div style={{ fontWeight: 600, color: 'var(--atlas-navy-1)' }}>{invalidRows.length}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Tabla preview */}
            <div style={{ maxHeight: '320px', overflowY: 'auto', marginBottom: '16px', border: '1px solid var(--hz-neutral-300, #e5e7eb)', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--atlas-v5-card-alt, #f9fafb)' }}>
                  <tr>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-gray)' }}>Fecha</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-gray)' }}>Valor</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-gray)' }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, PREVIEW_LIMIT).map((r, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--hz-neutral-300, #e5e7eb)' }}>
                      <td style={{ padding: '6px 12px', fontVariantNumeric: 'tabular-nums' }}>
                        {r.invalid === 'fecha' ? (
                          <span style={{ color: 'var(--s-warn, #b45309)' }}>{String(r.raw.fechaRaw)} ✗</span>
                        ) : (
                          r.fecha
                        )}
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {r.invalid === 'valor' ? (
                          <span style={{ color: 'var(--s-warn, #b45309)' }}>{String(r.raw.valorRaw)} ✗</span>
                        ) : (
                          formatCurrency(r.valor)
                        )}
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        {r.invalid ? (
                          <span style={{ color: 'var(--s-warn, #b45309)' }}>Inválido</span>
                        ) : (
                          <span style={{ color: 'var(--ok, #059669)' }}>OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > PREVIEW_LIMIT && (
                <p style={{ padding: '8px 12px', margin: 0, fontSize: '0.75rem', color: 'var(--text-gray)' }}>
                  ... y {rows.length - PREVIEW_LIMIT} filas más
                </p>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setRows(null)}
                style={{
                  padding: '8px 16px',
                  border: '1px solid var(--hz-neutral-300, #e5e7eb)',
                  borderRadius: '6px',
                  backgroundColor: 'transparent',
                  color: 'var(--text-gray)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-inter)',
                  fontSize: '0.875rem',
                }}
              >
                Volver
              </button>
              <button
                onClick={() => void handleImportar()}
                disabled={importing || validRows.length === 0}
                style={{
                  padding: '8px 20px',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor:
                    importing || validRows.length === 0 ? 'var(--hz-neutral-300, #d1d5db)' : 'var(--atlas-blue)',
                  color: 'var(--atlas-v5-white, #fff)',
                  cursor: importing || validRows.length === 0 ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-inter)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                }}
              >
                {importing ? 'Importando...' : `Importar ${validRows.length} valoración${validRows.length === 1 ? '' : 'es'}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ImportValoracionesWizard;
