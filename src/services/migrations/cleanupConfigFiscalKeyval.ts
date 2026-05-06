/**
 * TAREA 14 sub-tarea 14.5 · cleanup one-shot de la clave huérfana
 * `keyval['configFiscal']`.
 *
 * Contexto · `configFiscal` quedó documentada en `db.ts` JSDoc tras la
 * eliminación del store legacy `configuracion_fiscal` (V62) pero NO tiene
 * escritor ni lector activos en producción (confirmado en T15.1 audit ·
 * T14.1 audit · y en el reporte de validación retroactiva T14 · 2026-05-06).
 *
 * Esta migración elimina la entrada residual si existe · es completamente
 * idempotente · escribe el flag `cleanup_T14_v1` cuando termina y hace skip
 * silencioso en arranques posteriores.
 *
 * NO toca ningún otro store · NO migra datos del usuario · NO bumpea
 * DB_VERSION (sigue en 69).
 */

import { initDB } from '../db';

export const T14_CLEANUP_FLAG_KEY = 'cleanup_T14_v1';
const TARGET_KEY = 'configFiscal';

export interface ConfigFiscalCleanupReport {
  /** True si el flag estaba presente · resto de campos a 0/false. */
  skipped: boolean;
  /** True si la clave existía y se ha borrado en esta corrida. */
  deleted: boolean;
  /** Errores no fatales (ej · escritura del flag falló). */
  errors: string[];
}

export async function cleanupConfigFiscalKeyval(): Promise<ConfigFiscalCleanupReport> {
  const report: ConfigFiscalCleanupReport = {
    skipped: false,
    deleted: false,
    errors: [],
  };

  const db = await initDB();

  const flag = await db.get('keyval', T14_CLEANUP_FLAG_KEY);
  if (flag === 'completed') {
    report.skipped = true;
    return report;
  }

  try {
    const existing = await db.get('keyval', TARGET_KEY);
    if (existing !== undefined && existing !== null) {
      await db.delete('keyval', TARGET_KEY);
      report.deleted = true;
    }
  } catch (error) {
    report.errors.push(
      error instanceof Error ? error.message : String(error),
    );
  }

  try {
    await db.put('keyval', 'completed', T14_CLEANUP_FLAG_KEY);
  } catch (error) {
    report.errors.push(
      error instanceof Error ? error.message : String(error),
    );
  }

  return report;
}
