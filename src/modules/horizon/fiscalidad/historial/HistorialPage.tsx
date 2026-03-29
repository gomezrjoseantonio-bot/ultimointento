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
  getTodosLosEjercicios,
  getDeclaracion,
} from '../../../../services/ejercicioResolverService';
import type { EjercicioFiscalCoord, ResumenFiscal } from '../../../../services/ejercicioResolverService';
import { initDB, downloadBlob, getDocumentBlob } from '../../../../services/db';
import ImportarDatosWizard from './ImportarDatosWizard';

// ── Constants ──────────────────────────────────────────────
const CURRENT_YEAR = new Date().getFullYear();

// ── Formatters ─────────────────────────────────────────────
const fmtMoney = (n: number) =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(n)) + ' €';

// ── Types ──────────────────────────────────────────────────
type EstadoFiscal = 'declarado' | 'pendiente' | 'en_curso';
type FuenteDatos = 'PDF AEAT' | 'ATLAS' | 'Manual' | 'Parcial' | 'Sin datos';

interface HistorialRow {
  año: number;
  estado: EstadoFiscal;
  fuente: FuenteDatos;
  resumen: ResumenFiscal | null;
  hasPDF: boolean;
}

// ── Estado / Fuente logic ──────────────────────────────────
function getEstadoFiscal(year: number, _rawEstado: EjercicioFiscalCoord['estado']): EstadoFiscal {
  const hoy = new Date();
  const añoActual = hoy.getFullYear();

  if (year === añoActual) return 'en_curso';

  if (year === añoActual - 1) {
    const finCampaña = new Date(añoActual, 5, 30); // 30 de junio
    return hoy <= finCampaña ? 'pendiente' : 'declarado';
  }

  return 'declarado';
}

function mapFuente(resolverFuente: string, hasPDF: boolean): FuenteDatos {
  if (hasPDF || resolverFuente === 'aeat') return 'PDF AEAT';
  if (resolverFuente === 'atlas') return 'ATLAS';
  if (resolverFuente === 'manual') return 'Manual';
  if (resolverFuente === 'ninguno') return 'Sin datos';
  return 'Parcial';
}

const ESTADO_BADGE: Record<EstadoFiscal, { label: string; bg: string; color: string }> = {
  declarado: { label: 'Declarado', bg: 'var(--s-pos-bg)', color: 'var(--s-pos)' },
  pendiente: { label: 'Pendiente', bg: 'var(--s-warn-bg)', color: 'var(--s-warn)' },
  en_curso: { label: 'En curso', bg: '#E6F7FA', color: 'var(--teal)' },
};

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

// ── Component ──────────────────────────────────────────────
const HistorialPage: React.FC = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<HistorialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImportWizard, setShowImportWizard] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const ejercicios = await getTodosLosEjercicios();
      const validEjercicios = ejercicios.filter((ej) => ej.año <= CURRENT_YEAR && ej.año >= 2015);

      // Check which years have PDFs
      const db = await initDB();
      const allDocs = await db.getAll('documents');
      const pdfYears = new Set(
        (allDocs as Array<{ type?: string; metadata?: { ejercicio?: number } }>)
          .filter((d) => d.type === 'declaracion_irpf' && typeof d.metadata?.ejercicio === 'number')
          .map((d) => d.metadata!.ejercicio as number),
      );

      const histRows: HistorialRow[] = await Promise.all(
        validEjercicios.sort((a, b) => b.año - a.año).map(async (ej) => {
          const decl = await getDeclaracion(ej.año);
          const hasPDF = pdfYears.has(ej.año);
          return {
            año: ej.año,
            estado: getEstadoFiscal(ej.año, ej.estado),
            fuente: mapFuente(decl.fuente, hasPDF),
            resumen: decl.resumen,
            hasPDF,
          };
        }),
      );
      setRows(histRows);
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
              padding: '10px 16px',
              borderRadius: 'var(--r-md, 8px)',
              border: '1px solid var(--n-300)',
              background: 'var(--white)',
              color: 'var(--n-900)',
              fontWeight: 500,
              fontSize: 'var(--t-sm, 13px)',
              cursor: 'pointer',
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: 'var(--font-base, IBM Plex Sans, sans-serif)',
              transition: 'all 150ms ease',
            }}
          >
            <FileText size={16} />
            Importar
          </button>
        </header>

        {/* ── Table ── */}
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
          <div style={{
            border: '1px solid var(--n-200)',
            borderRadius: 'var(--r-lg, 12px)',
            overflow: 'auto',
            background: 'var(--white)',
          }}>
            {/* Table header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '70px 110px 90px 1fr 1fr 1fr 100px',
              columnGap: 8,
              padding: '10px 16px',
              background: 'var(--n-100)',
              borderBottom: '1px solid var(--n-200)',
              fontSize: 'var(--t-xs, 11px)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--n-500)',
              minWidth: 700,
            }}>
              <span>Año</span>
              <span>Estado</span>
              <span>Fuente</span>
              <span style={{ textAlign: 'right' }}>Cuota</span>
              <span style={{ textAlign: 'right' }}>Retenciones</span>
              <span style={{ textAlign: 'right' }}>Resultado</span>
              <span style={{ textAlign: 'right' }}>Acciones</span>
            </div>

            {/* Table rows */}
            {rows.map((row) => {
              const badge = ESTADO_BADGE[row.estado];
              const hasData = row.resumen !== null;

              return (
                <div
                  key={row.año}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '70px 110px 90px 1fr 1fr 1fr 100px',
                    columnGap: 8,
                    padding: '10px 16px',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--n-100)',
                    fontSize: 'var(--t-sm, 13px)',
                    minWidth: 700,
                  }}
                >
                  {/* Año */}
                  <span style={{ fontWeight: 600, color: 'var(--n-700)' }}>{row.año}</span>

                  {/* Estado — badge con color */}
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '3px 10px',
                    borderRadius: 999,
                    fontSize: 'var(--t-xs, 11px)',
                    fontWeight: 600,
                    background: badge.bg,
                    color: badge.color,
                    whiteSpace: 'nowrap',
                    width: 'fit-content',
                  }}>
                    {badge.label}
                  </span>

                  {/* Fuente — texto plano gris, SIN badge */}
                  <span style={{
                    color: 'var(--n-500)',
                    fontSize: 12,
                    whiteSpace: 'nowrap',
                  }}>
                    {row.fuente}
                  </span>

                  {/* Cuota */}
                  <span style={{ textAlign: 'right', ...monoStyle, color: 'var(--n-700)' }}>
                    {hasData ? fmtMoney(row.resumen!.cuotaIntegra) : '—'}
                  </span>

                  {/* Retenciones */}
                  <span style={{ textAlign: 'right', ...monoStyle, color: 'var(--n-700)' }}>
                    {hasData ? fmtMoney(row.resumen!.retenciones) : '—'}
                  </span>

                  {/* Resultado */}
                  <span style={{
                    textAlign: 'right',
                    ...monoStyle,
                    fontWeight: 500,
                    color: hasData
                      ? (row.resumen!.resultado > 0 ? 'var(--s-neg)' : row.resumen!.resultado < 0 ? 'var(--s-pos)' : 'var(--n-500)')
                      : 'var(--n-500)',
                  }}>
                    {hasData ? fmtMoney(row.resumen!.resultado) : '—'}
                  </span>

                  {/* Acciones — SIEMPRE 3 iconos */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                    {/* Ver */}
                    <button
                      type="button"
                      title="Ver declaración"
                      onClick={() => navigate(`/fiscalidad/mi-irpf?ejercicio=${row.año}`)}
                      style={actionBtnStyle}
                    >
                      <Eye size={16} />
                    </button>

                    {/* Descargar PDF / Importar */}
                    {row.hasPDF ? (
                      <button
                        type="button"
                        title="Descargar PDF"
                        onClick={() => handleDownloadPDF(row.año)}
                        style={actionBtnStyle}
                      >
                        <Download size={16} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        title="Importar declaración"
                        onClick={() => setShowImportWizard(true)}
                        style={actionBtnStyle}
                      >
                        <Upload size={16} />
                      </button>
                    )}

                    {/* Editar / Completar */}
                    <button
                      type="button"
                      title="Completar / editar"
                      onClick={() => {
                        // TODO: Open manual completion modal for this year
                        toast('Completar manualmente estará disponible próximamente.');
                      }}
                      style={actionBtnStyle}
                    >
                      <Edit2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Import wizard ── */}
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
