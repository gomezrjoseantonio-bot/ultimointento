// Tira superior de la tabla de gastos recurrentes (§3.1):
//   coste anual de gastos · gastos vigentes · sin importe todavía · el mes más cargado
//
// Todo desde el cálculo canónico `importeCompromisoEnMes` (misma cifra que
// Tesorería/Presupuesto). Un gasto sin importe NO se proyecta (contribuye 0 al
// coste) pero SÍ se cuenta en `sinImporte` (§2.6: se ve y se cuenta, no se
// rellena). El coste anual es solo de lo VIGENTE (activo).

import type { CompromisoRecurrente } from '../../../../../types/compromisosRecurrentes';
import { importeCompromisoEnMes } from '../../../../../services/personal/compromisosRecurrentesService';

export interface TiraMetrics {
  /** Suma de los 12 meses del año, solo compromisos activos. */
  costeAnual: number;
  /** Nº de compromisos activos (vigentes). */
  vigentes: number;
  /** Nº de compromisos cuyo importe NO se puede calcular (sin importe/patrón). */
  sinImporte: number;
  /** Mes (0-11) con mayor carga y su total · null si no hay ninguna cifra. */
  mesMasCargado: { month0: number; total: number } | null;
}

const MESES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export const nombreMes = (month0: number): string => MESES_ES[((month0 % 12) + 12) % 12];

export function computeTiraMetrics(
  compromisos: CompromisoRecurrente[],
  year: number,
): TiraMetrics {
  const activos = compromisos.filter((c) => c.estado === 'activo');

  const porMes: number[] = Array.from({ length: 12 }, (_, m) =>
    activos.reduce((s, c) => s + Math.abs(importeCompromisoEnMes(c, year, m) ?? 0), 0),
  );

  const costeAnual = porMes.reduce((a, b) => a + b, 0);

  let mesMasCargado: TiraMetrics['mesMasCargado'] = null;
  porMes.forEach((total, m) => {
    if (total > 0 && (mesMasCargado === null || total > mesMasCargado.total)) {
      mesMasCargado = { month0: m, total };
    }
  });

  // `null` en cualquier mes ⇒ estructuralmente no calculable (sin importe/patrón);
  // basta comprobar un mes. Un patrón que no cae en el mes devuelve 0, no null.
  const sinImporte = compromisos.filter(
    (c) => importeCompromisoEnMes(c, year, 0) === null,
  ).length;

  return { costeAnual, vigentes: activos.length, sinImporte, mesMasCargado };
}
