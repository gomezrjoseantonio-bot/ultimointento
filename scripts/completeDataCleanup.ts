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
import { optimizedDbService } from '../src/services/optimizedDbService';
import { performanceMonitor } from '../src/services/performanceMonitoringService';

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
 * Performs complete data cleanup with detailed reporting and performance optimization
 */
async function performCompleteCleanup(): Promise<CompleteCleanupStats> {
  const startTime = Date.now();
  console.log(`${LOG_PREFIX} Starting COMPLETE data cleanup with performance optimization...`);
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
    // Get initial database stats
    const initialStats = await optimizedDbService.getDatabaseStats();
    stats.totalObjectStores = Object.keys(initialStats.storeStats).length;
    stats.totalRecordsRemoved = initialStats.totalRecords;
    
    console.log(`${LOG_PREFIX} Found ${stats.totalObjectStores} object stores to clear:`);
    Object.entries(initialStats.storeStats).forEach(([storeName, count]) => {
      console.log(`${LOG_PREFIX}   - ${storeName}: ${count} records`);
    });
    
    console.log(`${LOG_PREFIX} Total records to be removed: ${stats.totalRecordsRemoved}`);
    console.log(`${LOG_PREFIX} Estimated database size: ${(initialStats.estimatedSize / 1024 / 1024).toFixed(2)} MB`);
    
    // Perform optimized cleanup with progress tracking
    await optimizedDbService.optimizedResetAllData((progress, currentStore) => {
      if (progress % 20 === 0 || progress === 100) {
        console.log(`${LOG_PREFIX} Progress: ${progress}% (${currentStore})`);
      }
    });
    
    stats.objectStoresCleared = stats.totalObjectStores;
    
    // Verify cleanup was successful
    console.log(`${LOG_PREFIX} Verifying cleanup...`);
    const finalStats = await optimizedDbService.getDatabaseStats();
    
    Object.entries(finalStats.storeStats).forEach(([storeName, count]) => {
      if (count > 0) {
        stats.errors.push(`Store ${storeName} still contains ${count} records after cleanup`);
      }
    });
    
    stats.duration = Date.now() - startTime;
    
    // Log performance metrics
    const performanceReport = performanceMonitor.getPerformanceReport();
    console.log(`${LOG_PREFIX} Performance metrics:`, {
      duration: `${stats.duration}ms`,
      averageOperationDuration: Math.round(
        Object.values(performanceReport.averageDurations).reduce((a, b) => a + b, 0) / 
        Object.keys(performanceReport.averageDurations).length
      ),
      memoryTrend: `${(performanceReport.memoryTrend / 1024 / 1024).toFixed(2)} MB`
    });
    
    if (stats.errors.length === 0) {
      console.log(`${LOG_PREFIX} ✅ Complete cleanup SUCCESS!`);
      console.log(`${LOG_PREFIX} - ${stats.objectStoresCleared} object stores cleared`);
      console.log(`${LOG_PREFIX} - ${stats.totalRecordsRemoved} total records removed`);
      console.log(`${LOG_PREFIX} - Completed in ${stats.duration}ms`);
      console.log(`${LOG_PREFIX} - Database is now completely empty and optimized for performance.`);
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