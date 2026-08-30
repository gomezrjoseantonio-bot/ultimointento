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
//   importe > 0  ⇒  dinero que ENTRA  ⇒  cabe ingreso/renta, nunca gasto
//   importe < 0  ⇒  dinero que SALE   ⇒  cabe gasto,          nunca renta
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
    case 'create_treasury_event':
      if (action.type === 'income') return 'entra';
      if (action.type === 'expense') return 'sale';
      return 'ninguna';
    case 'ignore':
    default:
      return 'ninguna';
  }
}

/** ¿Esta propuesta dice lo contrario de lo que dice el importe? */
export function contradiceElSigno(action: SuggestionAction, amount: number): boolean {
  const dinero = direccionDelImporte(amount);
  const propuesta = direccionDeLaAccion(action);
  if (dinero === 'ninguna' || propuesta === 'ninguna') return false;
  return dinero !== propuesta;
}
