import React, { useState, useEffect, useCallback } from 'react';
import {
  Calculator,
  Download,
  Eye,
  FileCheck,
  FileText,
  Camera,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
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
import type { EntidadAtribucionRentas, ConfiguracionFiscal } from '../../../../services/db';
import type { EventoFiscal } from '../../../../services/fiscalPaymentsService';
import { generarEventosFiscales, getConfiguracionFiscal, saveConfiguracionFiscal } from '../../../../services/fiscalPaymentsService';
import { eliminarDeclaracionImportada } from '../../../../services/fiscalHistoryService';
import { calcularDeclaracionIRPF } from '../../../../services/irpfCalculationService';
import { getEntidades } from '../../../../services/entidadAtribucionService';
import ImportarDatosWizard from './ImportarDatosWizard';

// ── Formatters ──────────────────────────────────────────────
const fmtMoney = (n: number) =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(n)) + ' €';

// ── Types ───────────────────────────────────────────────────
type EstadoType = EjercicioFiscalCoord['estado'];

interface HistorialRow {
  año: number;
  estado: EstadoType;
  resumen: ResumenFiscal | null;
  fuente: 'aeat' | 'atlas' | 'ninguno';
  hasPDF: boolean;
  hasImport: boolean;
}

// ── Badge configs ───────────────────────────────────────────
const ESTADO_BADGE: Record<EstadoType, { label: string; bg: string; color: string }> = {
  en_curso: { label: 'En curso', bg: 'var(--s-pos-bg)', color: 'var(--s-pos)' },
  pendiente: { label: 'Pendiente', bg: 'var(--s-warn-bg)', color: 'var(--s-warn)' },
  declarado: { label: 'Finalizado', bg: 'var(--n-100)', color: 'var(--n-500)' },
  prescrito: { label: 'Prescrito', bg: 'var(--n-100)', color: 'var(--n-300)' },
};

const FUENTE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  aeat: { label: 'PDF AEAT', icon: <FileCheck size={12} />, color: 'var(--n-700)' },
  atlas: { label: 'ATLAS', icon: <Calculator size={12} />, color: 'var(--n-700)' },
  manual: { label: 'Manual', icon: <Pencil size={12} />, color: 'var(--n-700)' },
  ninguno: { label: 'Sin datos', icon: null, color: 'var(--n-300)' },
};

// ── Badge component ─────────────────────────────────────────
const Badge: React.FC<{ bg: string; color: string; children: React.ReactNode; icon?: React.ReactNode }> = ({ bg, color, children, icon }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '3px 10px', borderRadius: 999, fontSize: 'var(--t-xs, 11px)',
    fontWeight: 500, whiteSpace: 'nowrap', background: bg, color,
  }}>
    {icon}
    {children}
  </span>
);

// ── Component ───────────────────────────────────────────────
const HistorialPage: React.FC = () => {
  const navigate = useNavigate();
  const CURRENT_YEAR = new Date().getFullYear();

  const [rows, setRows] = useState<HistorialRow[]>([]);
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
      const [ejercicios, ents, cfg] = await Promise.all([
        getTodosLosEjercicios(),
        getEntidades(),
        getConfiguracionFiscal(),
      ]);
      setEntidades(ents);
      setConfig(cfg);

      // Build rows from resolver data (filter out future/invalid years)
      const validEjercicios = ejercicios.filter((ej) => ej.año <= CURRENT_YEAR && ej.año >= 2015);
      const histRows: HistorialRow[] = await Promise.all(
        validEjercicios.sort((a, b) => b.año - a.año).map(async (ej) => {
          const decl = await getDeclaracion(ej.año);
          return {
            año: ej.año,
            estado: ej.estado,
            resumen: decl.resumen,
            fuente: decl.fuente,
            hasPDF: Boolean(ej.aeat?.pdfDocumentId),
            hasImport: Boolean(ej.aeat),
          };
        })
      );
      setRows(histRows);

      // Load fiscal events (pagos)
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
  }, [CURRENT_YEAR]);

  useEffect(() => { loadData(); }, [loadData]);

  // Close kebab on outside click
  useEffect(() => {
    if (kebabOpen === null) return;
    const handler = () => setKebabOpen(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [kebabOpen]);

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

  const handleDeleteImport = useCallback(async (año: number) => {
    try {
      await eliminarDeclaracionImportada(año);
      toast.success(`Importación de ${año} eliminada`);
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

  const sectionTitle: React.CSSProperties = {
    fontSize: 'var(--t-xs, 11px)',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--n-500)',
    marginBottom: 12,
  };

  return (
    <FiscalPageShell>
      <div style={{ display: 'grid', gap: 'var(--s6, 24px)', fontFamily: 'var(--font-base, IBM Plex Sans, sans-serif)' }}>
        {/* ── Header with import buttons ── */}
        <header>
          <h2 style={{ margin: 0, fontSize: 'var(--t-lg, 1.25rem)', fontWeight: 600, color: 'var(--n-900)' }}>
            Historial fiscal
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--n-500)', fontSize: 'var(--t-xs, 12px)' }}>
            Evolución, importaciones, pagos y archivo
          </p>
        </header>

        {/* Import buttons */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
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
            Importar declaración
          </button>
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
            <Camera size={16} />
            Importar Datos Fiscales
          </button>
        </div>

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
            {/* ═══ Evolución anual ═══ */}
            <div>
              <h3 style={sectionTitle}>Evolución anual</h3>
              <div style={{
                border: '1px solid var(--n-200)',
                borderRadius: 'var(--r-lg, 12px)',
                overflow: 'hidden',
                background: 'var(--white)',
              }}>
                {/* Table header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '70px 140px 1fr 1fr 1fr 120px 90px',
                  columnGap: 8,
                  padding: '10px 16px',
                  background: 'var(--n-100)',
                  borderBottom: '1px solid var(--n-200)',
                  fontSize: 'var(--t-xs, 11px)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--n-500)',
                }}>
                  <span>Año</span>
                  <span>Estado</span>
                  <span style={{ textAlign: 'right' }}>Cuota</span>
                  <span style={{ textAlign: 'right' }}>Retenciones</span>
                  <span style={{ textAlign: 'right' }}>Resultado</span>
                  <span>Fuente</span>
                  <span style={{ textAlign: 'right' }}>Acciones</span>
                </div>

                {/* Table rows */}
                {rows.map((row) => {
                  const estadoBadge = ESTADO_BADGE[row.estado];
                  const fuenteInfo = FUENTE_CONFIG[row.fuente];
                  const hasData = row.fuente !== 'ninguno' && row.resumen !== null;
                  const isPrescrito = row.estado === 'prescrito';

                  return (
                    <div
                      key={row.año}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '70px 140px 1fr 1fr 1fr 120px 90px',
                        columnGap: 8,
                        padding: '10px 16px',
                        alignItems: 'center',
                        borderBottom: '1px solid var(--n-100)',
                        fontSize: 'var(--t-sm, 13px)',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--n-700)' }}>{row.año}</span>
                      <Badge bg={estadoBadge.bg} color={estadoBadge.color}>{estadoBadge.label}</Badge>
                      <span style={{ textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', color: 'var(--n-700)' }}>
                        {hasData ? fmtMoney(row.resumen!.cuotaIntegra) : '—'}
                      </span>
                      <span style={{ textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', color: 'var(--n-700)' }}>
                        {hasData ? fmtMoney(row.resumen!.retenciones) : '—'}
                      </span>
                      <span style={{
                        textAlign: 'right',
                        fontFamily: 'IBM Plex Mono, monospace',
                        fontWeight: 500,
                        color: hasData
                          ? (row.resumen!.resultado > 0 ? 'var(--s-neg)' : row.resumen!.resultado < 0 ? 'var(--s-pos)' : 'var(--n-500)')
                          : 'var(--n-500)',
                      }}>
                        {hasData ? fmtMoney(row.resumen!.resultado) : '—'}
                      </span>
                      <Badge
                        bg={row.fuente === 'ninguno' ? 'transparent' : 'var(--n-100)'}
                        color={fuenteInfo.color}
                        icon={fuenteInfo.icon}
                      >
                        {fuenteInfo.label}
                      </Badge>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 2, position: 'relative' }}>
                        {hasData && (
                          <button
                            type="button"
                            title="Ver declaración"
                            onClick={() => navigate(`/fiscalidad/declaracion?ejercicio=${row.año}`)}
                            style={actionBtnStyle}
                          >
                            <Eye size={16} />
                          </button>
                        )}
                        {row.hasPDF && (
                          <button
                            type="button"
                            title="Descargar PDF"
                            onClick={() => handleDownloadPDF(row.año)}
                            style={actionBtnStyle}
                          >
                            <Download size={16} />
                          </button>
                        )}
                        {row.hasImport && !isPrescrito && (
                          <div style={{ position: 'relative' }}>
                            <button
                              type="button"
                              title="Más acciones"
                              onClick={(e) => { e.stopPropagation(); setKebabOpen(kebabOpen === row.año ? null : row.año); }}
                              style={actionBtnStyle}
                            >
                              <MoreVertical size={16} />
                            </button>
                            {kebabOpen === row.año && (
                              <div
                                style={{
                                  position: 'absolute', right: 0, top: '100%', zIndex: 10,
                                  background: 'var(--white)', border: '1px solid var(--n-200)',
                                  borderRadius: 'var(--r-md, 8px)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                  minWidth: 160,
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => { setKebabOpen(null); setDeleteConfirm(row.año); }}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                                    padding: '10px 14px', border: 'none', background: 'transparent',
                                    cursor: 'pointer', color: 'var(--s-neg)', fontSize: 'var(--t-sm, 13px)',
                                    minHeight: 44,
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

            {/* ═══ Pagos fiscales ═══ */}
            <div>
              <h3 style={sectionTitle}>Pagos fiscales {CURRENT_YEAR}</h3>
              <div style={{
                border: '1px solid var(--n-200)',
                borderRadius: 'var(--r-lg, 12px)',
                overflow: 'hidden',
                background: 'var(--white)',
              }}>
                {eventos.length === 0 ? (
                  <div style={{ padding: 24, color: 'var(--n-500)', fontSize: 'var(--t-sm, 13px)' }}>
                    No hay pagos fiscales registrados para este ejercicio.
                  </div>
                ) : (
                  <>
                    <div style={{
                      display: 'grid', gridTemplateColumns: '2fr 1fr 1fr',
                      padding: '10px 16px', background: 'var(--n-100)',
                      borderBottom: '1px solid var(--n-200)',
                      fontSize: 'var(--t-xs, 11px)', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--n-500)',
                    }}>
                      <span>Descripción</span>
                      <span style={{ textAlign: 'right' }}>Importe</span>
                      <span style={{ textAlign: 'right' }}>Estado</span>
                    </div>
                    {eventos.map((evento, i) => (
                      <div key={i} style={{
                        display: 'grid', gridTemplateColumns: '2fr 1fr 1fr',
                        padding: '10px 16px', alignItems: 'center',
                        borderBottom: '1px solid var(--n-100)', fontSize: 'var(--t-sm, 13px)',
                      }}>
                        <span style={{ color: 'var(--n-700)' }}>{evento.descripcion}</span>
                        <span style={{ textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', color: 'var(--n-700)' }}>
                          {fmtMoney(Math.abs(evento.importe))}
                        </span>
                        <div style={{ textAlign: 'right' }}>
                          {evento.pagado ? (
                            <Badge bg="var(--s-pos-bg)" color="var(--s-pos)">Pagado</Badge>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                              <Badge bg="var(--s-warn-bg)" color="var(--s-warn)">Pendiente</Badge>
                              {evento.trimestre && (
                                <button
                                  type="button"
                                  onClick={() => handleMarcarPagado(evento)}
                                  disabled={savingPago}
                                  style={{
                                    border: 'none', background: 'transparent',
                                    color: 'var(--blue)', cursor: 'pointer',
                                    fontSize: 'var(--t-xs, 11px)', fontWeight: 500,
                                  }}
                                >
                                  Marcar
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* ═══ Entidades en atribución ═══ */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ ...sectionTitle, marginBottom: 0 }}>Entidades en atribución de rentas</h3>
                <button
                  type="button"
                  onClick={() => toast('Gestión de entidades estará disponible próximamente.')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    border: '1px solid var(--n-300)', borderRadius: 'var(--r-md, 8px)',
                    padding: '6px 12px', background: 'var(--white)', cursor: 'pointer',
                    fontSize: 'var(--t-xs, 11px)', fontWeight: 500, color: 'var(--n-700)',
                    minHeight: 36, transition: 'all 150ms ease',
                    fontFamily: 'var(--font-base, IBM Plex Sans, sans-serif)',
                  }}
                >
                  <Plus size={14} />
                  Añadir entidad
                </button>
              </div>
              <div style={{
                border: '1px solid var(--n-200)',
                borderRadius: 'var(--r-lg, 12px)',
                overflow: 'hidden',
                background: 'var(--white)',
              }}>
                {entidades.length === 0 ? (
                  <div style={{ padding: 24, color: 'var(--n-500)', fontSize: 'var(--t-sm, 13px)' }}>
                    No hay entidades en atribución registradas.
                  </div>
                ) : (
                  entidades.map((entidad, i) => (
                    <div key={entidad.id ?? i} style={{
                      padding: '14px 16px',
                      borderBottom: i < entidades.length - 1 ? '1px solid var(--n-100)' : 'none',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <div>
                        <div style={{ fontWeight: 500, color: 'var(--n-900)', fontSize: 'var(--t-sm, 13px)' }}>
                          {entidad.nombre}
                        </div>
                        <div style={{ fontSize: 'var(--t-xs, 11px)', color: 'var(--n-500)', marginTop: 2 }}>
                          NIF: {entidad.nif} · Participación: {entidad.porcentajeParticipacion}% · {entidad.tipoEntidad}
                        </div>
                      </div>
                      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 500, color: 'var(--n-700)', fontSize: 'var(--t-sm, 13px)' }}>
                        {entidad.ejercicios?.[0] ? fmtMoney(entidad.ejercicios[0].rendimientosAtribuidos) : '—'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirm !== null && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1200,
            background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            style={{
              background: 'var(--white)', borderRadius: 'var(--r-lg, 12px)',
              padding: '24px', maxWidth: 400, width: '100%',
              border: '1px solid var(--n-200)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 12px', color: 'var(--n-900)', fontSize: 'var(--t-base, 14px)', fontWeight: 600 }}>
              Eliminar importación {deleteConfirm}
            </h3>
            <p style={{ color: 'var(--n-500)', fontSize: 'var(--t-sm, 13px)', margin: '0 0 24px' }}>
              Se borrarán los datos fiscales y el PDF archivado. Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                style={{
                  border: '1px solid var(--n-300)', borderRadius: 'var(--r-md, 8px)',
                  padding: '10px 16px', background: 'var(--white)', cursor: 'pointer',
                  fontSize: 'var(--t-sm, 13px)', minHeight: 44,
                  fontFamily: 'var(--font-base, IBM Plex Sans, sans-serif)',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDeleteImport(deleteConfirm)}
                style={{
                  border: 'none', borderRadius: 'var(--r-md, 8px)',
                  padding: '10px 16px', background: 'var(--s-neg)', color: 'var(--white)',
                  cursor: 'pointer', fontWeight: 500, fontSize: 'var(--t-sm, 13px)',
                  minHeight: 44, fontFamily: 'var(--font-base, IBM Plex Sans, sans-serif)',
                }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

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
