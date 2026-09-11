// ============================================================================
// El signo manda primero
// ============================================================================
//
// Antes que cualquier palabra del texto del banco, una línea del extracto dice
// una cosa que no admite interpretación: si el dinero ENTRÓ o SALIÓ. El detector
// de `movementSuggestionService` leía el texto y se saltaba el importe, y por eso
// proponía "Parece la renta de un inquilino" sobre "Bizum A Favor De Aroa Gómez
// −80 €". El nombre coincidía con una inquilina viva, sí — coincidía porque Aroa
// es quien COBRA esos 80 €, no quien los paga.
//
// Aquí vive la regla, sola y en un sitio por el que pasa todo lo que el detector
// propone:
//
//   importe > 0  ⇒  dinero que ENTRA  ⇒  cabe ingreso/renta · y la DEVOLUCIÓN
//                                        de un gasto, que es de su familia
//   importe < 0  ⇒  dinero que SALE   ⇒  cabe gasto,          nunca renta
//
// La devolución es la excepción que añadió E2.4.2-fix, y no es un descuido del
// signo sino lo contrario: Curenergía cobra una cuota fija y cada seis meses
// devuelve lo que sobró. Ese abono es del suministro —mismo proveedor, mismo
// CUPS, mismo piso— y tiene que RESTAR de la luz de ese piso. Si el guardián lo
// tumba, la propuesta que sabe de qué punto es se pierde y el abono acaba de
// «otros ingresos», desatado del piso. Lo que sigue siendo imposible es una
// renta que sale, un traspaso que entra por la pata de salida y un gasto que
// entra sin que nadie diga de qué gasto es.
//
// Por qué un guardián a la salida y no un `if` en cada regla. Los `if` también
// están —cada heurística mira ya su signo, y así el motivo que se le enseña al
// usuario es el bueno— pero un `if` sólo protege la regla que lo lleva. La
// heurística que alguien añada el año que viene no lo llevará, y el fallo no se
// vería: saldría una propuesta plausible, con su confianza y su frase, sobre una
// línea que dice lo contrario. El guardián no se puede olvidar porque no hay
// nada que recordar.
//
// Qué NO hace: no decide si la propuesta es acertada. Una transferencia de 900 €
// que entra puede ser una renta, la devolución de un préstamo a un amigo o la
// venta de un sofá — eso lo sigue decidiendo el usuario. Esto sólo tira lo que
// es imposible.
// ============================================================================

import type { SuggestionAction } from '../movementSuggestionService';

/** Hacia dónde va el dinero. `ninguna` es "esto no dice nada del signo". */
export type DireccionDelDinero = 'entra' | 'sale' | 'ninguna';

/**
 * La dirección que dice el importe del movimiento.
 *
 * El cero es `ninguna` a propósito: un apunte de 0 € ni entra ni sale, así que
 * no contradice nada y no tiene sentido usarlo para tumbar una propuesta.
 */
export function direccionDelImporte(amount: number): DireccionDelDinero {
  if (amount > 0) return 'entra';
  if (amount < 0) return 'sale';
  return 'ninguna';
}

/**
 * La dirección que da por supuesta una propuesta.
 *
 * `assign_to_contract` es dar por cobrada una renta, o sea dinero que entra —
 * aunque el nombre de la acción no lo diga. `financing` queda fuera: un
 * movimiento de financiación puede ser la disposición del préstamo (entra) o la
 * cuota (sale), y el `type` por sí solo no distingue cuál.
 */
export function direccionDeLaAccion(action: SuggestionAction): DireccionDelDinero {
  switch (action.kind) {
    case 'assign_to_contract':
      return 'entra';
    case 'mark_personal_expense':
      return 'sale';
    // E2.2 · un traspaso aprendido es la SALIDA hacia otra cuenta propia.
    case 'transfer':
      return 'sale';
    case 'create_treasury_event':
      if (action.naturaleza === 'ingreso') return 'entra';
      if (action.naturaleza === 'gasto') return 'sale';
      return 'ninguna';
    case 'ignore':
    default:
      return 'ninguna';
  }
}

/**
 * ¿La propuesta viene de un GASTO CONOCIDO que puede estar devolviendo dinero?
 *
 * Solo `create_treasury_event` de naturaleza gasto, que es lo que propone un
 * compromiso recurrente reconocido —la luz de ese piso, con su CUPS y su
 * proveedor—. Es justo la propuesta que hay que dejar pasar sobre un abono:
 * sin ella, la devolución de Curenergía pierde el punto y el piso.
 *
 * Los otros no entran, y cada uno por su motivo:
 *   · `transfer` es la pata de SALIDA hacia otra cuenta propia · sobre un
 *     abono no es una devolución, es la pata equivocada;
 *   · `assign_to_contract` es dar por cobrada una renta · un ingreso por sí
 *     mismo;
 *   · `mark_personal_expense` es una regla APRENDIDA de un gasto suelto, sin
 *     punto ni proveedor que ate nada. Dejarla pasar convertía «ABONO NOMINA»
 *     de 1.840 € en la devolución de un suministro, que es exactamente el
 *     fallo que este guardián nació para evitar. La devolución con proveedor
 *     reconocible ya la coge el motor por el concepto (`porComercio`).
 */
function proponeUnGastoConocido(action: SuggestionAction): boolean {
  return action.kind === 'create_treasury_event' && action.naturaleza === 'gasto';
}

/** ¿Esta propuesta dice lo contrario de lo que dice el importe? */
export function contradiceElSigno(action: SuggestionAction, amount: number): boolean {
  const dinero = direccionDelImporte(amount);
  const propuesta = direccionDeLaAccion(action);
  if (dinero === 'ninguna' || propuesta === 'ninguna') return false;
  // La devolución de un gasto entra con la familia de ese gasto · no contradice
  // el signo, lo usa: por eso resta en lugar de sumar (E2.4.2-fix).
  if (dinero === 'entra' && proponeUnGastoConocido(action)) return false;
  return dinero !== propuesta;
}
