// ============================================================================
// T3 · desde la previsión, a su gasto recurrente
// ============================================================================
//
// Punteando aparece un cargo que no debería estar —el ciclo cambió, el servicio
// se acabó— y la única forma de arreglarlo era salir de Tesorería, ir al módulo
// de gastos y volver a buscarlo por el nombre. Eso empujaba a la salida fácil:
// borrar la previsión, que no arregla nada porque el gasto la vuelve a emitir
// el mes siguiente.
//
// El enlace solo tiene sentido cuando detrás HAY un gasto recurrente. Una
// previsión suelta —de un contrato, de un préstamo, anotada a mano— no tiene
// ficha que abrir, y ofrecer un acceso que no lleva a ninguna parte es peor que
// no ofrecer ninguno.
//
// Puro: construye la ruta, no navega.
// ============================================================================

import type { TreasuryEvent } from '../db';
import { esPrevisionDeCompromiso } from '../personal/previsionesIdempotencia';

/** La previsión que viaja en la fila · lo justo para resolver el enlace. */
export type OrigenDePrevision = Pick<
  TreasuryEvent,
  'sourceType' | 'sourceId' | 'ambito' | 'inmuebleId'
>;

/**
 * Ruta de la ficha del gasto recurrente que emitió esta previsión, o `null` si
 * no la emitió ninguno.
 *
 * El gasto vive en dos sitios según su ámbito, y no son la misma pantalla: el
 * personal en su listado, el de un inmueble dentro de la ficha del inmueble. La
 * fila concreta se pide con `?gasto=`, que es lo que hace que el enlace lleve
 * AL gasto y no a una lista donde volver a buscarlo.
 */
export function rutaDelGastoRecurrente(ev: OrigenDePrevision): string | null {
  if (!esPrevisionDeCompromiso(ev)) return null;
  if (ev.sourceId == null) return null;
  const inmuebleId = typeof ev.inmuebleId === 'number' ? ev.inmuebleId : null;
  // El ámbito lo decide el inmueble, no la etiqueta: un evento antiguo puede no
  // traer `ambito`, pero si trae inmueble su gasto está en la ficha del
  // inmueble igual.
  if (ev.ambito === 'INMUEBLE' || inmuebleId != null) {
    if (inmuebleId == null) return null;
    return `/inmuebles/${inmuebleId}?tab=gastos&gasto=${ev.sourceId}`;
  }
  return `/personal/gastos?gasto=${ev.sourceId}`;
}
