// INVERSIONES V1 · Fase 2 · GALERÍA · agregaciones del hero (supervisión).
//
// Funciones PURAS que derivan los KPIs del hero navy a partir de los
// `CartaItem` que ya produce `galeriaAdapter` (sin doble contar planes: el
// adapter excluye los `plan_pensiones` legacy del store `inversiones`). No hay
// lógica de negocio nueva: sólo lectura y suma de campos reales para la vista.
//
// Cobros y dividendos son SOLO LECTURA aquí (regla de oro §3): la renta pasiva
// se DERIVA de lo declarado (RendimientoPeriodico · DividendoConfig), no se
// registra ningún cobro.

import type { CartaItem } from '../types/cartaItem';
import type { PosicionInversion } from '../../../types/inversiones';
import type { DividendoConfig } from '../../../types/inversiones-extended';
import { getCategoriaGaleria } from '../helpers';
import {
  tasaNominalPosicion,
  tasaObjetivo,
  type SupuestosGaleria,
  PROY_HORIZONTE_AÑOS,
} from './supuestosProyeccion';
import { getSerie } from '../../../services/valoracionesService';

// ── Resumen global de cartera ───────────────────────────────────────────────

export interface ResumenCartera {
  valorTotal: number;
  aportadoTotal: number;
  rentabilidadEur: number;
  rentabilidadPct: number;
}

export function resumenCartera(items: CartaItem[]): ResumenCartera {
  const valorTotal = items.reduce((s, i) => s + (i.valor_actual || 0), 0);
  const aportadoTotal = items.reduce((s, i) => s + (i.total_aportado || 0), 0);
  const rentabilidadEur = items.reduce((s, i) => s + (i.rentabilidad_euros || 0), 0);
  const rentabilidadPct = aportadoTotal > 0 ? (rentabilidadEur / aportadoTotal) * 100 : 0;
  return { valorTotal, aportadoTotal, rentabilidadEur, rentabilidadPct };
}

// ── Chips por familia (Planes · Fondos · Acciones · Préstamos) · spec §2.2 ──

export type FamiliaChip = 'planes' | 'prestamos' | 'acciones' | 'fondos';

export interface ResumenFamilia {
  familia: FamiliaChip;
  aportado: number;
  hoy: number;
  /** Rentabilidad anualizada agregada de la familia (%), o null si no calculable. */
  pctAnual: number | null;
  /**
   * Rentabilidad TOTAL (no anualizada) ponderada por valor · fallback para
   * familias cuyas posiciones son demasiado nuevas (<1 año) para tener CAGR
   * anualizada fiable. La UI lo muestra sin "/año".
   */
  pctTotal: number | null;
}

// Mapa categoría-galería → chip del hero. `otros` (crypto) no tiene chip
// propio pero SÍ cuenta en el total/gauge (resumenCartera los incluye).
// Los fondos de inversión son renta variable (categoría `equity`) pero tienen
// chip propio "Fondos": son otra familia y no deben confundirse con acciones.
function chipDeItem(item: CartaItem): FamiliaChip | null {
  if (item.tipo === 'fondo_inversion') return 'fondos';
  const cat = getCategoriaGaleria(item.tipo);
  if (cat === 'planes') return 'planes';
  if (cat === 'rentaFija') return 'prestamos';
  if (cat === 'equity') return 'acciones';
  return null; // otros/crypto
}

/**
 * Devuelve los chips por familia (planes · fondos · acciones · préstamos).
 * `pctAnual` es la media ponderada por valor de la rentabilidad anual de cada
 * posición: CAGR realizada para planes/fondos/equity y TIN para renta fija
 * (préstamos/depósitos). Si ninguna posición de la familia aporta tasa fiable →
 * null (la UI muestra "—", nunca inventa).
 */
export function familiasResumen(items: CartaItem[]): Record<FamiliaChip, ResumenFamilia> {
  const base: Record<FamiliaChip, ResumenFamilia> = {
    planes: { familia: 'planes', aportado: 0, hoy: 0, pctAnual: null, pctTotal: null },
    prestamos: { familia: 'prestamos', aportado: 0, hoy: 0, pctAnual: null, pctTotal: null },
    acciones: { familia: 'acciones', aportado: 0, hoy: 0, pctAnual: null, pctTotal: null },
    fondos: { familia: 'fondos', aportado: 0, hoy: 0, pctAnual: null, pctTotal: null },
  };
  // Acumuladores para la media ponderada de %. `pesoTot` acumula la rentabilidad
  // TOTAL (no anualizada) para el fallback de familias sin CAGR fiable.
  const acc: Record<FamiliaChip, { pesoPct: number; peso: number; pesoTot: number; pesoT: number }> = {
    planes: { pesoPct: 0, peso: 0, pesoTot: 0, pesoT: 0 },
    prestamos: { pesoPct: 0, peso: 0, pesoTot: 0, pesoT: 0 },
    acciones: { pesoPct: 0, peso: 0, pesoTot: 0, pesoT: 0 },
    fondos: { pesoPct: 0, peso: 0, pesoTot: 0, pesoT: 0 },
  };

  for (const item of items) {
    const chip = chipDeItem(item);
    if (!chip) continue;
    base[chip].aportado += item.total_aportado || 0;
    base[chip].hoy += item.valor_actual || 0;

    const tasa =
      chip === 'prestamos'
        ? item.tin ?? null
        : item.cagr_pct != null && Number.isFinite(item.cagr_pct)
          ? item.cagr_pct
          : null;
    if (tasa != null && Number.isFinite(tasa) && (item.valor_actual || 0) > 0) {
      acc[chip].pesoPct += tasa * item.valor_actual;
      acc[chip].peso += item.valor_actual;
    }
    // Rentabilidad total (no anualizada) · fallback cuando no hay CAGR.
    const rentTot = item.rentabilidad_porcentaje;
    if (rentTot != null && Number.isFinite(rentTot) && (item.valor_actual || 0) > 0) {
      acc[chip].pesoTot += rentTot * item.valor_actual;
      acc[chip].pesoT += item.valor_actual;
    }
  }

  (Object.keys(base) as FamiliaChip[]).forEach((chip) => {
    base[chip].pctAnual = acc[chip].peso > 0 ? acc[chip].pesoPct / acc[chip].peso : null;
    base[chip].pctTotal = acc[chip].pesoT > 0 ? acc[chip].pesoTot / acc[chip].pesoT : null;
  });
  return base;
}

// ── Renta pasiva anual (intereses + dividendos) · SOLO LECTURA ──────────────

export interface RentaPasiva {
  intereses: number;
  dividendos: number;
  total: number;
  mensual: number;
}

const PERIODOS_POR_AÑO: Record<string, number> = {
  mensual: 12,
  trimestral: 4,
  semestral: 2,
  anual: 1,
};

/** Interés anual bruto de una posición de renta fija (préstamo/depósito/cuenta). */
function interesAnualDe(item: CartaItem): number {
  if (item.tipo === 'prestamo_p2p' && item.interes_anual != null) return item.interes_anual;
  if (item.tin != null && Number.isFinite(item.tin)) {
    return ((item.valor_actual || 0) * item.tin) / 100;
  }
  return 0;
}

/**
 * Dividendo anual bruto de una acción/ETF/REIT. Deriva de la config declarada
 * (`DividendoConfig`): dividendo_por_accion × nº participaciones × periodos/año.
 * Si no hay config completa, cae al `dividendo_anual_estimado` (€/título/año)
 * del registro base. NUNCA registra cobros (solo lectura).
 */
function dividendoAnualDe(pos: PosicionInversion): number {
  const div = (pos as unknown as { dividendos?: DividendoConfig }).dividendos;
  const nParticipaciones = pos.numero_participaciones ?? 0;
  if (div?.paga_dividendos && div.dividendo_por_accion != null && nParticipaciones > 0) {
    const periodos = div.frecuencia_dividendos
      ? PERIODOS_POR_AÑO[div.frecuencia_dividendos] ?? 1
      : 1;
    return div.dividendo_por_accion * nParticipaciones * periodos;
  }
  // Fallback: campo base `dividendo_anual_estimado` (€/título/año).
  if (pos.dividendo_anual_estimado != null && nParticipaciones > 0) {
    return pos.dividendo_anual_estimado * nParticipaciones;
  }
  return 0;
}

const TIPOS_RENTA_FIJA = new Set(['prestamo_p2p', 'deposito_plazo', 'cuenta_remunerada', 'deposito']);
const TIPOS_EQUITY_DIV = new Set(['accion', 'etf', 'reit']);

export function rentaPasivaAnual(items: CartaItem[]): RentaPasiva {
  let intereses = 0;
  let dividendos = 0;
  for (const item of items) {
    if (TIPOS_RENTA_FIJA.has(item.tipo)) {
      intereses += interesAnualDe(item);
    } else if (TIPOS_EQUITY_DIV.has(item.tipo)) {
      dividendos += dividendoAnualDe(item._original as PosicionInversion);
    }
  }
  const total = intereses + dividendos;
  return { intereses, dividendos, total, mensual: total / 12 };
}

// ── Trayectoria a 20 años · por posición (área apilada) · spec §2.2 ─────────

/** Paleta de bandas · solo oro + tinta (verde/rojo prohibidos en gráfica §diseño). */
export const BANDA_COLORS = [
  'var(--atlas-v5-gold-light)',
  'var(--atlas-v5-gold-soft)',
  'var(--atlas-v5-gold-2)',
  'var(--atlas-v5-gold)',
  'var(--atlas-v5-gold-ink)',
  'var(--atlas-v5-ink-4)',
  'var(--atlas-v5-ink-3)',
] as const;

export interface BandaTrayectoria {
  nombre: string;
  color: string;
  /** Valor absoluto (no apilado) de la posición en cada año de `years`. */
  valores: number[];
  /** Año de vencimiento (renta fija) tras el cual la banda desaparece · o null. */
  vencYear: number | null;
}

export interface SerieTrayectoria {
  years: number[];
  bandas: BandaTrayectoria[];
  /** Total apilado por año (proyección con la CAGR de cada posición). */
  totalPorAño: number[];
  /**
   * Línea de REALIDAD (histórico real leído de `valoracionesActivos`) · valor
   * en cada año hasta hoy · `null` en los años de proyección (futuro). El punto
   * de "hoy" (índice `baseYearIdx`) coincide con el total apilado actual, para
   * que la línea enganche con las áreas.
   */
  historicoPorAño: (number | null)[];
  /**
   * Línea de OBJETIVO (misma cartera creciendo a la tasa objetivo del
   * escenario) · definida de hoy hacia el futuro · `null` en el pasado.
   */
  objetivoPorAño: (number | null)[];
  /** Índice de "hoy" dentro de `years` (0 si no hay tramo histórico). */
  baseYearIdx: number;
  /** Máximo del eje Y (redondeado a valor "bonito"). */
  vmax: number;
}

function yearOf(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.getFullYear();
}

/**
 * Año de vencimiento de una posición de renta fija: del plan de liquidación
 * (`fecha_vencimiento`) o derivado de fecha de apertura + duración en meses.
 * `null` si no es renta fija o no hay dato (la banda persiste sin proyectar
 * reinversión — spec: el capital devuelto sale de la gráfica, no se reinvierte).
 */
function vencYearDe(item: CartaItem): number | null {
  if (!TIPOS_RENTA_FIJA.has(item.tipo)) return null;
  const yVenc = yearOf(item.fecha_vencimiento);
  if (yVenc != null) return yVenc;
  const pos = item._original as PosicionInversion;
  const yApertura = yearOf(item.fecha_apertura);
  if (yApertura != null && pos.duracion_meses && pos.duracion_meses > 0) {
    return yApertura + Math.ceil(pos.duracion_meses / 12);
  }
  return null;
}

function redondearVmax(v: number): number {
  if (v <= 0) return 1000;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / mag) * mag;
}

/**
 * Construye la serie de la trayectoria a `PROY_HORIZONTE_AÑOS` años. Cada banda
 * es una posición. Renta fija: se mantiene plana en su valor hasta vencimiento
 * y luego desaparece (0) — NO se proyecta reinversión. Resto: crece a su tasa
 * nominal (CAGR realizada / suelo del escenario · ver `supuestosProyeccion`).
 * Los supuestos vienen del escenario compartido (Fase 5), no hardcodeados.
 */
export function serieTrayectoria(
  items: CartaItem[],
  supuestos: SupuestosGaleria,
  baseYear: number,
): SerieTrayectoria {
  const years: number[] = [];
  for (let y = baseYear; y <= baseYear + PROY_HORIZONTE_AÑOS; y++) years.push(y);

  // Ordenar por valor descendente para un apilado estable y legible.
  const ordenados = [...items].sort((a, b) => (b.valor_actual || 0) - (a.valor_actual || 0));

  // Línea de objetivo (misma cartera, la parte que crece lo hace a la tasa
  // objetivo del escenario · la renta fija mantiene su regla de vencimiento).
  const rObjetivo = tasaObjetivo(supuestos);
  const objetivoPorAño: number[] = years.map(() => 0);

  const bandas: BandaTrayectoria[] = ordenados.map((item, idx) => {
    const esRentaFija = TIPOS_RENTA_FIJA.has(item.tipo);
    const vencYear = vencYearDe(item);
    const valor0 = item.valor_actual || 0;
    const rate = tasaNominalPosicion(item.cagr_pct, supuestos);
    const valores = years.map((y, i) => {
      const t = y - baseYear;
      if (esRentaFija) {
        // Plana hasta vencimiento · luego fuera de la gráfica (capital devuelto).
        const v = vencYear != null && y > vencYear ? 0 : valor0;
        objetivoPorAño[i] += v;
        return v;
      }
      objetivoPorAño[i] += valor0 * Math.pow(1 + rObjetivo, t);
      return valor0 * Math.pow(1 + rate, t);
    });
    return {
      nombre: item.nombre,
      color: BANDA_COLORS[idx % BANDA_COLORS.length],
      valores,
      vencYear,
    };
  });

  const totalPorAño = years.map((_, i) => bandas.reduce((s, b) => s + b.valores[i], 0));
  // Sin tramo histórico aún · la realidad se ancla en "hoy" (índice 0) para que
  // `serieTrayectoriaConHistorico` la extienda hacia atrás. Ver esa función.
  const historicoPorAño: (number | null)[] = years.map((_, i) =>
    i === 0 ? totalPorAño[0] : null,
  );
  const vmax = redondearVmax(Math.max(0, ...totalPorAño, ...objetivoPorAño));
  return {
    years,
    bandas,
    totalPorAño,
    historicoPorAño,
    objetivoPorAño,
    baseYearIdx: 0,
    vmax,
  };
}

/**
 * Total histórico REAL de la cartera por año (fin de año), leído del store
 * `valoracionesActivos`. Para cada posición toma su última valoración con fecha
 * ≤ 31-dic de ese año (carry-forward) y suma. Devuelve solo los años con algún
 * valor > 0. Enlaza cada `CartaItem` con su histórico por `activoId`
 * (= `String(_idOriginal)` · UUID de plan o id numérico de inversión).
 */
async function historicoTotalPorAño(
  items: CartaItem[],
  baseYear: number,
): Promise<Map<number, number>> {
  const series = await Promise.all(
    items.map((it) =>
      getSerie(String(it._idOriginal)).catch(() => [] as Awaited<ReturnType<typeof getSerie>>),
    ),
  );

  let firstYear = baseYear;
  for (const serie of series) {
    const f = serie[0]?.fecha;
    if (f) {
      const y = Number(f.slice(0, 4));
      if (Number.isFinite(y) && y < firstYear) firstYear = y;
    }
  }

  // Carry-forward de una pasada: como los años suben y cada serie viene ASC,
  // se mantiene un índice por serie que solo avanza (O(años + puntos), no
  // O(años × puntos) · review Copilot).
  const idx = series.map(() => 0);
  const carry = series.map(() => null as number | null);
  const totales = new Map<number, number>();
  for (let y = firstYear; y < baseYear; y++) {
    const cutoff = `${y}-12-31`;
    let total = 0;
    series.forEach((serie, s) => {
      while (idx[s] < serie.length && serie[idx[s]].fecha <= cutoff) {
        carry[s] = serie[idx[s]].valor;
        idx[s] += 1;
      }
      if (carry[s] != null) total += carry[s] as number;
    });
    if (total > 0) totales.set(y, total);
  }
  return totales;
}

/**
 * Como `serieTrayectoria`, pero anteponiendo el tramo HISTÓRICO real (línea de
 * realidad) leído de `valoracionesActivos`. El eje pasa a cubrir
 * [primer año con valoración .. hoy + `PROY_HORIZONTE_AÑOS`]. Si no hay
 * histórico, devuelve la serie base tal cual (empieza en hoy).
 *
 * Decisión de Jose: la gráfica muestra a la vez la REALIDAD (histórico), la
 * PROYECCIÓN con la CAGR de cada posición (áreas) y el OBJETIVO (línea).
 */
export async function serieTrayectoriaConHistorico(
  items: CartaItem[],
  supuestos: SupuestosGaleria,
  baseYear: number,
): Promise<SerieTrayectoria> {
  const fut = serieTrayectoria(items, supuestos, baseYear);
  const hist = await historicoTotalPorAño(items, baseYear);
  if (hist.size === 0) return fut;

  const histYears = Array.from(hist.keys()).sort((a, b) => a - b);
  const firstYear = histYears[0];
  const prefijo: number[] = [];
  for (let y = firstYear; y < baseYear; y++) prefijo.push(y);

  const years = [...prefijo, ...fut.years];
  const nPre = prefijo.length;
  const ceros = prefijo.map(() => 0);
  const nulos = prefijo.map(() => null as number | null);

  const bandas = fut.bandas.map((b) => ({
    ...b,
    valores: [...ceros, ...b.valores],
  }));
  const totalPorAño = [...ceros, ...fut.totalPorAño];
  const objetivoPorAño = [...nulos, ...fut.objetivoPorAño];
  const historicoPorAño: (number | null)[] = [
    ...prefijo.map((y) => hist.get(y) ?? null),
    ...fut.historicoPorAño,
  ];

  const finitos = [
    ...totalPorAño,
    ...objetivoPorAño,
    ...historicoPorAño,
  ].filter((v): v is number => v != null && Number.isFinite(v));
  const vmax = redondearVmax(Math.max(0, ...finitos));

  return {
    years,
    bandas,
    totalPorAño,
    historicoPorAño,
    objetivoPorAño,
    baseYearIdx: nPre,
    vmax,
  };
}
