import React, { useState, useEffect, useCallback } from 'react';
import {
  Download,
  Edit3,
  Eye,
  FileText,
  MoreVertical,
  Plus,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../../../components/common/PageLayout';
import { downloadBlob, getDocumentBlob, initDB } from '../../../../services/db';
import type { EntidadAtribucionRentas } from '../../../../services/db';
import type { AnioHistoricoFiscal } from '../../../../services/fiscalHistoryService';
import { cargarHistoricoFiscal, eliminarDeclaracionImportada } from '../../../../services/fiscalHistoryService';
import { calcularDeclaracionIRPF } from '../../../../services/irpfCalculationService';
import type { EventoFiscal } from '../../../../services/fiscalPaymentsService';
import {
  generarEventosFiscales,
  getConfiguracionFiscal,
  saveConfiguracionFiscal,
} from '../../../../services/fiscalPaymentsService';
import type { ConfiguracionFiscal } from '../../../../services/db';
import { getEntidades } from '../../../../services/entidadAtribucionService';
import ImportarDeclaracionWizard from '../historico/ImportarDeclaracionWizard';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);

const fmtMono = (n: number): React.ReactNode => (
  <span style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{fmt(n)}</span>
);

const CURRENT_YEAR = new Date().getFullYear();
const MIN_HISTORIC_YEAR = 2020;
const HISTORIC_YEARS = Array.from(
  { length: Math.max(0, CURRENT_YEAR - MIN_HISTORIC_YEAR + 1) },
  (_, index) => CURRENT_YEAR - index,
);

type EstadoBadge = 'en_curso' | 'pendiente' | 'finalizado';
type FuenteBadge = 'pdf_aeat' | 'manual' | 'sin_datos';

function getEstadoBadge(row: AnioHistoricoFiscal): { label: string; type: EstadoBadge } {
  if (row.ejercicio === CURRENT_YEAR) return { label: 'En curso', type: 'en_curso' };
  if (row.fuente === 'declarado') return { label: 'Finalizado', type: 'finalizado' };
  if (row.fuente === 'cerrado') return { label: 'Pendiente', type: 'pendiente' };
  if (row.fuente === 'vivo' && row.ejercicio < CURRENT_YEAR) return { label: 'Pendiente', type: 'pendiente' };
  return { label: 'Pendiente', type: 'pendiente' };
}

function getFuenteBadge(row: AnioHistoricoFiscal): { label: string; type: FuenteBadge } {
  if (row.tienePDF) return { label: 'PDF AEAT', type: 'pdf_aeat' };
  if (row.fuente === 'declarado' || row.fuente === 'cerrado' || row.fuente === 'vivo') return { label: 'Manual', type: 'manual' };
  return { label: 'Sin datos', type: 'sin_datos' };
}

const estadoBadgeStyles: Record<EstadoBadge, React.CSSProperties> = {
  en_curso: { background: 'var(--s-pos-bg)', color: 'var(--s-pos)' },
  pendiente: { background: 'var(--s-warn-bg)', color: 'var(--s-warn)' },
  finalizado: { background: 'var(--n-100)', color: 'var(--n-500)' },
};

const fuenteBadgeStyles: Record<FuenteBadge, React.CSSProperties> = {
  pdf_aeat: { background: 'var(--n-100)', color: 'var(--n-700)' },
  manual: { background: 'var(--n-100)', color: 'var(--n-700)' },
  sin_datos: { background: 'transparent', color: 'var(--n-500)', border: '1px dashed var(--n-300)' },
};

const Badge: React.FC<{ style: React.CSSProperties; children: React.ReactNode; icon?: React.ReactNode }> = ({ style, children, icon }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
    padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem',
    fontWeight: 600, whiteSpace: 'nowrap', ...style,
  }}>
    {icon}
    {children}
  </span>
);

const HistorialPage: React.FC = () => {
  const navigate = useNavigate();
  const [historico, setHistorico] = useState<AnioHistoricoFiscal[]>([]);
  const [eventos, setEventos] = useState<EventoFiscal[]>([]);
  const [config, setConfig] = useState<ConfiguracionFiscal | null>(null);
  const [entidades, setEntidades] = useState<EntidadAtribucionRentas[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [savingPago, setSavingPago] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [kebabOpen, setKebabOpen] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [hist, ents, cfg] = await Promise.all([
        cargarHistoricoFiscal(HISTORIC_YEARS),
        getEntidades(),
        getConfiguracionFiscal(),
      ]);
      setHistorico(hist);
      setEntidades(ents);
      setConfig(cfg);

      try {
        const decl = await calcularDeclaracionIRPF(CURRENT_YEAR);
        const ev = await generarEventosFiscales(CURRENT_YEAR, decl);
        setEventos(ev);
      } catch {
        setEventos([]);
      }
    } catch (e) {
      console.error('Error loading historial:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDownloadPDF = useCallback(async (ejercicio: number) => {
    try {
      const db = await initDB();
      const docs = await db.getAll('documents');
      const doc = (docs as Array<{ id?: number; type?: string; filename?: string; metadata?: { ejercicio?: number } }>)
        .find((d) => d.type === 'declaracion_irpf' && d.metadata?.ejercicio === ejercicio);
      if (!doc?.id) { toast.error('PDF no encontrado'); return; }
      const blob = await getDocumentBlob(doc.id);
      if (!blob) { toast.error('PDF no encontrado'); return; }
      downloadBlob(blob, doc.filename || `Declaracion_IRPF_${ejercicio}.pdf`);
    } catch {
      toast.error('Error al descargar la declaración');
    }
  }, []);

  const handleDeleteImport = useCallback(async (ejercicio: number) => {
    try {
      await eliminarDeclaracionImportada(ejercicio);
      toast.success(`Importación de ${ejercicio} eliminada`);
      setDeleteConfirm(null);
      await loadData();
    } catch {
      toast.error('Error al eliminar la importación');
    }
  }, [loadData]);

  const handleMarcarPagado = async (evento: EventoFiscal) => {
    if (!config || !evento.trimestre) return;
    setSavingPago(true);
    try {
      const field = evento.modelo === 'M130' ? 'modelo130_pagados' : 'modelo303_pagados';
      const pagados = [...(config[field] ?? [])];
      pagados.push({
        ejercicio: evento.ejercicio,
        trimestre: evento.trimestre,
        importe: evento.importe,
        fechaPago: new Date().toISOString().split('T')[0],
      });
      const updated = await saveConfiguracionFiscal({ [field]: pagados });
      setConfig(updated);
      await loadData();
    } finally {
      setSavingPago(false);
    }
  };

  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.06em', color: 'var(--n-500)', marginBottom: '0.75rem',
  };

  const cardStyle: React.CSSProperties = {
    background: 'white', border: '1px solid var(--n-200)',
    borderRadius: 'var(--r-lg, 16px)', overflow: 'hidden',
  };

  return (
    <PageLayout
      title="Historial fiscal"
      subtitle="Evolución, importaciones, pagos y archivo"
      primaryAction={{
        label: '+ Importar declaración',
        onClick: () => setShowImportWizard(true),
      }}
    >
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent" style={{ borderColor: 'var(--blue)', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '2rem' }}>
          {/* ═══ SECCIÓN: Evolución anual ═══ */}
          <div>
            <h3 style={sectionHeaderStyle}>Evolución anual</h3>
            <div style={cardStyle}>
              <div style={{
                display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr 1fr 100px',
                padding: '0.75rem 1rem', background: 'var(--n-100)',
                borderBottom: '1px solid var(--n-200)',
                fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.04em', color: 'var(--n-500)',
              }}>
                <span>Año</span>
                <span>Estado / Fuente</span>
                <span style={{ textAlign: 'right' }}>Cuota</span>
                <span style={{ textAlign: 'right' }}>Retenciones</span>
                <span style={{ textAlign: 'right' }}>Resultado</span>
                <span style={{ textAlign: 'right' }}>Acciones</span>
              </div>
              {historico.map(row => {
                const estado = getEstadoBadge(row);
                const fuente = getFuenteBadge(row);
                const hasData = row.fuente !== 'sin_datos';
                return (
                  <div key={row.ejercicio} style={{
                    display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr 1fr 100px',
                    padding: '0.75rem 1rem', alignItems: 'center',
                    borderBottom: '1px solid var(--n-100)', fontSize: '0.9rem',
                  }}>
                    <span style={{ fontWeight: 700, color: 'var(--n-700)' }}>{row.ejercicio}</span>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <Badge style={estadoBadgeStyles[estado.type]}>{estado.label}</Badge>
                      <Badge
                        style={fuenteBadgeStyles[fuente.type]}
                        icon={fuente.type === 'pdf_aeat' ? <FileText size={12} /> : fuente.type === 'manual' ? <Edit3 size={12} /> : undefined}
                      >
                        {fuente.label}
                      </Badge>
                    </div>
                    <span style={{ textAlign: 'right' }}>{hasData ? fmtMono(row.cuotaLiquida) : '—'}</span>
                    <span style={{ textAlign: 'right' }}>{hasData ? fmtMono(row.retenciones) : '—'}</span>
                    <span style={{
                      textAlign: 'right', fontWeight: 600,
                      color: row.resultado > 0 ? 'var(--s-neg, #B91C1C)' : row.resultado < 0 ? 'var(--s-pos, #1A7A3C)' : 'var(--n-500)',
                    }}>
                      {hasData ? fmtMono(row.resultado) : '—'}
                    </span>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.25rem', position: 'relative' }}>
                      {hasData && (
                        <button
                          type="button"
                          title="Ver declaración"
                          onClick={() => navigate(`/fiscalidad/declaracion?ejercicio=${row.ejercicio}`)}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0.3rem', borderRadius: '6px', color: 'var(--n-500)' }}
                        >
                          <Eye size={16} />
                        </button>
                      )}
                      {row.tienePDF && (
                        <button
                          type="button"
                          title="Descargar PDF"
                          onClick={() => handleDownloadPDF(row.ejercicio)}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0.3rem', borderRadius: '6px', color: 'var(--n-500)' }}
                        >
                          <Download size={16} />
                        </button>
                      )}
                      {row.fuente === 'declarado' && row.origen === 'importado' && (
                        <div style={{ position: 'relative' }}>
                          <button
                            type="button"
                            onClick={() => setKebabOpen(kebabOpen === row.ejercicio ? null : row.ejercicio)}
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0.3rem', borderRadius: '6px', color: 'var(--n-500)' }}
                          >
                            <MoreVertical size={16} />
                          </button>
                          {kebabOpen === row.ejercicio && (
                            <div style={{
                              position: 'absolute', right: 0, top: '100%', zIndex: 10,
                              background: 'white', border: '1px solid var(--n-200)', borderRadius: '8px',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: '160px',
                            }}>
                              <button
                                type="button"
                                onClick={() => { setKebabOpen(null); setDeleteConfirm(row.ejercicio); }}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
                                  padding: '0.6rem 0.8rem', border: 'none', background: 'transparent',
                                  cursor: 'pointer', color: '#B91C1C', fontSize: '0.85rem',
                                }}
                              >
                                <Trash2 size={14} />
                                Eliminar importación
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ═══ SECCIÓN: Pagos fiscales ═══ */}
          <div>
            <h3 style={sectionHeaderStyle}>Pagos fiscales</h3>
            <div style={cardStyle}>
              {eventos.length === 0 ? (
                <div style={{ padding: '1.5rem', color: 'var(--n-500)', fontSize: '0.9rem' }}>
                  No hay pagos fiscales registrados para este ejercicio.
                </div>
              ) : (
                <div>
                  <div style={{
                    display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr',
                    padding: '0.75rem 1rem', background: 'var(--n-100)',
                    borderBottom: '1px solid var(--n-200)',
                    fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.04em', color: 'var(--n-500)',
                  }}>
                    <span>Descripción</span>
                    <span>Fecha límite</span>
                    <span style={{ textAlign: 'right' }}>Importe</span>
                    <span style={{ textAlign: 'right' }}>Estado</span>
                  </div>
                  {eventos.map((evento, i) => (
                    <div key={i} style={{
                      display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr',
                      padding: '0.75rem 1rem', alignItems: 'center',
                      borderBottom: '1px solid var(--n-100)', fontSize: '0.9rem',
                    }}>
                      <span style={{ color: 'var(--n-700)' }}>{evento.descripcion}</span>
                      <span style={{ color: 'var(--n-500)' }}>{new Date(evento.fechaLimite).toLocaleDateString('es-ES')}</span>
                      <span style={{ textAlign: 'right' }}>{fmtMono(Math.abs(evento.importe))}</span>
                      <div style={{ textAlign: 'right' }}>
                        {evento.pagado ? (
                          <Badge style={{ background: 'var(--s-pos-bg)', color: 'var(--s-pos)' }}>Pagado</Badge>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <Badge style={{ background: 'var(--s-warn-bg)', color: 'var(--s-warn)' }}>Pendiente</Badge>
                            {evento.trimestre && (
                              <button
                                type="button"
                                onClick={() => handleMarcarPagado(evento)}
                                disabled={savingPago}
                                style={{ border: 'none', background: 'transparent', color: 'var(--blue)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                              >
                                Marcar
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ═══ SECCIÓN: Entidades ═══ */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ ...sectionHeaderStyle, marginBottom: 0 }}>Entidades en atribución</h3>
              <button
                type="button"
                onClick={() => toast('Gestión de entidades estará disponible próximamente.')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  border: '1px solid var(--n-200)', borderRadius: '8px',
                  padding: '0.4rem 0.7rem', background: 'white', cursor: 'pointer',
                  fontSize: '0.8rem', fontWeight: 600, color: 'var(--n-700)',
                }}
              >
                <Plus size={14} />
                Añadir
              </button>
            </div>
            <div style={cardStyle}>
              {entidades.length === 0 ? (
                <div style={{ padding: '1.5rem', color: 'var(--n-500)', fontSize: '0.9rem' }}>
                  No hay entidades en atribución registradas. Añade CB/SC para que sus rentas entren en el IRPF.
                </div>
              ) : (
                entidades.map((entidad, i) => (
                  <div key={entidad.id ?? i} style={{
                    padding: '1rem', borderBottom: i < entidades.length - 1 ? '1px solid var(--n-100)' : 'none',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--n-700)' }}>{entidad.nombre}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--n-500)', marginTop: '0.2rem' }}>
                        {entidad.nif} · {entidad.tipoEntidad} · {entidad.porcentajeParticipacion}%
                      </div>
                    </div>
                    <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, color: 'var(--n-700)' }}>
                      {entidad.ejercicios[0] ? fmt(entidad.ejercicios[0].rendimientosAtribuidos) : '—'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm !== null && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1200,
          background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setDeleteConfirm(null)}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '2rem',
            maxWidth: '400px', width: '100%',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 0.75rem', color: 'var(--n-700)' }}>Eliminar importación {deleteConfirm}</h3>
            <p style={{ color: 'var(--n-500)', fontSize: '0.9rem', margin: '0 0 1.5rem' }}>
              Se borrarán los datos fiscales y el PDF archivado. Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                style={{
                  border: '1px solid var(--n-200)', borderRadius: '10px',
                  padding: '0.6rem 1rem', background: 'white', cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDeleteImport(deleteConfirm)}
                style={{
                  border: 'none', borderRadius: '10px',
                  padding: '0.6rem 1rem', background: '#B91C1C', color: 'white',
                  cursor: 'pointer', fontWeight: 600,
                }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {showImportWizard && (
        <ImportarDeclaracionWizard
          onClose={() => setShowImportWizard(false)}
          onImported={loadData}
        />
      )}
    </PageLayout>
  );
};

export default HistorialPage;
