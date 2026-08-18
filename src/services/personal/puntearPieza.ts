// ============================================================================
// Puntear una PIEZA de tarjeta · §3.5 (Fase 2b)
// ============================================================================
//
// Una pieza (`sourceType: 'gasto_tarjeta'`) se confirma DE OTRA MANERA que un
// previsto normal: NO nace un `Movement` de caja. El dinero de una compra con
// tarjeta no sale de ninguna cuenta el día de la compra —sale entero en el
// recibo—, así que crear un movimiento al confirmarla movería un saldo que no
// se mueve y, peor, la contaría dos veces (la pieza YA alimenta el recibo).
//
// Confirmar una pieza es, por tanto, fijar su importe REAL en el propio evento:
// `status: executed` + `actualAmount`. El recibo se re-deriva de las piezas
// (`recibosDePiezas`) y recoge ese importe real. Despuntear la devuelve a
// prevista. Ninguna de las dos toca `movements`.
// ============================================================================

import { initDB } from '../db';
import type { TreasuryEvent } from '../db';

export class NoEsPiezaError extends Error {
  constructor() {
    super('Solo se puede puntear así un gasto de tarjeta (pieza).');
    this.name = 'NoEsPiezaError';
  }
}

async function piezaEditable(eventId: number): Promise<TreasuryEvent> {
  const db = await initDB();
  const ev = (await db.get('treasuryEvents', eventId)) as TreasuryEvent | undefined;
  if (!ev || ev.sourceType !== 'gasto_tarjeta') throw new NoEsPiezaError();
  return ev;
}

/**
 * Confirma una pieza con su importe REAL, en el sitio · sin crear movimiento.
 *
 * `importeReal` es opcional: sin él se da por bueno el previsto. Se guarda como
 * magnitud positiva —el signo lo pone `type`—, igual que el resto del punteo.
 */
export async function confirmarPieza(eventId: number, importeReal?: number): Promise<void> {
  const ev = await piezaEditable(eventId);
  const db = await initDB();
  const now = new Date().toISOString();
  await db.put('treasuryEvents', {
    ...ev,
    // CONFIRMADO ("tu palabra"), no executed: no hay `Movement` que la respalde.
    // La pieza sube a conciliado en la Fase 3, cuando el extracto la avale.
    status: 'confirmed',
    actualDate: ev.actualDate ?? ev.predictedDate,
    actualAmount: Math.abs(importeReal ?? ev.actualAmount ?? ev.amount),
    // Sin `movementId`: la pieza no genera un cargo de caja, sale en el recibo.
    updatedAt: now,
  } as TreasuryEvent);
}

/** Despunta una pieza · vuelve a prevista y olvida el importe real. */
export async function despuntearPieza(eventId: number): Promise<void> {
  const ev = await piezaEditable(eventId);
  const db = await initDB();
  const now = new Date().toISOString();
  await db.put('treasuryEvents', {
    ...ev,
    status: 'predicted',
    executedAt: undefined,
    actualDate: undefined,
    actualAmount: undefined,
    updatedAt: now,
  } as TreasuryEvent);
}

/** Descarta una pieza · el usuario dice que ese gasto no ocurre este periodo. */
export async function descartarPieza(eventId: number): Promise<void> {
  const ev = await piezaEditable(eventId);
  const db = await initDB();
  const now = new Date().toISOString();
  await db.put('treasuryEvents', {
    ...ev,
    descartado: true,
    descartadoAt: now,
    updatedAt: now,
  } as TreasuryEvent);
}
