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
import { materializarLinea, type BaseParaMaterializar } from './materializarLinea';

export class MovimientoNoEncontradoError extends Error {
  constructor() {
    super('El movimiento ya no existe.');
    this.name = 'MovimientoNoEncontradoError';
  }
}

export class NoEsUnCargoError extends Error {
  constructor() {
    super('Solo un cargo puede ser la salida de un traspaso.');
    this.name = 'NoEsUnCargoError';
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
  // La salida de un traspaso es un CARGO. Sobre un ingreso, esto escribiría una
  // entrada de signo imposible en la cuenta destino.
  if (movimiento.amount >= 0) throw new NoEsUnCargoError();

  // Ya convertido · se devuelve el par que hay y no se escribe nada.
  //
  // El guardado del extracto hace varias cosas seguidas y puede fallar en
  // cualquiera; si el usuario reintenta, esta conversión se vuelve a ejecutar.
  // Sin esta guarda nacería una SEGUNDA pata de entrada y el saldo del efectivo
  // subiría dos veces por la misma retirada.
  const yaConvertido = movimiento.transferMetadata?.pairMovementId;
  if (yaConvertido != null) return { movementId, movementIdDestino: yaConvertido };

  const ahora = new Date().toISOString();
  const magnitud = Math.abs(movimiento.amount);

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
    // Los estados se fijan ENTEROS, no se heredan del cargo: el original puede
    // venir conciliado por el extracto y esta pata no lo está —nadie la ha
    // visto en ningún banco—, así que copiarlos afirmaría lo contrario de lo
    // que dice `source: 'manual'`. Los mismos que un alta a mano.
    unifiedStatus: 'no_planificado',
    movementState: 'Confirmado',
    state: 'pending',
    status: 'pendiente',
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

  // 2 · el que ya existía pasa a ser la SALIDA, emparejado con su espejo. No se
  //     tocan su importe ni su fecha: eso es lo que dice el banco y tiene que
  //     seguir cuadrando.
  //
  //     Va DESPUÉS de crear la entrada para poder guardar su id: si se
  //     escribiera antes, un fallo en el `add` dejaría el cargo marcado como
  //     traspaso sin pata al otro lado.
  await (db as any).put('movements', {
    ...movimiento,
    type: 'Transferencia',
    categoryKey: TRANSFER_KEYS.SALIDA,
    categoryLabel: 'Traspaso · salida',
    // Un traspaso no es gasto ni ingreso · quien suma los KPIs mira esta key
    // (`isTransferKey`) para dejarlo fuera, y la categoría vieja lo colaba.
    category: { tipo: 'Traspaso' },
    transferMetadata: { targetAccountId: cuentaDestinoId, pairMovementId: movementIdDestino },
    updatedAt: ahora,
  });

  return { movementId, movementIdDestino };
}

/**
 * E1.5 · la misma conversión, desde la LÍNEA del extracto.
 *
 * Tras el corte la línea no tiene movimiento hasta que se resuelve: aquí NACE
 * (pata de salida, `materializarLinea` · a mano) y acto seguido se convierte
 * como siempre. D2 · la línea queda enlazada SOLO a su pata (la de esta
 * cuenta); la de entrada la cuenta la cuenta destino. Idempotente por los dos
 * lados: la línea no vuelve a materializarse y el par no se duplica.
 */
export async function convertirLineaEnTraspaso(
  lineaId: number,
  cuentaDestinoId: number
): Promise<ResultadoConversion> {
  const db = await initDB();
  const { movement } = await materializarLinea(
    db as unknown as BaseParaMaterializar,
    lineaId,
    new Date().toISOString(),
    'a_mano'
  );
  return convertirEnTraspaso(movement.id as number, cuentaDestinoId);
}
