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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Icons } from '../../../design-system/v5';
import { showToastV5 } from '../../../design-system/v5';
import { aportacionesPlanService } from '../../../services/aportacionesPlanService';
import { calcularTotalAportadoPlan, planesPensionesService } from '../../../services/planesPensionesService';
import { getEscenarioActivo } from '../../../services/escenariosService';
import { personalDataService } from '../../../services/personalDataService';
import {
  calcularAnosHastaRescate,
  type ResultadoAnosHastaRescate,
} from '../utils/calcularAnosHastaRescate';
import { traspasosPlanPensionesService } from '../../../services/traspasosPlanPensionesService';
import { limitesFiscalesPlanesService } from '../../../services/limitesFiscalesPlanesService';
import {
  getRentabilidadTotal,
  getRentabilidadPorBloque,
  type RentabilidadTotal,
  type RentabilidadBloque,
} from '../../../services/rentabilidadPlanService';
import { getFiscalContextSafe } from '../../../services/fiscalContextService';
import { calcularEstimacionEnCurso } from '../../../services/estimacionFiscalEnCursoService';
import type {
  AportacionPlan,
  PlanPensiones,
  TipoAdministrativo,
} from '../../../types/planesPensiones';
import type { ValoracionHistorica } from '../../../types/valoraciones';
import AportarModal from '../components/modal/AportarModal';
import EditarPosicionModal from '../components/modal/EditarPosicionModal';
import TraspasoModal from '../components/modal/TraspasoModal';
import EliminarPosicionModal from '../components/ficha/EliminarPosicionModal';
import ProyeccionPlanChart, {
  type PuntoRealizado,
  type BandaGestora,
} from '../components/ficha/ProyeccionPlanChart';
import { planPensionToCartaItem } from '../types/cartaItem';
import { parseIsoDateAsUTC } from '../../../utils/recurrenceDateUtils';
import {
  obtenerSupuestosGaleria,
  RENT_OBJETIVO_INVERSIONES_DEFAULT_PCT,
} from '../adapters/supuestosProyeccion';
import { SUPUESTOS_PROYECCION_DEFAULTS } from '../../../types/supuestosProyeccion';
import styles from './FichaPosicion.module.css';
import d from '../components/ficha/fichaDetalleV5.module.css';

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

const fmtShort = (n: number): string =>
  new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n) + ' €';

const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25;

// ── Fecha mínima de rescate (TAREA 13 v4 · Acción 3) ─────────────────────────
//
// PPI/PPA · RD-Ley 1/2015 disp. final 1ª · desde el 1-ene-2025 se pueden
// rescatar las aportaciones con +10 años de antigüedad. La primera ventana
// para un plan es `max(fechaContratacion + 10 años, 2025-01-01)` · planes
// antiguos (contratados antes de 2015) están ya en la ventana desde
// 2025-01-01 inclusive · planes posteriores activan ventana progresivamente.
//
// PPE/PPES · sin fecha concreta · supuestos legales (jubilación, incapacidad,
// dependencia, fallecimiento, paro larga duración, enfermedad grave).
export interface FechaMinimaRescate {
  tipo: 'fecha' | 'supuestos';
  /** Primera ventana de rescate efectiva. Solo en `tipo='fecha'`. */
  fechaPrimeraVentana?: string;
  /** Texto pensado para el copy del usuario · honesto sobre el matiz "aportaciones +10 años". */
  descripcion: string;
  supuestosLegales?: string[];
}

const SUPUESTOS_LEGALES_PPE_PPES = [
  'Jubilación',
  'Incapacidad permanente',
  'Dependencia severa o gran dependencia',
  'Fallecimiento del partícipe (beneficiarios)',
  'Paro de larga duración',
  'Enfermedad grave',
];

const RESCATE_LIQUIDEZ_INICIO_ISO = '2025-01-01';

function formatCivilDate(d: Date): string {
  // Formato es-ES "DD/MM/YYYY" usando campos UTC para evitar shifts de timezone.
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function getFechaMinimaRescate(plan: {
  tipoAdministrativo: TipoAdministrativo;
  fechaContratacion: string;
}): FechaMinimaRescate {
  if (plan.tipoAdministrativo === 'PPE' || plan.tipoAdministrativo === 'PPES') {
    return {
      tipo: 'supuestos',
      descripcion:
        'Los PPE/PPES solo se rescatan al concurrir un supuesto legal · jubilación o supuestos extraordinarios.',
      supuestosLegales: SUPUESTOS_LEGALES_PPE_PPES,
    };
  }
  // PPI / PPA · regla 10 años · aritmética en UTC para fechas civiles estables.
  const fechaContratUTC = parseIsoDateAsUTC(plan.fechaContratacion);
  if (Number.isNaN(fechaContratUTC.getTime())) {
    return {
      tipo: 'fecha',
      descripcion:
        'Las aportaciones a este plan podrán rescatarse cuando cumplan 10 años de antigüedad (RD-Ley 1/2015).',
    };
  }
  const masDiez = new Date(
    Date.UTC(
      fechaContratUTC.getUTCFullYear() + 10,
      fechaContratUTC.getUTCMonth(),
      fechaContratUTC.getUTCDate(),
    ),
  );
  const inicioLey = parseIsoDateAsUTC(RESCATE_LIQUIDEZ_INICIO_ISO);
  // Clamp · planes anteriores a 2015 quedaban legalmente bloqueados hasta el
  // 1-ene-2025 (entrada en vigor del derecho de rescate por antigüedad).
  const efectiva = masDiez < inicioLey ? inicioLey : masDiez;
  const fechaIso = efectiva.toISOString().slice(0, 10);
  return {
    tipo: 'fecha',
    fechaPrimeraVentana: fechaIso,
    descripcion:
      `Desde ${formatCivilDate(efectiva)} podrás rescatar las aportaciones que tengan +10 años de antigüedad (RD-Ley 1/2015 disp. final 1ª). Las aportaciones posteriores maduran progresivamente.`,
  };
}

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

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  planId: string;
  onBack: () => void;
}

// Rangos de los sliders de proyección · un único sitio para el min/max del
// control y para clampar los defaults que vienen del escenario (así un valor
// del escenario fuera de rango no deja el slider incoherente · review Copilot).
const RENT_SLIDER = { min: 3, max: 14 } as const;
const INFL_SLIDER = { min: 0, max: 5 } as const;
const clampRango = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));

// ── Component ─────────────────────────────────────────────────────────────────

const FichaPlanPensiones: React.FC<Props> = ({ planId, onBack }) => {
  const [plan, setPlan] = useState<PlanPensiones | null | undefined>(undefined);
  const [aportaciones, setAportaciones] = useState<AportacionPlan[]>([]);
  const [valoraciones, setValoraciones] = useState<ValoracionHistorica[]>([]);
  const [marginalIrpf, setMarginalIrpf] = useState<number | null>(null);
  const [ejercicioActual] = useState(new Date().getFullYear());

  // TAREA 13 v4 · Commit 7 (A · UI) · rentabilidad TWR/MWR/bloques
  const [rentabilidadTotal, setRentabilidadTotal] = useState<RentabilidadTotal | null>(null);
  const [bloques, setBloques] = useState<RentabilidadBloque[]>([]);

  const [showAportar, setShowAportar] = useState(false);
  const [showEditar, setShowEditar] = useState(false);
  // T13 lote B · sub-tarea 2 · entrada per-plan al TraspasoForm.
  const [showTraspaso, setShowTraspaso] = useState(false);
  // INVERSIONES V1 · Fase 3.1 · confirm destructivo + sliders de proyección
  // (override sobre los defaults) + aviso cerrable.
  const [showEliminar, setShowEliminar] = useState(false);
  const [rateOverridePct, setRateOverridePct] = useState<number | null>(null);
  const [inflOverridePct, setInflOverridePct] = useState<number | null>(null);
  // Seeds del escenario compartido (Fase 5) · sin números mágicos en la ficha:
  // inflación y rentabilidad objetivo salen del único punto de definición.
  const [inflEscenarioPct, setInflEscenarioPct] = useState<number>(
    SUPUESTOS_PROYECCION_DEFAULTS.inflacionGastosPct,
  );
  const [objetivoBasePct, setObjetivoBasePct] = useState<number>(
    RENT_OBJETIVO_INVERSIONES_DEFAULT_PCT,
  );
  const [avisoAportarVisible, setAvisoAportarVisible] = useState(true);

  // T-FICHA-PP-DEUDA v1 · Fix #1 · años hasta rescate derivados de
  // escenario activo + fechaNacimiento personal.
  const [anosHastaRescateInfo, setAnosHastaRescateInfo] =
    useState<ResultadoAnosHastaRescate>({
      anos: 20,
      esEstimacionPorDefecto: true,
    });

  // Fase 5 · los defaults de los sliders (inflación y rentabilidad objetivo)
  // salen del escenario compartido. `rentabilidadObjetivoPct` es null hoy (el
  // escenario aún no la define · ver supuestosProyeccion.ts) → cae al default
  // del único punto de definición; el día que exista el campo, esto lo recoge
  // sin tocar la ficha.
  useEffect(() => {
    let cancelado = false;
    obtenerSupuestosGaleria()
      .then((s) => {
        if (cancelado) return;
        if (Number.isFinite(s.inflacionPct)) setInflEscenarioPct(s.inflacionPct);
        setObjetivoBasePct(
          s.rentabilidadObjetivoPct ?? RENT_OBJETIVO_INVERSIONES_DEFAULT_PCT,
        );
      })
      .catch(() => undefined);
    return () => {
      cancelado = true;
    };
  }, []);

  // ── Carga plan + aportaciones + valoraciones ──────────────────────────────

  const load = useCallback(async () => {
    try {
      const { planesPensionesService } = await import('../../../services/planesPensionesService');
      const p = await planesPensionesService.getPlan(planId);
      if (!p) { setPlan(null); return; }
      setPlan(p);

      const [aps, valHistoricas] = await Promise.all([
        aportacionesPlanService.getAportacionesPorPlan(planId),
        // TAREA 13 v4 · Commit 3 (C4) · usa índice `tipo-activo` (V69) vía
        // valoracionesService · sustituye el getAll + filter inline.
        (async () => {
          try {
            const { valoracionesService } = await import(
              '../../../services/valoracionesService'
            );
            return (await valoracionesService.getEvolucionActivo(
              'plan_pensiones',
              planId as unknown as number,
            )) as ValoracionHistorica[];
          } catch {
            return [];
          }
        })(),
      ]);

      setAportaciones(aps);
      setValoraciones(valHistoricas);

      // TAREA 13 v4 · Commit 7 · cargar rentabilidad TWR/MWR/bloques.
      try {
        const [rt, bs] = await Promise.all([
          getRentabilidadTotal(planId),
          getRentabilidadPorBloque(planId),
        ]);
        setRentabilidadTotal(rt);
        setBloques(bs);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[inversiones] ficha plan · rentabilidad falló:', err);
        setRentabilidadTotal(null);
        setBloques([]);
      }

    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[inversiones] ficha plan · carga', err);
      setPlan(null);
    }
  }, [planId]);

  useEffect(() => { void load(); }, [load]);

  // T-FICHA-PP-DEUDA v1 · Fix #1 · resolver años hasta rescate desde
  // escenario activo + fecha de nacimiento personal (independiente de la
  // carga del plan · no bloquea el render).
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const [esc, personal] = await Promise.all([
          getEscenarioActivo().catch(() => null),
          personalDataService.getPersonalData().catch(() => null),
        ]);
        if (cancelado) return;
        setAnosHastaRescateInfo(
          calcularAnosHastaRescate(esc, personal?.fechaNacimiento),
        );
      } catch {
        // Defaults educativos ya cubiertos por el state inicial.
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  // ── Contexto fiscal + tipo marginal ──────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const ctx = await getFiscalContextSafe();
        if (!ctx || !ctx.comunidadAutonoma) {
          return;
        }

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
        // Sin contexto fiscal · marginal queda null.
      }
    })();
  }, []);

  // ── Derivados ────────────────────────────────────────────────────────────

  const valorActual = plan?.valorActual ?? 0;

  const aportadoTotal = useMemo(() => {
    const aportadoTitular = aportaciones.reduce((s, a) => s + (a.importeTitular ?? 0), 0);
    const aportadoEmpresa = aportaciones.reduce((s, a) => s + (a.importeEmpresa ?? 0), 0);
    const aportadoConyuge = aportaciones.reduce((s, a) => s + (a.importeConyuge ?? 0), 0);
    return calcularTotalAportadoPlan(
      aportadoTitular + aportadoEmpresa + aportadoConyuge,
    );
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

  // ── TAREA 13 v4 · Acción 3 · Datos fiscales (plan + hogar) ───────────────

  // Datos fiscales atribuibles a este plan en el ejercicio actual.
  // Se aplican los topes del propio plan (tipo + subtipo + discapacidad) para
  // obtener `deduciblePlan` y `excesoPlan` aislados.
  const fiscalPlan = useMemo(() => {
    if (!plan) return null;
    const aps = aportaciones.filter((a) => a.ejercicioFiscal === ejercicioActual);
    const aportadoTitularAño = aps.reduce((s, a) => s + (a.importeTitular ?? 0), 0);
    const aportadoEmpresaAño = aps.reduce((s, a) => s + (a.importeEmpresa ?? 0), 0);
    const aportadoConyugeAño = aps.reduce((s, a) => s + (a.importeConyuge ?? 0), 0);
    const aportadoTotalAño = aportadoTitularAño + aportadoEmpresaAño + aportadoConyugeAño;

    const limites = limitesFiscalesPlanesService.getLimitesPorTipo(
      plan.tipoAdministrativo,
      plan.subtipoPPE,
      plan.subtipoPPES,
      plan.participeConDiscapacidad,
    );
    // Cap por rol primero, luego cap conjunto del plan. Para PPE empleador
    // único limiteEconomico=8.500 € (sub-tope empresa) y limiteEfectivo=10.000 €
    // (cap conjunto titular+empresa). Sumar caps por rol sin volver a capar al
    // conjunto sobreestimaría el deducible · ej. titular 10k + empresa 8.5k
    // daría 18.5k cuando el cap legal son 10k.
    const deducibleTitularBruto = Math.min(aportadoTitularAño, limites.limiteEfectivo);
    const deducibleEmpresaBruto = Math.min(aportadoEmpresaAño, limites.limiteEconomico);
    const deduciblePlan = Math.min(
      deducibleTitularBruto + deducibleEmpresaBruto,
      limites.limiteEfectivo,
    );
    const excesoPlan = Math.max(0, aportadoTotalAño - deduciblePlan);
    return {
      aportadoTitularAño,
      aportadoEmpresaAño,
      aportadoConyugeAño,
      aportadoTotalAño,
      deduciblePlan,
      excesoPlan,
      limiteEfectivo: limites.limiteEfectivo,
      limiteEconomico: limites.limiteEconomico,
    };
  }, [plan, aportaciones, ejercicioActual]);

  // ── Handlers ─────────────────────────────────────────────────────────────

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

  // ── Render principal · v10 (supervisión sin scroll · 2 cards) ─────────────
  const tipoLabel = TIPO_ADMIN_LABEL[plan.tipoAdministrativo] ?? plan.tipoAdministrativo;
  const hoyYear = new Date().getFullYear();
  const yearOf = (iso?: string | null): number | null => {
    if (!iso) return null;
    const dt = new Date(iso);
    return Number.isNaN(dt.getTime()) ? null : dt.getFullYear();
  };
  const desdeYear = yearOf(fechaPrimeraAportacion) ?? yearOf(plan.fechaContratacion);
  const nGestoras = bloques.length > 0 ? bloques.length : 1;

  // Rentabilidad (fracción → %). TWR realizado con CAGR de fallback.
  const twr = rentabilidadTotal?.TWR;
  const rentFrac =
    twr != null && Number.isFinite(twr) ? twr : cagr != null && Number.isFinite(cagr) ? cagr : null;
  const sinValoracion = valorActual === 0 && aportadoTotal > 0 && valoraciones.length === 0;
  const rentStat = sinValoracion
    ? 'Sin valoración'
    : rentFrac != null
      ? `${rentFrac >= 0 ? '+' : ''}${(rentFrac * 100).toFixed(1)}%/año`
      : '—';

  // ── Proyección · sliders (override) sobre defaults ────────────────────────
  // Base del slider · el rendimiento realizado (CAGR/TWR) manda si es fiable;
  // si no, la rentabilidad objetivo del escenario compartido (Fase 5).
  const defaultRatePct = clampRango(
    rentFrac != null ? Math.round(rentFrac * 1000) / 10 : objetivoBasePct,
    RENT_SLIDER.min,
    RENT_SLIDER.max,
  );
  const ratePct = rateOverridePct ?? defaultRatePct;
  // Clampado al rango del control: un valor del escenario fuera de [min,max]
  // dejaría el slider incoherente (value fuera de min/max).
  const inflPct = clampRango(
    inflOverridePct ?? inflEscenarioPct,
    INFL_SLIDER.min,
    INFL_SLIDER.max,
  );
  const rescateYear = hoyYear + Math.max(0, Math.round(anosHastaRescateInfo.anos));

  // Serie realizada por año (última valoración de cada año).
  const realizadosPorAnio = new Map<number, { fecha: string; valor: number }>();
  for (const v of valoraciones) {
    const y = yearOf(v.fecha_valoracion);
    if (y == null) continue;
    const prev = realizadosPorAnio.get(y);
    if (!prev || v.fecha_valoracion > prev.fecha) {
      realizadosPorAnio.set(y, { fecha: v.fecha_valoracion, valor: v.valor });
    }
  }
  const realizados: PuntoRealizado[] = [...realizadosPorAnio.entries()]
    .map(([year, o]) => ({ year, valor: o.valor }))
    .sort((a, b) => a.year - b.year);

  const rate = ratePct / 100;
  const infl = inflPct / 100;
  const anosFut = Math.max(0, rescateYear - hoyYear);
  const finalNom = valorActual * Math.pow(1 + rate, anosFut);
  const finalReal = finalNom / Math.pow(1 + infl, anosFut);

  // Bandas por gestora (líneas verticales en la gráfica).
  const bandas: BandaGestora[] = bloques
    .map((b) => ({ year: yearOf(b.fechaInicio) ?? 0, label: b.gestora }))
    .filter((b) => b.year > 0);

  // ── Fiscal · aportación máxima, ahorro IRPF, restante del año ─────────────
  const limiteAnual = fiscalPlan?.limiteEfectivo ?? getLimiteAnual(plan.tipoAdministrativo);
  const ahorroSiLlena = marginalIrpf != null ? limiteAnual * marginalIrpf : null;
  const restanteAportar = fiscalPlan
    ? Math.max(0, fiscalPlan.limiteEfectivo - fiscalPlan.aportadoTotalAño)
    : null;
  const ahorroRestante =
    restanteAportar != null && marginalIrpf != null ? restanteAportar * marginalIrpf : null;

  // ── Rentabilidad por gestora (tramos) ─────────────────────────────────────
  const GEST_COLORS = [
    'var(--atlas-v5-gold)',
    'var(--atlas-v5-gold-2)',
    'var(--atlas-v5-gold-soft)',
    'var(--atlas-v5-gold-light)',
    'var(--atlas-v5-ink-4)',
  ];
  const totalGenerado = bloques.reduce((s, b) => s + (b.plusvaliaAbsoluta || 0), 0);

  return (
    <>
      <div className={d.page}>
        <button type="button" className={d.back} onClick={onBack}>
          <Icons.ChevronLeft size={12} strokeWidth={2} />
          Volver a Inversiones
        </button>

        {/* ── Hero navy de detalle ───────────────────────────────────────── */}
        <div className={d.dhero}>
          <div>
            <div className={d.dheroEyebrow}>Plan de pensiones · {tipoLabel}</div>
            <div className={d.dheroNom}>
              {plan.nombre}
              {plan.gestoraActual ? ` · ${plan.gestoraActual}` : ''}
            </div>
            <div className={d.dheroMeta}>
              {desdeYear != null && <>desde <strong>{desdeYear}</strong></>}
              {plan.gestoraActual && (
                <>
                  <span className={d.dheroSep}>·</span>gestora actual <strong>{plan.gestoraActual}</strong>
                </>
              )}
              {nGestoras > 1 && (
                <>
                  <span className={d.dheroSep}>·</span>ha pasado por <strong>{nGestoras}</strong> gestoras
                </>
              )}
            </div>
          </div>
          <div className={d.dheroStats}>
            <div className={d.dstat}>
              <div className={d.dstatLab}>Valor hoy</div>
              <div className={d.dstatVal}>
                {sinValoracion ? '—' : fmtShort(valorActual)}
              </div>
            </div>
            <div className={d.dstat}>
              <div className={d.dstatLab}>Aportado</div>
              <div className={d.dstatVal}>{fmtShort(aportadoTotal)}</div>
            </div>
            <div className={d.dstat}>
              <div className={d.dstatLab}>Rentabilidad</div>
              <div
                className={`${d.dstatVal}${!sinValoracion && rentFrac != null && rentFrac >= 0 ? ' ' + d.g : ''}`}
              >
                {rentStat}
              </div>
            </div>
          </div>
        </div>

        {/* ── Cuerpo · 2 columnas ────────────────────────────────────────── */}
        <div className={d.dbody}>
          {/* Proyección · sin valoración no hay base sobre la que proyectar ·
              mostramos un placeholder honesto en vez de cifras a 0. */}
          {sinValoracion ? (
            <div className={d.card}>
              <div className={d.projHd}>
                <div>
                  <div className={d.projEyebrow}>Proyección</div>
                  <div className={d.projVerdict}>
                    Registra una valoración para proyectar
                    <br />
                    <span className={d.muted}>
                      sabemos lo aportado, pero aún no el valor actual del plan
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
          <div className={d.card}>
            <div className={d.projHd}>
              <div>
                <div className={d.projEyebrow}>Proyección · si mantienes tu rentabilidad objetivo</div>
                <div className={d.projVerdict}>
                  En <span className={d.g}>{rescateYear}</span> tendrás <span className={d.g}>{fmtShort(finalNom)}</span>
                  <br />
                  <span className={d.muted}>{fmtShort(finalReal)} en poder adquisitivo real</span>
                </div>
              </div>
              <div className={d.objCtrl}>
                <div className={d.sldr}>
                  <div className={d.sldrRow}>
                    <span className={d.sldrLab}>Rentabilidad objetivo</span>
                    <span className={d.sldrVal}>{ratePct.toFixed(1).replace('.', ',')}%</span>
                  </div>
                  <input
                    type="range"
                    className={d.rng}
                    min={RENT_SLIDER.min}
                    max={RENT_SLIDER.max}
                    step={0.1}
                    value={ratePct}
                    onChange={(e) => setRateOverridePct(Number(e.target.value))}
                    aria-label="Rentabilidad objetivo anual"
                  />
                  <div className={d.sldrRow}>
                    <span className={d.sldrLab}>
                      Inflación <span className={d.m}>· del escenario</span>
                    </span>
                    <span className={`${d.sldrVal} ${d.grey}`}>{inflPct.toFixed(1).replace('.', ',')}%</span>
                  </div>
                  <input
                    type="range"
                    className={`${d.rng} ${d.grey}`}
                    min={INFL_SLIDER.min}
                    max={INFL_SLIDER.max}
                    step={0.1}
                    value={inflPct}
                    onChange={(e) => setInflOverridePct(Number(e.target.value))}
                    aria-label="Inflación anual"
                  />
                </div>
                <div className={`${d.objChip} ${d.alt}`}>
                  Rescate en <span className={d.v}>{rescateYear}</span>
                </div>
              </div>
            </div>

            <div className={d.projLegend}>
              <span className={d.pl}><span className={`${d.plSwatch} ${d.solid}`} />Tu valor · hasta hoy</span>
              <span className={d.pl}><span className={`${d.plSwatch} ${d.dot}`} />Objetivo {ratePct.toFixed(1).replace('.', ',')}%/año</span>
              <span className={d.pl}><span className={`${d.plSwatch} ${d.dash}`} />Poder adquisitivo real</span>
            </div>

            <div className={d.projChart}>
              <ProyeccionPlanChart
                realizados={realizados}
                valorHoy={valorActual}
                hoy={hoyYear}
                yrFin={rescateYear}
                ratePct={ratePct}
                inflPct={inflPct}
                bandas={bandas}
              />
            </div>

            <div className={d.projBoxes}>
              <div className={d.pbox}>
                <div className={d.pboxLab}>Valor final nominal</div>
                <div className={`${d.pboxVal} ${d.g}`}>{fmtShort(finalNom)}</div>
                <div className={d.pboxSub}>a este ritmo, sin aportar más</div>
              </div>
              <div className={d.pbox}>
                <div className={d.pboxLab}>Poder adquisitivo real</div>
                <div className={d.pboxVal}>{fmtShort(finalReal)}</div>
                <div className={d.pboxSub}>
                  descontada inflación {inflPct.toFixed(1).replace('.', ',')}%
                </div>
              </div>
            </div>
          </div>
          )}

          {/* La ficha */}
          <div className={`${d.card} ${d.cardScroll}`}>
            <div className={d.fcardTitle}>La ficha</div>
            <div className={d.fcardSub}>lo esencial de este plan</div>

            <div className={d.frow}>
              <span className={d.k}>Ganancia acumulada</span>
              {sinValoracion ? (
                <span className={d.v}>—</span>
              ) : (
                <span className={`${d.v} ${pgLatente >= 0 ? d.pos : d.neg}`}>
                  {pgLatente >= 0 ? '+' : ''}{fmtShort(pgLatente)}
                </span>
              )}
            </div>
            <div className={d.frow}>
              <span className={d.k}>Aportación máxima {hoyYear}</span>
              <span className={`${d.v} ${d.g}`}>{fmtShort(limiteAnual)}</span>
            </div>
            <div className={d.frow}>
              <span className={d.k}>Ahorro IRPF si la llenas</span>
              <span className={`${d.v} ${d.g}`}>{ahorroSiLlena != null ? fmtShort(ahorroSiLlena) : '—'}</span>
            </div>
            <div className={d.frow}>
              <span className={d.k}>Liquidez</span>
              <span className={d.v}>jubilación</span>
            </div>

            {avisoAportarVisible && restanteAportar != null && restanteAportar > 0 && (
              <div className={d.aviso}>
                <button
                  type="button"
                  className={d.avisoX}
                  onClick={() => setAvisoAportarVisible(false)}
                  aria-label="Cerrar aviso"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
                <div className={d.avisoT}>Este año aún puedes</div>
                <div className={d.avisoB}>
                  aportar <strong>{fmtShort(restanteAportar)}</strong>
                  {ahorroRestante != null && (
                    <> y ahorrar <strong>{fmtShort(ahorroRestante)}</strong> de IRPF</>
                  )}
                </div>
              </div>
            )}

            {bloques.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div className={d.sectionLab}>Rentabilidad por gestora</div>
                {bloques.map((b, i) => {
                  const ini = yearOf(b.fechaInicio);
                  const fin = b.esBloqueActual ? 'hoy' : yearOf(b.fechaFin);
                  const twrB = b.TWR != null && Number.isFinite(b.TWR) ? b.TWR : null;
                  return (
                    <div className={d.gestRow} key={b.bloqueIndex ?? i}>
                      <span className={d.grDot} style={{ background: GEST_COLORS[i % GEST_COLORS.length] }} />
                      <div className={d.grMain}>
                        <span className={d.grNom}>{b.gestora}</span>
                        <span className={d.grPer}>
                          {ini ?? '—'} – {fin ?? '—'}
                        </span>
                      </div>
                      <span className={d.grRet}>
                        <span className={d.grAbs}>
                          {b.plusvaliaAbsoluta >= 0 ? '+' : ''}{fmtShort(b.plusvaliaAbsoluta)}
                        </span>
                        {twrB != null && (
                          <span className={d.grPct}>
                            ≈ {twrB >= 0 ? '+' : ''}{(twrB * 100).toFixed(1).replace('.', ',')}%/año
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
                <div className={d.grTotal}>
                  <span className={d.k}>Total generado</span>
                  <span className={d.v}>
                    {totalGenerado >= 0 ? '+' : ''}{fmtShort(totalGenerado)}
                  </span>
                </div>
              </div>
            )}

            <div className={d.fcardActs}>
              <button type="button" className={`${d.btn} ${d.btnGhost}`} onClick={() => setShowAportar(true)}>
                Aportar
              </button>
              <button type="button" className={`${d.btn} ${d.btnGhost}`} onClick={() => setShowTraspaso(true)}>
                Traspasar
              </button>
              <button type="button" className={`${d.btn} ${d.btnGhost}`} onClick={() => setShowEditar(true)}>
                Editar
              </button>
              <button
                type="button"
                className={`${d.btn} ${d.btnDanger}`}
                onClick={() => setShowEliminar(true)}
                aria-label="Eliminar este plan"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modales ──────────────────────────────────────────────────────────── */}

      {showAportar && (
        <AportarModal
          posicion={planPensionToCartaItem(plan)}
          onSavePlan={async (_p, input) => {
            try {
              // Camino doble · si hay cuenta de cargo, crear movement +
              // treasuryEvent primero (legacy AportacionPlanDialog parity).
              let movementId: string | undefined;
              if (input.cuentaCargoId) {
                try {
                  const { initDB } = await import('../../../services/db');
                  const db = await initDB();
                  const total = input.importeTitular + input.importeEmpresa;
                  const now = new Date().toISOString();
                  const mvId = await db.add('movements' as never, {
                    accountId: input.cuentaCargoId,
                    date: input.fecha,
                    amount: -total,
                    description: `Aportación plan pensiones: ${plan.nombre}`,
                    type: 'Gasto',
                    status: 'Confirmado',
                    unifiedStatus: 'confirmado',
                    source: 'manual',
                    createdAt: now,
                    updatedAt: now,
                  } as never);
                  await db.add('treasuryEvents' as never, {
                    type: 'expense',
                    amount: total,
                    predictedDate: input.fecha,
                    description: `Aportación plan pensiones: ${plan.nombre}`,
                    sourceType: 'inversion_aportacion',
                    status: 'executed',
                    accountId: input.cuentaCargoId,
                    movementId: mvId as number,
                    createdAt: now,
                    updatedAt: now,
                  } as never);
                  movementId = String(mvId);
                } catch (mvErr) {
                  // eslint-disable-next-line no-console
                  console.warn('[planes] aportacion · movement (non-fatal)', mvErr);
                }
              }
              await aportacionesPlanService.crearAportacion({
                planId: plan.id,
                fecha: input.fecha,
                ejercicioFiscal: input.ejercicioFiscal,
                importeTitular: input.importeTitular,
                importeEmpresa: input.importeEmpresa,
                origen: 'manual',
                granularidad: 'puntual',
                notas: input.notas,
                movementId,
              });
              handleAportacionSaved();
            } catch (err) {
              // eslint-disable-next-line no-console
              console.error('[planes] aportacion', err);
              showToastV5('Error al guardar la aportación');
            }
          }}
          onClose={() => setShowAportar(false)}
        />
      )}

      {showEditar && (
        <EditarPosicionModal
          posicion={planPensionToCartaItem(plan)}
          onSave={async ({ nombre, entidad, politicaInversion }) => {
            try {
              const updated = await planesPensionesService.updatePlan(plan.id, {
                nombre,
                gestoraActual: entidad,
                politicaInversion: politicaInversion ?? plan.politicaInversion,
              });
              handlePlanSaved(updated);
            } catch (err) {
              // eslint-disable-next-line no-console
              console.error('[planes] editar', err);
              showToastV5('Error al actualizar el plan');
            }
          }}
          onClose={() => setShowEditar(false)}
        />
      )}

      {showTraspaso && (
        <TraspasoModal
          plan={plan}
          onSave={async (input) => {
            try {
              await traspasosPlanPensionesService.registrarTraspaso({
                planId: plan.id,
                gestoraOrigen: plan.gestoraActual,
                isinOrigen: plan.isinActual,
                gestoraDestino: input.gestoraDestino,
                isinDestino: input.isinDestino,
                fechaSolicitud: input.fechaSolicitud,
                fechaEjecucion: input.fechaEjecucion,
                valorTraspaso: input.valorTraspaso,
                importeTraspasado: input.valorTraspaso,
                esTotal: input.esTotal,
              });
              showToastV5('Traspaso registrado.');
              void load();
            } catch (err) {
              // eslint-disable-next-line no-console
              console.error('[planes] traspaso', err);
              showToastV5('Error al registrar el traspaso');
            }
          }}
          onClose={() => setShowTraspaso(false)}
        />
      )}

      {showEliminar && (
        <EliminarPosicionModal
          what={`«${plan.nombre}»`}
          onConfirm={async () => {
            setShowEliminar(false);
            try {
              await planesPensionesService.eliminarPlan(plan.id);
              showToastV5('Plan eliminado.');
              onBack();
            } catch (err) {
              // eslint-disable-next-line no-console
              console.error('[planes] eliminar', err);
              showToastV5('Error al eliminar el plan');
            }
          }}
          onClose={() => setShowEliminar(false)}
        />
      )}
    </>
  );
};

export default FichaPlanPensiones;
