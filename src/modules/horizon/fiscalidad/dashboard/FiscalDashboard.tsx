import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';
import FiscalPageShell from '../components/FiscalPageShell';
import { cargarHistoricoFiscal } from '../../../../services/fiscalHistoryService';
import { generarEventosFiscales } from '../../../../services/fiscalPaymentsService';
import { getAllEjercicios } from '../../../../services/ejercicioFiscalService';
import ColdStartFiscal from '../estado/ColdStartFiscal';
import {
  getNivelConfianza,
  getConfianzaLabel,
  getConfianzaStyles,
} from '../../../../services/estimacionFiscalEnCursoService';
import {
  generarAlertasFiscales,
  descartarAlerta,
  AlertaFiscal,
} from '../../../../services/alertasFiscalesService';
import {
  calcularRentabilidadTodosInmuebles,
  getRentabilidadColor,
  RentabilidadInmueble,
} from '../../../../services/rentabilidadInmuebleService';
import { useFiscalData } from '../../../../contexts/FiscalContext';
import { getOpexRulesForProperty } from '../../../../services/opexService';
import type { OpexRule } from '../../../../services/db';

const fmtAmount = (n: number) =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const fmtMoney = (n: number) => `${fmtAmount(Math.abs(n))} €`;

const fmtMoneyShort = (n: number) =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(n)) + ' €';

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 600,
  color: 'var(--n-900)',
};



const FiscalDashboard: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { declaracion, estimacion, loading: contextLoading } = useFiscalData();
  const ejercicio = new Date().getFullYear();
  const [showColdStart, setShowColdStart] = useState(false);
  const [isColdStart, setIsColdStart] = useState(false);
  const [coldStartDismissed, setColdStartDismissed] = useState(false);

  // T24: Alertas proactivas
  const [alertasFiscales, setAlertasFiscales] = useState<AlertaFiscal[]>([]);
  const [showAllAlertas, setShowAllAlertas] = useState(false);

  // T25: Rentabilidad por inmueble
  const [rentabilidades, setRentabilidades] = useState<RentabilidadInmueble[]>([]);

  // C7: Expense tags per inmueble
  const [opexByInmueble, setOpexByInmueble] = useState<Record<number, OpexRule[]>>({});

  // Additional data loading: secondary data that depends on the declaration
  const [secondaryLoading, setSecondaryLoading] = useState(false);
  const loading = contextLoading || secondaryLoading;

  const currentYear = new Date().getFullYear();
  const years = useMemo(() => [currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4], [currentYear]);

  useEffect(() => {
    if (!declaracion || contextLoading) return;
    let cancelled = false;
    setSecondaryLoading(true);

    (async () => {
      try {
        const historico = await cargarHistoricoFiscal(years);
        if (cancelled) return;
        await generarEventosFiscales(ejercicio, declaracion);

        // T24: Generate alerts
        try {
          const alertas = await generarAlertasFiscales(declaracion, ejercicio);
          if (!cancelled) setAlertasFiscales(alertas);
        } catch {
          if (!cancelled) setAlertasFiscales([]);
        }

        // T25: Calculate rentabilidad
        try {
          const rents = await calcularRentabilidadTodosInmuebles(declaracion);
          if (!cancelled) setRentabilidades(rents);
        } catch {
          if (!cancelled) setRentabilidades([]);
        }

        // C7: Load opex rules per inmueble
        try {
          const inmuebleIds = declaracion.baseGeneral.rendimientosInmuebles
            .filter(inm => inm.inmuebleId >= 0)
            .map(inm => inm.inmuebleId);
          const opexMap: Record<number, OpexRule[]> = {};
          await Promise.all(inmuebleIds.map(async (id) => {
            opexMap[id] = await getOpexRulesForProperty(id);
          }));
          if (!cancelled) setOpexByInmueble(opexMap);
        } catch {
          if (!cancelled) setOpexByInmueble({});
        }

        if (!cancelled) {
          const hasAnyData = historico.some(
            (row) => row.cuotaLiquida !== 0 || row.retenciones !== 0 || row.resultado !== 0 || row.fuente === 'declarado',
          );
          setIsColdStart(!hasAnyData);
        }
      } catch (e) {
        console.error('Error loading fiscal dashboard secondary data:', e);
      } finally {
        if (!cancelled) setSecondaryLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [declaracion, contextLoading, ejercicio, years]);

  useEffect(() => {
    let cancelled = false;
    getAllEjercicios()
      .then((ejercicios) => {
        if (cancelled) return;
        const tieneDatos = ejercicios.some((item) => {
          const resumen = item.declaracionAeat?.basesYCuotas ?? item.calculoAtlas?.basesYCuotas;
          return Boolean(
            item.declaracionAeat
            || item.declaracionAeatPdfRef
            || (resumen && ((resumen.cuotaLiquida ?? 0) !== 0 || (resumen.retencionesTotal ?? 0) !== 0 || (resumen.resultadoDeclaracion ?? 0) !== 0))
          );
        });
        const dismissColdStart = Boolean((location.state as { dismissColdStart?: boolean } | null)?.dismissColdStart);
        setShowColdStart(!tieneDatos && !dismissColdStart);
      })
      .catch((error) => console.error('Error comprobando cold start fiscal:', error));

    return () => {
      cancelled = true;
    };
  }, [location.state]);

  // T23: Confidence badge
  const confianza = useMemo(() => {
    if (!estimacion) return null;
    const nivel = getNivelConfianza(estimacion.cobertura.mesesConDatos);
    return {
      nivel,
      label: getConfianzaLabel(nivel),
      styles: getConfianzaStyles(nivel),
    };
  }, [estimacion]);

  const ingresosResumen = useMemo(() => {
    if (!declaracion) return 0;
    const trabajo = declaracion.baseGeneral.rendimientosTrabajo?.salarioBrutoAnual ?? 0;
    const inmuebles = declaracion.baseGeneral.rendimientosInmuebles.reduce((sum, i) => sum + i.ingresosIntegros, 0);
    const actividad = declaracion.baseGeneral.rendimientosAutonomo?.ingresos ?? 0;
    return trabajo + inmuebles + actividad;
  }, [declaracion]);

  const gastosResumen = useMemo(() => {
    if (!declaracion) return 0;
    return declaracion.baseGeneral.rendimientosInmuebles.reduce((sum, i) =>
      sum + i.gastosDeducibles + i.amortizacion, 0);
  }, [declaracion]);

  // T24: Dismiss alert handler
  const handleDismissAlerta = useCallback((alertaId: string) => {
    descartarAlerta(ejercicio, alertaId);
    setAlertasFiscales(prev => prev.filter(a => a.id !== alertaId));
  }, [ejercicio]);

  // T24: Visible alerts (max 5)
  const alertasVisibles = useMemo(() => {
    if (showAllAlertas) return alertasFiscales;
    return alertasFiscales.slice(0, 5);
  }, [alertasFiscales, showAllAlertas]);

  // T25: Get rentabilidad for a specific inmueble
  const getRentabilidad = useCallback((inmuebleId: number) => {
    return rentabilidades.find(r => r.inmuebleId === inmuebleId);
  }, [rentabilidades]);

  if (showColdStart) {
    return (
      <FiscalPageShell>
        <ColdStartFiscal onDismiss={() => setShowColdStart(false)} />
      </FiscalPageShell>
    );
  }

  if (!loading && isColdStart && !coldStartDismissed) {
    return (
      <PageLayout title="Estado fiscal" subtitle="Tu situación fiscal en ATLAS">
        <ColdStartFiscal onDismiss={() => setColdStartDismissed(true)} />
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Estado fiscal" subtitle="Histórico + situación del año en curso">
      <div style={{ display: 'grid', gap: 'var(--s4)', fontFamily: 'var(--font-ui, IBM Plex Sans, sans-serif)' }}>
        <header>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: 'var(--n-900)' }}>Estado fiscal</h1>
          <p style={{ margin: '6px 0 0', color: 'var(--n-500)', fontSize: 'var(--t-xs, 12px)' }}>Estimación ejercicio {ejercicio} con los datos disponibles</p>
        </header>

        {loading || !declaracion ? (
          <section style={{ display: 'grid', gap: 16 }}>
            {/* Skeleton: hero resultado */}
            <div>
              <div style={{ background: 'var(--n-100)', borderRadius: 'var(--r-md, 12px)', height: 20, width: 160, marginBottom: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div style={{ background: 'var(--n-100)', borderRadius: 'var(--r-md, 12px)', height: 48, width: 240, marginBottom: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div style={{ background: 'var(--n-100)', borderRadius: 'var(--r-md, 12px)', height: 14, width: 320, animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
            {/* Skeleton: 3 cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 18 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ background: 'var(--n-50)', borderRadius: 'var(--r-lg, 16px)', padding: '18px 22px' }}>
                  <div style={{ background: 'var(--n-100)', borderRadius: 'var(--r-sm, 8px)', height: 12, width: 80, marginBottom: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
                  <div style={{ background: 'var(--n-100)', borderRadius: 'var(--r-sm, 8px)', height: 22, width: 120, marginBottom: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
                  <div style={{ background: 'var(--n-100)', borderRadius: 'var(--r-sm, 8px)', height: 12, width: 100, animation: 'pulse 1.5s ease-in-out infinite' }} />
                </div>
              ))}
            </div>
            <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
          </section>
        ) : (
          <>
            {/* ── T23: Hero resultado con badge de confianza ── */}
            <section style={{ display: 'grid', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <span style={{ color: 'var(--n-700)', fontSize: 16 }}>Resultado estimado</span>
                  {/* T23: Badge de confianza */}
                  {confianza && (
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: 'var(--r-sm, 8px)',
                      fontSize: 'var(--t-xs, 12px)',
                      fontWeight: 500,
                      background: confianza.styles.background,
                      color: confianza.styles.color,
                    }}>
                      {confianza.label}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
                  {/* T23: Hero resultado — IBM Plex Mono, --t-2xl */}
                  <strong style={{
                    fontSize: 'var(--t-2xl, 48px)',
                    lineHeight: 1,
                    color: declaracion.resultado > 0 ? 'var(--s-neg)' : 'var(--s-pos)',
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontWeight: 500,
                  }}>
                    {fmtMoney(declaracion.resultado)}
                  </strong>
                  <span style={{ color: declaracion.resultado > 0 ? 'var(--s-neg)' : 'var(--s-pos)', fontSize: 18 }}>
                    {declaracion.resultado > 0 ? 'a pagar' : 'a devolver'}
                  </span>
                </div>
                {/* T23: Subtexto fórmula */}
                <p style={{ margin: '10px 0 0', color: 'var(--n-500)', fontSize: 'var(--t-xs, 12px)' }}>
                  Cuota {fmtMoney(declaracion.liquidacion.cuotaLiquida)} − Retenciones {fmtMoney(declaracion.retenciones.total)} = {fmtMoney(declaracion.resultado)} · Tipo medio {declaracion.tipoEfectivo.toFixed(1)}%
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 18 }}>
                {[
                  { label: 'Ingresos', value: ingresosResumen, helper: 'Trabajo + inmuebles + actividad' },
                  { label: 'Gastos deducibles', value: gastosResumen, helper: ingresosResumen > 0 ? `${Math.round((gastosResumen / ingresosResumen) * 100)}% de ingresos` : 'Sin ingresos' },
                  { label: 'Retenciones', value: declaracion.retenciones.total, helper: declaracion.retenciones.trabajo > 0 ? 'Trabajo + M130 + capital' : 'Sin retenciones confirmadas' },
                ].map((card) => (
                  <div key={card.label} style={{ background: 'var(--n-50)', borderRadius: 'var(--r-lg, 16px)', padding: '18px 22px' }}>
                    <div style={{ color: 'var(--n-500)', marginBottom: 8, fontSize: 'var(--t-xs, 12px)' }}>{card.label}</div>
                    <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 22, color: 'var(--n-900)', marginBottom: 6 }}>{fmtMoney(card.value)}</div>
                    <div style={{ color: 'var(--n-500)', fontSize: 'var(--t-xs, 12px)' }}>{card.helper}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* ── T24: Alertas proactivas ── */}
            {alertasFiscales.length > 0 && (
              <section style={{ display: 'grid', gap: 8 }}>
                <h2 style={{ ...sectionTitleStyle, fontSize: 18 }}>Alertas</h2>
                {alertasVisibles.map((alerta) => {
                  const isWarning = alerta.prioridad === 'alta' || alerta.prioridad === 'media';
                  return (
                    <div
                      key={alerta.id}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 'var(--r-md, 12px)',
                        background: isWarning ? 'var(--s-warn-bg)' : 'var(--n-100)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                      }}
                    >
                      <div style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: isWarning ? 'var(--s-warn)' : 'var(--n-500)',
                        flexShrink: 0,
                        marginTop: 6,
                      }} />
                      <div style={{ flex: 1, fontSize: 'var(--t-xs, 12px)', lineHeight: 1.5, color: isWarning ? 'var(--s-warn)' : 'var(--n-700)' }}>
                        <span>{alerta.descripcion}</span>
                        {alerta.accion && (
                          <button
                            type="button"
                            onClick={() => navigate(alerta.accion!.ruta)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--blue)',
                              fontSize: 'var(--t-xs, 12px)',
                              fontWeight: 500,
                              cursor: 'pointer',
                              marginLeft: 8,
                              padding: 0,
                            }}
                          >
                            {alerta.accion.label}
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDismissAlerta(alerta.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 4,
                          color: isWarning ? 'var(--s-warn)' : 'var(--n-500)',
                          flexShrink: 0,
                          minWidth: 44,
                          minHeight: 44,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        aria-label="Descartar alerta"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  );
                })}
                {alertasFiscales.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setShowAllAlertas(prev => !prev)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--blue)',
                      fontSize: 'var(--t-xs, 12px)',
                      fontWeight: 500,
                      cursor: 'pointer',
                      padding: '8px 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {showAllAlertas ? 'Ver menos' : `Ver más (${alertasFiscales.length - 5})`}
                    {showAllAlertas ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                )}
              </section>
            )}

            {/* ── Inmuebles con T25: Rentabilidad ── */}
            {declaracion.baseGeneral.rendimientosInmuebles.length > 0 && (
              <section style={{ display: 'grid', gap: 16 }}>
                <h2 style={{ ...sectionTitleStyle, fontSize: 18 }}>Inmuebles</h2>
                {declaracion.baseGeneral.rendimientosInmuebles
                  .filter(inm => inm.inmuebleId >= 0)
                  .map((inmueble) => {
                    const rent = getRentabilidad(inmueble.inmuebleId);
                    return (
                      <article key={inmueble.inmuebleId} style={{ border: '1px solid var(--n-200)', borderRadius: 'var(--r-lg, 16px)', padding: '18px 24px', background: 'var(--white)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, alignItems: 'flex-start' }}>
                          <div>
                            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 500, color: 'var(--n-900)' }}>{inmueble.alias}</h3>
                            <p style={{ margin: '4px 0 0', color: 'var(--n-500)', fontSize: 'var(--t-xs, 12px)' }}>
                              {inmueble.esHabitual ? 'Habitual' : 'Alquiler'} · {inmueble.diasAlquilado} días arrendado
                            </p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ color: 'var(--n-500)', fontSize: 'var(--t-xs, 12px)' }}>Rendimiento neto</div>
                            <div style={{ fontFamily: 'IBM Plex Mono, monospace', color: inmueble.rendimientoNeto >= 0 ? 'var(--s-pos)' : 'var(--s-neg)', fontSize: 18, fontWeight: 500 }}>
                              {fmtMoney(inmueble.rendimientoNeto)}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 20, marginTop: 18, paddingBottom: 14, borderBottom: '1px solid var(--n-200)' }}>
                          <div>
                            <div style={{ color: 'var(--n-500)', fontSize: 'var(--t-xs, 12px)' }}>Ingresos</div>
                            <div style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{fmtMoney(inmueble.ingresosIntegros)}</div>
                          </div>
                          <div>
                            <div style={{ color: 'var(--n-500)', fontSize: 'var(--t-xs, 12px)' }}>Gastos + amortización</div>
                            <div style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{fmtMoney(inmueble.gastosDeducibles + inmueble.amortizacion)}</div>
                          </div>
                          <div>
                            <div style={{ color: 'var(--n-500)', fontSize: 'var(--t-xs, 12px)' }}>Reducción</div>
                            <div style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                              {inmueble.reduccionHabitual > 0
                                ? `${fmtMoney(inmueble.reduccionHabitual)} (${Math.round(inmueble.porcentajeReduccionHabitual * 100)}%)`
                                : '–'}
                            </div>
                          </div>
                        </div>

                        {/* T25: Rentabilidad neta */}
                        {rent && (
                          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                            <div>
                              <span style={{ fontSize: 'var(--t-xs, 12px)', color: 'var(--n-500)' }}>Rentabilidad neta </span>
                              {rent.rentabilidadPorcentaje !== null ? (
                                <span style={{
                                  fontFamily: 'IBM Plex Mono, monospace',
                                  fontSize: 'var(--t-xs, 12px)',
                                  fontWeight: 500,
                                  color: getRentabilidadColor(rent.rentabilidadPorcentaje),
                                }}>
                                  {rent.rentabilidadPorcentaje.toFixed(1)}% sobre inversión
                                </span>
                              ) : (
                                <span
                                  style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 'var(--t-xs, 12px)', color: 'var(--n-500)' }}
                                  title={rent.datosFaltantes.length > 0 ? `Faltan: ${rent.datosFaltantes.join(', ')}` : 'Sin datos de inversión'}
                                >
                                  —
                                </span>
                              )}
                            </div>
                            {rent.cashflowNeto !== 0 && (
                              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 'var(--t-xs, 12px)', color: 'var(--n-500)' }}>
                                Cashflow: {fmtMoneyShort(rent.cashflowNeto)}/año
                              </span>
                            )}
                          </div>
                        )}

                        {/* C7: Expense category tags */}
                        {(() => {
                          const rules = opexByInmueble[inmueble.inmuebleId] ?? [];
                          const EXPECTED_CATEGORIES: { key: string; label: string; match: (r: OpexRule) => boolean; alwaysRegistered?: boolean }[] = [
                            { key: 'comunidad', label: 'Comunidad', match: (r) => r.categoria === 'comunidad' },
                            { key: 'ibi', label: 'IBI', match: (r) => r.categoria === 'impuesto' && r.concepto.toLowerCase().includes('ibi') },
                            { key: 'seguro', label: 'Seguro', match: (r) => r.categoria === 'seguro' },
                            { key: 'suministros', label: 'Suministros', match: (r) => r.categoria === 'suministro' },
                            { key: 'amortizacion', label: 'Amortización', match: () => true, alwaysRegistered: true },
                            { key: 'intereses', label: 'Intereses hipoteca', match: (r) => r.concepto.toLowerCase().includes('hipoteca') || r.concepto.toLowerCase().includes('interés') || r.concepto.toLowerCase().includes('interes') },
                            { key: 'reparaciones', label: 'Reparaciones', match: (r) => r.concepto.toLowerCase().includes('reparac') || r.concepto.toLowerCase().includes('conservac') },
                          ];
                          return (
                            <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {EXPECTED_CATEGORIES.map((cat) => {
                                const registered = cat.alwaysRegistered || rules.some((r) => r.activo && cat.match(r));
                                if (registered) {
                                  return (
                                    <span key={cat.key} style={{
                                      padding: '3px 10px',
                                      borderRadius: 'var(--r-sm, 8px)',
                                      fontSize: 'var(--t-xs, 12px)',
                                      background: 'var(--n-100)',
                                      color: 'var(--n-500)',
                                    }}>
                                      {cat.label}
                                    </span>
                                  );
                                }
                                return (
                                  <button
                                    key={cat.key}
                                    type="button"
                                    onClick={() => navigate(`/inmuebles/${inmueble.inmuebleId}/gastos`)}
                                    style={{
                                      padding: '3px 10px',
                                      borderRadius: 'var(--r-sm, 8px)',
                                      fontSize: 'var(--t-xs, 12px)',
                                      background: 'var(--s-warn-bg)',
                                      color: 'var(--s-warn)',
                                      border: 'none',
                                      cursor: 'pointer',
                                      minHeight: 28,
                                    }}
                                  >
                                    + {cat.label}
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </article>
                    );
                  })}
              </section>
            )}
          </>
        )}
      </div>
    </PageLayout>
  );
};

export default FiscalDashboard;
