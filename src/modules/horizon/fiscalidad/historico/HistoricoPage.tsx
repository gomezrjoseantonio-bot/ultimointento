import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download,
  Edit3,
  Eye,
  FileText,
  MoreHorizontal,
  Plus,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import PageLayout from '../../../../components/common/PageLayout';
import { downloadBlob, getDocumentBlob, initDB } from '../../../../services/db';
import { AnioHistoricoFiscal, cargarHistoricoFiscal, eliminarDeclaracionImportada } from '../../../../services/fiscalHistoryService';
import ImportarDeclaracionWizard from './ImportarDeclaracionWizard';
import { EventoFiscal, generarEventosFiscales } from '../../../../services/fiscalPaymentsService';
import { calcularDeclaracionIRPF } from '../../../../services/irpfCalculationService';
import { EntidadAtribucionRentas } from '../../../../services/db';
import { getEntidades } from '../../../../services/entidadAtribucionService';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);

const CURRENT_YEAR = new Date().getFullYear();
const MIN_HISTORIC_YEAR = 2020;
const HISTORIC_YEARS = Array.from(
  { length: Math.max(0, CURRENT_YEAR - MIN_HISTORIC_YEAR + 1) },
  (_, index) => CURRENT_YEAR - index,
);

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
  const location = useLocation();
  const [historico, setHistorico] = useState<AnioHistoricoFiscal[]>([]);
  const [eventos, setEventos] = useState<EventoFiscal[]>([]);
  const [entidades, setEntidades] = useState<EntidadAtribucionRentas[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [wizardMethod, setWizardMethod] = useState<MetodoEntrada>('pdf');
  const [menuAbierto, setMenuAbierto] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [results, declaracionActual, entidadesData] = await Promise.all([
        cargarHistoricoFiscal(HISTORIC_YEARS),
        calcularDeclaracionIRPF(CURRENT_YEAR, { usarConciliacion: true }),
        getEntidades(),
      ]);
      setHistorico(results);
      setEntidades(entidadesData);
      setEventos(await generarEventosFiscales(CURRENT_YEAR, declaracionActual));
    } catch (e) {
      console.error('Error loading historial fiscal:', e);
      toast.error('No se pudo cargar el historial fiscal');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const state = location.state as { openImportWizard?: boolean; defaultMethod?: MetodoEntrada; openFiscalDataWizard?: boolean } | null;
    if (state?.openImportWizard) {
      setWizardMethod(state.defaultMethod ?? 'pdf');
      setShowImportWizard(true);
      navigate(location.pathname, { replace: true, state: null });
      return;
    }

    if (state?.openFiscalDataWizard) {
      toast('La importación de datos fiscales AEAT se integrará en esta vista. Mientras tanto puedes usar la importación de declaración o el formulario manual.', { icon: 'ℹ️' });
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

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
      console.error('Error descargando PDF:', error);
      toast.error('Error al descargar la declaración');
    }
  }, []);

  const confirmDeleteImport = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await eliminarDeclaracionImportada(deleteTarget);
      toast.success(`Importación de ${deleteTarget} eliminada`);
      setDeleteTarget(null);
      await loadData();
    } catch (error) {
      console.error('Error eliminando importación:', error);
      toast.error('Error al eliminar la importación');
    }
  }, [deleteTarget, loadData]);

  const pagosAgrupados = useMemo(() => agruparPagos(eventos), [eventos]);

  return (
    <PageLayout
      title="Historial fiscal"
      subtitle="Evolución, importaciones, pagos y archivo"
      primaryAction={{
        label: '+ Importar declaración',
        onClick: () => {
          setWizardMethod('pdf');
          setShowImportWizard(true);
        },
      }}
      secondaryActions={[
        {
          label: '+ Datos fiscales AEAT',
          onClick: () => toast('La importación directa de datos fiscales AEAT se activará en esta misma vista.', { icon: 'ℹ️' }),
        },
      ]}
    >
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent" style={{ borderColor: 'var(--blue)', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--s5)' }}>
          <section style={{ display: 'grid', gap: 'var(--s3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--s3)', flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ margin: 0, color: 'var(--n-900)', fontSize: 'var(--t-lg)' }}>Evolución anual</h2>
                <p style={{ margin: '4px 0 0', color: 'var(--n-500)' }}>Declaraciones, snapshots y documentos archivados por ejercicio.</p>
              </div>
            </div>

            <div style={{ border: '1px solid var(--n-200)', borderRadius: '20px', overflow: 'hidden', background: 'var(--white)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.4fr 1fr 1fr 1.1fr 0.8fr 0.8fr', gap: 'var(--s3)', padding: '14px 18px', background: 'var(--n-50)', color: 'var(--n-500)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
                <span>Año</span>
                <span>Estado/Fuente</span>
                <span>Cuota</span>
                <span>Reten.</span>
                <span>Resultado</span>
                <span>Tipo</span>
                <span>Acciones</span>
              </div>

              {historico.map((row) => {
                const estado = estadoVisual(row);
                const fuente = fuenteVisual(row);
                return (
                  <div key={row.ejercicio} style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.4fr 1fr 1fr 1.1fr 0.8fr 0.8fr', gap: 'var(--s3)', padding: '16px 18px', borderTop: '1px solid var(--n-100)', alignItems: 'center' }}>
                    <strong style={{ color: 'var(--n-900)' }}>{row.ejercicio}</strong>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ padding: '5px 10px', borderRadius: '999px', background: estado.background, color: estado.color, fontSize: 12, fontWeight: 700 }}>{estado.label}</span>
                      <span style={{ padding: '5px 10px', borderRadius: '999px', background: fuente.dashed ? 'transparent' : 'var(--n-100)', color: 'var(--n-700)', border: fuente.dashed ? '1px dashed var(--n-300)' : '1px solid transparent', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {fuente.icon}
                        {fuente.label}
                      </span>
                    </div>
                    <span style={monoStyle}>{fmt(row.cuotaLiquida)}</span>
                    <span style={{ ...monoStyle, color: 'var(--n-700)' }}>{fmt(row.retenciones)}</span>
                    <span style={{ ...monoStyle, color: row.resultado > 0 ? 'var(--s-neg)' : row.resultado < 0 ? 'var(--s-pos)' : 'var(--n-500)', fontWeight: 600 }}>
                      {row.resultado === 0 ? '—' : fmt(row.resultado)}
                    </span>
                    <span style={{ color: 'var(--n-600)' }}>{row.fuente === 'sin_datos' ? '—' : `${row.tipoEfectivo.toFixed(1)}%`}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', position: 'relative' }}>
                      {row.fuente !== 'sin_datos' && (
                        <button type="button" onClick={() => navigate(`/fiscalidad/declaracion?ejercicio=${row.ejercicio}`)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--n-600)' }} title="Ver declaración">
                          <Eye size={16} />
                        </button>
                      )}
                      {row.tienePDF && (
                        <button type="button" onClick={() => handleDownloadPDF(row.ejercicio)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--n-600)' }} title="Descargar PDF">
                          <Download size={16} />
                        </button>
                      )}
                      {(row.origen === 'importado' || row.origen === 'mixto') && (
                        <>
                          <button type="button" onClick={() => setMenuAbierto((current) => current === row.ejercicio ? null : row.ejercicio)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--n-600)' }} title="Más acciones">
                            <MoreHorizontal size={16} />
                          </button>
                          {menuAbierto === row.ejercicio && (
                            <div style={{ position: 'absolute', top: 28, right: 0, background: 'var(--white)', border: '1px solid var(--n-200)', borderRadius: '12px', boxShadow: '0 12px 30px rgba(2,30,63,0.12)', padding: 8, zIndex: 10 }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteTarget(row.ejercicio);
                                  setMenuAbierto(null);
                                }}
                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--s-neg)', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', whiteSpace: 'nowrap' }}
                              >
                                <Trash2 size={14} />
                                Eliminar datos
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section style={{ display: 'grid', gap: 'var(--s3)' }}>
            <div>
              <h2 style={{ margin: 0, color: 'var(--n-900)', fontSize: 'var(--t-lg)' }}>Pagos fiscales</h2>
              <p style={{ margin: '4px 0 0', color: 'var(--n-500)' }}>Modelo 130 e hitos del IRPF fraccionado del ejercicio actual.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--s3)' }}>
              {pagosAgrupados.length === 0 ? (
                <div style={{ border: '1px solid var(--n-200)', borderRadius: '18px', padding: 'var(--s4)', background: 'var(--white)', color: 'var(--n-500)' }}>
                  No hay pagos fiscales activos para este ejercicio.
                </div>
              ) : pagosAgrupados.map((pago) => {
                const pagado = pago.pendientes === 0;
                return (
                  <article key={pago.titulo} style={{ border: '1px solid var(--n-200)', borderRadius: '18px', padding: 'var(--s4)', background: 'var(--white)', display: 'grid', gap: 'var(--s2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--s2)' }}>
                      <strong style={{ color: 'var(--n-900)' }}>{pago.titulo}</strong>
                      <span style={{ borderRadius: '999px', padding: '4px 10px', background: pagado ? 'var(--s-pos-bg)' : 'var(--s-warn-bg)', color: pagado ? 'var(--s-pos)' : 'var(--s-warn)', fontSize: 12, fontWeight: 700 }}>
                        {pagado ? 'Pagado' : 'Pendiente'}
                      </span>
                    </div>
                    <span style={{ ...monoStyle, fontSize: 'var(--t-lg)', color: 'var(--n-900)' }}>{fmt(pago.total)}</span>
                    <span style={{ color: 'var(--n-500)', fontSize: 'var(--t-sm)' }}>{pago.pagados} hitos pagados · {pago.pendientes} pendientes</span>
                  </article>
                );
              })}
            </div>
          </section>

          <section style={{ display: 'grid', gap: 'var(--s3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--s3)', flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ margin: 0, color: 'var(--n-900)', fontSize: 'var(--t-lg)' }}>Entidades</h2>
                <p style={{ margin: '4px 0 0', color: 'var(--n-500)' }}>Comunidades de bienes, sociedades civiles y otras rentas atribuidas.</p>
              </div>
              <button type="button" onClick={() => toast('La edición avanzada de entidades sigue disponible en esta misma sección.', { icon: 'ℹ️' })} style={{ border: '1px solid var(--n-200)', borderRadius: '999px', padding: '8px 12px', background: 'var(--white)', color: 'var(--n-700)', display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <Plus size={16} />
                Añadir
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--s3)' }}>
              {entidades.length === 0 ? (
                <div style={{ border: '1px solid var(--n-200)', borderRadius: '18px', padding: 'var(--s4)', background: 'var(--white)', color: 'var(--n-500)' }}>
                  No hay entidades registradas todavía.
                </div>
              ) : entidades.map((entidad) => {
                const ejercicioActual = entidad.ejercicios[0];
                return (
                  <article key={entidad.id} style={{ border: '1px solid var(--n-200)', borderRadius: '18px', padding: 'var(--s4)', background: 'var(--white)', display: 'grid', gap: 'var(--s2)' }}>
                    <strong style={{ color: 'var(--n-900)' }}>{entidad.nombre}</strong>
                    <span style={{ color: 'var(--n-500)' }}>{entidad.nif} · {entidad.tipoEntidad} · {entidad.porcentajeParticipacion}%</span>
                    <span style={{ color: 'var(--n-700)' }}>{entidad.tipoRenta.replace(/_/g, ' ')}</span>
                    {ejercicioActual && (
                      <div style={{ display: 'grid', gap: 4 }}>
                        <span style={{ ...monoStyle, color: 'var(--n-900)' }}>{fmt(ejercicioActual.rendimientosAtribuidos)}</span>
                        <span style={{ color: 'var(--n-500)', fontSize: 'var(--t-sm)' }}>Retenciones: {fmt(ejercicioActual.retencionesAtribuidas)}</span>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {showImportWizard && (
        <ImportarDeclaracionWizard
          defaultMethod={wizardMethod}
          onClose={() => setShowImportWizard(false)}
          onImported={loadData}
        />
      )}

      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2, 30, 63, 0.48)', display: 'grid', placeItems: 'center', zIndex: 1200, padding: '1rem' }}>
          <div style={{ width: 'min(460px, 100%)', background: 'var(--white)', borderRadius: '20px', padding: 'var(--s5)', display: 'grid', gap: 'var(--s3)' }}>
            <div>
              <h3 style={{ margin: 0, color: 'var(--n-900)' }}>Eliminar datos importados</h3>
              <p style={{ margin: '8px 0 0', color: 'var(--n-500)' }}>
                Se borrarán los datos fiscales, el PDF archivado y el snapshot del ejercicio {deleteTarget}. Esta acción no se puede deshacer.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--s2)' }}>
              <button type="button" onClick={() => setDeleteTarget(null)} style={{ border: '1px solid var(--n-200)', borderRadius: '12px', padding: '10px 14px', background: 'var(--white)', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button type="button" onClick={confirmDeleteImport} style={{ border: 'none', borderRadius: '12px', padding: '10px 14px', background: 'var(--s-neg)', color: 'var(--white)', cursor: 'pointer' }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
};

export default HistoricoPage;
