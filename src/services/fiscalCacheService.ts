// ATLAS — Fiscal calculation cache
// Prevents recalculating the full IRPF engine on every tab navigation.
// Cache is invalidated when input data changes (detected via a fast hash of record counts).

import { initDB } from './db';
import { DeclaracionIRPF } from './irpfCalculationService';

interface FiscalCacheEntry {
  ejercicio: number;
  timestamp: number;
  hash: string;
  declaracion: DeclaracionIRPF;
}

const cache = new Map<number, FiscalCacheEntry>();

// Cache TTL: 60 seconds — forces re-check of hash after this period
const CACHE_TTL_MS = 60_000;

/**
 * Build a fast hash string from record counts and key sums.
 * This avoids reading all data — just metadata queries.
 */
// Un `.catch()` sobre la promesa NO protege de que `db.count` no exista
// (p.ej. mocks parciales de initDB en jest): la llamada lanza TypeError
// SÍNCRONO y, si nadie espera la promesa (setCachedDeclaracion se usa
// fire-and-forget), el unhandled rejection tumba el proceso. `safeCount`
// captura ambas rutas (throw síncrono y rejection) y degrada a 0.
const safeCount = async (fn: () => Promise<number>): Promise<number> => {
  try {
    return await fn();
  } catch {
    return 0;
  }
};

async function calcularHashInputs(ejercicio: number): Promise<string> {
  const db = await initDB();

  const counts = await Promise.all([
    safeCount(() => db.count('properties')),
    safeCount(() => db.count('contracts')),
    safeCount(() => db.count('compromisosRecurrentes')),  // opexRules eliminado en V62
    safeCount(() => db.count('prestamos')),
    safeCount(() => db.count('gastosInmueble')),
    // V63 (sub-tarea 4): el store `autonomos` se eliminó; los registros
    // viven en `ingresos` con `tipo='autonomo'`.
    safeCount(() => db.countFromIndex('ingresos', 'tipo', 'autonomo')),
    safeCount(() => db.count('inversiones')),
    Promise.resolve(0),  // rentaMensual store eliminado en V62
    safeCount(() => db.count('gastosInmueble')),
  ]);

  return `${ejercicio}-${counts.join('-')}`;
}

/**
 * Get a cached IRPF declaration, or null if cache is stale/missing.
 */
export async function getCachedDeclaracion(ejercicio: number): Promise<DeclaracionIRPF | null> {
  const entry = cache.get(ejercicio);
  if (!entry) return null;

  // Check TTL
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    // TTL expired — verify hash
    const currentHash = await calcularHashInputs(ejercicio);
    if (currentHash !== entry.hash) {
      cache.delete(ejercicio);
      return null;
    }
    // Hash still matches, refresh timestamp
    entry.timestamp = Date.now();
  }

  return entry.declaracion;
}

/**
 * Store a computed declaration in cache.
 */
export async function setCachedDeclaracion(ejercicio: number, declaracion: DeclaracionIRPF): Promise<void> {
  const hash = await calcularHashInputs(ejercicio);
  cache.set(ejercicio, {
    ejercicio,
    timestamp: Date.now(),
    hash,
    declaracion,
  });
}

/**
 * Invalidate cache for a specific year or all years.
 */
export function invalidateFiscalCache(ejercicio?: number): void {
  if (ejercicio != null) {
    cache.delete(ejercicio);
  } else {
    cache.clear();
  }
}
