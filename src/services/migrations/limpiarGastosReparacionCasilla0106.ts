// Migración one-shot: elimina registros de gastosInmueble con casillaAEAT='0106'
// y origen='xml_aeat' escritos antes del fix BUG-1. Usaban C_GRCEA (bruto antes
// del tope) en lugar de C_INTGRCEA (aplicado tras el tope), sobrededuciendo el
// gasto de reparación cuando había arrastre. Al reimportar el XML se reescriben
// correctamente con el importe aplicado real.

import { initDB } from '../db';

const MIGRATION_KEY = 'migration_limpiar_gastos_reparacion_0106_v1';

/** Safe localStorage.getItem — returns null when storage is unavailable */
function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Safe localStorage.setItem — best-effort, ignores storage errors */
function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Best-effort: if storage is unavailable the migration will re-run next time
  }
}

export async function limpiarGastosReparacionCasillasErroneas(): Promise<{ eliminados: number }> {
  const db = await initDB();
  // Usa el índice 'casillaAEAT' para no cargar toda la tabla en memoria.
  const candidatos = await db.getAllFromIndex('gastosInmueble', 'casillaAEAT', '0106');

  const ids: number[] = [];
  for (const g of candidatos) {
    if (
      g.origen === 'xml_aeat' &&
      typeof g.concepto === 'string' &&
      g.concepto.startsWith('Declaración AEAT') &&
      g.id != null
    ) {
      ids.push(g.id);
    }
  }

  if (ids.length === 0) return { eliminados: 0 };

  // Batch delete en una sola transacción readwrite.
  const tx = db.transaction('gastosInmueble', 'readwrite');
  await Promise.all(ids.map((id) => tx.store.delete(id)));
  await tx.done;

  console.log(`[gastosInmueble] Limpieza reparaciones 0106: ${ids.length} eliminados`);
  return { eliminados: ids.length };
}

export async function runMigrationIfNeeded(): Promise<void> {
  try {
    if (safeGetItem(MIGRATION_KEY)) return;
    await limpiarGastosReparacionCasillasErroneas();
    safeSetItem(MIGRATION_KEY, 'done');
  } catch (e) {
    console.error('[Migración] limpiarGastosReparacionCasillasErroneas falló:', e);
  }
}
