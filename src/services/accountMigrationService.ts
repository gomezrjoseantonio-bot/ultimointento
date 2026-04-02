/**
 * Account Migration Service
 * Handles migration of existing accounts to new status system
 * and backfill of IBANs from already-imported fiscal declarations.
 */

import { cuentasService } from './cuentasService';
import { initDB } from './db';
import { maskIban } from '../utils/accountHelpers';

const MIGRATION_VERSION = '1.0';
const MIGRATION_KEY = 'atlas_account_migration_version';

const IBAN_BACKFILL_VERSION = '1.0';
const IBAN_BACKFILL_KEY = 'atlas_iban_backfill_version';

/**
 * Check if migration is needed and execute it
 */
export async function initializeAccountMigration(): Promise<void> {
  const currentVersion = localStorage.getItem(MIGRATION_KEY);

  if (currentVersion === MIGRATION_VERSION) {
    console.info('[MIGRATION] Account migration already completed for version', MIGRATION_VERSION);
  } else {
    console.info('[MIGRATION] Starting account status migration...');

    try {
      const result = await cuentasService.migrateAccountStatuses();

      if (result.migrated > 0) {
        console.info(`[MIGRATION] Successfully migrated ${result.migrated} accounts to new status system`);
      } else {
        console.info('[MIGRATION] No accounts needed migration');
      }

      localStorage.setItem(MIGRATION_KEY, MIGRATION_VERSION);
      console.info('[MIGRATION] Account migration completed successfully');

    } catch (error) {
      console.error('[MIGRATION] Failed to migrate accounts:', error);
    }
  }

  // Backfill IBANs from ejerciciosFiscalesCoord for users who imported XMLs before the PR
  await backfillIbanFromDeclaraciones();
}

/**
 * Read IBANs from already-imported DeclaracionCompleta stored in
 * ejerciciosFiscalesCoord and write them to accounts if missing.
 */
async function backfillIbanFromDeclaraciones(): Promise<void> {
  const done = localStorage.getItem(IBAN_BACKFILL_KEY);
  if (done === IBAN_BACKFILL_VERSION) {
    return;
  }

  console.info('[MIGRATION] Starting IBAN backfill from fiscal declarations...');

  try {
    const db = await initDB();
    const ejercicios = await db.getAll('ejerciciosFiscalesCoord');
    let added = 0;

    for (const ej of ejercicios) {
      const decl = (ej as any).aeat?.declaracionCompleta;
      if (!decl) continue;

      const iban: string | undefined =
        decl.cuentaDevolucion?.iban || decl.cuentaIngreso?.iban;
      if (!iban) continue;

      try {
        await cuentasService.create({ iban });
        added++;
        console.info(`[MIGRATION] IBAN backfill: added ${maskIban(iban)} from ejercicio ${ej.año}`);
      } catch {
        // Already exists or validation error — skip
      }
    }

    if (added > 0) {
      console.info(`[MIGRATION] IBAN backfill complete: ${added} account(s) added`);
    } else {
      console.info('[MIGRATION] IBAN backfill: no new IBANs to add');
    }

    localStorage.setItem(IBAN_BACKFILL_KEY, IBAN_BACKFILL_VERSION);
  } catch (error) {
    console.error('[MIGRATION] IBAN backfill failed:', error);
  }
}

/**
 * Force re-run migration (for development/testing)
 */
export async function forceMigration(): Promise<void> {
  localStorage.removeItem(MIGRATION_KEY);
  localStorage.removeItem(IBAN_BACKFILL_KEY);
  await initializeAccountMigration();
}