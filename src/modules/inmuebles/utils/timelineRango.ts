import type { Contract, Property } from '../../../services/db';
import { parseIsoDateAsUTC } from '../../../utils/recurrenceDateUtils';
import { esFechaIndefinida } from './formatFechaFin';

export type RangoTimeline = '3m' | '6m' | '12m';

export interface MesRango {
  mes: number;
  ano: number;
  inicio: Date;
  fin: Date;
}

export interface RangoFechas {
  inicio: Date;
  fin: Date;
  meses: MesRango[];
}

const MESES_ADELANTE: Record<RangoTimeline, number> = {
  '3m': 3,
  '6m': 6,
  '12m': 12,
};

/**
 * Devuelve un rango temporal centrado en el "ahora" · 1 mes hacia atrás
 * para contexto y N meses hacia adelante según el toggle del usuario.
 */
export function calcularRangoFechas(
  rango: RangoTimeline,
  hoy: Date = new Date(),
): RangoFechas {
  const mesesAdelante = MESES_ADELANTE[rango];
  const inicio = new Date(
    Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 1, 1),
  );
  const fin = new Date(
    Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + mesesAdelante + 1, 1),
  );

  const meses: MesRango[] = [];
  let cursorYear = inicio.getUTCFullYear();
  let cursorMonth = inicio.getUTCMonth();
  while (Date.UTC(cursorYear, cursorMonth, 1) < fin.getTime()) {
    meses.push({
      mes: cursorMonth,
      ano: cursorYear,
      inicio: new Date(Date.UTC(cursorYear, cursorMonth, 1)),
      fin: new Date(Date.UTC(cursorYear, cursorMonth + 1, 1)),
    });
    cursorMonth += 1;
    if (cursorMonth > 11) {
      cursorMonth = 0;
      cursorYear += 1;
    }
  }

  return { inicio, fin, meses };
}

export function calcularLeftPorcentaje(fecha: Date, rangoFechas: RangoFechas): number {
  const totalMs = rangoFechas.fin.getTime() - rangoFechas.inicio.getTime();
  if (totalMs <= 0) return 0;
  const offset = fecha.getTime() - rangoFechas.inicio.getTime();
  return Math.max(0, Math.min(100, (offset / totalMs) * 100));
}

export function calcularWidthPorcentaje(
  fechaInicio: Date,
  fechaFin: Date,
  rangoFechas: RangoFechas,
): number {
  const inicioClamped =
    fechaInicio < rangoFechas.inicio ? rangoFechas.inicio : fechaInicio;
  const finClamped = fechaFin > rangoFechas.fin ? rangoFechas.fin : fechaFin;
  const totalMs = rangoFechas.fin.getTime() - rangoFechas.inicio.getTime();
  if (totalMs <= 0) return 0;
  const widthMs = finClamped.getTime() - inicioClamped.getTime();
  return Math.max(0, Math.min(100, (widthMs / totalMs) * 100));
}

/**
 * fechaInicio y fechaFin efectivas del contrato dentro del rango temporal ·
 * contratos indefinidos extienden hasta el final del rango.
 */
export function rangoEfectivoContrato(
  c: Contract,
  rangoFechas: RangoFechas,
): { inicio: Date; fin: Date } | null {
  if (!c.fechaInicio) return null;
  const inicio = parseIsoDateAsUTC(c.fechaInicio);
  if (Number.isNaN(inicio.getTime())) return null;
  const fin = c.fechaFin && !esFechaIndefinida(c.fechaFin)
    ? new Date(parseIsoDateAsUTC(c.fechaFin).getTime() + 24 * 60 * 60 * 1000)
    : rangoFechas.fin;
  if (Number.isNaN(fin.getTime())) return null;
  return { inicio, fin };
}

export function intersectaConRango(c: Contract, rangoFechas: RangoFechas): boolean {
  const ef = rangoEfectivoContrato(c, rangoFechas);
  if (!ef) return false;
  return ef.fin > rangoFechas.inicio && ef.inicio < rangoFechas.fin;
}

/**
 * Cuenta unidades arrendables · suma de bedrooms (≥1) de cada propiedad activa.
 */
export function contarUnidadesArrendables(properties: Property[]): number {
  return properties
    .filter((p) => !p.state || p.state === 'activo')
    .reduce((sum, p) => sum + Math.max(1, p.bedrooms || 1), 0);
}
