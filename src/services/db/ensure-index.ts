// Frente C · troceo · helper ensureIndex (crea un índice idempotente durante el
// upgrade). Extraído literal de db.ts; lo usan upgrade-a/upgrade-b.
import type { DBSchema, IDBPObjectStore, IndexNames, StoreNames } from 'idb';

export function ensureIndex<
  DBTypes extends DBSchema | unknown,
  TxStores extends ArrayLike<StoreNames<DBTypes>>,
  StoreName extends StoreNames<DBTypes>,
>(
  store: IDBPObjectStore<DBTypes, TxStores, StoreName, 'versionchange'>,
  indexName: string,
  keyPath: string | string[],
  options: IDBIndexParameters = { unique: false },
): void {
  const typedIndexName = indexName as IndexNames<DBTypes, StoreName>;

  if (store.indexNames.contains(typedIndexName)) {
    return;
  }

  try {
    store.createIndex(typedIndexName, keyPath, options);
  } catch (error) {
    if ((error as DOMException)?.name === 'ConstraintError' && options.unique) {
      console.warn(`[DB] Índice único '${indexName}' degradado a no único por datos legacy duplicados.`);
      store.createIndex(typedIndexName, keyPath, { ...options, unique: false });
      return;
    }

    throw error;
  }
}
