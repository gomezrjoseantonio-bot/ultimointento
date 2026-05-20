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
import { calcularTotalAportadoPlan, planesPensionesService } from '../../../services/planesPensionesService';
import { traspasosPlanPensionesService, valorTraspasoNormalizado } from '../../../services/traspasosPlanPensionesService';
import { limitesFiscalesPlanesService } from '../../../services/limitesFiscalesPlanesService';
import {
  getRentabilidadTotal,
  getRentabilidadPorBloque,
  type RentabilidadTotal,
  type RentabilidadBloque,
} from '../../../services/rentabilidadPlanService';
import { getFiscalContextSafe } from '../../../services/fiscalContextService';
import { calcularEstimacionEnCurso } from '../../../services/estimacionFiscalEnCursoService';
import { parseIsoDateAsUTC } from '../../../utils/recurrenceDateUtils';
import type {
  AportacionPlan,
  PlanPensiones,
  TipoAdministrativo,
  TraspasoPlanPensiones,
  ResultadoReduccionBaseImponible,
} from '../../../types/planesPensiones';
import type { ValoracionHistorica } from '../../../types/valoraciones';
import ActualizarValoracionModal from '../components/modal/ActualizarValoracionModal';
import AportarModal from '../components/modal/AportarModal';
import EditarPosicionModal from '../components/modal/EditarPosicionModal';
import TraspasoModal from '../components/modal/TraspasoModal';
import { planPensionToCartaItem } from '../types/cartaItem';
import { valoracionesService } from '../../../services/valoracionesService';
import ImportValoracionesWizard from '../../../components/valoraciones/ImportValoracionesWizard';
import FichaShell from '../components/FichaShell';
// PlanFormV5 y TraspasoPlanDialog (T13v4) sustituidos por los modales
// ATLAS PR 3/PR 4 · siguen vivos en el repo hasta PR 5 cleanup.
import { getEntidadLogoConfig } from '../utils/entidadLogo';
// T-INVERSIONES-DETALLE-PP-v1 PR 4 · 5 bloques chicha cableados.
import BloqueProyeccion from '../components/bloques/BloqueProyeccion';
import BloqueBenchmark from '../components/bloques/BloqueBenchmark';
import BloqueCostes from '../components/bloques/BloqueCostes';
import BloqueHitos from '../components/bloques/BloqueHitos';
import BloqueSandbox from '../components/bloques/BloqueSandbox';
import styles from './FichaPosicion.module.css';
import bloquesStyles from '../components/bloques/bloques.module.css';

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

  // TAREA 13 v4 · Commit 7 (A · UI) · rentabilidad TWR/MWR/bloques
  const [rentabilidadTotal, setRentabilidadTotal] = useState<RentabilidadTotal | null>(null);
  const [bloques, setBloques] = useState<RentabilidadBloque[]>([]);

  // TAREA 13 v4 · Acción 3 · trayectoria + datos fiscales formales.
  const [traspasos, setTraspasos] = useState<TraspasoPlanPensiones[]>([]);
  const [reduccionHogar, setReduccionHogar] = useState<ResultadoReduccionBaseImponible | null>(null);

  const [showActualizarValor, setShowActualizarValor] = useState(false);
  const [showAportar, setShowAportar] = useState(false);
  const [showEditar, setShowEditar] = useState(false);
  // T13 lote B · sub-tarea 2 · entrada per-plan al TraspasoForm.
  const [showTraspaso, setShowTraspaso] = useState(false);
  // T-VALORACIONES PR3 · wizard de importación de histórico de valoraciones.
  const [showImportWizard, setShowImportWizard] = useState(false);

  // ── Carga plan + aportaciones + valoraciones ──────────────────────────────

  const load = useCallback(async () => {
    try {
      const { planesPensionesService } = await import('../../../services/planesPensionesService');
      const p = await planesPensionesService.getPlan(planId);
      if (!p) { setPlan(null); return; }
      setPlan(p);

      const [aps, valHistoricas, traspasosPlan] = await Promise.all([
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
        // TAREA 13 v4 · Acción 3 · traspasos para la trayectoria timeline.
        traspasosPlanPensionesService.getTraspasosPorPlan(planId).catch(() => []),
      ]);

      setAportaciones(aps);
      setValoraciones(valHistoricas);
      setTraspasos(traspasosPlan);

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

      // TAREA 13 v4 · Acción 3 · cargar reducción agregada del hogar para
      // el bloque "Datos fiscales" · solo si el plan trae personalDataId.
      try {
        if (p.personalDataId) {
          const r = await limitesFiscalesPlanesService.calcularReduccionBaseImponible(
            p.personalDataId,
            new Date().getFullYear(),
          );
          setReduccionHogar(r);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[inversiones] ficha plan · reducción hogar falló:', err);
        setReduccionHogar(null);
      }
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
    const aportadoConyuge = aportaciones.reduce((s, a) => s + (a.importeConyuge ?? 0), 0);
    return {
      aportadoTotal: calcularTotalAportadoPlan(
        aportadoTitular + aportadoEmpresa + aportadoConyuge,
      ),
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

  // Tributación al rescatar · cota superior conservadora (valor actual ×
  // marginal). Aviso de que el marginal real al jubilarse suele ser menor.
  const tributacionRescateCotaSuperior = useMemo(() => {
    if (marginalIrpf == null || valorActual <= 0) return null;
    return Math.round(valorActual * marginalIrpf * 100) / 100;
  }, [marginalIrpf, valorActual]);

  // Fecha mínima de rescate (PPI/PPA · fecha real · PPE/PPES · supuestos).
  const fechaMinimaRescate = useMemo(() => (plan ? getFechaMinimaRescate(plan) : null), [plan]);

  // ── TAREA 13 v4 · Acción 3 · Trayectoria · eventos cronológicos ──────────

  interface EventoTrayectoria {
    fecha: string; // ISO date
    año: number;
    tipo: 'contratacion' | 'primera_aportacion' | 'traspaso' | 'ultima_valoracion';
    titulo: string;
    detalle?: string;
  }

  const eventosTrayectoria = useMemo<EventoTrayectoria[]>(() => {
    if (!plan) return [];

    // Gestora inicial · si hay traspasos, el primer `gestoraOrigen` · si no,
    // la actual del plan.
    const traspasosOrdenados = [...traspasos].sort((a, b) => a.fechaEjecucion.localeCompare(b.fechaEjecucion));
    const gestoraInicial = traspasosOrdenados[0]?.gestoraOrigen ?? plan.gestoraActual;

    const eventos: EventoTrayectoria[] = [];

    // 1. Contratación.
    eventos.push({
      fecha: plan.fechaContratacion,
      año: Number(plan.fechaContratacion.slice(0, 4)) || 0,
      tipo: 'contratacion',
      titulo: `Plan abierto en ${gestoraInicial || '—'}`,
      detalle: plan.importeInicial != null && plan.importeInicial > 0
        ? `Valor inicial · ${fmt(plan.importeInicial)}`
        : undefined,
    });

    // 2. Primera aportación · solo si su fecha es distinta de contratación.
    //    Pulido T13 v4 final · issue 6 · agregar TODAS las aportaciones del
    //    primer ejercicio fiscal (no mostrar solo el primer registro). Si en
    //    2020 hubo titular 1.203,36 + empresa 1.604,52, el detalle debe ser
    //    el agregado (2.807,88) con desglose por rol.
    if (fechaPrimeraAportacion && fechaPrimeraAportacion !== plan.fechaContratacion) {
      const ordenadas = [...aportaciones].sort((a, b) => a.fecha.localeCompare(b.fecha));
      const primeraAp = ordenadas[0];
      if (primeraAp) {
        const ejercicioPrimero = primeraAp.ejercicioFiscal;
        const apsPrimerEjercicio = ordenadas.filter((a) => a.ejercicioFiscal === ejercicioPrimero);
        const sumTitular = apsPrimerEjercicio.reduce((s, a) => s + (a.importeTitular ?? 0), 0);
        const sumEmpresa = apsPrimerEjercicio.reduce((s, a) => s + (a.importeEmpresa ?? 0), 0);
        const sumConyuge = apsPrimerEjercicio.reduce((s, a) => s + (a.importeConyuge ?? 0), 0);
        const total = sumTitular + sumEmpresa + sumConyuge;

        const desglose: string[] = [];
        if (sumTitular > 0) desglose.push(`${fmt(sumTitular)} titular`);
        if (sumEmpresa > 0) desglose.push(`${fmt(sumEmpresa)} empresa`);
        if (sumConyuge > 0) desglose.push(`${fmt(sumConyuge)} cónyuge`);
        const detalle = total > 0
          ? desglose.length > 1
            ? `${fmt(total)} · ${desglose.join(' + ')}`
            : fmt(total)
          : undefined;

        eventos.push({
          fecha: primeraAp.fecha,
          año: Number(primeraAp.fecha.slice(0, 4)) || 0,
          tipo: 'primera_aportacion',
          titulo: `Primera aportación (${ejercicioPrimero})`,
          detalle,
        });
      }
    }

    // 3. Cada traspaso (orden ascendente).
    for (const t of traspasosOrdenados) {
      const valor = valorTraspasoNormalizado(t);
      const valorTxt = valor != null ? fmt(valor) : '—';
      const tipoTxt = t.esTotal ? 'Traspaso total' : 'Traspaso parcial';
      eventos.push({
        fecha: t.fechaEjecucion,
        año: Number(t.fechaEjecucion.slice(0, 4)) || 0,
        tipo: 'traspaso',
        titulo: `${tipoTxt} · ${t.gestoraOrigen} → ${t.gestoraDestino}`,
        detalle: `Valor en el momento · ${valorTxt}`,
      });
    }

    // 4. Última valoración · solo si su fecha es distinta del último evento.
    const ultimaVal = [...valoraciones].sort((a, b) => a.fecha_valoracion.localeCompare(b.fecha_valoracion))[valoraciones.length - 1];
    if (ultimaVal) {
      const fechaVal = `${ultimaVal.fecha_valoracion}-01`;
      const ultimoEvento = eventos[eventos.length - 1];
      if (!ultimoEvento || ultimoEvento.fecha.slice(0, 7) !== ultimaVal.fecha_valoracion) {
        eventos.push({
          fecha: fechaVal,
          año: Number(ultimaVal.fecha_valoracion.slice(0, 4)) || 0,
          tipo: 'ultima_valoracion',
          titulo: 'Última valoración registrada',
          detalle: `${fmt(ultimaVal.valor)} · en ${plan.gestoraActual || '—'}`,
        });
      }
    }

    return eventos.sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [plan, traspasos, aportaciones, valoraciones, fechaPrimeraAportacion]);

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
  // Subtitle (= meta del hero) sin `tipoLabel` · ya está en el badge superior.
  const subtitle = [plan.gestoraActual, plan.isinActual || null]
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
          stats: (() => {
            // Pulido T13 v4 final · issue 4 · si el plan tiene aportaciones
            // pero no tiene ninguna valoración registrada y `valorActual=0`,
            // P/G latente y TWR/año son cálculos engañosos (interpretan que
            // el plan vale 0 hoy, dando -100 % y latente negativo equivalente
            // al aportado). En ese caso mostramos '—' como placeholder.
            const sinValoracion =
              valorActual === 0 && aportadoTotal > 0 && valoraciones.length === 0;
            return [
              {
                lab: 'Valor actual',
                val: sinValoracion ? '—' : fmtShort(valorActual),
                valVariant: !sinValoracion && pgLatente > 0
                  ? 'pos'
                  : !sinValoracion && pgLatente < 0
                  ? 'neg'
                  : undefined,
              },
              {
                lab: 'Aportado',
                val: fmtShort(aportadoTotal),
              },
              {
                lab: sinValoracion
                  ? 'Latente'
                  : pgLatente >= 0
                  ? 'Ganancia'
                  : 'Pérdida',
                val: sinValoracion
                  ? '—'
                  : `${pgLatente >= 0 ? '+' : ''}${fmt(pgLatente)}`,
                valVariant: sinValoracion
                  ? undefined
                  : pgLatente > 0
                  ? 'pos'
                  : pgLatente < 0
                  ? 'neg'
                  : undefined,
              },
              // TAREA 13 v4 · Commit 7 · sustituye CAGR por TWR/año (real,
              // neutralizando el efecto de las aportaciones). Si no es
              // calculable (plan reciente · <1 año · sin convergencia), cae
              // a CAGR como fallback informativo.
              {
                lab: rentabilidadTotal?.TWR != null ? 'TWR/año' : 'CAGR',
                val: sinValoracion
                  ? '—'
                  : rentabilidadTotal?.TWR != null
                  ? fmtPct(rentabilidadTotal.TWR)
                  : cagr != null
                  ? fmtPct(cagr)
                  : '—',
                valVariant: sinValoracion
                  ? undefined
                  : rentabilidadTotal?.TWR != null
                  ? rentabilidadTotal.TWR >= 0
                    ? 'pos'
                    : 'neg'
                  : cagr != null
                  ? cagr >= 0
                    ? 'pos'
                    : 'neg'
                  : undefined,
              },
            ];
          })(),
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
            label: 'Importar histórico',
            variant: 'ghost',
            icon: <Icons.Upload size={14} strokeWidth={1.8} />,
            onClick: () => setShowImportWizard(true),
          },
          {
            label: 'Aportar',
            variant: 'ghost',
            icon: <Icons.Plus size={14} strokeWidth={1.8} />,
            onClick: () => setShowAportar(true),
          },
          {
            label: 'Traspasar',
            variant: 'ghost',
            icon: <Icons.ArrowRight size={14} strokeWidth={1.8} />,
            onClick: () => setShowTraspaso(true),
          },
          {
            label: 'Editar',
            variant: 'gold',
            icon: <Icons.Edit size={14} strokeWidth={1.8} />,
            onClick: () => setShowEditar(true),
          },
        ]}
      >

        {/* ─── T-INVERSIONES-DETALLE-PP-v1 PR 4 · 5 bloques chicha ──────── */}
        {/* P1 · Proyección "tu yo en X" */}
        <BloqueProyeccion
          posicionId={plan.id}
          tipoActivo="plan_pensiones"
          saldoActual={valorActual}
          aportadoActual={aportadoTotal}
          aportacionAnualEstimada={(() => {
            // Proxy · aportes del último ejercicio · si no hay, 0.
            const apsAno = aportaciones.filter((a) => a.ejercicioFiscal === ejercicioActual);
            const total = apsAno.reduce(
              (s, a) => s + (a.importeTitular ?? 0) + (a.importeEmpresa ?? 0) + (a.importeConyuge ?? 0),
              0,
            );
            return total;
          })()}
          twrHistorico={rentabilidadTotal?.TWR ?? null}
          anosTranscurridos={(() => {
            if (!fechaPrimeraAportacion) return 0;
            const t = Date.now() - new Date(fechaPrimeraAportacion).getTime();
            return Math.max(0, Math.round(t / MS_PER_YEAR));
          })()}
          politicaInversion={plan.politicaInversion}
          modoCopy={plan.tipoAdministrativo === 'PPE' ? 'informativo' : 'accionable'}
        />

        {/* P2 · Benchmark */}
        <BloqueBenchmark
          posicionId={plan.id}
          tipoActivo="plan_pensiones"
          nombrePosicion={plan.nombre}
          twrHistorico={rentabilidadTotal?.TWR ?? null}
          politicaInversion={plan.politicaInversion}
        />

        {/* P3 · Comisiones · TIPO-AWARE */}
        <BloqueCostes
          posicionId={plan.id}
          tipoActivo="plan_pensiones"
          tipoPlan={plan.tipoAdministrativo}
          garantizado={plan.garantizado}
          nombreEmpresa={plan.empresaPagadora?.nombre ?? null}
          ter={0.015 /* TODO · planesPensiones aún no expone TER · default 1,5 % */}
          saldoMedioAnual={Math.max(0, (valorActual + aportadoTotal) / 2)}
          anosTranscurridos={(() => {
            if (!fechaPrimeraAportacion) return 0;
            const t = Date.now() - new Date(fechaPrimeraAportacion).getTime();
            return Math.max(0, Math.round(t / MS_PER_YEAR));
          })()}
          anosHastaRescate={23 /* TODO · derivar de personal+escenario · PR 4 follow-up */}
          saldoMedioProyectado={Math.max(valorActual, 1) * 1.5}
        />

        {/* P4 · Hitos vivos */}
        <BloqueHitos
          posicionId={plan.id}
          tipoActivo="plan_pensiones"
          fechaApertura={plan.fechaContratacion}
        />

        {/* P5 · Sandbox interactivo */}
        <BloqueSandbox
          posicionId={plan.id}
          tipoActivo="plan_pensiones"
          tipoPlan={plan.tipoAdministrativo}
          esAutonomo={plan.subtipoPPES === 'autonomos'}
          discapacidad={plan.participeConDiscapacidad}
          saldoActual={valorActual}
          aportacionAnualDefault={(() => {
            const apsAno = aportaciones.filter((a) => a.ejercicioFiscal === ejercicioActual);
            return apsAno.reduce(
              (s, a) => s + (a.importeTitular ?? 0) + (a.importeEmpresa ?? 0),
              0,
            );
          })()}
          anosDefault={23}
          twrDefault={rentabilidadTotal?.TWR ?? 0.03}
          valorFinalActual={null /* PR 4 follow-up · pasar valor de proyección actual para mostrar diferencia */}
        />

        {/* ─── Detalle fiscal y aportaciones · T13v4 preservado (§5.7) ─── */}
        <details className={bloquesStyles.detalleFiscalDetails} open>
          <summary className={bloquesStyles.detalleFiscalSummary}>
            Detalle fiscal y aportaciones
          </summary>
          <div className={bloquesStyles.detalleFiscalBody}>

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

            {/* ── 1.5.bis · Datos fiscales · TAREA 13 v4 · Acción 3 ─────── */}
            <div className={styles.detailCard}>
              <div className={styles.detailCardTit}>
                Datos fiscales · ejercicio {ejercicioActual}
              </div>
              <div className={styles.composicionList}>

                {/* Bloque A · este plan */}
                <div style={{ fontSize: 11, color: 'var(--atlas-v5-ink-4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                  Este plan
                </div>
                {fiscalPlan && fiscalPlan.aportadoTotalAño > 0 ? (
                  <>
                    <div className={styles.composicionRow}>
                      <span className={styles.composicionRowLab}>Aportado este año</span>
                      <span className={styles.composicionRowVal}>{fmt(fiscalPlan.aportadoTotalAño)}</span>
                    </div>
                    <div className={styles.composicionRow}>
                      <span className={styles.composicionRowLab}>Deducible aplicable</span>
                      <span className={`${styles.composicionRowVal} ${styles.pos}`}>{fmt(fiscalPlan.deduciblePlan)}</span>
                    </div>
                    {fiscalPlan.excesoPlan > 0 && (
                      <div className={styles.composicionRow}>
                        <span className={styles.composicionRowLab}>Exceso no deducible</span>
                        <span className={`${styles.composicionRowVal} ${styles.neg}`}>{fmt(fiscalPlan.excesoPlan)}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--atlas-v5-ink-4)' }}>
                    Sin aportaciones este año a este plan.
                  </div>
                )}

                {/* Bloque B · tu hogar (agregado · informativo) */}
                {reduccionHogar && (
                  <>
                    <div style={{ fontSize: 11, color: 'var(--atlas-v5-ink-4)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 4, borderTop: '1px solid var(--atlas-v5-line)', paddingTop: 12 }}>
                      Tu hogar
                    </div>
                    <div className={styles.composicionRow}>
                      <span className={styles.composicionRowLab}>Total deducible aplicado</span>
                      <span className={`${styles.composicionRowVal} ${styles.pos}`}>{fmt(reduccionHogar.totalDeducibleAplicado)}</span>
                    </div>
                    {reduccionHogar.excesoArrastrable > 0 && (
                      <div className={styles.composicionRow}>
                        <span className={styles.composicionRowLab}>Exceso arrastrable (5 años)</span>
                        <span className={`${styles.composicionRowVal} ${styles.neg}`}>{fmt(reduccionHogar.excesoArrastrable)}</span>
                      </div>
                    )}
                    {reduccionHogar.alertas.length > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--atlas-v5-warn)', marginTop: 8 }}>
                        {reduccionHogar.alertas.map((a, i) => (
                          <div key={i}>· {a}</div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Bloque C · tributación al rescatar · cota superior */}
                <div style={{ fontSize: 11, color: 'var(--atlas-v5-ink-4)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 4, borderTop: '1px solid var(--atlas-v5-line)', paddingTop: 12 }}>
                  Al rescatar
                </div>
                {marginalIrpf != null && tributacionRescateCotaSuperior != null ? (
                  <>
                    <div className={styles.composicionRow}>
                      <span className={styles.composicionRowLab}>Valor actual</span>
                      <span className={styles.composicionRowVal}>{fmt(valorActual)}</span>
                    </div>
                    <div className={styles.composicionRow}>
                      <span className={styles.composicionRowLab}>Tributación estimada (cota superior)</span>
                      <span className={`${styles.composicionRowVal} ${styles.neg}`}>−{fmt(tributacionRescateCotaSuperior)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--atlas-v5-ink-4)', marginTop: 8 }}>
                      Asumiendo rescate completo hoy como rendimiento del trabajo al marginal actual ({(marginalIrpf * 100).toFixed(0)} %). El marginal real al jubilarse suele ser menor.
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--atlas-v5-ink-4)' }}>
                    Completa tu perfil fiscal para estimar la tributación al rescatar.
                  </div>
                )}

                {/* Bloque D · fecha mínima de rescate */}
                {fechaMinimaRescate && (
                  <>
                    <div style={{ fontSize: 11, color: 'var(--atlas-v5-ink-4)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 4, borderTop: '1px solid var(--atlas-v5-line)', paddingTop: 12 }}>
                      Fecha mínima de rescate
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--atlas-v5-ink-2)' }}>
                      {fechaMinimaRescate.descripcion}
                    </div>
                    {fechaMinimaRescate.supuestosLegales && fechaMinimaRescate.supuestosLegales.length > 0 && (
                      <ul style={{ fontSize: 11, color: 'var(--atlas-v5-ink-3)', marginTop: 8, paddingLeft: 16 }}>
                        {fechaMinimaRescate.supuestosLegales.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
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

        {/* ── 1.6.bis · Rentabilidad por bloque (TAREA 13 · Commit 7) ──────── */}
        {bloques.length > 0 && (
          <div className={styles.detailCard} style={{ marginTop: 16 }}>
            <div className={styles.detailCardTit}>
              Trayectoria · rentabilidad por bloque
            </div>
            {rentabilidadTotal?.MWR != null && (
              <div style={{ fontSize: 11, color: 'var(--atlas-v5-ink-4)', marginBottom: 8 }}>
                MWR/año (rentabilidad ponderada por capital y tiempo): {fmtPct(rentabilidadTotal.MWR)}
                {rentabilidadTotal.conDatosParciales && (
                  <span style={{ marginLeft: 8, color: 'var(--atlas-v5-warn, #B07E2A)' }}>
                    · datos parciales (plan migrado)
                  </span>
                )}
              </div>
            )}
            <div className={styles.tablaWrap}>
              <table className={styles.tabla}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Gestora</th>
                    <th>Periodo</th>
                    <th style={{ textAlign: 'right' }}>Valor inicio</th>
                    <th style={{ textAlign: 'right' }}>Valor fin</th>
                    <th style={{ textAlign: 'right' }}>Aportes</th>
                    <th style={{ textAlign: 'right' }}>Plusvalía</th>
                    <th style={{ textAlign: 'right' }}>TWR</th>
                    <th>vs anterior</th>
                  </tr>
                </thead>
                <tbody>
                  {bloques.map((b) => {
                    const sem = b.diferenciaConAnterior?.semaforo;
                    const delta = b.diferenciaConAnterior?.deltaTWR;
                    const semIcon =
                      sem === 'mejor' ? '▲' : sem === 'peor' ? '▼' : sem === 'igual' ? '=' : '—';
                    const semColor =
                      sem === 'mejor'
                        ? 'var(--atlas-v5-pos, #1F7A4D)'
                        : sem === 'peor'
                        ? 'var(--atlas-v5-neg, #B23A48)'
                        : sem === 'igual'
                        ? 'var(--atlas-v5-warn, #B07E2A)'
                        : 'var(--atlas-v5-ink-5)';
                    const periodoTxt =
                      b.periodoAños < 1
                        ? `${(b.periodoAños * 12).toFixed(0)} m`
                        : `${b.periodoAños.toFixed(1)} a`;
                    const twrTxt =
                      b.TWR == null
                        ? '—'
                        : b.periodoAños < 1
                        ? `${fmtPct(b.TWR)} (sin anualizar)`
                        : fmtPct(b.TWR);
                    return (
                      <tr key={b.bloqueIndex}>
                        <td>{b.bloqueIndex}</td>
                        <td className={styles.txt}>
                          {b.gestora}
                          {b.esBloqueActual && (
                            <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--atlas-v5-ink-4)' }}>
                              · actual
                            </span>
                          )}
                        </td>
                        <td className={styles.txt}>
                          {b.fechaInicio.slice(0, 7)} → {b.fechaFin.slice(0, 7)} · {periodoTxt}
                        </td>
                        <td className={styles.num}>{fmtShort(b.valorInicio)}</td>
                        <td className={styles.num}>{fmtShort(b.valorFin)}</td>
                        <td className={styles.num}>
                          {b.aportacionesBloque > 0 ? fmtShort(b.aportacionesBloque) : '—'}
                        </td>
                        <td className={styles.num}>
                          {b.plusvaliaAbsoluta >= 0 ? '+' : ''}
                          {fmtShort(b.plusvaliaAbsoluta)}
                          <span style={{ fontSize: 10, color: 'var(--atlas-v5-ink-5)', marginLeft: 4 }}>
                            ({fmtPct(b.plusvaliaRelativa)})
                          </span>
                        </td>
                        <td className={styles.num}>{twrTxt}</td>
                        <td style={{ color: semColor, fontSize: 12 }}>
                          {semIcon}
                          {delta != null && Math.abs(delta) > 0.05 && (
                            <span style={{ marginLeft: 4, fontSize: 10 }}>
                              {delta > 0 ? '+' : ''}
                              {delta.toFixed(1)} pp
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 10, color: 'var(--atlas-v5-ink-5)', marginTop: 8 }}>
              TWR · rentabilidad temporal pura (neutraliza efecto de aportaciones · idónea para
              comparar gestoras). Semáforo: ▲ mejor (+1 pp) · = igual (±1 pp) · ▼ peor (−1 pp).
            </div>
          </div>
        )}

        {/* ── 1.6.ter · Trayectoria · TAREA 13 v4 · Acción 3 ──────────────── */}
        {eventosTrayectoria.length > 0 && (
          <div className={styles.detailCard} style={{ marginTop: 16 }}>
            <div className={styles.detailCardTit}>Trayectoria del plan</div>
            <div className={styles.tablaWrap}>
              <table className={styles.tabla}>
                <thead>
                  <tr>
                    <th style={{ width: 110 }}>Fecha</th>
                    <th>Evento</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {eventosTrayectoria.map((ev, idx) => {
                    const añoAnterior = idx > 0 ? eventosTrayectoria[idx - 1].año : null;
                    const cambioAño = añoAnterior !== null && añoAnterior !== ev.año;
                    return (
                      <React.Fragment key={`${ev.fecha}-${ev.tipo}-${idx}`}>
                        {cambioAño && (
                          <tr style={{ background: 'var(--atlas-v5-bg-soft, transparent)' }}>
                            <td colSpan={3} style={{ fontSize: 11, color: 'var(--atlas-v5-ink-4)', textTransform: 'uppercase', letterSpacing: 0.5, paddingTop: 8 }}>
                              {ev.año}
                            </td>
                          </tr>
                        )}
                        <tr>
                          <td className={styles.txt}>{formatDate(ev.fecha)}</td>
                          <td className={styles.txt}>{ev.titulo}</td>
                          <td className={styles.txt}>{ev.detalle ?? '—'}</td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 10, color: 'var(--atlas-v5-ink-5)', marginTop: 8 }}>
              Hitos del plan · contratación, primera aportación, traspasos entre gestoras y última valoración registrada. Las aportaciones individuales viven en la tabla "Aportaciones · histórico".
            </div>
          </div>
        )}

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

          </div>
        </details>
      </FichaShell>

      {/* ── Modales ──────────────────────────────────────────────────────────── */}

      {showActualizarValor && (
        <ActualizarValoracionModal
          posicion={planPensionToCartaItem(plan)}
          onSave={async (valor, fecha) => {
            try {
              // valoracionesService guarda por YYYY-MM (granularidad mensual).
              const fechaMes = fecha.slice(0, 7);
              await valoracionesService.guardarValoracionActivo(fechaMes, {
                tipo_activo: 'plan_pensiones',
                // UUID almacenado como string · la búsqueda usa String(activo_id).
                activo_id: plan.id as unknown as number,
                activo_nombre: plan.nombre,
                valor,
              });
              // También sincroniza valorActual en el plan para reflejar el
              // cambio en la galería inmediatamente.
              await planesPensionesService.updatePlan(plan.id, {
                valorActual: valor,
                fechaUltimaValoracion: fecha,
              });
              handleValorSaved();
            } catch (err) {
              // eslint-disable-next-line no-console
              console.error('[planes] actualizar valor', err);
              showToastV5('Error al actualizar la valoración');
            }
          }}
          onClose={() => setShowActualizarValor(false)}
        />
      )}

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
              // El campo "motivo" del modal queda en UI · el schema actual
              // de traspasosPlanPensiones no lo persiste (TODO en T13-bis).
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

      {showImportWizard && (
        <ImportValoracionesWizard
          activoId={String(plan.id)}
          tipoActivo="plan_pensiones"
          activoNombre={plan.nombre}
          onClose={() => setShowImportWizard(false)}
          onSuccess={() => {
            setShowImportWizard(false);
            void load();
          }}
        />
      )}
    </>
  );
};

export default FichaPlanPensiones;
