// ============================================================================
// D1 · el Confirmado se CONSERVA y recibe el aval del banco
// ============================================================================
//
// La línea del extracto y un movimiento que el usuario ya había anotado a mano
// (Confirmado) son la MISMA operación. Hasta E1.5 el import creaba un segundo
// movimiento para la línea y había que colapsar los dos: sobrevivía el del
// import y se borraba el confirmado, repuntando todo lo que le apuntaba (patas
// de traspaso, líneas de gasto, el evento). Cincuenta líneas de repunteo que
// solo existían por el duplicado.
//
// Tras el corte no nace ningún duplicado, así que se hace lo natural (pieza X
// §23: manda el conciliado, funde con lo existente): el Confirmado SIGUE
// SIENDO el movimiento —sus patas, su línea de gasto y su evento le siguen
// apuntando sin tocar nada—, sube a Conciliado y toma del banco lo que el banco
// sabe mejor: el importe y las fechas reales. La línea del extracto queda
// enlazada a él (`movementIds`) y deja de sumar por sí misma.
//
// La limpieza de duplicados anteriores al corte (`reconciliarDuplicadosExistentes`)
// pasa por aquí con el mismo criterio invertido: el confirmado se queda, el
// duplicado del import se va.
// ============================================================================

import type { initDB } from './db';
import type { Movement, TreasuryEvent } from './db';
import type { LineaExtractoPersistida } from './db/types-lineasExtracto';
import { repuntarLineasAlMovimiento, type DbParaCierre } from './cierreLineaInmueble';

type DB = Awaited<ReturnType<typeof initDB>>;

/** `treasury_event:<id>` → id, o `null` si la referencia no es de un previsto. */
export function eventIdDeReferencia(reference: unknown): number | null {
  if (typeof reference !== 'string' || !reference.startsWith('treasury_event:')) return null;
  const id = Number(reference.slice('treasury_event:'.length));
  return Number.isFinite(id) ? id : null;
}

/** Lo que el banco dice de la operación · lo que el Confirmado toma como aval. */
export interface AvalDelBanco {
  /** Con signo · el del extracto. */
  amount: number;
  /** YYYY-MM-DD · fecha de cargo del banco. */
  date: string;
  valueDate?: string;
  /**
   * Solo para pares ANTERIORES al corte: el movimiento que el import creó para
   * la misma línea. Es el duplicado y se borra; si alguna línea le apuntaba,
   * pasa a apuntar al confirmado.
   */
  importMovementId?: number;
}

/**
 * Da al Confirmado `confirmadoMovementId` el aval del banco y lo sube a
 * Conciliado. Devuelve su id, o `null` si ya no existe (nada que avalar).
 *
 * Idempotente: repetirlo deja lo mismo.
 */
export async function aplicarReconciliacionConfirmado(
  db: DB,
  aval: AvalDelBanco,
  confirmadoMovementId: number,
  now: string,
): Promise<number | null> {
  const confirmado = (await db.get('movements', confirmadoMovementId)) as Movement | undefined;
  if (!confirmado || confirmado.id == null) return null;

  // El Confirmado, con el aval: el importe y las fechas los pone el banco, todo
  // lo demás —clasificación, texto del usuario, patas, `reference`— es suyo y
  // se queda. `match_automatico` marca que YA tiene extracto detrás: no vuelve
  // a ofrecerse a otra línea (`esConfirmadoEmparejable`).
  const avalado: Movement = {
    ...confirmado,
    amount: aval.amount,
    date: aval.date,
    ...(aval.valueDate ? { valueDate: aval.valueDate } : {}),
    unifiedStatus: 'conciliado',
    movementState: 'Conciliado',
    statusConciliacion: 'match_automatico',
    updatedAt: now,
  };
  await db.put('movements', avalado);

  // Si era un previsto PUNTEADO, su evento sigue apuntándole · solo toma el
  // dato real del banco (magnitud, como el punteo manual).
  const eventId = eventIdDeReferencia(confirmado.reference);
  if (eventId != null) {
    const ev = (await db.get('treasuryEvents', eventId)) as TreasuryEvent | undefined;
    if (ev && (ev.movementId === confirmado.id || ev.executedMovementId === confirmado.id)) {
      await db.put('treasuryEvents', {
        ...ev,
        actualDate: aval.date,
        actualAmount: Math.abs(aval.amount),
        updatedAt: now,
      });
    }
  }

  // La línea de gasto que lo declara sigue apuntándole · se queda con el dato
  // del banco (importe, fecha de cargo, fecha valor): conciliado manda.
  try {
    await repuntarLineasAlMovimiento(db as unknown as DbParaCierre, confirmado.id, avalado);
  } catch (err) {
    console.warn('[reconciliarConfirmado] no se pudo actualizar la línea de gasto', err);
  }

  // Pares anteriores al corte · el duplicado del import se va. Si alguna línea
  // del extracto le apuntaba, pasa a apuntar al confirmado (que es quien queda).
  if (aval.importMovementId != null && aval.importMovementId !== confirmado.id) {
    try {
      const lineas = ((await db.getAll('lineasExtracto')) ?? []) as LineaExtractoPersistida[];
      for (const l of lineas) {
        if (!l.movementIds?.includes(aval.importMovementId)) continue;
        await db.put('lineasExtracto', {
          ...l,
          movementIds: l.movementIds.map((id) => (id === aval.importMovementId ? confirmado.id as number : id)),
          updatedAt: now,
        });
      }
    } catch {
      // Base anterior a V91 · no hay líneas que repuntar.
    }
    await db.delete('movements', aval.importMovementId);
  }

  return confirmado.id;
}
