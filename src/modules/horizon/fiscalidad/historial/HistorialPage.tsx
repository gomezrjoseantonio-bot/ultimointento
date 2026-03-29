import React, { useState, useEffect, useCallback } from 'react';
import {
  Download,
  Edit2,
  Eye,
  FileText,
  Upload,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import FiscalPageShell from '../components/FiscalPageShell';
import {
  resolverTodosLosEjercicios,
  formatFiscalValueShort,
} from '../../../../services/fiscalResolverService';
import type {
  DatosFiscalesEjercicio,
  EstadoEjercicioFiscal,
} from '../../../../services/fiscalResolverService';
import { initDB, downloadBlob, getDocumentBlob } from '../../../../services/db';
import ImportarDatosWizard from './ImportarDatosWizard';

// ── Styles ─────────────────────────────────────────────────
const monoStyle: React.CSSProperties = {
  fontFamily: 'IBM Plex Mono, monospace',
  fontVariantNumeric: 'tabular-nums',
};

const actionBtnStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  padding: 4,
  borderRadius: 6,
  color: 'var(--n-500)',
  minWidth: 32,
  minHeight: 32,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 150ms ease',
};

const ESTADO_BADGE: Record<EstadoEjercicioFiscal, { label: string; bg: string; color: string }> = {
  declarado: { label: 'Declarado', bg: 'var(--s-pos-bg)', color: 'var(--s-pos)' },
  pendiente: { label: 'Pendiente', bg: 'var(--s-warn-bg)', color: 'var(--s-warn)' },
  en_curso: { label: 'En curso', bg: '#E6F7FA', color: 'var(--teal)' },
};

function fuenteLabel(fuente: string): string {
  switch (fuente) {
    case 'pdf_aeat': return 'PDF AEAT';
    case 'xml_aeat': return 'XML AEAT';
    case 'atlas': return 'ATLAS';
    default: return 'Sin datos';
  }
}

// ── Mini Bar Chart ─────────────────────────────────────────
const MiniBarChart: React.FC<{ rows: DatosFiscalesEjercicio[] }> = ({ rows }) => {
  const withData = rows.filter((r) => r.resultado !== null).sort((a, b) => a.año - b.año);
  if (withData.length < 2) return null;

  const maxAbs = Math.max(...withData.map((r) => Math.abs(r.resultado!)), 1);
  const barW = Math.max(24, Math.min(48, 300 / withData.length));
  const chartH = 80;
  const midY = chartH / 2;

  return (
    <div style={{
      border: '1px solid var(--n-200)',
      borderRadius: 'var(--r-lg, 12px)',
      padding: '16px 20px 8px',
      background: 'var(--white)',
      marginBottom: 8,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 6,
        height: chartH,
        position: 'relative',
      }}>
        {/* Zero line */}
        <div style={{
          position: 'absolute',
          left: 0, right: 0,
          top: midY,
          height: 1,
          background: 'var(--n-200)',
        }} />

        {withData.map((row) => {
          const val = row.resultado!;
          const pct = (Math.abs(val) / maxAbs) * (midY - 4);
          const isPagar = val >= 0;

          return (
            <div
              key={row.año}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: barW,
                height: chartH,
                position: 'relative',
                cursor: 'pointer',
              }}
              title={`${row.año}: ${val >= 0 ? '+' : ''}${val.toLocaleString('es-ES')} €`}
            >
              {/* Bar */}
              <div style={{
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                width: Math.max(12, barW - 8),
                borderRadius: 3,
                background: isPagar ? 'var(--blue)' : 'var(--teal)',
                ...(isPagar
                  ? { bottom: midY + 1, height: Math.max(2, pct) }
                  : { top: midY + 1, height: Math.max(2, pct) }
                ),
                transition: 'height 300ms ease',
              }} />
            </div>
          );
        })}
      </div>
      {/* Year labels */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 6,
        marginTop: 4,
      }}>
        {withData.map((row) => (
          <span key={row.año} style={{
            width: barW,
            textAlign: 'center',
            fontSize: 10,
            color: 'var(--n-500)',
            fontFamily: 'IBM Plex Mono, monospace',
          }}>
            {String(row.año).slice(-2)}
          </span>
        ))}
      </div>
    </div>
  );
};

// ── Component ──────────────────────────────────────────────
const HistorialPage: React.FC = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<DatosFiscalesEjercicio[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdfYears, setPdfYears] = useState<Set<number>>(new Set());
  const [showImportWizard, setShowImportWizard] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await resolverTodosLosEjercicios();
      setRows(data);

      // Check PDFs
      const db = await initDB();
      const allDocs = await db.getAll('documents');
      const years = new Set(
        (allDocs as Array<{ type?: string; metadata?: { ejercicio?: number } }>)
          .filter((d) => d.type === 'declaracion_irpf' && typeof d.metadata?.ejercicio === 'number')
          .map((d) => d.metadata!.ejercicio as number),
      );
      setPdfYears(years);
    } catch (e) {
      console.error('Error loading historial:', e);
      toast.error('Error cargando el historial fiscal');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDownloadPDF = useCallback(async (año: number) => {
    try {
      const db = await initDB();
      const docs = await db.getAll('documents');
      const doc = (docs as Array<{ id?: number; type?: string; filename?: string; metadata?: { ejercicio?: number } }>)
        .find((d) => d.type === 'declaracion_irpf' && d.metadata?.ejercicio === año);
      if (!doc?.id) { toast.error('PDF no encontrado'); return; }
      const blob = await getDocumentBlob(doc.id);
      if (!blob) { toast.error('PDF no encontrado'); return; }
      downloadBlob(blob, doc.filename || `Declaracion_IRPF_${año}.pdf`);
    } catch {
      toast.error('Error al descargar la declaración');
    }
  }, []);

  return (
    <FiscalPageShell>
      <div style={{ display: 'grid', gap: 'var(--s6, 24px)', fontFamily: 'var(--font-base, IBM Plex Sans, sans-serif)' }}>
        {/* ── Header ── */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 'var(--t-lg, 1.25rem)', fontWeight: 600, color: 'var(--n-900)' }}>
              Historial
            </h2>
            <p style={{ margin: '4px 0 0', color: 'var(--n-500)', fontSize: 'var(--t-xs, 12px)' }}>
              Evolución anual y archivo de declaraciones
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowImportWizard(true)}
            style={{
              padding: '10px 16px', borderRadius: 'var(--r-md, 8px)',
              border: '1px solid var(--n-300)', background: 'var(--white)',
              color: 'var(--n-900)', fontWeight: 500, fontSize: 'var(--t-sm, 13px)',
              cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', gap: 8,
              fontFamily: 'var(--font-base, IBM Plex Sans, sans-serif)',
              transition: 'all 150ms ease',
            }}
          >
            <FileText size={16} />
            Importar
          </button>
        </header>

        {/* ── Content ── */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              border: '2px solid var(--blue)', borderTopColor: 'transparent',
              animation: 'spin 0.8s linear infinite',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <>
            {/* ── Mini bar chart ── */}
            <MiniBarChart rows={rows} />

            {/* ── Table ── */}
            <div style={{
              border: '1px solid var(--n-200)',
              borderRadius: 'var(--r-lg, 12px)',
              overflow: 'auto',
              background: 'var(--white)',
            }}>
              {/* Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '70px 110px 90px 1fr 100px',
                columnGap: 8,
                padding: '10px 16px',
                background: 'var(--n-100)',
                borderBottom: '1px solid var(--n-200)',
                fontSize: 'var(--t-xs, 11px)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--n-500)',
                minWidth: 500,
              }}>
                <span>Año</span>
                <span>Estado</span>
                <span>Fuente</span>
                <span style={{ textAlign: 'right' }}>Resultado</span>
                <span style={{ textAlign: 'right' }}>Acciones</span>
              </div>

              {/* Rows */}
              {rows.map((row) => {
                const badge = ESTADO_BADGE[row.estado];
                const hasData = row.resultado !== null;
                const hasPDF = pdfYears.has(row.año);

                // Result color: navy (blue) for pagar, teal for devolver
                const resultColor = hasData
                  ? (row.resultado! > 0 ? 'var(--blue)' : row.resultado! < 0 ? 'var(--teal)' : 'var(--n-500)')
                  : 'var(--n-500)';

                return (
                  <div
                    key={row.año}
                    onClick={() => navigate(`/fiscalidad/mi-irpf?ejercicio=${row.año}`)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '70px 110px 90px 1fr 100px',
                      columnGap: 8,
                      padding: '10px 16px',
                      alignItems: 'center',
                      borderBottom: '1px solid var(--n-100)',
                      fontSize: 'var(--t-sm, 13px)',
                      minWidth: 500,
                      cursor: 'pointer',
                      transition: 'background 150ms ease',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--n-50)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = ''; }}
                  >
                    {/* Año */}
                    <span style={{ fontWeight: 600, color: 'var(--n-700)' }}>{row.año}</span>

                    {/* Estado */}
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', padding: '3px 10px',
                      borderRadius: 999, fontSize: 'var(--t-xs, 11px)', fontWeight: 600,
                      background: badge.bg, color: badge.color, whiteSpace: 'nowrap', width: 'fit-content',
                    }}>
                      {badge.label}
                    </span>

                    {/* Fuente */}
                    <span style={{ color: 'var(--n-500)', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {fuenteLabel(row.fuente)}
                    </span>

                    {/* Resultado */}
                    <span style={{
                      textAlign: 'right', ...monoStyle, fontWeight: 500, color: resultColor,
                    }}>
                      {hasData ? formatFiscalValueShort(row.resultado) : '—'}
                    </span>

                    {/* Acciones */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}
                      onClick={(e) => e.stopPropagation()}>
                      <button type="button" title="Ver declaración"
                        onClick={() => navigate(`/fiscalidad/mi-irpf?ejercicio=${row.año}`)}
                        style={actionBtnStyle}>
                        <Eye size={16} />
                      </button>

                      {hasPDF ? (
                        <button type="button" title="Descargar PDF"
                          onClick={() => handleDownloadPDF(row.año)}
                          style={actionBtnStyle}>
                          <Download size={16} />
                        </button>
                      ) : (
                        <button type="button" title="Importar declaración"
                          onClick={() => setShowImportWizard(true)}
                          style={actionBtnStyle}>
                          <Upload size={16} />
                        </button>
                      )}

                      <button type="button" title="Completar / editar"
                        onClick={() => toast('Completar manualmente estará disponible próximamente.')}
                        style={actionBtnStyle}>
                        <Edit2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {showImportWizard && (
        <ImportarDatosWizard
          onClose={() => setShowImportWizard(false)}
          onImported={loadData}
        />
      )}
    </FiscalPageShell>
  );
};

export default HistorialPage;
