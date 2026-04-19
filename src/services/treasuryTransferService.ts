// PR5-HOTFIX v2 · Traspasos entre cuentas propias.
//
// Un traspaso crea DOS TreasuryEvents espejo:
//   - Uno de tipo `expense` en la cuenta origen (categoryKey='traspaso_salida')
//   - Uno de tipo `income`  en la cuenta destino (categoryKey='traspaso_entrada')
//
// Ambos se vinculan mutuamente mediante `transferMetadata.pairEventId`.
//
// Los traspasos NO se cuentan en los KPIs de Ingreso/Gasto/Neto (ver
// computeKpis en useMonthConciliacion — filtran por `isTransferKey`).

import { initDB } from './db';
import type { TreasuryEvent } from './db';
import { TRANSFER_KEYS } from './categoryCatalog';
import { confirmTreasuryEvent } from './treasuryConfirmationService';

export interface CreateTransferParams {
  date: string;             // ISO YYYY-MM-DD
  amount: number;           // magnitud positiva
  originAccountId: number;
  targetAccountId: number;
  concept: string;
  /** Si true, ambas patas se confirman tras la creación (crean movement). */
  confirm: boolean;
}

export interface CreateTransferResult {
  originEventId: number;
  targetEventId: number;
  originMovementId?: number;
  targetMovementId?: number;
}

/**
 * Crea las dos patas espejo de un traspaso entre cuentas propias.
 *
 * @throws Error si origin === target o importe <= 0.
 */
export async function createTransfer(
  params: CreateTransferParams,
): Promise<CreateTransferResult> {
  if (params.originAccountId === params.targetAccountId) {
    throw new Error('La cuenta destino debe ser distinta de la cuenta origen');
  }
  if (!params.amount || params.amount <= 0) {
    throw new Error('Importe no válido');
  }

  const db = await initDB();
  const now = new Date().toISOString();
  const concept = params.concept.trim() || 'Traspaso entre cuentas';

  // 1. Crear event de salida (cuenta origen).
  const originEvent: Omit<TreasuryEvent, 'id'> = {
    type: 'expense',
    amount: params.amount,
    predictedDate: params.date,
    description: `${concept} · salida`,
    sourceType: 'manual',
    accountId: params.originAccountId,
    status: 'predicted',
    ambito: 'PERSONAL',
    categoryKey: TRANSFER_KEYS.SALIDA,
    categoryLabel: 'Traspaso · salida',
    transferMetadata: { targetAccountId: params.targetAccountId },
    createdAt: now,
    updatedAt: now,
  };
  const originEventId = Number(await (db as any).add('treasuryEvents', originEvent));

  // 2. Crear event de entrada (cuenta destino), ligado al origen por pairEventId.
  const targetEvent: Omit<TreasuryEvent, 'id'> = {
    type: 'income',
    amount: params.amount,
    predictedDate: params.date,
    description: `${concept} · entrada`,
    sourceType: 'manual',
    accountId: params.targetAccountId,
    status: 'predicted',
    ambito: 'PERSONAL',
    categoryKey: TRANSFER_KEYS.ENTRADA,
    categoryLabel: 'Traspaso · entrada',
    transferMetadata: {
      targetAccountId: params.originAccountId,
      pairEventId: originEventId,
    },
    createdAt: now,
    updatedAt: now,
  };
  const targetEventId = Number(await (db as any).add('treasuryEvents', targetEvent));

  // 3. Vincular la pata de salida al event de entrada (bidireccional).
  const stored = (await db.get('treasuryEvents', originEventId)) as TreasuryEvent | undefined;
  if (stored) {
    await (db as any).put('treasuryEvents', {
      ...stored,
      transferMetadata: {
        targetAccountId: params.targetAccountId,
        pairEventId: targetEventId,
      },
      updatedAt: new Date().toISOString(),
    });
  }

  let originMovementId: number | undefined;
  let targetMovementId: number | undefined;

  if (params.confirm) {
    const originResult = await confirmTreasuryEvent(originEventId);
    const targetResult = await confirmTreasuryEvent(targetEventId);
    originMovementId = originResult.movementId;
    targetMovementId = targetResult.movementId;
  }

  return { originEventId, targetEventId, originMovementId, targetMovementId };
}
