// src/services/rentabilidadPlanService.ts
// TAREA 13 v4 · Commit 6 (A · servicio) · §4 spec
//
// Cálculo de rentabilidad de planes de pensiones · TWR (Time-Weighted Return),
// MWR (Money-Weighted Return / IRR) y desglose por bloque (cada bloque =
// periodo entre traspasos de gestora).
//
// Conceptos:
//
//   · Un plan tiene UN identificador estable (UUID) durante toda su vida.
//   · Los traspasos NO crean planes nuevos · solo cambian la gestora actual.
//   · Cada traspaso DELIMITA un bloque · el valorTraspaso es el cierre del
//     bloque anterior y el cierre simultáneo de aportaciones acumuladas.
//   · Las aportaciones (`aportacionesPlan`) son cash flows positivos que
//     deben neutralizarse en el TWR (no contribuyen a la rentabilidad real
//     del periodo) y se ponderan por su fecha en el MWR.
//
// Algoritmos:
//
//   · TWR · 1 + TWR_total = ∏ (1 + HPR_i) · HPR_i = (V_fin_i − CF_i) / V_ini_i
//     − 1 · anualización TWR_anual = (1 + TWR)^(1/años) − 1.
//   · MWR · IRR de los cash flows · resuelto con Newton-Raphson · max 100 it,
//     tolerancia 1e-6, valor inicial 0.05. Si no converge → null.
//
// Reglas (§4.6 spec):
//   · Plan recién creado / sin valoraciones → todo null.
//   · Plan < 1 año → TWR sin anualizar (campo `periodoAños` lo aclara).
//   · Plan migrado v60 sin histórico fino → marcar advertencia en campo aparte.
//   · 1 solo bloque → array de 1 elemento · semáforo `sin_comparar`.
//   · Bloque sin aportaciones intermedias → TWR == MWR == growth rate.

import { initDB } from './db';
import { aportacionesPlanService } from './aportacionesPlanService';
import { traspasosPlanPensionesService } from './traspasosPlanPensionesService';
import type {
  AportacionPlan,
  PlanPensiones,
  TraspasoPlanPensiones,
} from '../types/planesPensiones';
import type { ValoracionHistorica } from '../types/valoraciones';

// ── Tipos públicos ──────────────────────────────────────────────────────────

export interface RentabilidadTotal {
  planId: string;
  capitalAportadoTotal: number;
  valorActual: number;
  plusvaliaAbsoluta: number;
  /** Plusvalía relativa en tanto por uno (0.13 = +13 %). */
  plusvaliaRelativa: number;
  /** TWR anualizado (tanto por uno) · null si no calculable. */
  TWR: number | null;
  /** MWR/IRR anualizado (tanto por uno) · null si no converge o <1 año. */
  MWR: number | null;
  /** Periodo en años (real, no truncado). */
  periodoAños: number;
  fechaInicio: string;
  fechaFin: string;
  numeroBloques: number;
  /** True si la rentabilidad se calculó con datos parciales (plan migrado). */
  conDatosParciales: boolean;
}

export type SemaforoBloque = 'mejor' | 'igual' | 'peor' | 'sin_comparar';

export interface RentabilidadBloque {
  bloqueIndex: number;
  gestora: string;
  isin?: string;
  fechaInicio: string;
  fechaFin: string;
  esBloqueActual: boolean;

  valorInicio: number;
  valorFin: number;
  aportacionesBloque: number;

  plusvaliaAbsoluta: number;
  plusvaliaRelativa: number;
  TWR: number | null;
  MWR: number | null;
  periodoAños: number;

  diferenciaConAnterior?: {
    deltaTWR: number | null; // puntos porcentuales (no tanto por uno)
    semaforo: SemaforoBloque;
  };
}

export interface RentabilidadComparativa {
  planId: string;
  bloques: RentabilidadBloque[];
  conclusionGeneral: 'mejorando' | 'empeorando' | 'mixto' | 'estable';
}

// ── Constantes ──────────────────────────────────────────────────────────────

const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25;
const SEMAFORO_THRESHOLD_PP = 1; // ±1 pp para clasificar mejor/igual/peor

// ── Utilidades ──────────────────────────────────────────────────────────────

function añosEntre(desde: string, hasta: string): number {
  const a = new Date(desde).getTime();
  const b = new Date(hasta).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return (b - a) / MS_PER_YEAR;
}

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Anualiza un retorno de un periodo de N años:
 *   r_anual = (1 + r_periodo)^(1/años) − 1
 *
 * Si el periodo es < 1 año devuelve `null` para que el caller renderice como
 * "+X% en N meses" (regla §4.6 spec).
 */
function anualizar(rPeriodo: number, años: number): number | null {
  if (años < 1) return null;
  if (años <= 0) return null;
  return Math.pow(1 + rPeriodo, 1 / años) - 1;
}

// ── TWR · Time-Weighted Return ───────────────────────────────────────────────

/**
 * Calcula el TWR de un periodo dados:
 *   - valorInicio · valor del activo al principio del periodo
 *   - valorFin · valor al final
 *   - cashFlows · array ordenado por fecha de aportaciones (CF positivo) o
 *     retiradas (CF negativo) DURANTE el periodo · cada uno con la valoración
 *     del activo INMEDIATAMENTE ANTES del cash flow.
 *
 * Si no hay cash flows intermedios:
 *   TWR_periodo = (valorFin − 0) / valorInicio − 1 = valorFin / valorInicio − 1
 *
 * Si hay cash flows · descomponemos en sub-periodos:
 *   HPR_i = (V_fin_i − CF_i) / V_ini_i − 1
 *   TWR_periodo = ∏ (1 + HPR_i) − 1
 *
 * En la práctica, sin valoraciones intermedias, hacemos una APROXIMACIÓN:
 * trasladamos cada aportación al "centro temporal" del sub-periodo y usamos
 * los valores en los traspasos como anclajes intermedios. Esta aproximación
 * coincide con TWR exacto cuando las aportaciones son pequeñas vs valor.
 */
export function calcularTWRSimple(
  valorInicio: number,
  valorFin: number,
  cashFlowNeto: number,
): number | null {
  if (valorInicio <= 0) return null;
  // (V_fin − CF) / V_ini − 1
  return (valorFin - cashFlowNeto) / valorInicio - 1;
}

// ── MWR · Money-Weighted Return (IRR) ───────────────────────────────────────

interface CashFlow {
  /** Fecha del cash flow (YYYY-MM-DD). */
  fecha: string;
  /** Importe · positivo = entrada al plan (aportación) · negativo = salida (valor terminal cuando se valora). */
  importe: number;
}

/**
 * Calcula el IRR (MWR) usando Newton-Raphson.
 *
 * Convención:
 *   · Aportaciones del partícipe/empresa · `importe > 0` (entrada al plan).
 *   · Valoración terminal · `importe < 0` (lo que el partícipe "recuperaría"
 *     si rescatase · cash de salida desde el punto de vista del partícipe).
 *
 * NPV(r) = Σ CF_t / (1 + r)^t = 0 · resolvemos para r anual.
 *
 * Devuelve `null` si no converge en 100 iteraciones o si hay datos insuficientes.
 */
export function calcularMWR(cashFlows: CashFlow[]): number | null {
  if (cashFlows.length < 2) return null;
  const sorted = [...cashFlows].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const t0 = new Date(sorted[0].fecha).getTime();
  if (!Number.isFinite(t0)) return null;

  // Comprobación de signos: necesita al menos un positivo y un negativo.
  const tieneEntrada = sorted.some((c) => c.importe > 0);
  const tieneSalida = sorted.some((c) => c.importe < 0);
  if (!tieneEntrada || !tieneSalida) return null;

  const tiemposAños = sorted.map((cf) => {
    const t = new Date(cf.fecha).getTime();
    if (!Number.isFinite(t)) return NaN;
    return (t - t0) / MS_PER_YEAR;
  });
  if (tiemposAños.some((t) => Number.isNaN(t))) return null;

  // Convención del partícipe: signos invertidos (aportación es salida desde
  // su bolsillo). Para que NPV converja con la fórmula estándar, invertimos:
  //   NPV(r) = Σ (-CF_partícipe) / (1+r)^t = Σ CF_inv / (1+r)^t = 0
  // Equivalente a: aportaciones negativas, valor terminal positivo.
  const cfs = sorted.map((c) => -c.importe);

  const npv = (r: number): number => {
    let s = 0;
    for (let i = 0; i < cfs.length; i++) {
      s += cfs[i] / Math.pow(1 + r, tiemposAños[i]);
    }
    return s;
  };
  const dnpv = (r: number): number => {
    let s = 0;
    for (let i = 0; i < cfs.length; i++) {
      if (tiemposAños[i] === 0) continue;
      s += (-tiemposAños[i] * cfs[i]) / Math.pow(1 + r, tiemposAños[i] + 1);
    }
    return s;
  };

  let r = 0.05;
  for (let it = 0; it < 100; it++) {
    const f = npv(r);
    if (Math.abs(f) < 1e-6) return r;
    const df = dnpv(r);
    if (df === 0 || !Number.isFinite(df)) return null;
    const rNuevo = r - f / df;
    if (!Number.isFinite(rNuevo)) return null;
    if (rNuevo <= -0.99) {
      // Newton llevó a tasa negativa imposible · saltar a otro inicio.
      r = -0.5;
      continue;
    }
    if (Math.abs(rNuevo - r) < 1e-9) return rNuevo;
    r = rNuevo;
  }
  return null; // no convergió
}

// ── Carga de datos ──────────────────────────────────────────────────────────

interface DatosPlan {
  plan: PlanPensiones;
  aportaciones: AportacionPlan[];
  traspasos: TraspasoPlanPensiones[];
  valoraciones: ValoracionHistorica[];
}

async function cargarDatosPlan(planId: string): Promise<DatosPlan | null> {
  const db = await initDB();
  const plan = (await db.get('planesPensiones', planId)) as PlanPensiones | undefined;
  if (!plan) return null;
  const [aportaciones, traspasos, valoracionesAll] = await Promise.all([
    aportacionesPlanService.getAportacionesPorPlan(planId),
    traspasosPlanPensionesService.getTraspasosPorPlan(planId),
    (async () => {
      const all = (await db.getAll('valoraciones_historicas')) as ValoracionHistorica[];
      return all.filter(
        (v) => v.tipo_activo === 'plan_pensiones' && String(v.activo_id) === planId,
      );
    })(),
  ]);

  // Ordenar
  aportaciones.sort((a, b) => a.fecha.localeCompare(b.fecha));
  traspasos.sort((a, b) => a.fechaEjecucion.localeCompare(b.fechaEjecucion));
  const valoraciones = [...valoracionesAll].sort((a, b) =>
    a.fecha_valoracion.localeCompare(b.fecha_valoracion),
  );
  return { plan, aportaciones, traspasos, valoraciones };
}

function importeAportacion(a: AportacionPlan): number {
  return (a.importeTitular ?? 0) + (a.importeEmpresa ?? 0) + (a.importeConyuge ?? 0);
}

// ── API pública ─────────────────────────────────────────────────────────────

/**
 * Rentabilidad TOTAL del plan · §4.5 spec.
 */
export async function getRentabilidadTotal(
  planId: string,
): Promise<RentabilidadTotal> {
  const datos = await cargarDatosPlan(planId);
  if (!datos) {
    throw new Error(`Plan ${planId} no encontrado`);
  }
  const { plan, aportaciones, traspasos, valoraciones } = datos;

  const capitalAportadoTotal = aportaciones.reduce(
    (s, a) => s + importeAportacion(a),
    0,
  );
  const valorActual = plan.valorActual ?? valoraciones.at(-1)?.valor ?? 0;
  const plusvaliaAbsoluta = valorActual - capitalAportadoTotal;
  const plusvaliaRelativa =
    capitalAportadoTotal > 0 ? plusvaliaAbsoluta / capitalAportadoTotal : 0;

  const fechaInicio = plan.fechaContratacion;
  const fechaFin = plan.fechaUltimaValoracion ?? hoyIso();
  const periodoAños = añosEntre(fechaInicio, fechaFin);
  const numeroBloques = traspasos.length + 1;

  // Plan recién creado · sin aportaciones registradas y valor 0 · todo null.
  if (capitalAportadoTotal === 0 && valorActual === 0) {
    return {
      planId,
      capitalAportadoTotal,
      valorActual,
      plusvaliaAbsoluta: 0,
      plusvaliaRelativa: 0,
      TWR: null,
      MWR: null,
      periodoAños,
      fechaInicio,
      fechaFin,
      numeroBloques,
      conDatosParciales: false,
    };
  }

  // Plan migrado v60 · si la única aportación es de origen 'migrado_v60' y no
  // hay valoraciones, marcamos como datos parciales.
  const conDatosParciales =
    aportaciones.length > 0 &&
    aportaciones.every((a) => a.origen === 'migrado_v60') &&
    valoraciones.length < 2;

  // TWR total · componer los TWR sin anualizar (HPR) de cada bloque.
  const bloques = await getRentabilidadPorBloque(planId);
  let TWR: number | null = null;
  if (bloques.every((b) => b.TWR !== null) && bloques.length > 0) {
    let acum = 1;
    for (const b of bloques) {
      // HPR sin anualizar · misma lógica del cálculo por bloque (bloque con
      // V_ini=0 usa primera aportación como base).
      let baseInicio: number;
      let cfDurante: number;
      if (b.valorInicio > 0) {
        baseInicio = b.valorInicio;
        cfDurante = b.aportacionesBloque;
      } else if (b.aportacionesBloque > 0) {
        // No tenemos aquí el desglose de aportaciones · usamos la suma como
        // base (caso típico Jose: 1 aportación inicial = todo el bloque CF=0).
        baseInicio = b.aportacionesBloque;
        cfDurante = 0;
      } else {
        baseInicio = 0;
        cfDurante = 0;
      }
      const hpr =
        baseInicio > 0 ? (b.valorFin - cfDurante) / baseInicio - 1 : null;
      if (hpr === null) {
        acum = NaN;
        break;
      }
      acum *= 1 + hpr;
    }
    if (Number.isFinite(acum)) {
      const twrPeriodo = acum - 1;
      TWR = anualizar(twrPeriodo, periodoAños);
      // Si el periodo es <1 año o no podemos anualizar, devolvemos el TWR del
      // periodo (sin anualizar) como fallback solo si periodoAños > 0.
      if (TWR === null && periodoAños > 0) TWR = twrPeriodo;
    }
  }

  // MWR total · cash flows desde el inicio.
  const cashFlows: CashFlow[] = aportaciones.map((a) => ({
    fecha: a.fecha,
    importe: importeAportacion(a),
  }));
  if (valorActual > 0) {
    cashFlows.push({ fecha: fechaFin, importe: -valorActual });
  }
  let MWR: number | null = calcularMWR(cashFlows);
  if (periodoAños < 1) {
    // <1 año · no anualizamos
    MWR = null;
  }

  return {
    planId,
    capitalAportadoTotal,
    valorActual,
    plusvaliaAbsoluta,
    plusvaliaRelativa,
    TWR,
    MWR,
    periodoAños,
    fechaInicio,
    fechaFin,
    numeroBloques,
    conDatosParciales,
  };
}

/**
 * Rentabilidad POR BLOQUE · §4.5 spec.
 */
export async function getRentabilidadPorBloque(
  planId: string,
): Promise<RentabilidadBloque[]> {
  const datos = await cargarDatosPlan(planId);
  if (!datos) return [];
  const { plan, aportaciones, traspasos } = datos;

  const fechaFinPlan = plan.fechaUltimaValoracion ?? hoyIso();
  const valorActualPlan = plan.valorActual ?? 0;

  // Construir delimitadores de bloque a partir de los traspasos:
  //   bloque 1 · [fechaContratacion, traspaso1.fechaEjecucion]
  //   bloque 2 · [traspaso1.fechaEjecucion, traspaso2.fechaEjecucion]
  //   ...
  //   bloque N · [traspasoN-1.fechaEjecucion, hoy]
  interface DelimitadorBloque {
    fechaInicio: string;
    fechaFin: string;
    valorInicio: number;
    valorFin: number;
    gestora: string;
    isin?: string;
    esActual: boolean;
  }

  const delimitadores: DelimitadorBloque[] = [];

  if (traspasos.length === 0) {
    delimitadores.push({
      fechaInicio: plan.fechaContratacion,
      fechaFin: fechaFinPlan,
      valorInicio: 0,
      valorFin: valorActualPlan,
      gestora: plan.gestoraActual,
      isin: plan.isinActual,
      esActual: true,
    });
  } else {
    // Bloque 1 · contratación → primer traspaso
    const primerTraspaso = traspasos[0];
    delimitadores.push({
      fechaInicio: plan.fechaContratacion,
      fechaFin: primerTraspaso.fechaEjecucion,
      valorInicio: 0,
      valorFin: primerTraspaso.valorTraspaso,
      gestora: primerTraspaso.gestoraOrigen,
      isin: primerTraspaso.isinOrigen,
      esActual: false,
    });

    // Bloques intermedios
    for (let i = 1; i < traspasos.length; i++) {
      const ant = traspasos[i - 1];
      const cur = traspasos[i];
      delimitadores.push({
        fechaInicio: ant.fechaEjecucion,
        fechaFin: cur.fechaEjecucion,
        valorInicio: ant.valorTraspaso,
        valorFin: cur.valorTraspaso,
        gestora: cur.gestoraOrigen,
        isin: cur.isinOrigen,
        esActual: false,
      });
    }
    // Bloque actual · último traspaso → hoy
    const ultimo = traspasos[traspasos.length - 1];
    delimitadores.push({
      fechaInicio: ultimo.fechaEjecucion,
      fechaFin: fechaFinPlan,
      valorInicio: ultimo.valorTraspaso,
      valorFin: valorActualPlan,
      gestora: plan.gestoraActual,
      isin: plan.isinActual,
      esActual: true,
    });
  }

  // Asignar aportaciones a cada bloque por fecha
  const bloques: RentabilidadBloque[] = delimitadores.map((d, i) => {
    const apsBloque = aportaciones.filter(
      (a) => a.fecha >= d.fechaInicio && a.fecha < d.fechaFin,
    );
    // El último bloque también incluye aportaciones con fecha exactamente
    // igual a fechaFin (hoy)
    if (d.esActual) {
      const apsHoy = aportaciones.filter((a) => a.fecha === d.fechaFin);
      apsBloque.push(...apsHoy);
    }
    const aportacionesBloque = apsBloque.reduce(
      (s, a) => s + importeAportacion(a),
      0,
    );
    const plusvaliaAbsoluta = d.valorFin - d.valorInicio - aportacionesBloque;
    const plusvaliaRelativa =
      d.valorInicio + aportacionesBloque > 0
        ? plusvaliaAbsoluta / (d.valorInicio + aportacionesBloque)
        : 0;
    const periodoAños = añosEntre(d.fechaInicio, d.fechaFin);

    // TWR del bloque · cuando V_ini=0 (bloque 1 · contratación), la primera
    // aportación es la apertura del plan, NO un CF · debe ir al baseInicio,
    // no al cf. El resto de aportaciones del bloque sí son CF intermedios.
    let baseInicio: number;
    let cfDurante: number;
    if (d.valorInicio > 0) {
      baseInicio = d.valorInicio;
      cfDurante = aportacionesBloque;
    } else if (apsBloque.length > 0) {
      const primera = apsBloque[0];
      const importePrimera = importeAportacion(primera);
      baseInicio = importePrimera;
      cfDurante = aportacionesBloque - importePrimera;
    } else {
      baseInicio = 0;
      cfDurante = 0;
    }
    const hpr = calcularTWRSimple(baseInicio, d.valorFin, cfDurante);
    let TWR: number | null = null;
    if (hpr !== null) {
      TWR = anualizar(hpr, periodoAños);
      // Si periodo <1 año, devolvemos HPR sin anualizar (el caller lo rendira
      // como "+X% en N meses" si quiere).
      if (TWR === null && periodoAños > 0) TWR = hpr;
    }

    // MWR del bloque · cashflows: aportaciones intermedias positivas + valor
    // final negativo + valorInicio negativo (capital con el que se entró).
    const cashFlowsBloque: CashFlow[] = [];
    if (d.valorInicio > 0) {
      cashFlowsBloque.push({ fecha: d.fechaInicio, importe: d.valorInicio });
    }
    for (const a of apsBloque) {
      cashFlowsBloque.push({ fecha: a.fecha, importe: importeAportacion(a) });
    }
    if (d.valorFin > 0) {
      cashFlowsBloque.push({ fecha: d.fechaFin, importe: -d.valorFin });
    }
    let MWR: number | null = calcularMWR(cashFlowsBloque);
    if (periodoAños < 1) MWR = null;

    return {
      bloqueIndex: i + 1,
      gestora: d.gestora,
      isin: d.isin,
      fechaInicio: d.fechaInicio,
      fechaFin: d.fechaFin,
      esBloqueActual: d.esActual,
      valorInicio: d.valorInicio,
      valorFin: d.valorFin,
      aportacionesBloque,
      plusvaliaAbsoluta,
      plusvaliaRelativa,
      TWR,
      MWR,
      periodoAños,
    };
  });

  // Diferencia con el bloque anterior · semáforo
  for (let i = 0; i < bloques.length; i++) {
    if (i === 0) {
      bloques[i].diferenciaConAnterior = { deltaTWR: null, semaforo: 'sin_comparar' };
      continue;
    }
    const ant = bloques[i - 1].TWR;
    const cur = bloques[i].TWR;
    if (ant === null || cur === null) {
      bloques[i].diferenciaConAnterior = { deltaTWR: null, semaforo: 'sin_comparar' };
      continue;
    }
    const deltaPP = (cur - ant) * 100;
    let semaforo: SemaforoBloque = 'igual';
    if (deltaPP > SEMAFORO_THRESHOLD_PP) semaforo = 'mejor';
    else if (deltaPP < -SEMAFORO_THRESHOLD_PP) semaforo = 'peor';
    bloques[i].diferenciaConAnterior = { deltaTWR: deltaPP, semaforo };
  }

  return bloques;
}

/**
 * Comparativa de bloques · §4.5 spec.
 */
export async function getRentabilidadComparativaBloques(
  planId: string,
): Promise<RentabilidadComparativa> {
  const bloques = await getRentabilidadPorBloque(planId);
  // Conclusión general (excluye el primer bloque que no tiene comparación)
  let mejores = 0;
  let peores = 0;
  let iguales = 0;
  for (const b of bloques) {
    const s = b.diferenciaConAnterior?.semaforo;
    if (s === 'mejor') mejores++;
    else if (s === 'peor') peores++;
    else if (s === 'igual') iguales++;
  }
  let conclusionGeneral: RentabilidadComparativa['conclusionGeneral'];
  if (mejores === 0 && peores === 0) conclusionGeneral = 'estable';
  else if (mejores > 0 && peores === 0) conclusionGeneral = 'mejorando';
  else if (peores > 0 && mejores === 0) conclusionGeneral = 'empeorando';
  else conclusionGeneral = 'mixto';

  void iguales;

  return { planId, bloques, conclusionGeneral };
}

// Exportamos helpers internos para tests.
export const _internals = {
  calcularTWRSimple,
  calcularMWR,
  anualizar,
  añosEntre,
};
