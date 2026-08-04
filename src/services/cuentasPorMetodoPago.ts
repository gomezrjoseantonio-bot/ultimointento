// ============================================================================
// Qué cuentas pueden pagar con cada método · docs/VOCABULARIO-dinero.md §2
// ============================================================================
//
// El método de pago dice CÓMO sale el dinero; la cuenta dice DE DÓNDE. Son dos
// datos distintos, pero no independientes: el método RESTRINGE las cuentas
// posibles, y en dos casos las reduce a una sola.
//
// Esto vivía repartido por los formularios, o directamente no vivía: el alta de
// gasto recurrente ofrecía las diez cuentas con método "efectivo" —que sale del
// colchón, no del banco— y con "bizum" —que solo puede salir de la única cuenta
// que lo tiene atado al teléfono—. Guardar eso deja un dato imposible que luego
// se proyecta sobre la cuenta equivocada.
//
// La regla se escribe UNA vez y se consulta siempre. Si cambia, cambia aquí.
// ============================================================================

import type { Account } from './db';
import type { MetodoPagoCompromiso } from '../types/compromisosRecurrentes';
import type { Tarjeta } from '../types/tarjetas';

/**
 * Una cuenta de banco de verdad · tiene IBAN y se le puede domiciliar algo.
 *
 * Bastaba con dejar fuera el efectivo desde que las cuentas de tipo tarjeta no
 * existen (V88): una tarjeta no es un sitio donde hay dinero, es una `Tarjeta`.
 */
function esBancaria(c: Account): boolean {
  return c.tipo !== 'EFECTIVO';
}

/**
 * Las cuentas entre las que se puede elegir con este método.
 *
 * Vacío significa que el método NO se puede usar todavía —no hay cuenta de
 * efectivo, o ninguna tiene el Bizum activado—, y entonces no debe ofrecerse:
 * antes eso que guardar un gasto en efectivo colgado de una cuenta bancaria.
 */
export function cuentasQuePuedenPagar(
  metodo: MetodoPagoCompromiso,
  cuentas: Account[]
): Account[] {
  switch (metodo) {
    // §4 · el efectivo sale del colchón. El dinero llega ahí por un traspaso
    // interno desde el banco (la retirada de cajero), no por arte de magia.
    case 'efectivo':
      return cuentas.filter((c) => c.tipo === 'EFECTIVO');
    // §5 · el Bizum va atado a un teléfono y un teléfono a una cuenta.
    case 'bizum':
      return cuentas.filter((c) => c.bizum === true);
    // §3 · lo que compras con tarjeta lo paga su cuenta de liquidación, que es
    // bancaria. §1 · el colchón no tiene IBAN que domiciliar.
    default:
      return cuentas.filter(esBancaria);
  }
}

/**
 * `true` cuando el método NO deja elegir: la cuenta es una y la decide él.
 *
 * Enseñar un desplegable con una sola opción invita a pensar que hay algo que
 * decidir, y no lo hay: si pagas en efectivo sale del efectivo.
 */
export function elMetodoDecideLaCuenta(metodo: MetodoPagoCompromiso): boolean {
  return metodo === 'efectivo' || metodo === 'bizum';
}

/**
 * La cuenta que toca al elegir este método, respetando la ya guardada si sigue
 * siendo válida. `undefined` si el método no se puede usar.
 *
 * Sin esto, cambiar el medio a "Efectivo" dejaba pegada la cuenta bancaria
 * anterior: el desplegable se ocultaba pero el dato guardado seguía siendo el
 * viejo, que es la peor de las dos formas de estar mal — invisible.
 */
export function cuentaParaElMetodo(
  metodo: MetodoPagoCompromiso,
  cuentas: Account[],
  cuentaActual?: number | null
): number | undefined {
  const posibles = cuentasQuePuedenPagar(metodo, cuentas);
  if (posibles.length === 0) return undefined;
  if (cuentaActual != null && posibles.some((c) => c.id === cuentaActual)) {
    return cuentaActual;
  }
  return posibles[0].id;
}

/**
 * De qué cuenta sale REALMENTE el cargo de este gasto.
 *
 * `compromiso.cuentaCargo` es lo que se guardó el día que se creó, y para los
 * métodos que NO dejan elegir eso es una copia que puede mentir: un gasto en
 * efectivo apuntando a Santander hace que el banco parezca más pobre y que el
 * colchón no baje nunca — el dinero sale de un sitio del que no salió.
 *
 * Así que la cuenta se vuelve a decidir al proyectar, con la misma regla que
 * usa el formulario. Para domiciliación y transferencia se respeta lo guardado:
 * ahí el usuario SÍ elige, y cambiárselo por su cuenta sería peor.
 *
 * Sin `cuentas` —quien no las tenga a mano— se devuelve lo guardado: mejor la
 * copia que nada.
 */
export function cuentaDelCargo(
  compromiso: { metodoPago: MetodoPagoCompromiso; cuentaCargo: number },
  tarjeta: Pick<Tarjeta, 'cuentaLiquidacionId'> | undefined,
  cuentas: Account[]
): number {
  // §3 · con tarjeta manda su cuenta de liquidación.
  if (tarjeta) return tarjeta.cuentaLiquidacionId;
  // §2 · efectivo y Bizum no dejan elegir: la cuenta la decide el método.
  if (elMetodoDecideLaCuenta(compromiso.metodoPago)) {
    return (
      cuentaParaElMetodo(compromiso.metodoPago, cuentas, compromiso.cuentaCargo) ??
      compromiso.cuentaCargo
    );
  }
  return compromiso.cuentaCargo;
}

// ============================================================================
// Pagar con tarjeta · §3
// ============================================================================
//
// «Tarjeta» no es un método como los demás: no dice de qué cuenta sale, dice
// con QUÉ tarjeta se paga — y es la tarjeta la que sabe dónde está domiciliada.
// Hasta ahora el medio se guardaba a secas y la cuenta se elegía a mano, así
// que un gasto de la Carrefour podía acabar apuntando a Santander cuando su
// recibo lo paga Bankinter.

/** Las que se pueden elegir para pagar · una tarjeta de baja no paga nada. */
export function tarjetasQuePuedenPagar(tarjetas: Tarjeta[]): Tarjeta[] {
  return tarjetas.filter((t) => t.id != null && t.activa !== false);
}

/**
 * `true` cuando se puede pagar con tarjeta · hay al menos una dada de alta.
 *
 * Sin esto el medio se ofrecía siempre, y elegirlo dejaba un gasto que dice
 * «con tarjeta» sin decir con cuál: un dato que no se puede proyectar.
 */
export function sePuedePagarConTarjeta(tarjetas: Tarjeta[]): boolean {
  return tarjetasQuePuedenPagar(tarjetas).length > 0;
}

/**
 * La tarjeta que toca, respetando la ya guardada si sigue valiendo.
 *
 * `undefined` si no hay ninguna: cambiar el medio a «Tarjeta» sin tarjetas no
 * debería poder ocurrir —el medio no se ofrece—, y si ocurre es mejor que se
 * vea vacío que que se quede pegada una tarjeta borrada.
 */
export function tarjetaParaElPago(
  tarjetas: Tarjeta[],
  tarjetaActual?: number | null
): number | undefined {
  const posibles = tarjetasQuePuedenPagar(tarjetas);
  if (posibles.length === 0) return undefined;
  if (tarjetaActual != null && posibles.some((t) => t.id === tarjetaActual)) {
    return tarjetaActual;
  }
  return posibles[0].id;
}

/**
 * De qué cuenta sale el dinero de esta tarjeta · su cuenta de liquidación.
 *
 * No se elige: la decide la tarjeta, igual que el efectivo decide el colchón.
 * Si la tarjeta ya no existe se devuelve `undefined` en vez de la cuenta que
 * hubiera antes — dejarla pegada sería la peor forma de estar mal, invisible.
 */
export function cuentaDeLaTarjeta(
  tarjetaId: number | null | undefined,
  tarjetas: Tarjeta[]
): number | undefined {
  if (tarjetaId == null) return undefined;
  return tarjetas.find((t) => t.id === tarjetaId)?.cuentaLiquidacionId;
}
