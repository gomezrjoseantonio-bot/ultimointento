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

/** Una cuenta de banco de verdad · tiene IBAN y se le puede domiciliar algo. */
function esBancaria(c: Account): boolean {
  return c.tipo !== 'EFECTIVO' && c.tipo !== 'TARJETA_CREDITO';
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
