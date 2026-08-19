// ============================================================================
// Colapsar un Confirmado contra la línea del extracto que lo confirma
// ============================================================================
//
// UNA sola implementación del "las dos cosas": la usa el import al Guardar
// (`confirmDecisions`) y la limpieza de duplicados ya creados
// (`reconciliarDuplicadosExistentes`).
//
// La línea del extracto y el confirmado son la MISMA operación. Sobrevive la del
// import —la palabra del banco: su texto y su fecha hacen que un reimport la
// reconozca por hash y no la duplique—, hereda la clasificación del confirmado
// y sube a Conciliado. El confirmado se borra: dejarlo contaría el dinero dos
// veces. Y si el confirmado era la materialización de un previsto PUNTEADO
// (`confirmTreasuryEvent` lo crea con `reference: treasury_event:<id>` y deja el
// evento en `executed` apuntándole), su evento se RE-APUNTA a la línea del
// import; si no, el saldo contaría el evento y la línea por separado (fechas
// distintas) y volvería a duplicar.
// ============================================================================

import type { initDB } from './db';
import type { Movement, TreasuryEvent } from './db';
import { isTransferKey } from './categoryCatalog';

type DB = Awaited<ReturnType<typeof initDB>>;

/** `treasury_event:<id>` → id, o `null` si la referencia no es de un previsto. */
export function eventIdDeReferencia(reference: unknown): number | null {
  if (typeof reference !== 'string' || !reference.startsWith('treasury_event:')) return null;
  const id = Number(reference.slice('treasury_event:'.length));
  return Number.isFinite(id) ? id : null;
}

/**
 * Colapsa `confirmadoMovementId` sobre `importMov`: la línea del import hereda la
 * clasificación, sube a Conciliado, re-apunta el evento del previsto punteado y
 * borra el confirmado. Idempotente si el confirmado ya no existe.
 */
export async function aplicarReconciliacionConfirmado(
  db: DB,
  importMov: Movement,
  confirmadoMovementId: number,
  now: string,
): Promise<void> {
  const confirmado = (await db.get('movements', confirmadoMovementId)) as Movement | undefined;
  // Una pata de traspaso ya creada (§4.4): al subir el extracto de su cuenta, la
  // línea del banco la confirma. Hereda además del resto la identidad de traspaso
  // —`transferMetadata`, `type`, la categoría— para no perder que es un traspaso
  // (los KPIs y el saldo la dejan fuera por `isTransferKey`), y luego se repunta
  // su pata pareja. Sin esto, la línea sobreviviría como un ingreso/gasto normal.
  const esTraspaso = confirmado != null && isTransferKey(confirmado.categoryKey);
  await db.put('movements', {
    ...importMov,
    ...(confirmado
      ? {
          categoryKey: confirmado.categoryKey,
          subtypeKey: confirmado.subtypeKey,
          inmuebleId: confirmado.inmuebleId,
          ambito: confirmado.ambito,
          ...(confirmado.tarjetaId != null ? { tarjetaId: confirmado.tarjetaId } : {}),
          ...(esTraspaso
            ? {
                transferMetadata: confirmado.transferMetadata,
                type: 'Transferencia' as const,
                category: confirmado.category,
              }
            : {}),
        }
      : {}),
    unifiedStatus: 'conciliado',
    movementState: 'Conciliado',
    statusConciliacion: 'match_automatico',
    updatedAt: now,
  });

  if (confirmado?.id == null || confirmado.id === importMov.id) return;

  // La pata pareja apuntaba con `pairMovementId` a este confirmado, que se va a
  // borrar; se repunta a la línea del import, que es quien queda. Sin esto, la
  // salida quedaría enlazada a un id inexistente y el par se rompería.
  if (esTraspaso && importMov.id != null) {
    const todos = (await db.getAll('movements')) as Movement[];
    for (const m of todos) {
      if (m.id == null || m.id === confirmado.id) continue;
      if (m.transferMetadata?.pairMovementId === confirmado.id) {
        await db.put('movements', {
          ...m,
          transferMetadata: { ...m.transferMetadata, pairMovementId: importMov.id },
          updatedAt: now,
        });
      }
    }
  }

  const eventId = eventIdDeReferencia(confirmado.reference);
  if (eventId != null) {
    const ev = (await db.get('treasuryEvents', eventId)) as TreasuryEvent | undefined;
    if (ev && (ev.movementId === confirmado.id || ev.executedMovementId === confirmado.id)) {
      await db.put('treasuryEvents', {
        ...ev,
        movementId: importMov.id,
        executedMovementId: importMov.id,
        actualDate: importMov.date,
        actualAmount: Math.abs(importMov.amount),
        updatedAt: now,
      });
    }
  }
  await db.delete('movements', confirmado.id);
}
