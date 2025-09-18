/**
 * Account Migration Service
 * Handles migration of existing accounts to new status system
 */

import { cuentasService } from './cuentasService';

const MIGRATION_VERSION = '1.0';
const MIGRATION_KEY = 'atlas_account_migration_version';

/**
 * Check if migration is needed and execute it
 */
export async function initializeAccountMigration(): Promise<void> {
  const currentVersion = localStorage.getItem(MIGRATION_KEY);
  
  if (currentVersion === MIGRATION_VERSION) {
    console.info('[MIGRATION] Account migration already completed for version', MIGRATION_VERSION);
    return;
  }

  console.info('[MIGRATION] Starting account status migration...');
  
  try {
    const result = await cuentasService.migrateAccountStatuses();
    
    if (result.migrated > 0) {
      console.info(`[MIGRATION] Successfully migrated ${result.migrated} accounts to new status system`);
    } else {
      console.info('[MIGRATION] No accounts needed migration');
    }
    
    // Mark migration as completed
    localStorage.setItem(MIGRATION_KEY, MIGRATION_VERSION);
    
    console.info('[MIGRATION] Account migration completed successfully');
    
  } catch (error) {
    console.error('[MIGRATION] Failed to migrate accounts:', error);
    // Don't block the app if migration fails, but log the error
  }
}

/**
 * Force re-run migration (for development/testing)
 */
export async function forceMigration(): Promise<void> {
  localStorage.removeItem(MIGRATION_KEY);
  await initializeAccountMigration();
}