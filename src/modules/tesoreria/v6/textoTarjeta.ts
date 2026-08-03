// Cómo se lee una tarjeta de un vistazo · VOCABULARIO §3.3 y §3.4.
//
// Lo que hay que poder leer sin abrir la ficha es lo que decide el dinero:
// cuándo sale y de dónde. El nombre de la emisora es una etiqueta; el ciclo no.

import type { Account } from '../../../services/db';
import type { Tarjeta } from '../../../types/tarjetas';
import type { RendimientoDeTarjeta } from '../../../services/rendimientoDeTarjeta';
import { importeSaldo } from './formatoV6';

/** Los euros, con la misma letra que el resto de las cifras de la pantalla. */
const euros = (n: number): string => importeSaldo(n);

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

/**
 * Lo que ha rendido una tarjeta, en una línea · §3.7.
 *
 * Se enseña la COMPARACIÓN —devuelto sobre canalizado— y no un total suelto:
 * la pregunta que responde el cashback es por qué tarjeta canalizar el gasto,
 * y para eso hay que ver las dos cifras juntas.
 *
 * Mientras no haya nada cerrado, lo único que se puede decir es hasta dónde
 * llega ese camino — que ya es una respuesta.
 */
export function textoDeRendimiento(r: RendimientoDeTarjeta): string {
  const pct = `${r.porcentaje} %`;
  const techo = r.techoAnual != null ? ` · hasta ${euros(r.techoAnual)}/año` : '';

  if (r.canalizado <= 0) return `${pct} de vuelta${techo}`;
  return `${pct} · te ha devuelto ${euros(r.rendimiento)} de ${euros(r.canalizado)}${techo}`;
}
