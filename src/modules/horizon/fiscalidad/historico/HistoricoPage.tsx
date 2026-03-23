import React, { useCallback, useEffect, useState } from 'react';
import { Download, Edit3, Eye, FileText, MoreHorizontal, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { downloadBlob, getDocumentBlob, initDB } from '../../../../services/db';
import { AnioHistoricoFiscal, cargarHistoricoFiscal, eliminarDeclaracionImportada } from '../../../../services/fiscalHistoryService';
import FiscalPageShell from '../components/FiscalPageShell';

const CURRENT_YEAR = new Date().getFullYear();
const MIN_HISTORIC_YEAR = 2020;
const HISTORIC_YEARS = Array.from({ length: Math.max(0, CURRENT_YEAR - MIN_HISTORIC_YEAR + 1) }, (_, index) => CURRENT_YEAR - index);

const fmtMoney = (value: number) => `${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(value))} €`;
const fmtResult = (value: number) => `${value < 0 ? '-' : '+'}${fmtMoney(value)}`;

const monoStyle: React.CSSProperties = { fontFamily: 'IBM Plex Mono, monospace' };

function getEstadoBadge(row: AnioHistoricoFiscal): { label: string; background: string; color: string } {
  if (row.ejercicio === CURRENT_YEAR || row.estado === 'vivo') return { label: 'En curso', background: 'var(--s-pos-bg)', color: 'var(--s-pos)' };
  if (row.estado === 'cerrado') return { label: 'Pendiente', background: 'var(--s-warn-bg)', color: '#A36400' };
  return { label: 'Finalizado', background: 'var(--n-100)', color: 'var(--n-700)' };
}

function getFuenteBadge(row: AnioHistoricoFiscal): { label: string; icon?: React.ReactNode; dashed?: boolean } {
  if (row.tienePDF) return { label: 'PDF AEAT', icon: <FileText size={18} /> };
  if (row.fuente !== 'sin_datos') return { label: 'Manual', icon: <Edit3 size={18} /> };
  return { label: 'Sin datos', dashed: true };
}

const actionButtonStyle: React.CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: 18,
  border: '1px solid var(--n-300)',
  background: 'var(--white)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--n-700)',
};

type MetodoEntrada = 'formulario' | 'pdf';

const monoStyle: React.CSSProperties = {
  fontFamily: 'IBM Plex Mono, monospace',
};

function estadoVisual(row: AnioHistoricoFiscal): { label: string; background: string; color: string } {
  if (row.ejercicio === CURRENT_YEAR || row.estado === 'vivo') {
    return { label: 'En curso', background: 'var(--s-pos-bg)', color: 'var(--s-pos)' };
  }
  if (row.estado === 'cerrado') {
    return { label: 'Pendiente', background: 'var(--s-warn-bg)', color: 'var(--s-warn)' };
  }
  return { label: 'Finalizado', background: 'var(--n-100)', color: 'var(--n-500)' };
}

function fuenteVisual(row: AnioHistoricoFiscal): { label: string; icon?: React.ReactNode; dashed?: boolean } {
  if (row.tienePDF) {
    return { label: 'PDF AEAT', icon: <FileText size={14} /> };
  }
  if (row.fuente !== 'sin_datos') {
    return { label: 'Manual', icon: <Edit3 size={14} /> };
  }
  return { label: 'Sin datos', dashed: true };
}

function agruparPagos(eventos: EventoFiscal[]): Array<{ titulo: string; total: number; pendientes: number; pagados: number }> {
  const grupos = new Map<string, { titulo: string; total: number; pendientes: number; pagados: number }>();

  eventos.forEach((evento) => {
    const key = evento.modelo === 'IRPF_FRACCIONES' ? 'IRPF fraccionado' : evento.modelo === 'IRPF_ANUAL' ? 'IRPF anual' : evento.modelo;
    const actual = grupos.get(key) ?? { titulo: key, total: 0, pendientes: 0, pagados: 0 };
    actual.total += Math.abs(evento.importe);
    actual[evento.pagado ? 'pagados' : 'pendientes'] += 1;
    grupos.set(key, actual);
  });

  return Array.from(grupos.values());
}

const HistoricoPage: React.FC = () => {
  const navigate = useNavigate();
  const [historico, setHistorico] = useState<AnioHistoricoFiscal[]>([]);
  const [eventos, setEventos] = useState<EventoFiscal[]>([]);
  const [entidades, setEntidades] = useState<EntidadAtribucionRentas[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      setHistorico(await cargarHistoricoFiscal(HISTORIC_YEARS));
    } catch (error) {
      console.error('Error loading fiscal history:', error);
      toast.error('No se pudo cargar el historial fiscal');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const handleDownloadPDF = useCallback(async (ejercicio: number) => {
    try {
      const db = await initDB();
      const docs = await db.getAll('documents');
      const doc = (docs as Array<{ id?: number; type?: string; filename?: string; metadata?: { ejercicio?: number } }>)
        .find((documento) => documento.type === 'declaracion_irpf' && documento.metadata?.ejercicio === ejercicio);

      if (!doc?.id) {
        toast.error('PDF no encontrado');
        return;
      }
      const blob = await getDocumentBlob(doc.id);
      if (!blob) {
        toast.error('PDF no encontrado');
        return;
      }
      downloadBlob(blob, doc.filename || `Declaracion_IRPF_${ejercicio}.pdf`);
    } catch (error) {
      console.error('Error downloading fiscal pdf:', error);
      toast.error('No se pudo descargar el PDF');
    }
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await eliminarDeclaracionImportada(deleteTarget);
      setDeleteTarget(null);
      await loadData();
      toast.success(`Importación ${deleteTarget} eliminada`);
    } catch (error) {
      console.error('Error deleting fiscal import:', error);
      toast.error('No se pudo eliminar la importación');
    }
  }, [deleteTarget, loadData]);

  return (
    <FiscalPageShell>
      <div style={{ display: 'grid', gap: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: 'var(--n-900)' }}>Evolución anual</h1>
          <button type="button" style={{ border: 'none', background: 'transparent', color: 'var(--n-700)' }}>
            <MoreHorizontal size={24} />
          </button>
        </div>

        {loading ? (
          <div style={{ color: 'var(--n-500)' }}>Cargando historial…</div>
        ) : (
          <div style={{ borderTop: '1px solid var(--n-200)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 2.3fr 1fr 1fr 1fr 0.8fr 1.4fr', gap: 16, padding: '16px 24px', color: 'var(--n-500)', fontWeight: 600 }}>
              <span>Año</span>
              <span>Estado / Fuente</span>
              <span>Cuota</span>
              <span>Reten.</span>
              <span>Resultado</span>
              <span>Tipo</span>
              <span />
            </div>
            {historico.map((row) => {
              const estado = getEstadoBadge(row);
              const fuente = getFuenteBadge(row);
              return (
                <div key={row.ejercicio} style={{ display: 'grid', gridTemplateColumns: '0.8fr 2.3fr 1fr 1fr 1fr 0.8fr 1.4fr', gap: 16, padding: '20px 24px', borderTop: '1px solid var(--n-200)', alignItems: 'center' }}>
                  <span style={{ fontSize: 26, fontWeight: 500, color: 'var(--n-900)' }}>{row.ejercicio}</span>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ borderRadius: 999, padding: '8px 16px', background: estado.background, color: estado.color, fontWeight: 600 }}>{estado.label}</span>
                    <span style={{ borderRadius: 999, padding: '8px 16px', background: fuente.dashed ? 'transparent' : 'var(--n-50)', color: 'var(--n-700)', border: fuente.dashed ? '1px dashed var(--n-300)' : '1px solid transparent', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      {fuente.icon}
                      {fuente.label}
                    </span>
                  </div>
                  <span style={{ ...monoStyle, fontSize: 20 }}>{row.cuotaLiquida === 0 ? '—' : fmtMoney(row.cuotaLiquida)}</span>
                  <span style={{ ...monoStyle, fontSize: 20 }}>{row.retenciones === 0 ? '—' : fmtMoney(row.retenciones)}</span>
                  <span style={{ ...monoStyle, fontSize: 20, color: row.resultado > 0 ? 'var(--s-neg)' : row.resultado < 0 ? 'var(--s-pos)' : 'var(--n-500)' }}>{row.resultado === 0 ? '—' : fmtResult(row.resultado)}</span>
                  <span style={{ ...monoStyle, fontSize: 18 }}>{row.fuente === 'sin_datos' ? '—' : `${row.tipoEfectivo.toFixed(1)}%`}</span>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                    {row.fuente !== 'sin_datos' && (
                      <button type="button" onClick={() => navigate(`/fiscalidad/declaracion?ejercicio=${row.ejercicio}`)} style={actionButtonStyle} title="Ver declaración">
                        <Eye size={20} />
                      </button>
                    )}
                    {row.tienePDF && (
                      <button type="button" onClick={() => handleDownloadPDF(row.ejercicio)} style={actionButtonStyle} title="Descargar PDF">
                        <Download size={20} />
                      </button>
                    )}
                    {(row.origen === 'importado' || row.origen === 'mixto') && (
                      <button type="button" onClick={() => setDeleteTarget(row.ejercicio)} style={actionButtonStyle} title="Eliminar datos">
                        <Trash2 size={20} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,30,63,0.45)', display: 'grid', placeItems: 'center', zIndex: 1200 }}>
          <div style={{ width: 'min(440px, 100%)', background: 'var(--white)', borderRadius: 18, padding: 24, display: 'grid', gap: 16 }}>
            <div>
              <h3 style={{ margin: 0, color: 'var(--n-900)' }}>Eliminar importación</h3>
              <p style={{ margin: '8px 0 0', color: 'var(--n-500)' }}>Se borrarán los datos y el PDF archivado de {deleteTarget}. Esta acción no se puede deshacer.</p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button type="button" onClick={() => setDeleteTarget(null)} style={{ border: '1px solid var(--n-300)', borderRadius: 12, background: 'var(--white)', padding: '10px 14px' }}>Cancelar</button>
              <button type="button" onClick={confirmDelete} style={{ border: 'none', borderRadius: 12, background: 'var(--s-neg)', color: 'var(--white)', padding: '10px 14px' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </FiscalPageShell>
  );
};

export default HistoricoPage;
