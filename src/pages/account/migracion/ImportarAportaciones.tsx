import React, { useCallback, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Check, Download, TrendingUp, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  AportacionesImportPreview,
  AportacionImportPreviewRow,
  BusquedaPosicionResult,
  FilaCorregida,
  buscarPosicionPorNombre,
  descargarPlantillaImportacionAportaciones,
  importarAportacionesHistoricasMasivas,
  importarFilasCorregidas,
  previsualizarImportacionAportaciones,
} from '../../../services/inversionesAportacionesImportService';

interface ImportarAportacionesProps {
  onComplete: () => void;
  onBack: () => void;
}

const PREVIEW_ROW_LIMIT = 12;

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);

// Per-row override state for inline editing
interface RowOverride {
  posicionNombre: string;
  entidad: string;
  status: 'editing' | 'verified' | 'not_found';
  match?: BusquedaPosicionResult;
}

const ImportarAportaciones: React.FC<ImportarAportacionesProps> = ({ onComplete, onBack }) => {
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<AportacionesImportPreview | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewPage, setPreviewPage] = useState(1);
  const [rowOverrides, setRowOverrides] = useState<Record<number, RowOverride>>({});
  const [verifying, setVerifying] = useState<Record<number, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalPreviewPages = preview ? Math.max(1, Math.ceil(preview.rows.length / PREVIEW_ROW_LIMIT)) : 1;
  const paginatedRows = preview
    ? preview.rows.slice((previewPage - 1) * PREVIEW_ROW_LIMIT, previewPage * PREVIEW_ROW_LIMIT)
    : [];

  const verifiedCount = Object.values(rowOverrides).filter((v) => v.status === 'verified').length;
  const totalToImport = (preview?.totalValidas ?? 0) + verifiedCount;

  const runPreview = useCallback(async (file: File) => {
    setImporting(true);
    try {
      const data = await previsualizarImportacionAportaciones(file);
      setPreview(data);
      setSelectedFile(file);
      setPreviewPage(1);

      // Initialize inline-edit state for each error row
      const initialOverrides: Record<number, RowOverride> = {};
      data.rows
        .filter((r) => r.estado === 'error')
        .forEach((r) => {
          initialOverrides[r.fila] = {
            posicionNombre: r.posicionNombre,
            entidad: r.entidad,
            status: 'editing',
          };
        });
      setRowOverrides(initialOverrides);

      if (data.totalValidas === 0 && data.totalConError === 0) {
        toast('No hay aportaciones válidas para importar.', { icon: 'ℹ️' });
      }
    } catch (error) {
      console.error('Error previewing aportaciones:', error);
      toast.error('Error al leer el archivo de aportaciones');
    } finally {
      setImporting(false);
    }
  }, []);

  const handleVerifyRow = useCallback(async (row: AportacionImportPreviewRow) => {
    const override = rowOverrides[row.fila];
    if (!override) return;

    setVerifying((v) => ({ ...v, [row.fila]: true }));
    try {
      const result = await buscarPosicionPorNombre(override.posicionNombre, override.entidad);
      setRowOverrides((prev) => ({
        ...prev,
        [row.fila]: {
          ...prev[row.fila],
          status: result ? 'verified' : 'not_found',
          match: result ?? undefined,
        },
      }));
      if (!result) toast(`No se encontró "${override.posicionNombre}" (${override.entidad})`, { icon: '⚠️' });
    } catch {
      toast.error('Error al verificar la posición');
    } finally {
      setVerifying((v) => ({ ...v, [row.fila]: false }));
    }
  }, [rowOverrides]);

  const handleImport = useCallback(async () => {
    if (!selectedFile) return;
    setImporting(true);
    try {
      // 1. Import valid rows from file
      const result = await importarAportacionesHistoricasMasivas(selectedFile);

      // 2. Import inline-corrected rows
      const correctedPayload: FilaCorregida[] = [];
      if (preview) {
        preview.rows
          .filter((r) => r.estado === 'error' && rowOverrides[r.fila]?.status === 'verified')
          .forEach((r) => {
            const override = rowOverrides[r.fila]!;
            correctedPayload.push({
              fecha: r.fecha,
              importe: r.importe,
              notas: r.notas,
              targetKind: override.match!.kind,
              targetId: override.match!.id,
              importeEmpresa: r.importeEmpresa,
              importeIndividuo: r.importeIndividuo,
            });
          });
      }

      let correctedImported = 0;
      if (correctedPayload.length > 0) {
        const correctedResult = await importarFilasCorregidas(correctedPayload);
        correctedImported = correctedResult.imported;
        if (correctedResult.errors.length > 0) {
          toast(correctedResult.errors[0], { icon: '⚠️' });
        }
      }

      const totalImported = result.imported + correctedImported;

      if (totalImported > 0) {
        toast.success(`Importadas ${totalImported} aportaciones históricas.`);
      }
      if (result.errors.length > 0 && correctedImported === 0) {
        toast(result.errors[0], { icon: '⚠️' });
      }
      if (totalImported === 0 && result.errors.length === 0) {
        toast('No se detectaron filas para importar.', { icon: 'ℹ️' });
      }

      if (totalImported > 0) {
        setPreview(null);
        setSelectedFile(null);
        setPreviewPage(1);
        setRowOverrides({});
        onComplete();
      }
    } catch (error) {
      console.error('Error importing aportaciones:', error);
      toast.error('Error al importar aportaciones históricas');
    } finally {
      setImporting(false);
    }
  }, [onComplete, preview, rowOverrides, selectedFile]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) runPreview(file);
  }, [runPreview]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) runPreview(file);
    event.target.value = '';
  };

  const renderErrorRow = (row: AportacionImportPreviewRow, index: number) => {
    const override = rowOverrides[row.fila];
    if (!override) return null;

    const isVerified = override.status === 'verified';
    const isNotFound = override.status === 'not_found';
    const isVerifying = verifying[row.fila] ?? false;

    return (
      <tr
        key={`${row.fila}-${index}`}
        style={{
          borderBottom: '1px solid var(--hz-neutral-300)',
          backgroundColor: isVerified ? 'color-mix(in srgb, var(--ok, #22c55e) 8%, white)' : '#fff9f9',
        }}
      >
        <td style={{ padding: '8px 12px', fontSize: '0.8125rem' }}>{row.fila}</td>
        <td style={{ padding: '8px 12px', fontSize: '0.8125rem' }}>{row.fecha}</td>
        <td style={{ padding: '6px 8px' }}>
          {isVerified ? (
            <span style={{ fontSize: '0.8125rem', color: 'var(--atlas-navy-1)' }}>{override.match!.nombre}</span>
          ) : (
            <input
              value={override.posicionNombre}
              onChange={(e) =>
                setRowOverrides((prev) => ({
                  ...prev,
                  [row.fila]: { ...prev[row.fila], posicionNombre: e.target.value, status: 'editing', match: undefined },
                }))
              }
              placeholder="Nombre de la posición"
              style={{
                width: '100%',
                padding: '5px 8px',
                border: `1px solid ${isNotFound ? 'var(--error, #ef4444)' : 'var(--hz-neutral-300)'}`,
                borderRadius: 6,
                fontSize: '0.8125rem',
                fontFamily: 'inherit',
              }}
            />
          )}
        </td>
        <td style={{ padding: '6px 8px' }}>
          {isVerified ? (
            <span style={{ fontSize: '0.8125rem', color: 'var(--atlas-navy-1)' }}>{override.match!.entidad}</span>
          ) : (
            <input
              value={override.entidad}
              onChange={(e) =>
                setRowOverrides((prev) => ({
                  ...prev,
                  [row.fila]: { ...prev[row.fila], entidad: e.target.value, status: 'editing', match: undefined },
                }))
              }
              placeholder="Entidad"
              style={{
                width: '100%',
                padding: '5px 8px',
                border: `1px solid ${isNotFound ? 'var(--error, #ef4444)' : 'var(--hz-neutral-300)'}`,
                borderRadius: 6,
                fontSize: '0.8125rem',
                fontFamily: 'inherit',
              }}
            />
          )}
        </td>
        <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '0.8125rem' }}>{formatCurrency(row.importe)}</td>
        <td style={{ padding: '8px 12px' }}>
          {isVerified ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--ok, #16a34a)', fontSize: '0.8125rem', fontWeight: 500 }}>
              <Check size={13} />
              Corregida
            </span>
          ) : (
            <button
              onClick={() => handleVerifyRow(row)}
              disabled={isVerifying || !override.posicionNombre.trim()}
              style={{
                padding: '4px 10px',
                border: '1px solid var(--atlas-blue)',
                borderRadius: 6,
                background: 'transparent',
                color: 'var(--atlas-blue)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: isVerifying || !override.posicionNombre.trim() ? 'not-allowed' : 'pointer',
                opacity: !override.posicionNombre.trim() ? 0.5 : 1,
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
            >
              {isVerifying ? 'Buscando…' : isNotFound ? 'Reintentar' : 'Verificar'}
            </button>
          )}
        </td>
      </tr>
    );
  };

  const renderValidRow = (row: AportacionImportPreviewRow, index: number) => (
    <tr
      key={`${row.fila}-${index}`}
      style={{
        borderBottom: '1px solid var(--hz-neutral-300)',
        backgroundColor: index % 2 === 0 ? 'var(--bg)' : 'var(--atlas-blue-light, #f9fafb)',
      }}
    >
      <td style={{ padding: '8px 12px', fontSize: '0.8125rem' }}>{row.fila}</td>
      <td style={{ padding: '8px 12px', fontSize: '0.8125rem' }}>{row.fecha}</td>
      <td style={{ padding: '8px 12px', fontSize: '0.8125rem' }}>{row.posicionNombre || row.posicionId}</td>
      <td style={{ padding: '8px 12px', fontSize: '0.8125rem' }}>{row.entidad}</td>
      <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '0.8125rem' }}>{formatCurrency(row.importe)}</td>
      <td style={{ padding: '8px 12px', color: 'var(--ok, #16a34a)', fontSize: '0.8125rem' }}>Lista para importar</td>
    </tr>
  );

  // Header columns differ: error rows have editable Posición + Entidad (separate), valid rows collapse them
  const hasErrorRows = preview ? preview.rows.some((r) => r.estado === 'error') : false;
  const tableHeaders = hasErrorRows
    ? ['Fila', 'Fecha', 'Posición', 'Entidad', 'Importe', 'Estado']
    : ['Fila', 'Fecha', 'Posición', 'Entidad', 'Importe', 'Estado'];

  return (
    <div style={{ fontFamily: 'var(--font-inter)' }}>
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
          padding: 0,
          marginBottom: '20px',
          fontFamily: 'var(--font-inter)',
        }}
      >
        <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" />
        Volver a Migración de Datos
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: 'var(--n-100)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <TrendingUp size={20} strokeWidth={1.5} style={{ color: 'var(--atlas-blue)' }} aria-hidden="true" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--atlas-navy-1)' }}>
            Importar aportaciones históricas
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-gray)' }}>
            Migra aportaciones previas para cualquier posición financiera desde Excel.
          </p>
        </div>
      </div>

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
          Incluye fecha e importe. Para plan de pensiones/empleo puedes usar importe_empresa y/o importe_individuo.
        </p>
        <button
          onClick={descargarPlantillaImportacionAportaciones}
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
            2. Sube tu archivo de migración
          </h3>
          <div
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => !importing && fileInputRef.current?.click()}
            role="button"
            aria-label="Subir archivo Excel de aportaciones"
            tabIndex={0}
            onKeyDown={(event) => event.key === 'Enter' && !importing && fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? 'var(--atlas-blue)' : 'var(--hz-neutral-300)'}`,
              borderRadius: '10px',
              padding: '40px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              cursor: importing ? 'wait' : 'pointer',
              backgroundColor: dragging ? 'var(--n-100)' : 'var(--bg)',
              transition: 'all 150ms ease',
            }}
          >
            <Upload size={24} strokeWidth={1.5} style={{ color: 'var(--atlas-blue)' }} aria-hidden="true" />
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--atlas-navy-1)', fontWeight: 500 }}>
              {importing ? 'Analizando Excel…' : 'Arrastra tu Excel aquí o haz clic para seleccionar'}
            </p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-gray)' }}>
              Formatos soportados: .xlsx, .xls
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>
      )}

      {preview && (
        <div
          style={{
            border: '1px solid var(--hz-neutral-300)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--atlas-navy-1)' }}>
              3. Vista previa ({preview.totalAportacionesDetectadas} aportaciones detectadas)
            </h3>
            <button
              onClick={() => {
                setPreview(null);
                setSelectedFile(null);
                setPreviewPage(1);
                setRowOverrides({});
              }}
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
              Detectadas {preview.totalValidas} válidas
              {preview.totalConError > 0 && ` y ${preview.totalConError} con error`}
              {verifiedCount > 0 && ` · ${verifiedCount} corregidas inline`}.
              {preview.totalConError > 0 && verifiedCount < preview.totalConError && (
                <> Edita los campos marcados en rojo y pulsa <strong>Verificar</strong> para incluirlas.</>
              )}
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--hz-neutral-300)' }}>
                  {tableHeaders.map((col) => (
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
                {paginatedRows.map((row, index) =>
                  row.estado === 'error'
                    ? renderErrorRow(row, index)
                    : renderValidRow(row, index)
                )}
              </tbody>
            </table>
            {preview.rows.length > PREVIEW_ROW_LIMIT && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  gap: '8px',
                }}
              >
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-gray)' }}>
                  Página {previewPage} de {totalPreviewPages} ({preview.rows.length} filas)
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                    disabled={previewPage === 1}
                    style={{
                      padding: '6px 10px',
                      border: '1px solid var(--hz-neutral-300)',
                      borderRadius: '6px',
                      background: 'var(--bg)',
                      color: 'var(--atlas-navy-1)',
                      cursor: previewPage === 1 ? 'not-allowed' : 'pointer',
                      fontSize: '0.75rem',
                    }}
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewPage((p) => Math.min(totalPreviewPages, p + 1))}
                    disabled={previewPage === totalPreviewPages}
                    style={{
                      padding: '6px 10px',
                      border: '1px solid var(--hz-neutral-300)',
                      borderRadius: '6px',
                      background: 'var(--bg)',
                      color: 'var(--atlas-navy-1)',
                      cursor: previewPage === totalPreviewPages ? 'not-allowed' : 'pointer',
                      fontSize: '0.75rem',
                    }}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button
              onClick={handleImport}
              disabled={importing || totalToImport === 0}
              style={{
                padding: '10px 24px',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: importing || totalToImport === 0 ? 'var(--hz-neutral-300)' : 'var(--atlas-blue)',
                color: '#fff',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: importing || totalToImport === 0 ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-inter)',
              }}
            >
              {importing ? 'Importando...' : `Importar ${totalToImport} aportaciones`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportarAportaciones;
