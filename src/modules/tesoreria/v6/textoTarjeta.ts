// Cómo se lee una tarjeta de un vistazo · VOCABULARIO §3.3 y §3.4.
//
// Lo que hay que poder leer sin abrir la ficha es lo que decide el dinero:
// cuándo sale y de dónde. El nombre de la emisora es una etiqueta; el ciclo no.

import type { Account } from '../../../services/db';
import type { Tarjeta } from '../../../types/tarjetas';

const DIAS = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

/** "el 31" es el ÚLTIMO día del mes, no el 31 literal · no se salta febrero. */
const diaMensual = (d: number): string => (d >= 31 ? 'el último día' : `el ${d}`);

const diaSemanal = (d: number): string => `el ${DIAS[d] ?? ''}`.trimEnd();

/**
 * Una línea con lo que decide el dinero: cuándo sale y de qué cuenta.
 *
 * El débito no lleva ciclo porque no acumula nada — decir "corta el N" de una
 * de débito sería inventarse un periodo que no existe.
 */
export function describirTarjeta(tarjeta: Tarjeta, cuentas: Account[]): string {
  const cuenta = cuentas.find((c) => c.id === tarjeta.cuentaLiquidacionId);
  const donde = `en ${cuenta?.alias || `cuenta #${tarjeta.cuentaLiquidacionId}`}`;

  if (tarjeta.modalidad !== 'credito' || !tarjeta.ciclo) {
    return `Débito · sale ${donde} al momento`;
  }

  const { periodicidad, corte, diaCargo } = tarjeta.ciclo;
  const como = periodicidad === 'semanal' ? diaSemanal : diaMensual;
  return `Crédito · corta ${como(corte)} y cobra ${como(diaCargo)} ${donde}`;
}
