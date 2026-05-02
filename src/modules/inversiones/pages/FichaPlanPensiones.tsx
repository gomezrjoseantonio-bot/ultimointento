// T23.6.4 · Ficha detallada de plan de pensiones.
// Implementa §4 completo de docs/TAREA-23-6-wizard-y-galeria-unificada.md.
// Mockup de referencia · docs/audit-inputs/atlas-inversiones-v2.html §1615-1802 (Plan Orange BBVA).
//
// REGLAS:
//  · Cero hex hardcoded · tokens v5.
//  · NO refactorizar servicios · solo leer/escribir con firma pública.
//  · "Actualizar valoración" es la única acción autónoma que escribe valores.
//  · "Aportar" sigue camino doble: movements + treasuryEvents + aportacionesPlan.
//  · "Editar" usa PlanFormV5 · NO toca movimientos.

import React, { useCallback, useEffect, useMemo, useId, useState } from 'react';
import { Icons } from '../../../design-system/v5';
import { showToastV5 } from '../../../design-system/v5';
import { aportacionesPlanService } from '../../../services/aportacionesPlanService';
import { getFiscalContextSafe } from '../../../services/fiscalContextService';
import { calcularEstimacionEnCurso } from '../../../services/estimacionFiscalEnCursoService';
import type { AportacionPlan, PlanPensiones, TipoAdministrativo } from '../../../types/planesPensiones';
import type { ValoracionHistorica } from '../../../types/valoraciones';
import ActualizarValorPlanDialog from '../components/ActualizarValorPlanDialog';
import AportacionPlanDialog from '../components/AportacionPlanDialog';
import FichaShell from '../components/FichaShell';
import PlanFormV5 from '../components/wizard/PlanFormV5';
import { getEntidadLogoConfig } from '../utils/entidadLogo';
import styles from './FichaPosicion.module.css';

// ── Mapping label tipo administrativo ────────────────────────────────────────

const TIPO_ADMIN_LABEL: Record<TipoAdministrativo, string> = {
  PPI: 'Plan Pensiones Individual',
  PPE: 'Plan Pensiones Empleo',
  PPES: 'Plan Pensiones Empleo Simplificado',
  PPA: 'Plan Pensiones Asociado',
};

// ── Límites fiscales 2024+ por tipo ──────────────────────────────────────────
// PPI / PPA → 1.500 €. PPE / PPES → 1.500 € titular + hasta 8.500 € empresa.
const getLimiteAnual = (tipo: TipoAdministrativo): number =>
  tipo === 'PPE' || tipo === 'PPES' ? 10_000 : 1_500;

const getLimiteTitular = (_tipo: TipoAdministrativo): number => 1_500;

// ── Tramos base general (estatal + autonómica media) para tipo marginal estimado ─
// Fuente: alertasFiscalesService.ts · getTipoMarginal. Tarifas 2024+.
// Actualizar cuando cambien las tarifas en LIRPF o escalas autonómicas.
const TRAMOS_MARGINAL = [
  { hasta: 12_450, tipo: 0.19 },
  { hasta: 20_200, tipo: 0.24 },
  { hasta: 35_200, tipo: 0.30 },
  { hasta: 60_000, tipo: 0.37 },
  { hasta: 300_000, tipo: 0.45 },
  { hasta: Infinity, tipo: 0.47 },
];

function getTipoMarginal(base: number): number {
  for (const tramo of TRAMOS_MARGINAL) {
    if (base <= tramo.hasta) return tramo.tipo;
  }
  return 0.47;
}

// ── Helpers de formato ────────────────────────────────────────────────────────

const fmt = (n: number): string =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

const fmtShort = (n: number): string =>
  new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n) + ' €';

const fmtPct = (n: number): string =>
  `${n > 0 ? '+' : ''}${(n * 100).toFixed(1)}%`;

const formatDate = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25;

// ── CAGR desde primera aportación hasta hoy ───────────────────────────────────
function calcularCagr(
  valorActual: number,
  aportadoTotal: number,
  fechaPrimeraAportacion: string | null,
): number | null {
  if (valorActual <= 0 || aportadoTotal <= 0) return null;
  if (!fechaPrimeraAportacion) return null;
  const start = new Date(fechaPrimeraAportacion).getTime();
  if (Number.isNaN(start)) return null;
  const elapsedYears = (Date.now() - start) / MS_PER_YEAR;
  if (elapsedYears < 1) return null;
  return Math.pow(valorActual / aportadoTotal, 1 / elapsedYears) - 1;
}

// ── SparklineDoble · 2 líneas: valor real vs aportado acumulado ───────────────

interface SparklinePunto {
  fecha: string; // YYYY-MM
  valor: number;
  aportadoAcum: number;
}

const W = 800;
const H = 220;
const PAD = 12;

const SparklineDoble: React.FC<{ data: SparklinePunto[] }> = ({ data }) => {
  const reactId = useId();
  const gradId = `spkdbl-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const paths = useMemo(() => {
    if (data.length < 2) return null;

    const xs = data.map((_, i) => i);
    const allVals = data.flatMap((p) => [p.valor, p.aportadoAcum]);
    const minX = 0;
    const maxX = data.length - 1;
    const minY = Math.min(...allVals);
    const maxY = Math.max(...allVals);

    if (maxY <= minY) return null;

    const dx = maxX - minX || 1;
    const dy = maxY - minY || 1;
    const scaleX = (i: number) => PAD + (i / dx) * (W - PAD * 2);
    const scaleY = (y: number) => H - PAD - ((y - minY) / dy) * (H - PAD * 2);

    const lineValor = data
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(xs[i]).toFixed(1)} ${scaleY(p.valor).toFixed(1)}`)
      .join(' ');
    const lineAportado = data
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(xs[i]).toFixed(1)} ${scaleY(p.aportadoAcum).toFixed(1)}`)
      .join(' ');

    // Área bajo curva valor (para gradient)
    const areaValor =
      `${lineValor} ` +
      `L ${scaleX(maxX).toFixed(1)} ${(H - PAD).toFixed(1)} ` +
      `L ${scaleX(0).toFixed(1)} ${(H - PAD).toFixed(1)} Z`;

    return { lineValor, lineAportado, areaValor };
  }, [data]);

  if (!paths) {
    return (
      <div className={styles.bigPlaceholder}>
        <div>Necesitas al menos 2 valoraciones para ver evolución.</div>
      </div>
    );
  }

  return (
    <svg
      className={styles.bigSparkline}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Evolución valor actual vs aportado acumulado"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--atlas-v5-brand)" stopOpacity="0.15" />
          <stop offset="100%" stopColor="var(--atlas-v5-brand)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Área bajo valor actual */}
      <path d={paths.areaValor} fill={`url(#${gradId})`} />
      {/* Línea aportado acumulado (punteada, muted) */}
      <path
        d={paths.lineAportado}
        fill="none"
        stroke="var(--atlas-v5-ink-5)"
        strokeWidth={1.5}
        strokeDasharray="5 3"
        strokeLinecap="round"
      />
      {/* Línea valor actual (sólida, brand) */}
      <path
        d={paths.lineValor}
        fill="none"
        stroke="var(--atlas-v5-brand)"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  planId: string;
  onBack: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

const FichaPlanPensiones: React.FC<Props> = ({ planId, onBack }) => {
  const [plan, setPlan] = useState<PlanPensiones | null | undefined>(undefined);
  const [aportaciones, setAportaciones] = useState<AportacionPlan[]>([]);
  const [valoraciones, setValoraciones] = useState<ValoracionHistorica[]>([]);
  const [marginalIrpf, setMarginalIrpf] = useState<number | null>(null);
  const [hasFiscalContext, setHasFiscalContext] = useState<boolean | null>(null);
  const [ejercicioActual] = useState(new Date().getFullYear());

  const [showActualizarValor, setShowActualizarValor] = useState(false);
  const [showAportar, setShowAportar] = useState(false);
  const [showEditar, setShowEditar] = useState(false);

  // ── Carga plan + aportaciones + valoraciones ──────────────────────────────

  const load = useCallback(async () => {
    try {
      const { planesPensionesService } = await import('../../../services/planesPensionesService');
      const p = await planesPensionesService.getPlan(planId);
      if (!p) { setPlan(null); return; }
      setPlan(p);

      const [aps, valHistoricas] = await Promise.all([
        aportacionesPlanService.getAportacionesPorPlan(planId),
        (async () => {
          try {
            const db = (await import('../../../services/db')).initDB;
            const idb = await db();
            const all = await idb.getAll('valoraciones_historicas' as any) as ValoracionHistorica[];
            return all
              .filter((v) => v.tipo_activo === 'plan_pensiones' && String(v.activo_id) === planId)
              .sort((a, b) => a.fecha_valoracion.localeCompare(b.fecha_valoracion));
          } catch {
            return [];
          }
        })(),
      ]);

      setAportaciones(aps);
      setValoraciones(valHistoricas);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[inversiones] ficha plan · carga', err);
      setPlan(null);
    }
  }, [planId]);

  useEffect(() => { void load(); }, [load]);

  // ── Contexto fiscal + tipo marginal ──────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const ctx = await getFiscalContextSafe();
        if (!ctx || !ctx.comunidadAutonoma) {
          setHasFiscalContext(false);
          return;
        }
        setHasFiscalContext(true);

        // Intentar obtener la base imponible estimada para calcular el marginal real
        try {
          const estimacion = await calcularEstimacionEnCurso();
          if (estimacion?.resultadoEstimado?.baseImponibleGeneral != null) {
            const marginal = getTipoMarginal(estimacion.resultadoEstimado.baseImponibleGeneral);
            setMarginalIrpf(marginal);
          } else {
            // Sin datos de estimación · marginal no disponible
            setMarginalIrpf(null);
          }
        } catch {
          setMarginalIrpf(null);
        }
      } catch {
        setHasFiscalContext(false);
      }
    })();
  }, []);

  // ── Derivados ────────────────────────────────────────────────────────────

  const valorActual = plan?.valorActual ?? 0;

  const { aportadoTotal, aportadoTitular, aportadoEmpresa } = useMemo(() => {
    const aportadoTitular = aportaciones.reduce((s, a) => s + (a.importeTitular ?? 0), 0);
    const aportadoEmpresa = aportaciones.reduce((s, a) => s + (a.importeEmpresa ?? 0), 0);
    return {
      aportadoTotal: aportadoTitular + aportadoEmpresa,
      aportadoTitular,
      aportadoEmpresa,
    };
  }, [aportaciones]);

  const pgLatente = valorActual - aportadoTotal;

  const fechaPrimeraAportacion = useMemo(() => {
    if (!aportaciones.length) return plan?.fechaContratacion ?? null;
    const sorted = [...aportaciones].sort((a, b) => a.fecha.localeCompare(b.fecha));
    return sorted[0]?.fecha ?? plan?.fechaContratacion ?? null;
  }, [aportaciones, plan]);

  const cagr = useMemo(
    () => calcularCagr(valorActual, aportadoTotal, fechaPrimeraAportacion),
    [valorActual, aportadoTotal, fechaPrimeraAportacion],
  );

  // ── Serie sparkline ───────────────────────────────────────────────────────

  const sparklineData = useMemo((): SparklinePunto[] => {
    if (valoraciones.length < 2) return [];

    // Construir mapa de aportado por mes
    const aportacionesPorMes: Record<string, number> = {};
    for (const ap of aportaciones) {
      const mes = ap.fecha.slice(0, 7); // YYYY-MM
      aportacionesPorMes[mes] = (aportacionesPorMes[mes] ?? 0) + (ap.importeTitular ?? 0) + (ap.importeEmpresa ?? 0);
    }

    // Para cada valoración, calcular aportado acumulado hasta ese mes
    return valoraciones.map((v) => {
      const aportadoAcum = Object.entries(aportacionesPorMes)
        .filter(([mes]) => mes <= v.fecha_valoracion)
        .reduce((s, [, importe]) => s + importe, 0);
      return { fecha: v.fecha_valoracion, valor: v.valor, aportadoAcum };
    });
  }, [valoraciones, aportaciones]);

  // ── Ventaja fiscal ────────────────────────────────────────────────────────

  const { reduccionBase, ahorradoCuota } = useMemo(() => {
    if (!hasFiscalContext || marginalIrpf == null || !plan) {
      return { reduccionBase: null, ahorradoCuota: null };
    }

    // Aportaciones del año en curso del titular
    const aportadoEsteAño = aportaciones
      .filter((a) => a.ejercicioFiscal === ejercicioActual)
      .reduce((s, a) => s + (a.importeTitular ?? 0), 0);

    const limiteTitular = getLimiteTitular(plan.tipoAdministrativo);
    const reduccion = Math.min(aportadoEsteAño, limiteTitular);
    return {
      reduccionBase: reduccion,
      ahorradoCuota: Math.round(reduccion * marginalIrpf * 100) / 100,
    };
  }, [hasFiscalContext, marginalIrpf, plan, aportaciones, ejercicioActual]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleValorSaved = useCallback(async () => {
    showToastV5('Valoración actualizada.');
    await load();
  }, [load]);

  const handleAportacionSaved = useCallback(async () => {
    showToastV5('Aportación registrada.');
    await load();
  }, [load]);

  const handlePlanSaved = useCallback(async (saved: PlanPensiones) => {
    showToastV5('Plan actualizado.');
    setPlan(saved);
    setShowEditar(false);
  }, []);

  // ── Render: estados de carga ──────────────────────────────────────────────

  if (plan === undefined) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Cargando plan…</div>
      </div>
    );
  }

  if (plan === null) {
    return (
      <div className={styles.page}>
        <div className={styles.notFound}>
          <div>No se encontró el plan de pensiones.</div>
          <button type="button" className={styles.backBtn} onClick={onBack}>
            Volver a Inversiones
          </button>
        </div>
      </div>
    );
  }

  // ── Render principal ──────────────────────────────────────────────────────

  const tipoLabel = TIPO_ADMIN_LABEL[plan.tipoAdministrativo] ?? plan.tipoAdministrativo;
  const subtitle = [tipoLabel, plan.gestoraActual, plan.isinActual || null]
    .filter(Boolean)
    .join(' · ');
  const esPPEoPPES = plan.tipoAdministrativo === 'PPE' || plan.tipoAdministrativo === 'PPES';

  const logoCfg = getEntidadLogoConfig(plan.gestoraActual ?? '');
  const heroBadge = `${tipoLabel} · revalorización · liquidez en jubilación`;

  return (
    <>
      <FichaShell
        hero={{
          variant: 'plan',
          badge: heroBadge,
          logo: {
            text: logoCfg.text,
            bg: logoCfg.gradient ?? logoCfg.bg ?? 'var(--atlas-v5-bg)',
            color: logoCfg.color,
            noBorder: logoCfg.noBorder,
          },
          title: plan.nombre,
          meta: subtitle ? <>{subtitle}</> : null,
          stats: [
            {
              lab: 'Valor actual',
              val: fmtShort(valorActual),
              valVariant: pgLatente > 0 ? 'pos' : pgLatente < 0 ? 'neg' : undefined,
            },
            {
              lab: 'Aportado',
              val: fmtShort(aportadoTotal),
            },
            {
              lab: pgLatente >= 0 ? 'Ganancia' : 'Pérdida',
              val: `${pgLatente >= 0 ? '+' : ''}${fmt(pgLatente)}`,
              valVariant: pgLatente > 0 ? 'pos' : pgLatente < 0 ? 'neg' : undefined,
            },
            {
              lab: 'CAGR',
              val: cagr != null ? fmtPct(cagr) : '—',
              valVariant: cagr != null ? (cagr >= 0 ? 'pos' : 'neg') : undefined,
            },
          ],
        }}
        onBack={onBack}
        actions={[
          {
            label: 'Actualizar valoración',
            variant: 'ghost',
            icon: <Icons.Refresh size={14} strokeWidth={1.8} />,
            onClick: () => setShowActualizarValor(true),
          },
          {
            label: 'Aportar',
            variant: 'ghost',
            icon: <Icons.Plus size={14} strokeWidth={1.8} />,
            onClick: () => setShowAportar(true),
          },
          {
            label: 'Editar',
            variant: 'gold',
            icon: <Icons.Edit size={14} strokeWidth={1.8} />,
            onClick: () => setShowEditar(true),
          },
        ]}
      >

        {/* ── 1.3 · Sparkline gigante ────────────────────────────────────── */}
        <div className={styles.detailCard} style={{ marginBottom: 16 }}>
          <div className={styles.detailCardTit}>Evolución del valor</div>
          {sparklineData.length >= 2 ? (
            <>
              <SparklineDoble data={sparklineData} />
              <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11, color: 'var(--atlas-v5-ink-4)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <svg width="20" height="3"><line x1="0" y1="1.5" x2="20" y2="1.5" stroke="var(--atlas-v5-brand)" strokeWidth="2.2" /></svg>
                  Valor actual
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <svg width="20" height="3"><line x1="0" y1="1.5" x2="20" y2="1.5" stroke="var(--atlas-v5-ink-5)" strokeWidth="1.5" strokeDasharray="5 3" /></svg>
                  Aportado acumulado
                </span>
              </div>
            </>
          ) : (
            <div className={styles.bigPlaceholder}>
              <div>
                Necesitas al menos 2 valoraciones para ver evolución.{' '}
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() => setShowActualizarValor(true)}
                >
                  Actualizar valoración
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={styles.detailCols}>
          {/* ── Columna izquierda ─────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* ── 1.4 · Estructura aportación (solo PPE / PPES) ─────────── */}
            {esPPEoPPES && (
              <div className={styles.detailCard}>
                <div className={styles.detailCardTit}>Estructura de aportación</div>
                <div className={styles.composicionList}>
                  <div className={styles.composicionRow}>
                    <span className={styles.composicionRowLab}>Aportación empresa</span>
                    <span className={styles.composicionRowVal}>
                      {aportadoEmpresa > 0
                        ? `${fmt(aportadoEmpresa)} (${aportadoTotal > 0 ? ((aportadoEmpresa / aportadoTotal) * 100).toFixed(1) : 0}%)`
                        : '—'}
                    </span>
                  </div>
                  <div className={styles.composicionRow}>
                    <span className={styles.composicionRowLab}>Aportación trabajador</span>
                    <span className={styles.composicionRowVal}>
                      {aportadoTitular > 0
                        ? `${fmt(aportadoTitular)} (${aportadoTotal > 0 ? ((aportadoTitular / aportadoTotal) * 100).toFixed(1) : 0}%)`
                        : '—'}
                    </span>
                  </div>
                  <div className={styles.composicionRow} style={{ borderTop: '1px solid var(--atlas-v5-line)', marginTop: 8, paddingTop: 8 }}>
                    <span className={styles.composicionRowLab}>Total aportado</span>
                    <span className={styles.composicionRowVal}>{aportadoTotal > 0 ? fmt(aportadoTotal) : '—'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── 1.5 · Ventaja fiscal ──────────────────────────────────── */}
            <div className={styles.detailCard}>
              <div className={styles.detailCardTit}>
                Ventaja fiscal · campaña {ejercicioActual}
              </div>

              {hasFiscalContext === false ? (
                <div className={styles.tablaEmpty}>
                  <div>Para calcular la ventaja fiscal necesitas completar tu perfil fiscal (CCAA y datos de ingresos).</div>
                  <div style={{ marginTop: 8 }}>
                    <a
                      href="/personal/fiscal"
                      style={{ color: 'var(--atlas-v5-gold-ink)', fontSize: 12, fontWeight: 600 }}
                    >
                      Completa tu perfil fiscal →
                    </a>
                  </div>
                </div>
              ) : marginalIrpf == null ? (
                <div className={styles.tablaEmpty}>
                  <div>Añade datos de ingresos para calcular tu tipo marginal y la ventaja fiscal real.</div>
                  <div style={{ marginTop: 8 }}>
                    <a
                      href="/personal/fiscal"
                      style={{ color: 'var(--atlas-v5-gold-ink)', fontSize: 12, fontWeight: 600 }}
                    >
                      Completa tu perfil fiscal →
                    </a>
                  </div>
                </div>
              ) : (
                <div className={styles.composicionList}>
                  <div className={styles.composicionRow}>
                    <span className={styles.composicionRowLab}>Tipo marginal IRPF</span>
                    <span className={styles.composicionRowVal}>{(marginalIrpf * 100).toFixed(0)}%</span>
                  </div>
                  <div className={styles.composicionRow}>
                    <span className={styles.composicionRowLab}>
                      Límite anual {
                        plan.tipoAdministrativo === 'PPE' || plan.tipoAdministrativo === 'PPES'
                          ? '(titular + empresa)'
                          : ''
                      }
                    </span>
                    <span className={styles.composicionRowVal}>{fmtShort(getLimiteAnual(plan.tipoAdministrativo))}</span>
                  </div>
                  <div className={styles.composicionRow}>
                    <span className={styles.composicionRowLab}>
                      Reducción base IRPF {ejercicioActual}
                    </span>
                    <span className={`${styles.composicionRowVal} ${styles.pos}`}>
                      {reduccionBase != null ? `−${fmt(reduccionBase)}` : '—'}
                    </span>
                  </div>
                  <div className={styles.composicionRow} style={{ borderTop: '1px solid var(--atlas-v5-line)', marginTop: 8, paddingTop: 8 }}>
                    <span className={styles.composicionRowLab}>Ahorrado en cuota estimado</span>
                    <span className={`${styles.composicionRowVal} ${styles.pos}`}>
                      {ahorradoCuota != null && ahorradoCuota > 0 ? `−${fmt(ahorradoCuota)}` : '—'}
                    </span>
                  </div>
                  {(reduccionBase != null && reduccionBase === 0) && (
                    <div style={{ fontSize: 11, color: 'var(--atlas-v5-ink-4)', marginTop: 8 }}>
                      Sin aportaciones registradas en {ejercicioActual} · añade una aportación para ver el ahorro.
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* ── Columna derecha ───────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* ── 1.6 · Composición (condicional · placeholder con TODO) ─── */}
            {plan.politicaInversion && (
              <div className={styles.detailCard}>
                <div className={styles.detailCardTit}>Composición</div>
                {/* TODO: T23.6.4+ · composición detallada pendiente de API gestora.
                    Renderizamos solo la política declarada hasta que esté disponible. */}
                <div className={styles.tablaEmpty}>
                  Composición detallada · pendiente API gestora · solo política declarada:{' '}
                  <strong>{plan.politicaInversion.replace(/_/g, ' ')}</strong>.
                </div>
              </div>
            )}

            {/* Datos del plan */}
            <div className={styles.detailCard}>
              <div className={styles.detailCardTit}>Datos del plan</div>
              <div className={styles.composicionList}>
                <div className={styles.composicionRow}>
                  <span className={styles.composicionRowLab}>Tipo</span>
                  <span className={styles.composicionRowVal}>{tipoLabel}</span>
                </div>
                <div className={styles.composicionRow}>
                  <span className={styles.composicionRowLab}>Gestora</span>
                  <span className={styles.composicionRowVal}>{plan.gestoraActual || '—'}</span>
                </div>
                {plan.isinActual && (
                  <div className={styles.composicionRow}>
                    <span className={styles.composicionRowLab}>ISIN</span>
                    <span className={styles.composicionRowVal}>{plan.isinActual}</span>
                  </div>
                )}
                <div className={styles.composicionRow}>
                  <span className={styles.composicionRowLab}>Fecha contratación</span>
                  <span className={styles.composicionRowVal}>{formatDate(plan.fechaContratacion)}</span>
                </div>
                <div className={styles.composicionRow}>
                  <span className={styles.composicionRowLab}>Estado</span>
                  <span className={styles.composicionRowVal}>{plan.estado}</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ── 1.7 · Tabla aportaciones históricas ──────────────────────────── */}
        <div className={styles.detailCard} style={{ marginTop: 16 }}>
          <div className={styles.detailCardTit}>Aportaciones · histórico</div>
          {aportaciones.length === 0 ? (
            <div className={styles.tablaEmpty}>
              Sin aportaciones registradas. Usa el botón "Aportar" para añadir la primera.
            </div>
          ) : (
            <div className={styles.tablaWrap}>
              <table className={styles.tabla}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th style={{ textAlign: 'right' }}>Importe total</th>
                    <th style={{ textAlign: 'right' }}>Empresa</th>
                    <th style={{ textAlign: 'right' }}>Trabajador</th>
                    <th>Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {aportaciones.map((ap) => {
                    const total = (ap.importeTitular ?? 0) + (ap.importeEmpresa ?? 0);
                    return (
                      <tr key={ap.id}>
                        <td>{formatDate(ap.fecha)}</td>
                        <td className={styles.num}>{fmt(total)}</td>
                        <td className={styles.num}>
                          {ap.importeEmpresa > 0 ? fmt(ap.importeEmpresa) : '—'}
                        </td>
                        <td className={styles.num}>
                          {ap.importeTitular > 0 ? fmt(ap.importeTitular) : '—'}
                        </td>
                        <td className={styles.txt}>{ap.notas || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </FichaShell>

      {/* ── Modales ──────────────────────────────────────────────────────────── */}

      {showActualizarValor && (
        <ActualizarValorPlanDialog
          plan={plan}
          onSaved={handleValorSaved}
          onClose={() => setShowActualizarValor(false)}
        />
      )}

      {showAportar && (
        <AportacionPlanDialog
          plan={plan}
          onSaved={handleAportacionSaved}
          onClose={() => setShowAportar(false)}
        />
      )}

      {showEditar && (
        <PlanFormV5
          plan={plan}
          onSaved={handlePlanSaved}
          onClose={() => setShowEditar(false)}
        />
      )}
    </>
  );
};

export default FichaPlanPensiones;
