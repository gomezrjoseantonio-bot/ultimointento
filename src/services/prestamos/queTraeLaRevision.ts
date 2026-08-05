// ============================================================================
// Qué trae la revisión que viene · VOCABULARIO §6 ter · ter
// ============================================================================
//
// El aviso decía siempre lo mismo —«en la revisión de agosto pasarías al X %,
// Y € más al mes»— y esa frase solo habla de bonificaciones. Es la respuesta
// entera en un préstamo a tipo fijo, y media respuesta en todos los demás:
//
//   · En un VARIABLE la revisión mueve también el índice, que pesa mucho más
//     que las bonificaciones y que nadie puede predecir. Dar la cifra de las
//     bonificaciones a secas se lee como «esto es lo que va a cambiar».
//   · En un MIXTO, además, hay UNA revisión que lo cambia todo a la vez. La
//     Unicaja de Jose: el 25 de agosto de 2026 se acaban los 36 meses al
//     2,600 %, entra el Euríbor + 1,750 y las bonificaciones empiezan a rebajar
//     por primera vez. De las tres cosas no se avisaba de ninguna.
//
// Aquí se responde **qué trae**, en datos. Cómo se dice es de la capa de texto,
// y de qué día es de quien lleva el calendario: esto no mira el reloj —`hoy` se
// pasa de fuera— ni escribe frases.
// ============================================================================

import type { Prestamo } from '../../types/prestamos';
import { rebajanEnTramo } from './tinDelTramo';
import { tramosDeTipo, tramoVigente } from './tramosDeTipo';

/**
 * Una fecha que sirva para preguntar por un tramo · §6 ter · ter.
 *
 * La revisión puede venir en MES y AÑO, que es como la da el banco («Próxima
 * revisión 08/2027»), y `tramoVigente` compara cadenas ISO: `'2027-08-25'` no es
 * menor o igual que `'2027-08'`, así que un tramo que empieza a mitad de ese mes
 * salía como «todavía no ha llegado».
 *
 * Se completa al día 31 y no al 1: la revisión cae en algún día de ese mes y no
 * se sabe cuál, así que la pregunta honesta es si el tramo ha entrado **en algún
 * momento** del mes. Con el día 1 se respondería «no» de todos los tramos que
 * empiezan del 2 en adelante, que es el fallo contrario y el más caro — callar
 * lo que más mueve la cuota.
 *
 * El 31 vale aunque el mes no lo tenga: no se construye ninguna fecha, solo se
 * compara texto, y cualquier día real de ese mes es menor o igual que él.
 */
const cualquierDiaDe = (fecha: string): string =>
  /^\d{4}-\d{2}$/.test(fecha) ? `${fecha}-31` : fecha;

export interface LoQueTraeLaRevision {
  /** Si en esa revisión el tipo lo pone el índice · un fijo no lo mueve nunca. */
  elIndice: boolean;
  /** Cuál es · para poder llamarlo por su nombre en vez de «el índice». */
  indice?: Prestamo['indice'];
  /**
   * El día en que se acaba el tramo fijo de un mixto · solo si está por venir.
   *
   * Va aparte de la fecha de revisión a propósito: la del tramo la fija la
   * escritura (`firma + tramoFijoMeses`) y la de las bonificaciones la fija el
   * banco. En la Unicaja de Jose caen el mismo día, pero nada obliga a ello, y
   * darlas por la misma escondería la que no coincidiera.
   */
  acabaElTramoFijo?: string;
  /** El tipo fijo que se deja atrás ese día. */
  tinQueAcaba?: number;
  /** El diferencial al que se pasa · «Euríbor + 1,750». */
  diferencial?: number;
  /** Si ese día las bonificaciones empiezan a rebajar por primera vez. */
  estrenanLasBonificaciones?: boolean;
}

/**
 * Qué trae la revisión de una fecha dada, y qué trae el calendario del préstamo.
 *
 * `revisionDesde` ausente es el caso de «si la revisión fuera hoy»: la escritura
 * no dice cada cuánto miran y no hay cita que poner, así que se responde sobre
 * el tramo de hoy.
 */
export function queTraeLaRevision(
  prestamo: Prestamo,
  revisionDesde: string | undefined,
  hoy: string
): LoQueTraeLaRevision {
  const elIndice = tramoVigente(prestamo, cualquierDiaDe(revisionDesde || hoy)).variable;

  const trae: LoQueTraeLaRevision = { elIndice, indice: prestamo.indice };

  // El cambio de tramo de un mixto · el primer tramo que va a índice, y solo si
  // todavía no ha llegado. Uno que ya pasó no es un aviso, es historia.
  const primeroVariable = tramosDeTipo(prestamo).find((t) => t.variable);
  if (prestamo.tipo !== 'MIXTO' || !primeroVariable || primeroVariable.desde <= hoy) {
    return trae;
  }

  trae.acabaElTramoFijo = primeroVariable.desde;
  trae.tinQueAcaba = tramoVigente(prestamo, hoy).tinBase;
  trae.diferencial = prestamo.diferencial;
  // Solo se estrena lo que hoy no se aplica · en un mixto que ya bonifica desde
  // la firma no hay nada que anunciar, y decirlo sería anunciar dos veces algo
  // que el usuario ya está pagando rebajado.
  trae.estrenanLasBonificaciones =
    (prestamo.bonificaciones?.length ?? 0) > 0 &&
    !rebajanEnTramo(prestamo, tramoVigente(prestamo, hoy)) &&
    rebajanEnTramo(prestamo, primeroVariable);

  return trae;
}
