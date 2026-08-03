// ============================================================================
// Los dos vocabularios del método de pago · docs/VOCABULARIO-dinero.md §2
// ============================================================================
//
// Conviven dos enumeraciones para exactamente lo mismo:
//
//   `MetodoPagoCompromiso` (recurrentes) · domiciliacion · transferencia ·
//                                          tarjeta · efectivo · bizum
//   `MetodoDePago`         (movimientos) · Domiciliado  · Transferencia ·
//                                          TPV     · Efectivo · Bizum
//
// No coinciden ni en los valores (`TPV` / `tarjeta`) ni en la forma. Mientras
// sigan siendo dos, la traducción se escribe AQUÍ y en ningún otro sitio.
//
// Traducir a mano en cada pantalla es lo que dejó `bizum` sin caso en el
// `switch` del motor de compromisos: un recurrente por Bizum llegaba a la
// previsión SIN método de pago, y luego no había con qué reconocerlo en el
// extracto. Un `switch` incompleto no avisa; una tabla con todas las claves sí.
// ============================================================================

import type { MetodoDePago } from './db';
import type { MetodoPagoCompromiso } from '../types/compromisosRecurrentes';

/**
 * Del vocabulario de los recurrentes al de los movimientos.
 *
 * Es un `Record` y no un `switch` a propósito: TypeScript exige que estén las
 * cinco claves, así que añadir un método nuevo al tipo rompe la compilación en
 * vez de devolver `undefined` en silencio.
 */
const AL_MOVIMIENTO: Record<MetodoPagoCompromiso, MetodoDePago> = {
  domiciliacion: 'Domiciliado',
  transferencia: 'Transferencia',
  tarjeta: 'TPV',
  efectivo: 'Efectivo',
  bizum: 'Bizum',
};

/** Cómo se llama este método en un movimiento. */
export function metodoDeMovimiento(metodo: MetodoPagoCompromiso): MetodoDePago {
  return AL_MOVIMIENTO[metodo];
}

/**
 * Del vocabulario de los movimientos al de los recurrentes.
 *
 * Sirve para casar un movimiento importado con el recurrente que lo esperaba:
 * sin esto habría que comparar `'TPV'` con `'tarjeta'` a ojo en cada sitio.
 */
const AL_COMPROMISO: Record<MetodoDePago, MetodoPagoCompromiso> = {
  Domiciliado: 'domiciliacion',
  Transferencia: 'transferencia',
  TPV: 'tarjeta',
  Efectivo: 'efectivo',
  Bizum: 'bizum',
};

/** Cómo se llama este método en un gasto recurrente. */
export function metodoDeCompromiso(metodo: MetodoDePago): MetodoPagoCompromiso {
  return AL_COMPROMISO[metodo];
}

/** Cómo se le enseña al usuario · una sola forma en toda la aplicación. */
const EN_PANTALLA: Record<MetodoPagoCompromiso, string> = {
  domiciliacion: 'Domiciliación',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  efectivo: 'Efectivo',
  bizum: 'Bizum',
};

/** El nombre que ve el usuario · acepta cualquiera de los dos vocabularios. */
export function nombreDelMetodo(metodo: MetodoPagoCompromiso | MetodoDePago): string {
  // `hasOwnProperty` y no `in`: `in` también encuentra lo que hereda del
  // prototipo, así que un dato corrupto que valiera «toString» se daría por
  // bueno y devolvería una función donde se espera un rótulo.
  const esDeCompromiso = Object.prototype.hasOwnProperty.call(EN_PANTALLA, metodo);
  const clave = esDeCompromiso
    ? (metodo as MetodoPagoCompromiso)
    : metodoDeCompromiso(metodo as MetodoDePago);
  return EN_PANTALLA[clave];
}
