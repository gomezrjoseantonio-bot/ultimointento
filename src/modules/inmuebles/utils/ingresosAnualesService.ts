// FIX § 1.6 bloque 2 · ingresos de renta confirmados agrupados por año/mes ·
// alimenta el gráfico SVG de líneas comparativas. Puro y testable.

import type { TreasuryEvent } from '../../../services/db';

export interface SerieAnual {
  anio: number;
  /** Ingreso de renta confirmado por mes · 12 posiciones (ene..dic). */
  mensual: number[];
  total: number;
}

export interface ProyeccionAnual {
  /** % de variación de la proyección del año actual vs el total del año anterior. */
  pct: number | null;
  /** Hay datos suficientes para proyectar (al menos un mes con ingresos). */
  hayDatos: boolean;
}

/**
 * Una renta confirmada: ingreso (`income`) originado en un contrato y ya
 * confirmado/ejecutado (no una mera previsión). Es la traducción del modelo
 * idealizado del spec ("tipo renta · estado confirmado") al esquema real de
 * `TreasuryEvent`.
 */
export const esRentaConfirmada = (e: TreasuryEvent): boolean =>
  e.type === 'income' &&
  (e.sourceType === 'contract' || e.sourceType === 'contrato') &&
  (e.status === 'confirmed' || e.status === 'executed');

const anioMesDe = (e: TreasuryEvent): { anio: number; mes: number } | null => {
  const fecha = e.actualDate || e.predictedDate || '';
  const anio = e.año ?? (fecha ? parseInt(fecha.slice(0, 4), 10) : NaN);
  const mes = e.mes != null ? e.mes - 1 : fecha ? parseInt(fecha.slice(5, 7), 10) - 1 : NaN;
  if (!Number.isFinite(anio) || !Number.isFinite(mes) || mes < 0 || mes > 11) return null;
  return { anio, mes };
};

/** Series mensuales de renta confirmada para los años pedidos. */
export function ingresosPorAnio(events: TreasuryEvent[], anios: number[]): SerieAnual[] {
  const porAnio = new Map<number, number[]>();
  anios.forEach((a) => porAnio.set(a, new Array(12).fill(0)));

  for (const e of events) {
    if (!esRentaConfirmada(e)) continue;
    const am = anioMesDe(e);
    if (!am) continue;
    const arr = porAnio.get(am.anio);
    if (!arr) continue;
    arr[am.mes] += e.actualAmount ?? e.amount ?? 0;
  }

  return anios.map((a) => {
    const mensual = porAnio.get(a) ?? new Array(12).fill(0);
    return { anio: a, mensual, total: mensual.reduce((s, x) => s + x, 0) };
  });
}

/**
 * Proyección del año actual (anualiza el run-rate de los meses con dato) frente
 * al total del año anterior. `pct` null si no se puede proyectar.
 */
export function proyeccionAnual(
  serieActual: SerieAnual | undefined,
  serieAnterior: SerieAnual | undefined,
  mesActual: number, // 0-11
): ProyeccionAnual {
  const mesesTranscurridos = mesActual + 1;
  const acumuladoActual = (serieActual?.mensual ?? [])
    .slice(0, mesesTranscurridos)
    .reduce((s, x) => s + x, 0);
  const totalAnterior = serieAnterior?.total ?? 0;

  if (acumuladoActual <= 0 || totalAnterior <= 0) {
    return { pct: null, hayDatos: acumuladoActual > 0 };
  }
  const proyeccion = (acumuladoActual / mesesTranscurridos) * 12;
  return { pct: Math.round((proyeccion / totalAnterior - 1) * 100), hayDatos: true };
}
