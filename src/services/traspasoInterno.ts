// ============================================================================
// El traspaso interno es UNA cosa escrita dos veces
// ============================================================================
//
// Mover dinero entre cuentas propias no es un gasto ni un ingreso: el dinero no
// se va, cambia de sitio. Por eso se guarda en dos apuntes espejo —salida en la
// cuenta de origen, entrada en la de destino— atados por `pairEventId`.
//
// Y por eso no se puede corregir uno solo. Cambiarle el importe a la salida y
// dejar la entrada como estaba hace aparecer o desaparecer dinero de la nada;
// borrar una pata deja la otra colgada, con un ingreso que no viene de ningún
// sitio. Hasta ahora la única defensa era no ofrecer el lápiz, así que un
// traspaso mal anotado se quedaba mal para siempre.
//
// Aquí las dos patas se tratan como lo que son: una sola operación.
// ============================================================================

import { initDB } from './db';
import type { Movement, TreasuryEvent } from './db';
import { isTransferKey, TRANSFER_KEYS } from './categoryCatalog';
import {
  deleteTreasuryEventCompletely,
  revertTreasuryConfirmation,
} from './treasuryConfirmationService';

export class TraspasoIncompletoError extends Error {
  constructor() {
    super('No se encuentra la otra mitad de este traspaso.');
    this.name = 'TraspasoIncompletoError';
  }
}

export class TraspasoALaMismaCuentaError extends Error {
  constructor() {
    super('Un traspaso interno va de una cuenta a OTRA: elige un destino distinto.');
    this.name = 'TraspasoALaMismaCuentaError';
  }
}

/** `true` si este evento es una de las dos patas de un traspaso interno. */
export function esPataDeTraspaso(
  e: Pick<TreasuryEvent, 'categoryKey' | 'transferMetadata'>
): boolean {
  return isTransferKey(e.categoryKey) && e.transferMetadata?.pairEventId != null;
}

export interface ParDeTraspaso {
  salida: TreasuryEvent & { id: number };
  entrada: TreasuryEvent & { id: number };
}

/**
 * Las dos patas, dando igual por cuál se entre.
 *
 * Se comprueba que la pareja siga siendo un traspaso y que se apunten entre
 * ellas: media pareja no se puede editar de forma consistente, y es mejor
 * decirlo que escribir a ciegas sobre un dato roto.
 */
export async function parDeTraspaso(eventId: number): Promise<ParDeTraspaso> {
  const db = await initDB();
  const uno = (await db.get('treasuryEvents', eventId)) as TreasuryEvent | undefined;
  if (!uno || !esPataDeTraspaso(uno)) throw new TraspasoIncompletoError();

  const otroId = uno.transferMetadata!.pairEventId!;
  const otro = (await db.get('treasuryEvents', otroId)) as TreasuryEvent | undefined;
  if (!otro || !esPataDeTraspaso(otro)) throw new TraspasoIncompletoError();
  if (otro.transferMetadata?.pairEventId !== eventId) throw new TraspasoIncompletoError();

  const salida = uno.categoryKey === TRANSFER_KEYS.SALIDA ? uno : otro;
  const entrada = salida === uno ? otro : uno;
  if (salida.categoryKey !== TRANSFER_KEYS.SALIDA) throw new TraspasoIncompletoError();
  if (entrada.categoryKey !== TRANSFER_KEYS.ENTRADA) throw new TraspasoIncompletoError();

  return { salida, entrada } as ParDeTraspaso;
}

export interface EdicionTraspaso {
  fecha: string;
  /** Magnitud · el signo lo pone cada pata. */
  importe: number;
  concepto: string;
  cuentaOrigenId: number;
  cuentaDestinoId: number;
}

/** El movimiento que materializó una pata, si ya estaba punteada. */
async function movimientoDe(evento: TreasuryEvent): Promise<Movement | undefined> {
  const id = evento.executedMovementId ?? evento.movementId;
  if (id == null) return undefined;
  const db = await initDB();
  return (await db.get('movements', id)) as Movement | undefined;
}

/**
 * Corrige un traspaso entero · las dos patas a la vez.
 *
 * Cada pata conserva su papel —la salida sale del origen, la entrada entra en
 * el destino— y cambian a la vez importe, fecha y concepto. Si el traspaso ya
 * estaba punteado, sus movimientos se corrigen también: dejarlos con el
 * importe viejo descuadraría el saldo justo después de arreglarlo.
 */
export async function editarTraspasoInterno(
  eventId: number,
  v: EdicionTraspaso
): Promise<void> {
  if (v.cuentaOrigenId === v.cuentaDestinoId) throw new TraspasoALaMismaCuentaError();

  const { salida, entrada } = await parDeTraspaso(eventId);
  const db = await initDB();
  const ahora = new Date().toISOString();
  const fecha = v.fecha.slice(0, 10);
  const magnitud = Math.abs(v.importe);
  const concepto = v.concepto.trim() || 'Traspaso entre cuentas';

  const patas = [
    { evento: salida, cuentaId: v.cuentaOrigenId, otra: v.cuentaDestinoId, sufijo: 'salida' },
    { evento: entrada, cuentaId: v.cuentaDestinoId, otra: v.cuentaOrigenId, sufijo: 'entrada' },
  ] as const;

  for (const { evento, cuentaId, otra, sufijo } of patas) {
    await db.put('treasuryEvents', {
      ...evento,
      amount: magnitud,
      predictedDate: fecha,
      description: `${concepto} · ${sufijo}`,
      accountId: cuentaId,
      // `targetAccountId` es SIEMPRE "la otra": en la entrada guarda el origen.
      transferMetadata: { ...evento.transferMetadata, targetAccountId: otra },
      updatedAt: ahora,
    } as TreasuryEvent);

    const movimiento = await movimientoDe(evento);
    if (!movimiento?.id) continue;
    await db.put('movements', {
      ...movimiento,
      accountId: cuentaId,
      date: fecha,
      valueDate: fecha,
      // El signo lo manda el papel de la pata, no lo que llegue en `importe`.
      amount: evento.type === 'income' ? magnitud : -magnitud,
      description: `${concepto} · ${sufijo}`,
      transferMetadata: { ...movimiento.transferMetadata, targetAccountId: otra },
      updatedAt: ahora,
    } as Movement);
  }
}

/**
 * Borra un traspaso entero · las dos patas y lo que generaron.
 *
 * Primero se despuntea lo que estuviera punteado y después se borran los dos
 * eventos. Al revés quedarían movimientos huérfanos apuntando a previsiones que
 * ya no existen — y un movimiento suelto en una cuenta es dinero inventado.
 */
export async function eliminarTraspasoInterno(eventId: number): Promise<void> {
  const { salida, entrada } = await parDeTraspaso(eventId);

  for (const evento of [salida, entrada]) {
    const movimiento = await movimientoDe(evento);
    if (movimiento?.id == null) continue;
    // `revertTreasuryConfirmation` ya sabe de la pareja y arrastra a la otra
    // pata; llamarlo dos veces es inofensivo porque comprueba que el
    // movimiento siga existiendo.
    await revertTreasuryConfirmation(movimiento.id);
  }

  await deleteTreasuryEventCompletely(salida.id);
  await deleteTreasuryEventCompletely(entrada.id);
}
