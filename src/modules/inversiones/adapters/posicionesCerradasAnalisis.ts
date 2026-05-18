// Análisis de posiciones cerradas · helpers usados por el rediseño v5
// (PR 5 · T-INVERSIONES-DETALLE-PP-v1 · §6).
//
// Complementa `adapters/posicionesCerradas.ts` (que ya expone
// `calcularKpisCerradas` con KPIs hero). Aquí van los cálculos nuevos:
//   - bestWorstPorPorcentaje (§6.2) · max/min plusvaliaPorcentual
//   - histogramaBins (§6.3) · 5 bins fijos
//   - rankingPorTipo (§6.4) · agrupado · CAGR ponderado por tipo
//   - aciertosRatio · expresión 0-1 (alternativa explícita a tasaAcierto/100)
//   - cagrMedioPonderado · alias semántico · suma cagr·aportado / suma aportado

import type { PosicionCerrada } from './posicionesCerradas';

// ── BEST / WORST por % (§6.2) ─────────────────────────────────────────────────

export interface BestWorstResult {
  mejor: PosicionCerrada | null;
  peor: PosicionCerrada | null;
}

/**
 * Mejor · max(resultadoPercent). Peor · min(resultadoPercent).
 * Devuelve null en cada uno si la lista está vacía.
 */
export function bestWorstPorPorcentaje(
  cerradas: ReadonlyArray<PosicionCerrada>,
): BestWorstResult {
  if (cerradas.length === 0) return { mejor: null, peor: null };
  let mejor: PosicionCerrada | null = null;
  let peor: PosicionCerrada | null = null;
  for (const p of cerradas) {
    if (mejor === null || p.resultadoPercent > mejor.resultadoPercent) mejor = p;
    if (peor === null || p.resultadoPercent < peor.resultadoPercent) peor = p;
  }
  return { mejor, peor };
}

// ── HISTOGRAMA (§6.3) ────────────────────────────────────────────────────────

export type BinHistograma = '<0%' | '0-3%' | '3-10%' | '10-20%' | '>20%';

export const BINS_HISTOGRAMA: ReadonlyArray<BinHistograma> = [
  '<0%',
  '0-3%',
  '3-10%',
  '10-20%',
  '>20%',
];

export interface HistogramaItem {
  bin: BinHistograma;
  count: number;
  posiciones: ReadonlyArray<PosicionCerrada>;
}

function clasificarBin(pct: number): BinHistograma {
  if (pct < 0) return '<0%';
  if (pct < 3) return '0-3%';
  if (pct < 10) return '3-10%';
  if (pct < 20) return '10-20%';
  return '>20%';
}

/**
 * Cuenta + agrupa por bin fijo (5 bins). Devuelve los 5 bins siempre,
 * con `count: 0` si vacíos. Útil para renderizar 5 columnas estables.
 */
export function computeHistogramaBins(
  cerradas: ReadonlyArray<PosicionCerrada>,
): HistogramaItem[] {
  const grupos: Record<BinHistograma, PosicionCerrada[]> = {
    '<0%': [],
    '0-3%': [],
    '3-10%': [],
    '10-20%': [],
    '>20%': [],
  };
  for (const p of cerradas) {
    grupos[clasificarBin(p.resultadoPercent)].push(p);
  }
  return BINS_HISTOGRAMA.map((bin) => ({
    bin,
    count: grupos[bin].length,
    posiciones: grupos[bin],
  }));
}

// ── COPY ANÁLISIS HISTOGRAMA (§6.3 plantillas) ───────────────────────────────

export function analisisHistogramaCopy(bins: ReadonlyArray<HistogramaItem>): string {
  const total = bins.reduce((s, b) => s + b.count, 0);
  if (total === 0) return 'Sin posiciones cerradas para analizar.';
  const negativos = bins[0].count;
  const tibios = bins[1].count;
  const buenos = bins.slice(2).reduce((s, b) => s + b.count, 0);
  if (negativos / total > 0.5) {
    return 'La mayoría de tus cierres han sido pérdidas · revisa tu estrategia.';
  }
  if (tibios > buenos && tibios > negativos) {
    return 'Tus cierres son tibios (0-3 %) · plantéate horizontes más largos.';
  }
  if (buenos / total >= 0.5) {
    return `La mitad de tus operaciones cerradas acabaron en rentabilidad >3 % · trayectoria sólida.`;
  }
  return 'Distribución mixta · sin patrón claro · acumula más cierres para análisis robusto.';
}

// ── RANKING POR TIPO (§6.4) ──────────────────────────────────────────────────

export interface RankingTipoItem {
  tipo: string;
  numOps: number;
  capital: number;
  plusvalia: number;
  cagrMedio: number; // ponderado por capital · 0 si no calculable
  tiempoMedioDias: number; // 0 si no calculable
}

function fmtTipoLabel(tipo: string): string {
  switch (tipo) {
    case 'fondo_inversion': return 'Fondos';
    case 'plan_pensiones': return 'Planes pensiones';
    case 'plan_empleo': return 'Planes empleo';
    case 'accion': return 'Acciones';
    case 'etf': return 'ETFs';
    case 'reit': return 'REITs';
    case 'crypto': return 'Crypto';
    case 'cuenta_remunerada': return 'Cuentas remuneradas';
    case 'prestamo_p2p': return 'Préstamos P2P';
    case 'deposito_plazo':
    case 'deposito':
      return 'Depósitos';
    case 'otro': return 'Otros';
    default: return tipo;
  }
}

/**
 * Agrupa por `tipo` y devuelve · num ops · capital invertido total ·
 * plusvalía total · CAGR medio ponderado por capital · tiempo medio
 * (días ponderado por capital). Ordenado por `cagrMedio` descendente
 * (primera fila se considera "líder" en la UI).
 */
export function computeRankingPorTipo(
  cerradas: ReadonlyArray<PosicionCerrada>,
): RankingTipoItem[] {
  const grupos = new Map<string, PosicionCerrada[]>();
  for (const p of cerradas) {
    const key = p.tipo;
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push(p);
  }
  const items: RankingTipoItem[] = [];
  for (const [tipo, lista] of grupos.entries()) {
    let capital = 0;
    let plusvalia = 0;
    let cagrNum = 0;
    let cagrDen = 0;
    let tiempoNum = 0;
    let tiempoDen = 0;
    for (const p of lista) {
      capital += p.aportado;
      plusvalia += p.resultado;
      if (p.cagr != null && p.aportado > 0) {
        cagrNum += p.cagr * p.aportado;
        cagrDen += p.aportado;
      }
      if (p.duracionDias != null && p.aportado > 0) {
        tiempoNum += p.duracionDias * p.aportado;
        tiempoDen += p.aportado;
      }
    }
    items.push({
      tipo: fmtTipoLabel(tipo),
      numOps: lista.length,
      capital,
      plusvalia,
      cagrMedio: cagrDen > 0 ? cagrNum / cagrDen : 0,
      tiempoMedioDias: tiempoDen > 0 ? Math.round(tiempoNum / tiempoDen) : 0,
    });
  }
  return items.sort((a, b) => b.cagrMedio - a.cagrMedio);
}

export function analisisRankingCopy(items: ReadonlyArray<RankingTipoItem>): string {
  if (items.length === 0) return 'Aún no hay tipos cerrados para rankear.';
  const lider = items[0];
  return `Los ${lider.tipo.toLowerCase()} te han funcionado mejor · ${lider.numOps} operación${lider.numOps === 1 ? '' : 'es'} · CAGR medio ${lider.cagrMedio.toFixed(1)} %.`;
}

// ── ALIAS SEMÁNTICOS (spec §6.1) ─────────────────────────────────────────────

/**
 * Ratio 0-1 de operaciones con plusvalía positiva. Equivalente a
 * `tasaAcierto / 100` del adapter existente · expone el dato en la
 * forma que la spec menciona explícitamente.
 */
export function aciertosRatio(cerradas: ReadonlyArray<PosicionCerrada>): number {
  if (cerradas.length === 0) return 0;
  const aciertos = cerradas.filter((p) => p.resultado > 0).length;
  return aciertos / cerradas.length;
}

/**
 * CAGR medio ponderado por capital · 0 si no calculable. Misma fórmula
 * que el adapter usa internamente, expuesta con nombre semántico para
 * la spec §6.1.
 */
export function cagrMedioPonderado(
  cerradas: ReadonlyArray<PosicionCerrada>,
): number {
  let num = 0;
  let den = 0;
  for (const p of cerradas) {
    if (p.cagr != null && p.aportado > 0) {
      num += p.cagr * p.aportado;
      den += p.aportado;
    }
  }
  return den > 0 ? num / den : 0;
}
