import { initDB } from './db';

type CacheEntry<T> = {
  data?: T[];
  expiresAt: number;
  promise?: Promise<T[]>;
};

const DEFAULT_TTL_MS = 15_000;
const cache = new Map<string, CacheEntry<any>>();

const getCacheKey = (storeName: string) => storeName;

const isEntryFresh = <T,>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> & { data: T[] } => {
  return Boolean(entry?.data && entry.expiresAt > Date.now());
};

export const getCachedStoreRecords = async <T = any>(
  storeName: string,
  options?: { ttlMs?: number; forceRefresh?: boolean }
): Promise<T[]> => {
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const key = getCacheKey(storeName);
  const existing = cache.get(key) as CacheEntry<T> | undefined;

  if (!options?.forceRefresh && isEntryFresh(existing)) {
    return existing.data;
  }

  if (!options?.forceRefresh && existing?.promise) {
    return existing.promise;
  }

  const loadPromise = initDB()
    .then((db) => db.getAll(storeName as any) as Promise<T[]>)
    .then((records) => {
      cache.set(key, {
        data: records,
        expiresAt: Date.now() + ttlMs,
      });
      return records;
    })
    .catch((error) => {
      cache.delete(key);
      throw error;
    });

  cache.set(key, {
    data: existing?.data,
    expiresAt: existing?.expiresAt ?? 0,
    promise: loadPromise,
  });

  return loadPromise;
};

export const warmCachedStores = async (
  storeNames: string[],
  options?: { ttlMs?: number }
): Promise<void> => {
  await Promise.allSettled(
    Array.from(new Set(storeNames)).map((storeName) => getCachedStoreRecords(storeName, options))
  );
};

export const invalidateCachedStores = (storeNames: string[]): void => {
  for (const storeName of storeNames) {
    cache.delete(getCacheKey(storeName));
  }
};

export const invalidateAllCachedStores = (): void => {
  cache.clear();
};
