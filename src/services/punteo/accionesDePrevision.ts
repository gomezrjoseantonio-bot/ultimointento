// ============================================================================
// T4 · qué se puede hacer con esta fila · la regla, escrita una sola vez
// ============================================================================
//
// El usuario usaba «Eliminar» para cuatro situaciones distintas porque era el
// único botón que parecía hacer algo. Cada una tiene ya su camino (T1·T2·T3), y
// lo que queda es que la fila OFREZCA el que le toca — y solo ese.
//
// La regla la manda el estado, y son tres:
//
//   PREVISTO           → ✓ confirmar · ✎ editar · ⇢ ir al gasto · ✕ descartar.
//                        «Eliminar» nunca borró una previsión: marcaba
//                        descartado. Su función es el ✕, y por eso no hay un
//                        «Eliminar» aparte.
//   CONFIRMADO A MANO  → ↺ deshacer + ✎. Lo dijiste tú, lo corriges tú.
//   CONCILIADO (BANCO) → 🔒 y nada más, A PROPÓSITO. La jerarquía es
//                        conciliado > confirmado > previsto: el banco es la
//                        verdad última y no se discute desde aquí. El candado
//                        NO es un botón deshabilitado —eso invita a pulsarlo y
//                        no responde—: es la señal de de dónde viene el dato.
//
// Y transversal: una DESCARTADA sigue existiendo (no caduca, T1) y se puede
// recuperar. Sin esto, descartar por error no tenía vuelta.
//
// Vive aparte de las vistas porque son TRES —calendario, cuenta y tarjeta— y
// una regla repartida entre tres pantallas es una regla que se corrige en una
// y se olvida en las otras dos. Vive junto al modelo de punteo —no en
// Tesorería— porque la lista que la consume es compartida.
// ============================================================================

import type { ItemPunteo } from './punteoModel';

export type AccionDeFila =
  | 'confirmar'
  | 'editar'
  | 'irAlGasto'
  | 'descartar'
  | 'deshacer'
  | 'candado'
  | 'recuperar';

/**
 * ¿Se puede deshacer la confirmación de esta fila?
 *
 * Solo lo que NACIÓ de una previsión: es lo único que tiene adónde volver.
 * Deshacer un alta a mano o algo llegado del inbox no lo devolvería a «Por
 * confirmar», lo borraría. Un evento `confirmed` sin punteo detrás —la venta de
 * un piso, la liquidación de un préstamo— no se punteó nunca: está decidido y
 * espera al banco.
 *
 * Lo conciliado queda fuera por definición: no llega aquí (`accionesDeFila` lo
 * manda al candado antes), y el servicio lo rechaza además por su cuenta.
 */
export function sePuedeDeshacer(it: Pick<ItemPunteo, 'kind' | 'estado' | 'previsionId'>): boolean {
  return it.estado === 'confirmado' && it.kind === 'movimiento' && it.previsionId != null;
}

/**
 * Las acciones de la fila, en el orden en que se pintan.
 *
 * `confirmar` sale la primera porque es la acción principal y vive a la
 * izquierda, en el círculo; el resto van al grupo de la derecha.
 */
export function accionesDeFila(
  it: Pick<ItemPunteo, 'kind' | 'estado' | 'previsionId' | 'gastoRecurrente' | 'descartado' | 'editable'>,
): AccionDeFila[] {
  // Una descartada no se confirma ni se vuelve a descartar: lo único que queda
  // por decir de ella es que fue un error.
  if (it.descartado) return ['recuperar'];

  if (it.estado === 'previsto') {
    return [
      'confirmar',
      ...(it.editable ? (['editar'] as const) : []),
      // Solo si hay gasto recurrente detrás (T3) · una renta de contrato o un
      // préstamo no tienen ficha que abrir.
      ...(it.gastoRecurrente ? (['irAlGasto'] as const) : []),
      'descartar',
    ];
  }

  if (it.estado === 'confirmado') {
    return [
      ...(sePuedeDeshacer(it) ? (['deshacer'] as const) : []),
      ...(it.editable ? (['editar'] as const) : []),
    ];
  }

  return ['candado'];
}

/**
 * En el pie de la ficha, ¿la baja DESCARTA o borra de verdad?
 *
 * El botón decía «Eliminar» en los dos casos y solo era cierto en uno: sobre
 * una previsión llamaba a descartar —el evento sigue ahí, marcado como que no
 * va a ocurrir—, y quien lo pulsaba creía haber borrado algo. Sobre un
 * movimiento anotado a mano o un traspaso sí borra, y ahí el rótulo es el
 * bueno.
 *
 * Se decide con lo mismo que decide la ACCIÓN, no con un rótulo escrito aparte:
 * si algún día cambiara a quién borra de verdad, un texto suelto se quedaría
 * mintiendo.
 */
export function laBajaEsDescarte(it: Pick<ItemPunteo, 'kind' | 'traspaso'>): boolean {
  if (it.traspaso) return false;
  return it.kind === 'evento';
}

/** Rótulo del pie de la ficha · dice lo que el botón hace de verdad. */
export function etiquetaDeBaja(it: Pick<ItemPunteo, 'kind' | 'traspaso'>): string {
  return laBajaEsDescarte(it) ? 'Descartar' : 'Eliminar';
}
