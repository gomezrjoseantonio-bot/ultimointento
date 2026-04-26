import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Scale, X } from 'lucide-react';
import FiscalPageShell from '../components/FiscalPageShell';
import EjercicioPillSelector from '../components/EjercicioPillSelector';
import {
  bootstrapEjercicios,
  getEjercicio,
  getDeclaracion,
  getInmueblesDelEjercicio,
  getTodosLosEjercicios,
  getArrastresParaAño,
  syncAndCleanupLegacyStore,
} from '../../../../services/ejercicioResolverService';
import type { EjercicioFiscalCoord, ResumenFiscal } from '../../../../services/ejercicioResolverService';
import { useFiscalData } from '../../../../contexts/FiscalContext';
import {
  generarAlertasFiscales,
  descartarAlerta,
  AlertaFiscal,
} from '../../../../services/alertasFiscalesService';
import { getOpexRulesForProperty } from '../../../../services/opexService';
import type { OpexRule } from '../../../../services/db';

// ── Formatters ──────────────────────────────────────────────
const fmtAmount = (n: number) =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const fmtMoney = (n: number) => `${fmtAmount(Math.abs(n))} €`;
const fmtMoneyShort = (n: number) =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(n)) + ' €';

// ── Estado badge config ─────────────────────────────────────
type EstadoType = EjercicioFiscalCoord['estado'];

const ESTADO_BADGE: Record<EstadoType, { label: string; bg: string; color: string }> = {
  en_curso: { label: 'En curso', bg: 'var(--s-pos-bg)', color: 'var(--s-pos)' },
  pendiente: { label: 'Pendiente', bg: 'var(--s-warn-bg)', color: 'var(--s-warn)' },
  declarado: { label: 'Finalizado', bg: 'var(--n-100)', color: 'var(--n-500)' },
  prescrito: { label: 'Prescrito', bg: 'var(--n-100)', color: 'var(--n-300)' },
};

const ESTADO_LABEL: Record<EstadoType, string> = {
  en_curso: 'Estimación con los datos disponibles',
  pendiente: 'Cálculo previo con datos de ATLAS',
  declarado: 'Resultado declarado',
  prescrito: 'Resultado declarado (prescrito)',
};

// ── Expected expense categories ─────────────────────────────
const EXPECTED_CATEGORIES: { key: string; label: string; match: (r: OpexRule) => boolean; alwaysRegistered?: boolean }[] = [
  { key: 'comunidad', label: 'Comunidad', match: (r) => r.categoria === 'comunidad' },
  { key: 'ibi', label: 'IBI', match: (r) => r.categoria === 'impuesto' && r.concepto.toLowerCase().includes('ibi') },
  { key: 'seguro', label: 'Seguro', match: (r) => r.categoria === 'seguro' },
  { key: 'suministros', label: 'Suministros', match: (r) => r.categoria === 'suministro' },
  { key: 'amortizacion', label: 'Amortización', match: () => true, alwaysRegistered: true },
  { key: 'intereses', label: 'Intereses hipoteca', match: (r) => r.concepto.toLowerCase().includes('hipoteca') || r.concepto.toLowerCase().includes('interés') || r.concepto.toLowerCase().includes('interes') },
  { key: 'reparaciones', label: 'Reparaciones', match: (r) => r.concepto.toLowerCase().includes('reparac') || r.concepto.toLowerCase().includes('conservac') },
];

// ── Component ───────────────────────────────────────────────
type FuenteResolver = Awaited<ReturnType<typeof getDeclaracion>>['fuente'];

const FiscalDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { declaracion, loading: contextLoading } = useFiscalData();

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [ejercicio, setEjercicio] = useState<EjercicioFiscalCoord | null>(null);
  const [resumen, setResumen] = useState<ResumenFiscal | null>(null);
  const [fuente, setFuente] = useState<FuenteResolver>('ninguno');
  const [allYears, setAllYears] = useState<number[]>([]);
  const [arrastresTotal, setArrastresTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Alerts
  const [alertasFiscales, setAlertasFiscales] = useState<AlertaFiscal[]>([]);
  const [showAllAlertas, setShowAllAlertas] = useState(false);

  // Opex per inmueble
  const [opexByInmueble, setOpexByInmueble] = useState<Record<number, OpexRule[]>>({});

  // Load available years (with one-time cleanup of garbage records)
  useEffect(() => {
    // BUG-08: syncAndCleanupLegacyStore runs once per session to migrate legacy ejerciciosFiscales → coord
    syncAndCleanupLegacyStore()
      .catch(() => { /* non-blocking: migration failures don't affect UI */ });
    bootstrapEjercicios()
      .catch(() => { /* non-blocking: cleanup failures don't affect UI */ })
      .finally(() => {
        getTodosLosEjercicios().then((todos) => {
          const years = todos.map((e) => e.año).sort((a, b) => b - a);
          if (years.length === 0) {
            const defaultYears = Array.from({ length: 7 }, (_, i) => currentYear - i);
            setAllYears(defaultYears);
          } else {
            setAllYears(years);
          }
        }).catch(() => {
          setAllYears(Array.from({ length: 7 }, (_, i) => currentYear - i));
        });
      });
  }, [currentYear]);

  // Load exercise data when year changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const [ej, decl, arrastres] = await Promise.all([
          getEjercicio(selectedYear),
          getDeclaracion(selectedYear),
          getArrastresParaAño(selectedYear),
        ]);
        if (cancelled) return;
        setEjercicio(ej);
        setFuente(decl.fuente);
        setResumen(decl.resumen);

        // Calculate total arrastres
        const totalArrastres =
          arrastres.gastosPendientes.reduce((s, g) => s + g.importePendiente, 0) +
          arrastres.perdidasPatrimoniales.reduce((s, p) => s + p.importePendiente, 0);
        setArrastresTotal(totalArrastres);

        // Load opex rules for inmuebles
        try {
          const inmuebleIds = await getInmueblesDelEjercicio(selectedYear);
          const opexMap: Record<number, OpexRule[]> = {};
          await Promise.all(inmuebleIds.map(async (id) => {
            opexMap[id] = await getOpexRulesForProperty(id);
          }));
          if (!cancelled) setOpexByInmueble(opexMap);
        } catch {
          if (!cancelled) setOpexByInmueble({});
        }
      } catch (e) {
        console.error('Error loading fiscal estado:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [selectedYear]);

  // Load alerts (only for en_curso/pendiente, not for finalized)
  useEffect(() => {
    if (!declaracion || !ejercicio) return;
    if (ejercicio.estado === 'declarado' || ejercicio.estado === 'prescrito') {
      setAlertasFiscales([]);
      return;
    }
    let cancelled = false;
    generarAlertasFiscales(declaracion, selectedYear)
      .then((alertas) => { if (!cancelled) setAlertasFiscales(alertas); })
      .catch(() => { if (!cancelled) setAlertasFiscales([]); });
    return () => { cancelled = true; };
  }, [declaracion, ejercicio, selectedYear]);

  const handleDismissAlerta = useCallback((alertaId: string) => {
    descartarAlerta(selectedYear, alertaId);
    setAlertasFiscales((prev) => prev.filter((a) => a.id !== alertaId));
  }, [selectedYear]);

  const alertasVisibles = useMemo(() => {
    return showAllAlertas ? alertasFiscales : alertasFiscales.slice(0, 5);
  }, [alertasFiscales, showAllAlertas]);

  // Derive amounts from resolver resumen or FiscalContext declaracion
  const resultado = resumen?.resultado ?? declaracion?.resultado ?? 0;
  const cuotaIntegraTotal = resumen
    ? (resumen.cuotaIntegraEstatal + resumen.cuotaIntegraAutonomica)
    : (declaracion?.liquidacion?.cuotaIntegra ?? 0);
  const cuotaLiquidaTotal = resumen
    ? (resumen.cuotaLiquidaEstatal + resumen.cuotaLiquidaAutonomica)
    : (declaracion?.liquidacion?.cuotaLiquida ?? 0);

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

  const estado = ejercicio?.estado ?? 'en_curso';
  const badge = ESTADO_BADGE[estado];
  const hasData = fuente !== 'ninguno';

  const isLoading = loading || (selectedYear === currentYear && contextLoading);

  return (
    <FiscalPageShell>
      <div style={{ display: 'grid', gap: 'var(--s4, 16px)', fontFamily: 'var(--font-base, IBM Plex Sans, sans-serif)' }}>
        {/* ── Canonical header ── */}
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Scale size={40} strokeWidth={1.5} style={{ color: 'var(--blue)', flexShrink: 0 }} />
            <div>
              <h1 style={{ margin: 0, fontSize: 'var(--t-xl, 24px)', fontWeight: 600, color: 'var(--n-900)' }}>
                Impuestos
              </h1>
              <p style={{ margin: '4px 0 0', color: 'var(--n-500)', fontSize: 'var(--t-xs, 12px)' }}>
                {ESTADO_LABEL[estado]}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              padding: '4px 12px',
              borderRadius: 999,
              fontSize: 'var(--t-xs, 12px)',
              fontWeight: 500,
              background: badge.bg,
              color: badge.color,
            }}>
              {selectedYear} · {badge.label}
            </span>
          </div>
        </header>

        {/* ── Exercise selector pills ── */}
        {allYears.length > 0 && (
          <EjercicioPillSelector value={selectedYear} onChange={setSelectedYear} years={allYears} />
        )}

        {/* ── Loading skeleton ── */}
        {isLoading ? (
          <section style={{ display: 'grid', gap: 16 }}>
            <div>
              <div style={{ background: 'var(--n-100)', borderRadius: 'var(--r-md, 8px)', height: 16, width: 160, marginBottom: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div style={{ background: 'var(--n-100)', borderRadius: 'var(--r-md, 8px)', height: 40, width: 240, marginBottom: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div style={{ background: 'var(--n-100)', borderRadius: 'var(--r-md, 8px)', height: 14, width: 320, animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ background: 'var(--n-50)', borderRadius: 'var(--r-md, 8px)', padding: '18px 22px' }}>
                  <div style={{ background: 'var(--n-100)', borderRadius: 'var(--r-sm, 4px)', height: 12, width: 80, marginBottom: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
                  <div style={{ background: 'var(--n-100)', borderRadius: 'var(--r-sm, 4px)', height: 22, width: 120, animation: 'pulse 1.5s ease-in-out infinite' }} />
                </div>
              ))}
            </div>
            <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
          </section>
        ) : !hasData ? (
          /* ── Empty state ── */
          <section style={{
            padding: 48,
            textAlign: 'center',
            background: 'var(--n-50)',
            borderRadius: 'var(--r-lg, 12px)',
            border: '1px dashed var(--n-300)',
          }}>
            <p style={{ margin: 0, color: 'var(--n-500)', fontSize: 'var(--t-sm, 13px)' }}>
              No hay datos para {selectedYear}. Importa la declaración o los Datos Fiscales.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 }}>
              <button
                type="button"
                onClick={() => navigate('/fiscalidad/historial')}
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
                  fontFamily: 'var(--font-base, IBM Plex Sans, sans-serif)',
                }}
              >
                Importar datos
              </button>
            </div>
          </section>
        ) : (
          <>
            {/* ── Hero resultado ── */}
            <section>
              <div style={{
                fontSize: 'var(--t-xs, 11px)',
                color: 'var(--n-500)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: 8,
              }}>
                Resultado estimado
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <strong style={{
                  fontSize: 'var(--t-2xl, 2rem)',
                  lineHeight: 1,
                  color: resultado > 0 ? 'var(--s-neg)' : 'var(--s-pos)',
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontWeight: 500,
                }}>
                  {fmtMoney(resultado)}
                </strong>
                <span style={{
                  color: resultado > 0 ? 'var(--s-neg)' : 'var(--s-pos)',
                  fontSize: 'var(--t-base, 14px)',
                  fontWeight: 500,
                }}>
                  {resultado > 0 ? 'a pagar' : 'a devolver'}
                </span>
              </div>
              <p style={{ margin: '8px 0 0', color: 'var(--n-500)', fontSize: 'var(--t-xs, 11px)' }}>
                Cuota íntegra {fmtMoney(cuotaIntegraTotal)} − Cuota líquida {fmtMoney(cuotaLiquidaTotal)}
              </p>
            </section>

            {/* ── 3 KPIs ── */}
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
              {[
                { label: 'INGRESOS TOTALES', value: ingresosResumen },
                { label: 'GASTOS DEDUCIBLES', value: gastosResumen },
                { label: 'ARRASTRES APLICADOS', value: arrastresTotal },
              ].map((kpi) => (
                <div key={kpi.label} style={{
                  background: 'var(--n-50)',
                  borderRadius: 'var(--r-md, 8px)',
                  padding: '16px 20px',
                }}>
                  <div style={{
                    color: 'var(--n-500)',
                    fontSize: 'var(--t-xs, 11px)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: 8,
                  }}>
                    {kpi.label}
                  </div>
                  <div style={{
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontSize: 'var(--t-lg, 1.25rem)',
                    color: 'var(--n-900)',
                  }}>
                    {fmtMoneyShort(kpi.value)}
                  </div>
                </div>
              ))}
            </section>

            {/* ── Inmuebles ── */}
            {declaracion && declaracion.baseGeneral.rendimientosInmuebles.length > 0 && (
              <section style={{ display: 'grid', gap: 12 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--n-900)' }}>Inmuebles</h2>
                {declaracion.baseGeneral.rendimientosInmuebles
                  .filter((inm) => inm.inmuebleId >= 0)
                  .map((inmueble) => {
                    const rules = opexByInmueble[inmueble.inmuebleId] ?? [];
                    return (
                      <article
                        key={inmueble.inmuebleId}
                        style={{
                          border: '1px solid var(--n-200)',
                          borderRadius: 'var(--r-lg, 12px)',
                          padding: '16px 20px',
                          background: 'var(--white)',
                          transition: 'all 150ms ease',
                        }}
                      >
                        {/* Top row: name + rendimiento */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
                          <div>
                            <h3 style={{
                              margin: 0,
                              fontFamily: 'IBM Plex Sans, sans-serif',
                              fontSize: 'var(--t-sm, 13px)',
                              fontWeight: 500,
                              color: 'var(--n-900)',
                            }}>
                              {inmueble.alias}
                            </h3>
                            <p style={{
                              margin: '2px 0 0',
                              fontSize: 'var(--t-xs, 11px)',
                              color: 'var(--n-500)',
                            }}>
                              {`${inmueble.diasAlquilado} días arrendado`}
                              {inmueble.esHabitual ? ' · larga estancia' : ' · alquiler'}
                            </p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 'var(--t-xs, 11px)', color: 'var(--n-500)' }}>Rto</div>
                            <div style={{
                              fontFamily: 'IBM Plex Mono, monospace',
                              fontSize: 'var(--t-sm, 13px)',
                              fontWeight: 500,
                              color: inmueble.rendimientoNeto >= 0 ? 'var(--s-pos)' : 'var(--s-neg)',
                            }}>
                              {fmtMoney(inmueble.rendimientoNeto)}
                            </div>
                          </div>
                        </div>

                        {/* Income/Expenses row */}
                        <div style={{
                          display: 'flex',
                          gap: 24,
                          marginTop: 12,
                          fontSize: 'var(--t-xs, 11px)',
                        }}>
                          <span style={{ color: 'var(--n-700)' }}>
                            Ingresos: <span style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{fmtMoneyShort(inmueble.ingresosIntegros)}</span>
                          </span>
                          <span style={{ color: 'var(--n-700)' }}>
                            Gastos: <span style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{fmtMoneyShort(inmueble.gastosDeducibles + inmueble.amortizacion)}</span>
                          </span>
                        </div>

                        {/* Expense tags */}
                        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {EXPECTED_CATEGORIES.map((cat) => {
                            const registered = cat.alwaysRegistered || rules.some((r) => r.activo && cat.match(r));
                            if (registered) {
                              return (
                                <span key={cat.key} style={{
                                  padding: '3px 10px',
                                  borderRadius: 'var(--r-sm, 4px)',
                                  fontSize: 'var(--t-xs, 11px)',
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
                                  borderRadius: 'var(--r-sm, 4px)',
                                  fontSize: 'var(--t-xs, 11px)',
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
                      </article>
                    );
                  })}
              </section>
            )}

            {/* ── Atención (alertas) ── */}
            {alertasFiscales.length > 0 && estado !== 'declarado' && estado !== 'prescrito' && (
              <section style={{ display: 'grid', gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--n-900)' }}>Atención</h2>
                {alertasVisibles.map((alerta) => (
                  <div
                    key={alerta.id}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--r-md, 8px)',
                      background: 'var(--s-warn-bg)',
                      color: 'var(--s-warn)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      fontSize: 'var(--t-xs, 12px)',
                      lineHeight: 1.5,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      {alerta.descripcion}
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
                      aria-label="Descartar alerta"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 4,
                        color: 'var(--s-warn)',
                        flexShrink: 0,
                        minWidth: 44,
                        minHeight: 44,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                {alertasFiscales.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setShowAllAlertas((prev) => !prev)}
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
          </>
        )}
      </div>
    </FiscalPageShell>
  );
};

export default FiscalDashboard;
