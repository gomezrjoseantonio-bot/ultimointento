// Panel · normalización mensual de compromisos recurrentes.
//
// Los compromisos NUNCA se prorratean en su modelo (patronCalendario §Regla #4:
// el IBI son 500€ en junio + 500€ en noviembre, no 83€/mes). Para el COLCHÓN
// Jose pide justo la vista prorrateada ("IBI prorrateado"), así que aquí
// anualizamos expandiendo el patrón sobre un año natural y dividimos entre 12.
//
// Para el hueco del saldo a fin de mes necesitamos, además, el importe que un
// compromiso descarga DENTRO de un mes concreto (sin prorratear).

import { expandirPatron, calcularImporte } from '../../services/personal/patronCalendario';
import type { CompromisoRecurrente } from '../../types/compromisosRecurrentes';

const iso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const esActivoRecurrente = (c: CompromisoRecurrente): boolean =>
  c.estado === 'activo' && c.patron?.tipo !== 'puntual';

/** Coste anual de un compromiso · suma de sus pagos en el año natural de `ref`. */
const costeAnual = (c: CompromisoRecurrente, ref: Date): number => {
  try {
    const y = ref.getFullYear();
    const fechas = expandirPatron(c.patron, `${y}-01-01`, `${y}-12-31`);
    return fechas.reduce((s, f) => s + calcularImporte(c.importe, f), 0);
  } catch {
    return 0;
  }
};

/**
 * Gasto fijo recurrente prorrateado a mes = Σ (coste anual / 12) de los
 * compromisos activos (personal + inmueble). Excluye pagos puntuales.
 */
export const costeMensualRecurrente = (
  compromisos: CompromisoRecurrente[],
  ref: Date,
): number =>
  compromisos
    .filter(esActivoRecurrente)
    .reduce((s, c) => s + costeAnual(c, ref) / 12, 0);

/** Importe que los compromisos activos descargan DENTRO del mes de `ref` (sin prorratear). */
export const importeRecurrenteEnMes = (
  compromisos: CompromisoRecurrente[],
  ref: Date,
): number => {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const desde = iso(new Date(y, m, 1));
  const hasta = iso(new Date(y, m + 1, 0));
  return compromisos.filter(esActivoRecurrente).reduce((s, c) => {
    try {
      const fechas = expandirPatron(c.patron, desde, hasta);
      return s + fechas.reduce((acc, f) => acc + calcularImporte(c.importe, f), 0);
    } catch {
      return s;
    }
  }, 0);
};
