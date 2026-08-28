// ============================================================================
// Un descarte no se deshace solo
// ============================================================================
//
// Descartar un previsto es decir «esto no va a ocurrir». Pero la previsión
// descartada seguía siendo candidata al conciliar: casaba con el cargo del
// extracto y quedaba `executed` CON la marca de descarte puesta. Un evento así
// no se ve en ningún sitio —ni en confirmados (`DrawerCuenta:185`), ni en
// pendientes (`:205`), ni en los KPIs (`tesoreriaV6Metrics:589`)— mientras su
// movimiento sí mueve el saldo. Dinero moviéndose sin nada que lo explique.
//
// Antes se autolimitaba: la purga del bootstrap borraba el descartado en cuanto
// pasaba el mes. #1813 hizo que los descartes vivan para siempre, y con ellos
// el fallo.
//
// Aquí viven las dos piezas que lo cierran, juntas y puras para que los cuatro
// sitios que las necesitan digan exactamente lo mismo.
// ============================================================================

import type { TreasuryEvent } from './db';

/**
 * ¿Se le puede casar un cargo del banco a esta previsión?
 *
 * Solo a lo que sigue esperando ocurrir. Un descartado no: el usuario ya dijo
 * que no iba a pasar, y ofrecerlo otra vez es preguntarle lo mismo por segunda
 * vez con la respuesta ya dada. Si se equivocó, el camino es recuperar el
 * descarte, no que el extracto lo deshaga por detrás.
 */
export function esConciliable(evento: Pick<TreasuryEvent, 'status' | 'descartado'>): boolean {
  return evento.status === 'predicted' && evento.descartado !== true;
}

/**
 * La previsión sin marca de descarte · lo que se escribe al materializarla.
 *
 * Red de seguridad para las vías que no pasan por `esConciliable` (confirmar a
 * mano desde la ficha, por ejemplo): **un evento no puede ser `executed` y
 * `descartado` a la vez.** Si el cargo llegó de verdad, el hecho del banco
 * manda sobre la previsión de que no llegaría.
 *
 * La jerarquía ya estaba escrita en el otro sentido: `descartarPrevisto` se
 * niega sobre un `executed` («no se puede descartar algo que ya ocurrió ·
 * deshaz la confirmación primero», `treasuryDiscardService:29-31`). Esto es la
 * otra mitad de la misma regla.
 *
 * Se BORRAN las propiedades en vez de ponerlas a `false`, igual que hace
 * `recuperarPrevisto`: un registro sin marca se lee mejor que uno con
 * `descartado: false` colgando.
 */
export function sinMarcaDeDescarte<T extends Partial<TreasuryEvent>>(evento: T): T {
  if (evento.descartado == null && evento.descartadoAt == null && evento.motivoDescarte == null) {
    return evento;
  }
  const { descartado, descartadoAt, motivoDescarte, ...resto } = evento;
  void descartado;
  void descartadoAt;
  void motivoDescarte;
  return resto as T;
}
