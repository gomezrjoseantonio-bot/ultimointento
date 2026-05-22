import type { Contract } from '../../../services/db';

export type ColorHabitacion = 'verde' | 'roja' | 'amarilla' | 'azul' | 'negra';

const ORDEN_COLORES: ColorHabitacion[] = [
  'verde',
  'roja',
  'amarilla',
  'azul',
  'negra',
];

/**
 * Color de habitación derivado del número (1..N) · ciclo de 5 colores para
 * propiedades con >5 habitaciones.
 */
export function colorPorNumeroHabitacion(num: number): ColorHabitacion {
  if (!Number.isFinite(num) || num < 1) return 'verde';
  const idx = (Math.floor(num) - 1) % ORDEN_COLORES.length;
  return ORDEN_COLORES[idx];
}

/**
 * Extrae el número de habitación a partir de Contract.habitacionId · admite
 * convenciones del proyecto · "hab-1", "habitacion-3", "3", null/undefined.
 */
export function habitacionNumeroDe(c: Contract): number | null {
  if (!c.habitacionId) return null;
  const m = String(c.habitacionId).match(/(\d+)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function resolverColorHabitacion(c: Contract): ColorHabitacion {
  const n = habitacionNumeroDe(c);
  if (n != null) return colorPorNumeroHabitacion(n);
  return 'verde';
}

export const CSS_COLOR_HABITACION: Record<ColorHabitacion, string> = {
  verde: 'var(--atlas-v5-room-green, #4A7C59)',
  roja: 'var(--atlas-v5-room-red, #A23E3E)',
  amarilla: 'var(--atlas-v5-room-yellow, #C89828)',
  azul: 'var(--atlas-v5-room-blue, #3B5A7F)',
  negra: 'var(--atlas-v5-room-bw, #2C2C2C)',
};
