// ============================================================================
// V86 · `AHORRO` y `OTRA` dejan de existir · docs/VOCABULARIO-dinero.md §1
// ============================================================================
//
// Decisión de Jose (3 ago 2026): complicaban sin distinguir nada. Una cuenta de
// ahorro se comporta exactamente igual que una corriente —tiene IBAN, tiene
// saldo, se le domicilia lo que sea— y "otra" no dice nada de nada.
//
// Las que existan pasan a `CORRIENTE`. No se pierde ni un dato: no cambia el
// saldo, ni los movimientos, ni a qué se puede domiciliar, ni siquiera la fecha
// de última modificación. Lo único que cambia es que esos dos tipos dejan de
// ofrecerse al dar de alta.
// ============================================================================

import type { IDBPDatabase } from 'idb';

/** Los tipos retirados · lo que había antes del vocabulario. */
const RETIRADOS = new Set(['AHORRO', 'OTRA']);

/**
 * Pasa a `CORRIENTE` las cuentas de los tipos retirados.
 *
 * Devuelve cuántas ha tocado. Idempotente: repetirlo no cambia nada, porque
 * `CORRIENTE` ya no está en la lista de retirados.
 */
export async function migrarTiposDeCuenta(db: IDBPDatabase<any>): Promise<number> {
  const tx = db.transaction('accounts', 'readwrite');
  const store = tx.objectStore('accounts');
  let cursor = await store.openCursor();
  let migradas = 0;

  while (cursor) {
    const cuenta = cursor.value as { tipo?: string };
    if (cuenta?.tipo && RETIRADOS.has(cuenta.tipo)) {
      // `updatedAt` NO se toca: el usuario no ha editado nada. Sellarlo aquí
      // dejaría todas sus cuentas como "recién modificadas" —moviendo
      // ordenaciones y cualquier lectura que se fíe de esa fecha— por un
      // cambio que hizo el sistema, no él. Cambia la etiqueta y nada más, que
      // es exactamente lo que promete esta migración.
      await cursor.update({ ...cursor.value, tipo: 'CORRIENTE' });
      migradas++;
    }
    cursor = await cursor.continue();
  }

  await tx.done;
  return migradas;
}
