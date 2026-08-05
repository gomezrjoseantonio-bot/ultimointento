// ============================================================================
// El tipo que se paga en un tramo · VOCABULARIO §6 ter
// ============================================================================
//
// Hasta aquí las bonificaciones rebajaban el préstamo ENTERO, de la firma al
// último recibo. Para un fijo y para un variable eso es correcto. Para un mixto
// depende de la escritura, y las dos de Jose dicen cosas contrarias:
//
//   · Unicaja (25-08-2023, 85.000 €, 240 meses): «No obstante, en el SEGUNDO y
//     en los sucesivos períodos de interés… UNICAJA BANCO aplicará
//     bonificaciones al tipo de interés». El primer periodo de interés son los
//     36 meses al 2,600 % fijo. Durante ellos se paga el 2,600 % aunque tengas
//     contratado todo el anexo. Las bonificaciones —hasta 1,000 punto— empiezan
//     el 25 de agosto de 2026, el mismo día que entra el Euríbor + 1,750.
//   · ING: 2,15 % fijo que baja al 1,35 % con las bonificaciones desde el
//     principio, y a los diez años pasa a Euríbor + diferencial.
//
// ATLAS aplicaba las de la Unicaja desde el día uno, así que enseñaba una cuota
// más baja de la que se cobra durante tres años. Y no es un decimal: un punto
// entero sobre 85.000 € a 240 meses.
//
// La respuesta la da el préstamo (`bonificacionesDesde`), no la bonificación —
// la escritura lo dice una vez, para el anexo entero.
//
// Aquí vive **esa decisión**, una sola vez, porque la pregunta «¿qué TIN se
// paga?» se hace desde el cuadro, desde el listado, desde el panel y desde la
// confirmación de una revisión, y ya hemos visto lo que pasa cuando la misma
// regla se escribe en cuatro sitios.
// ============================================================================

import type { Bonificacion, Prestamo } from '../../types/prestamos';
import type { Cumplimiento } from '../bonificaciones/cumplimiento';
import { tinConBonificaciones, tinSiRevisaranHoy } from '../bonificaciones/tinEfectivo';
import type { TramoDeTipo } from './tramosDeTipo';

/** Lo que hace falta saber de un tramo para decidir · nada más. */
type TramoBonificable = Pick<TramoDeTipo, 'tinBase' | 'variable'>;

/**
 * Si en este tramo las bonificaciones rebajan.
 *
 * Sin respuesta guardada, rebajan: es lo que ATLAS venía haciendo, y es lo
 * correcto para un fijo, para un variable y para un mixto tipo ING. El caso que
 * hay que declarar es el otro.
 *
 * Y solo se declara en un mixto. Un préstamo que cambia a fijo arrastrando un
 * `TRAMO_VARIABLE` de cuando era mixto se quedaría SIN bonificar de por vida —
 * esperando una fase variable que ya no va a llegar—. Un dato que dejó de tener
 * sentido no puede seguir decidiendo el tipo.
 */
export function rebajanEnTramo(prestamo: Prestamo, tramo: TramoBonificable): boolean {
  if (prestamo.tipo !== 'MIXTO') return true;
  return prestamo.bonificacionesDesde !== 'TRAMO_VARIABLE' || tramo.variable;
}

/**
 * El TIN que se paga en un tramo · el del tramo, menos lo que rebajen si rebajan.
 *
 * `bonificaciones` se puede pasar aparte para preguntar «¿y si el banco me
 * quitara estas?» sin tener que fabricar un préstamo entero. Por defecto, las
 * del préstamo.
 */
export function tinDelTramo(
  prestamo: Prestamo,
  tramo: TramoBonificable,
  bonificaciones: Bonificacion[] | undefined = prestamo.bonificaciones
): number {
  if (!rebajanEnTramo(prestamo, tramo)) return tramo.tinBase;
  return tinConBonificaciones(tramo.tinBase, bonificaciones, prestamo);
}

/**
 * El TIN al que se iría **si la revisión fuera hoy** · §6 ter.
 *
 * En un tramo que todavía no bonifica la respuesta es «al mismo», y no es un
 * atajo: durante los 36 meses fijos de la Unicaja da igual lo que demuestren
 * tus movimientos, porque el tipo de ese periodo no lo mueve nada. Lo que se
 * juega ahí se cobra en la primera revisión, y eso se avisa aparte.
 */
export function tinDelTramoSiRevisaranHoy(
  prestamo: Prestamo,
  tramo: TramoBonificable,
  cumplimientos: Cumplimiento[]
): number {
  if (!rebajanEnTramo(prestamo, tramo)) return tramo.tinBase;
  return tinSiRevisaranHoy(tramo.tinBase, prestamo.bonificaciones, cumplimientos, prestamo);
}
