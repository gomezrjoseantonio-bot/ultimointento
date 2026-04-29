/**
 * TAREA 15 sub-tarea 15.3 · migración de claves `planpagos_${id}` del store
 * `keyval` al campo `prestamos[].planPagos`.
 *
 * Las claves `planpagos_*` viven en `keyval` desde el wizard original de
 * préstamos · son **datos del usuario** (categoría C del audit T15.1) y no
 * configuración. Esta migración las mueve al store correcto y borra la
 * entrada de origen.
 *
 * Idempotente · escribe el flag `migration_keyval_planpagos_to_prestamos_v1`
 * en `keyval` cuando termina · próxima ejecución hace skip silencioso.
 *
 * Política de conflictos:
 *   - keyval tiene valor + prestamo.planPagos vacío → mover · borrar keyval
 *   - keyval vacío + prestamo.planPagos tiene valor → no-op (ya migrado)
 *   - keyval vacío + prestamo.planPagos vacío → no-op
 *   - keyval tiene valor + prestamo.planPagos tiene valor → WARNING · NO
 *     sobrescribir · log conflict · borrar keyval (la copia "buena" ya está
 *     en el prestamo)
 *
 * Si el préstamo asociado a `planpagos_${id}` no existe en el store
 * `prestamos` (huérfana) · log warning y borrar la entrada keyval.
 */

import { initDB } from '../db';
import type { PlanPagos, Prestamo } from '../../types/prestamos';

export const T15_PLANPAGOS_MIGRATION_FLAG_KEY =
  'migration_keyval_planpagos_to_prestamos_v1';

const PLANPAGOS_KEY_PREFIX = 'planpagos_';

export interface PlanpagosMigrationReport {
  /** True si el flag estaba presente · resto de campos a 0. */
  skipped: boolean;
  /** Plans movidos de keyval a prestamo.planPagos. */
  movedCount: number;
  /** Conflictos · keyval y prestamo.planPagos ambos con valor distinto. */
  conflictCount: number;
  /** Claves planpagos_* sin préstamo asociado · borradas. */
  orphanCount: number;
  /** Claves keyval cuyo prestamo ya tenía planPagos · borradas. */
  alreadyMigratedCount: number;
  /** Errores no fatales por clave. */
  errors: Array<{ key: string; error: string }>;
}

/**
 * Compara dos planes de pagos por valor (deep equal vía JSON). IndexedDB
 * devuelve copias en cada lectura, así que la comparación por referencia
 * (`a !== b`) trataría siempre dos planes idénticos como distintos.
 */
function plansAreDeepEqual(a: PlanPagos, b: PlanPagos): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Resuelve el préstamo asociado a un loanId extraído de `planpagos_${id}`.
 *
 * La interfaz `Prestamo` declara `id: string` y el store usa `keyPath: 'id'`
 * sin `autoIncrement`, así que en condiciones normales todos los IDs son
 * strings. Defensivamente intentamos también la variante numérica para no
 * borrar como huérfana una entrada keyval que apunta a un préstamo legacy
 * con `id` numérico residual (regla "datos del usuario intactos" · spec §4).
 */
async function resolvePrestamo(
  db: Awaited<ReturnType<typeof initDB>>,
  loanId: string,
): Promise<Prestamo | undefined> {
  const direct = (await db.get('prestamos', loanId)) as Prestamo | undefined;
  if (direct) return direct;

  const numericKey =
    loanId !== '' &&
    Number.isFinite(Number(loanId)) &&
    String(Number(loanId)) === loanId
      ? (Number(loanId) as IDBValidKey)
      : undefined;
  if (numericKey !== undefined) {
    return (await db.get('prestamos', numericKey)) as Prestamo | undefined;
  }
  return undefined;
}

export async function migrateKeyvalPlanpagosToPrestamos(): Promise<PlanpagosMigrationReport> {
  const report: PlanpagosMigrationReport = {
    skipped: false,
    movedCount: 0,
    conflictCount: 0,
    orphanCount: 0,
    alreadyMigratedCount: 0,
    errors: [],
  };

  const db = await initDB();

  const flag = await db.get('keyval', T15_PLANPAGOS_MIGRATION_FLAG_KEY);
  if (flag === 'completed') {
    report.skipped = true;
    return report;
  }

  // Enumerar claves planpagos_* en una sola lectura.
  const allKeys = (await db.getAllKeys('keyval')) as IDBValidKey[];
  const planpagosKeys = allKeys
    .map((k) => String(k))
    .filter((k) => k.startsWith(PLANPAGOS_KEY_PREFIX));

  if (planpagosKeys.length === 0) {
    // Nada que migrar · marcamos el flag para que no volvamos a escanear.
    try {
      await db.put('keyval', 'completed', T15_PLANPAGOS_MIGRATION_FLAG_KEY);
    } catch (error) {
      report.errors.push({
        key: T15_PLANPAGOS_MIGRATION_FLAG_KEY,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return report;
  }

  for (const key of planpagosKeys) {
    try {
      const loanId = key.slice(PLANPAGOS_KEY_PREFIX.length).trim();
      if (!loanId) {
        report.errors.push({ key, error: 'loanId vacío tras quitar prefijo' });
        continue;
      }

      const plan = (await db.get('keyval', key)) as PlanPagos | undefined;
      const prestamo = await resolvePrestamo(db, loanId);

      if (!prestamo) {
        // Huérfana · borrar y seguir
        await db.delete('keyval', key);
        report.orphanCount += 1;
        console.warn(
          `[Migración 15.3] keyval[${key}] sin préstamo asociado · borrada huérfana`,
        );
        continue;
      }

      const existingPlan = prestamo.planPagos;

      if (!plan) {
        // Entrada keyval vacía/null · borrar para limpiar
        await db.delete('keyval', key);
        continue;
      }

      if (existingPlan && !plansAreDeepEqual(existingPlan, plan)) {
        // Conflict · ambos lados tienen valor · NO sobrescribimos · borramos
        // la copia keyval (la canónica post-migración es prestamo.planPagos).
        await db.delete('keyval', key);
        report.conflictCount += 1;
        console.warn(
          `[Migración 15.3] conflict · prestamo[${loanId}].planPagos ya tiene ` +
            `valor distinto al de keyval[${key}] · NO se sobrescribe · keyval borrada`,
        );
        continue;
      }

      if (existingPlan) {
        // Ambos apuntan al mismo objeto o el campo ya está migrado · solo
        // limpiar keyval.
        await db.delete('keyval', key);
        report.alreadyMigratedCount += 1;
        continue;
      }

      // Caso normal · mover plan al prestamo y borrar keyval
      await db.put('prestamos', { ...prestamo, planPagos: plan });
      await db.delete('keyval', key);
      report.movedCount += 1;
    } catch (error) {
      report.errors.push({
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  try {
    await db.put('keyval', 'completed', T15_PLANPAGOS_MIGRATION_FLAG_KEY);
  } catch (error) {
    report.errors.push({
      key: T15_PLANPAGOS_MIGRATION_FLAG_KEY,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return report;
}
