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
async function calcularHashInputs(ejercicio: number): Promise<string> {
  const db = await initDB();

  const counts = await Promise.all([
    db.count('properties').catch(() => 0),
    db.count('contracts').catch(() => 0),
    db.count('opexRules').catch(() => 0),
    db.count('prestamos').catch(() => 0),
    db.count('gastosInmueble').catch(() => 0),
    // V63 (sub-tarea 4): el store `autonomos` se eliminó; los registros
    // viven en `ingresos` con `tipo='autonomo'`.
    db.countFromIndex('ingresos', 'tipo', 'autonomo').catch(() => 0),
    db.count('inversiones').catch(() => 0),
    db.count('rentaMensual').catch(() => 0),
    db.count('gastosInmueble').catch(() => 0),
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
