// ============================================================================
// Convertir un movimiento que YA existe en una transferencia interna
// ============================================================================
//
// No es `createTransfer`. Aquél crea las dos patas desde cero, y aquí una de
// ellas ya está: la línea del extracto entró como `Movement` al importar
// (`processFile`), así que crear el traspaso entero duplicaría el apunte y el
// saldo dejaría de cuadrar con el banco.
//
// Lo que hace falta es lo contrario: quedarse con el movimiento que hay,
// marcarlo como la pata de SALIDA y escribir solo la de ENTRADA en la cuenta
// destino.
//
// El caso que lo pide es la retirada de cajero: el banco te la manda como un
// cargo, y sin esto se apunta como gasto — el patrimonio baja 200 € el día que
// siguen estando en tu bolsillo.
// ============================================================================

import { initDB } from './db';
import type { Movement } from './db';
import { TRANSFER_KEYS } from './categoryCatalog';

export class MovimientoNoEncontradoError extends Error {
  constructor() {
    super('El movimiento ya no existe.');
    this.name = 'MovimientoNoEncontradoError';
  }
}

export class TraspasoALaMismaCuentaError extends Error {
  constructor() {
    super('Un traspaso va de una cuenta a OTRA.');
    this.name = 'TraspasoALaMismaCuentaError';
  }
}

export interface ResultadoConversion {
  /** El movimiento que ya existía, ahora marcado como salida. */
  movementId: number;
  /** La pata espejo, recién creada en la cuenta destino. */
  movementIdDestino: number;
}

/**
 * Convierte `movementId` en la salida de un traspaso hacia `cuentaDestinoId`.
 *
 * La pata de entrada nace `source: 'manual'` —y por tanto CONFIRMADA, no
 * conciliada (§2 · punteoModel)— porque el banco no sabe nada de ella: en su
 * extracto solo está el cargo. Decir que está conciliada sería afirmar que hay
 * un extracto detrás que no existe.
 */
export async function convertirEnTraspaso(
  movementId: number,
  cuentaDestinoId: number
): Promise<ResultadoConversion> {
  const db = await initDB();
  const movimiento = (await db.get('movements', movementId)) as Movement | undefined;
  if (!movimiento) throw new MovimientoNoEncontradoError();
  if (movimiento.accountId === cuentaDestinoId) throw new TraspasoALaMismaCuentaError();

  const ahora = new Date().toISOString();
  const magnitud = Math.abs(movimiento.amount);

  // 1 · el que ya existe pasa a ser la SALIDA. No se toca su importe ni su
  //     fecha: eso es lo que dice el banco y tiene que seguir cuadrando.
  await (db as any).put('movements', {
    ...movimiento,
    type: 'Transferencia',
    categoryKey: TRANSFER_KEYS.SALIDA,
    categoryLabel: 'Traspaso · salida',
    // Un traspaso no es gasto ni ingreso · quien suma los KPIs mira esta key
    // (`isTransferKey`) para dejarlo fuera, y la categoría vieja lo colaba.
    category: { tipo: 'Traspaso' },
    transferMetadata: { targetAccountId: cuentaDestinoId },
    updatedAt: ahora,
  });

  // 2 · la ENTRADA en la cuenta destino · el mismo dinero, del otro lado.
  const entrada: Omit<Movement, 'id'> = {
    ...movimiento,
    id: undefined,
    accountId: cuentaDestinoId,
    amount: magnitud,
    type: 'Transferencia',
    // La entrada NO la respalda ningún extracto: existe porque el usuario dijo
    // que ese dinero fue a parar aquí.
    source: 'manual',
    origin: 'Manual',
    unifiedStatus: 'no_planificado',
    statusConciliacion: 'sin_match',
    categoryKey: TRANSFER_KEYS.ENTRADA,
    categoryLabel: 'Traspaso · entrada',
    category: { tipo: 'Traspaso' },
    // La otra cuenta · en la entrada es la de ORIGEN, que es de donde vino.
    transferMetadata: { targetAccountId: movimiento.accountId },
    // La huella del extracto es del cargo, no de esta: heredarla haría que al
    // reimportar el fichero se diera por duplicada la línea equivocada.
    reference: undefined,
    documentIds: undefined,
    createdAt: ahora,
    updatedAt: ahora,
  } as unknown as Omit<Movement, 'id'>;
  delete (entrada as Record<string, unknown>).id;

  const movementIdDestino = Number(await db.add('movements', entrada as Movement));
  return { movementId, movementIdDestino };
}
