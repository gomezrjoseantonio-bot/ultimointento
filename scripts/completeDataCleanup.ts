#!/usr/bin/env ts-node

/**
 * Complete Data Cleanup Script
 * 
 * This script performs a COMPLETE cleanup of ALL data from the Atlas Horizon database:
 * - Removes ALL data from ALL object stores (movements, accounts, properties, etc.)
 * - Clears ALL localStorage entries related to the application
 * - Ensures database is completely empty with zero records
 * - NO exceptions - removes demo data, real data, and everything else
 * 
 * WARNING: This is IRREVERSIBLE - all data will be permanently lost
 * 
 * Usage: node scripts/completeDataCleanup.ts
 * 
 * This script addresses the requirement to have a completely clean database
 * when creating new accounts, with absolutely no historical data remaining.
 */

import { initDB, resetAllData } from '../src/services/db';

const LOG_PREFIX = '[COMPLETE-CLEANUP]';

interface CompleteCleanupStats {
  totalObjectStores: number;
  objectStoresCleared: number;
  totalRecordsRemoved: number;
  localStorageKeysCleared: number;
  errors: string[];
  duration: number;
}

/**
 * Performs complete data cleanup with detailed reporting
 */
async function performCompleteCleanup(): Promise<CompleteCleanupStats> {
  const startTime = Date.now();
  console.log(`${LOG_PREFIX} Starting COMPLETE data cleanup...`);
  console.log(`${LOG_PREFIX} WARNING: This will remove ALL data permanently!`);
  
  const stats: CompleteCleanupStats = {
    totalObjectStores: 0,
    objectStoresCleared: 0,
    totalRecordsRemoved: 0,
    localStorageKeysCleared: 0,
    errors: [],
    duration: 0
  };

  try {
    const db = await initDB();
    
    // Step 1: Count existing data before cleanup
    const storeNames = Array.from(db.objectStoreNames);
    stats.totalObjectStores = storeNames.length;
    
    console.log(`${LOG_PREFIX} Found ${storeNames.length} object stores to clear:`);
    
    // Count records in each store before clearing
    for (const storeName of storeNames) {
      try {
        const count = await db.count(storeName);
        stats.totalRecordsRemoved += count;
        console.log(`${LOG_PREFIX}   - ${storeName}: ${count} records`);
      } catch (error) {
        console.warn(`${LOG_PREFIX} Warning: Could not count records in ${storeName}:`, error);
      }
    }
    
    console.log(`${LOG_PREFIX} Total records to be removed: ${stats.totalRecordsRemoved}`);
    
    // Step 2: Perform the complete cleanup using the enhanced resetAllData function
    await resetAllData();
    stats.objectStoresCleared = storeNames.length;
    
    // Step 3: Count localStorage items that were cleared
    // Note: we can't count this precisely since resetAllData already cleared them
    // But we can estimate based on the keys we know about
    const knownKeys = [
      'atlas-inbox-documents',
      'atlas-horizon-settings', 
      'atlas-user-preferences',
      'classificationRules',
      'bankProfiles',
      'demo-mode',
      'atlas-kpi-configurations',
      'treasury-cache',
      'fiscal-cache'
    ];
    stats.localStorageKeysCleared = knownKeys.length;
    
    // Step 4: Verify cleanup was successful
    console.log(`${LOG_PREFIX} Verifying cleanup...`);
    
    for (const storeName of storeNames) {
      try {
        const count = await db.count(storeName);
        if (count > 0) {
          stats.errors.push(`Store ${storeName} still contains ${count} records after cleanup`);
        }
      } catch (error) {
        stats.errors.push(`Could not verify cleanup of store ${storeName}: ${error}`);
      }
    }
    
    stats.duration = Date.now() - startTime;
    
    if (stats.errors.length === 0) {
      console.log(`${LOG_PREFIX} ✅ Complete cleanup SUCCESS!`);
      console.log(`${LOG_PREFIX} - ${stats.objectStoresCleared} object stores cleared`);
      console.log(`${LOG_PREFIX} - ${stats.totalRecordsRemoved} total records removed`);
      console.log(`${LOG_PREFIX} - ${stats.localStorageKeysCleared}+ localStorage keys cleared`);
      console.log(`${LOG_PREFIX} - Completed in ${stats.duration}ms`);
      console.log(`${LOG_PREFIX} Database is now completely empty and ready for fresh use.`);
    } else {
      console.error(`${LOG_PREFIX} ❌ Cleanup completed with ${stats.errors.length} errors:`);
      stats.errors.forEach(error => console.error(`${LOG_PREFIX}   - ${error}`));
    }
    
    return stats;
    
  } catch (error) {
    console.error(`${LOG_PREFIX} Fatal error during cleanup:`, error);
    stats.errors.push(`Fatal error: ${error}`);
    stats.duration = Date.now() - startTime;
    return stats;
  }
}

/**
 * Interactive confirmation for safety
 */
async function confirmCleanup(): Promise<boolean> {
  // In a real environment, this would use readline for interactive confirmation
  // For script execution, we'll check for a command line flag
  const args = process.argv.slice(2);
  
  if (args.includes('--confirm') || args.includes('-y')) {
    return true;
  }
  
  console.log(`${LOG_PREFIX} SAFETY CHECK:`);
  console.log(`${LOG_PREFIX} This will permanently delete ALL data in the Atlas Horizon database.`);
  console.log(`${LOG_PREFIX} This includes:`);
  console.log(`${LOG_PREFIX}   - All properties and real estate data`);
  console.log(`${LOG_PREFIX}   - All financial movements and accounts`);
  console.log(`${LOG_PREFIX}   - All documents and contracts`);
  console.log(`${LOG_PREFIX}   - All demo data and real data`);
  console.log(`${LOG_PREFIX}   - All configuration and preferences`);
  console.log(`${LOG_PREFIX}`);
  console.log(`${LOG_PREFIX} To proceed, run with --confirm flag:`);
  console.log(`${LOG_PREFIX}   node scripts/completeDataCleanup.ts --confirm`);
  console.log(`${LOG_PREFIX}`);
  
  return false;
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    console.log(`${LOG_PREFIX} Atlas Horizon Complete Data Cleanup Script`);
    console.log(`${LOG_PREFIX} ==========================================\n`);
    
    const confirmed = await confirmCleanup();
    if (!confirmed) {
      console.log(`${LOG_PREFIX} Cleanup cancelled for safety. Use --confirm flag to proceed.`);
      process.exit(0);
    }
    
    const stats = await performCompleteCleanup();
    
    if (stats.errors.length > 0) {
      console.error(`${LOG_PREFIX} Cleanup completed with errors.`);
      process.exit(1);
    } else {
      console.log(`${LOG_PREFIX} Cleanup completed successfully!`);
      process.exit(0);
    }
    
  } catch (error) {
    console.error(`${LOG_PREFIX} Fatal error:`, error);
    process.exit(1);
  }
}

// Export for use in other modules
export { performCompleteCleanup };
export type { CompleteCleanupStats };

// Run the script if executed directly
if (require.main === module) {
  main();
}