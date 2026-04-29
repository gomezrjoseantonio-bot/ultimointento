/**
 * TAREA 15 · sub-tarea 15.2 · limpieza de claves muertas del store `keyval`.
 *
 * Borra (one-shot) las claves clasificadas como B (cache recalculable) y D2
 * (flag migración consumida) en `docs/AUDIT-T15-keyval.md` §4 que Jose
 * confirmó en revisión del PR T15.1:
 *
 *   - `proveedor-contraparte-migration` · D2 · flag migración consumida
 *   - `base-projection`                 · B  · cache de proyección recalculable
 *   - `kpiConfig_horizon`               · residual V62 · kpiService es stub
 *   - `kpiConfig_pulse`                 · residual V62 · kpiService es stub
 *
 * NO toca:
 *   - `configFiscal` · pertenece a T14 (decisión Jose)
 *   - `base-assumptions` · configuración de proyección · esperar a T21
 *   - `migration_orphaned_inmueble_ids_v1` · D1 · puede re-correr
 *   - `matchingConfig`, `dashboardConfiguration` · configuración real
 *   - `planpagos_*` · datos del usuario · se migran en sub-tarea 15.3
 *
 * Idempotente · escribe el flag `cleanup_T15_v1='completed'` cuando termina ·
 * próxima ejecución hace skip silencioso.
 */

import { initDB } from './db';

export const T15_CLEANUP_FLAG_KEY = 'cleanup_T15_v1';

/** Lista hardcodeada de claves a borrar · confirmadas por Jose en PR T15.1. */
export const T15_KEYS_TO_DELETE: readonly string[] = [
  'proveedor-contraparte-migration',
  'base-projection',
  'kpiConfig_horizon',
  'kpiConfig_pulse',
];

export interface KeyvalCleanupReport {
  /** True si el flag estaba presente y se hizo skip · resto de campos a 0. */
  skipped: boolean;
  /** Claves que existían y se borraron. */
  deletedCount: number;
  /** Claves que ya no existían · no requirieron acción. */
  skippedCount: number;
  /** Claves que fallaron al borrar · no abortan el resto. */
  errors: Array<{ key: string; error: string }>;
}

/**
 * Ejecuta la limpieza T15 una sola vez por instalación.
 *
 * - Verifica el flag `cleanup_T15_v1` · si está `'completed'` · skip total
 * - Para cada clave en `T15_KEYS_TO_DELETE` · si existe · `db.delete` · si no · skip
 * - Si una clave falla · registra el error y continúa con el resto
 * - Al final · escribe el flag (incluso si hubo errores parciales · evita
 *   reintentos infinitos · Jose puede borrar el flag manualmente para forzar)
 */
export async function runKeyvalCleanup(): Promise<KeyvalCleanupReport> {
  const report: KeyvalCleanupReport = {
    skipped: false,
    deletedCount: 0,
    skippedCount: 0,
    errors: [],
  };

  const db = await initDB();

  const flag = await db.get('keyval', T15_CLEANUP_FLAG_KEY);
  if (flag === 'completed') {
    report.skipped = true;
    return report;
  }

  for (const key of T15_KEYS_TO_DELETE) {
    try {
      const existing = await db.get('keyval', key);
      if (existing === undefined) {
        report.skippedCount += 1;
        continue;
      }
      await db.delete('keyval', key);
      report.deletedCount += 1;
    } catch (error) {
      report.errors.push({
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  try {
    await db.put('keyval', 'completed', T15_CLEANUP_FLAG_KEY);
  } catch (error) {
    // Si no puedo escribir el flag · próximo arranque re-ejecutará la
    // limpieza · es seguro porque ya es idempotente sobre claves muertas.
    report.errors.push({
      key: T15_CLEANUP_FLAG_KEY,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return report;
}
