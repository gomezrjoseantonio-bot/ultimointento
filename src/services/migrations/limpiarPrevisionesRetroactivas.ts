// ============================================================================
// Limpieza · lo que C1 (#1819) fabricó hacia atrás y quedó en la base
// ============================================================================
//
// C1 rellenaba el pasado del ejercicio con previsiones estimadas. Se retiró en
// #1821 porque el pasado pasa a entrar por el fichero del banco, que es la
// verdad real. Pero retirar el generador NO borra lo que ya escribió: esas
// previsiones viven en `treasuryEvents` de cada navegador, y la pantalla las
// sigue pintando —correctamente, porque están ahí— como trabajo pendiente de
// enero a julio que ya no significa nada.
//
// Esto las quita. Solo esas.
//
// ── Cómo se reconoce una ────────────────────────────────────────────────────
//
// Por la contradicción que lleva dentro: **dice ser la previsión de un mes
// ANTERIOR al mes en que nació**. Ningún camino vivo puede producir eso:
//
//   · el motor de recurrentes proyecta del día 1 del mes en curso hacia
//     delante, así que lo que emite nace en su mes o antes de él;
//   · la reactivación de un compromiso se niega expresamente a ir hacia atrás
//     (`compromisosRecurrentesService.ts:392-397` · «no se generan previsiones
//     retroactivas»);
//   · y el mes EN CURSO no entra: para agosto el motor vivo ya había emitido,
//     así que C1 se encontraba la clave de origen ocupada y no añadía nada.
//     Un cargo del 15 de agosto creado el 29 es del motor vivo, no de C1.
//
// De ahí que la comparación sea por MES y estricta. Cruza el año sola, porque
// compara cadenas `YYYY-MM`.
//
// ── Qué se respeta ──────────────────────────────────────────────────────────
//
// Todo lo demás, y en particular todo lo que haya tocado una persona. Un
// confirmado o un conciliado es realidad bancaria que mueve el saldo —borrarlo
// sería perder dinero de la vista—; un descartado es una decisión suya. Y un
// apunte a mano con fecha pasada también nace después de su fecha, así que se
// exige además que venga del motor de recurrentes: es lo único que C1 emitía.
//
// En la duda, no se borra. Un evento sin fecha o sin `createdAt` se queda.
// ============================================================================

import type { IDBPDatabase } from 'idb';
import type { TreasuryEvent } from '../db';
import { esPrevisionIntocable } from '../personal/previsionesIdempotencia';

/** El mes de una fecha ISO · `2026-03-10` → `2026-03`. Vacío si no la hay. */
const mesDe = (iso: string | undefined): string => (iso ?? '').slice(0, 7);

/**
 * ¿Esta previsión la fabricó C1 hacia atrás?
 *
 * Pura y sin E/S, para poder fijar la frontera en tests antes de borrar nada.
 */
export function esPrevisionRetroactiva(ev: TreasuryEvent): boolean {
  // Lo tocado por una persona no se toca · confirmado, conciliado o descartado.
  if (esPrevisionIntocable(ev)) return false;
  // C1 solo emitía gastos recurrentes, y solo por el motor de previsiones.
  if (ev.sourceType !== 'gasto_recurrente') return false;
  if (ev.generadoPor !== 'treasurySyncService') return false;

  const mesPrevisto = mesDe(ev.predictedDate);
  const mesNacimiento = mesDe(ev.createdAt);
  // Sin una de las dos no se decide: en la duda se queda.
  if (!mesPrevisto || !mesNacimiento) return false;

  return mesPrevisto < mesNacimiento;
}

export interface ReciboDeLimpieza {
  /** Cuántas se borraron. */
  borradas: number;
  /** Cuántos euros dejan de figurar como pendientes (siempre negativos). */
  importe: number;
  /** Por mes previsto · para poder mirar qué se fue. */
  porMes: Record<string, number>;
  /** Cuándo se hizo. */
  fecha: string;
}

/**
 * Borra las previsiones retroactivas y devuelve el recibo de lo que se llevó.
 *
 * Borrar no se deshace, así que deja constancia — mismo criterio que la V88 de
 * tarjetas, que guarda su recibo en `keyval`.
 */
export async function limpiarPrevisionesRetroactivas(
  db: IDBPDatabase<any>,
): Promise<ReciboDeLimpieza> {
  const recibo: ReciboDeLimpieza = {
    borradas: 0,
    importe: 0,
    porMes: {},
    fecha: new Date().toISOString(),
  };

  const tx = db.transaction('treasuryEvents', 'readwrite');
  let cursor = await tx.objectStore('treasuryEvents').openCursor();
  while (cursor) {
    const ev = cursor.value as TreasuryEvent;
    if (esPrevisionRetroactiva(ev)) {
      const mes = mesDe(ev.predictedDate);
      recibo.borradas += 1;
      recibo.importe += ev.amount ?? 0;
      recibo.porMes[mes] = (recibo.porMes[mes] ?? 0) + 1;
      await cursor.delete();
    }
    cursor = await cursor.continue();
  }
  await tx.done;

  return recibo;
}
