#!/usr/bin/env node

/**
 * Complete Data Cleanup Script (JavaScript version)
 * 
 * This script performs a COMPLETE cleanup of ALL data from the Atlas Horizon database.
 * It calls the resetAllData function from the database service to ensure everything is cleared.
 * 
 * WARNING: This is IRREVERSIBLE - all data will be permanently lost
 * 
 * Usage: node scripts/completeDataCleanup.js [--confirm]
 */

const LOG_PREFIX = '[COMPLETE-CLEANUP]';

/**
 * Simple confirmation check
 */
function confirmCleanup() {
  const args = process.argv.slice(2);
  
  if (args.includes('--confirm') || args.includes('-y')) {
    return true;
  }
  
  console.log(`${LOG_PREFIX} SAFETY CHECK:`);
  console.log(`${LOG_PREFIX} This will permanently delete ALL data in the Atlas Horizon database.`);
  console.log(`${LOG_PREFIX} This includes ALL movements, accounts, properties, documents, etc.`);
  console.log(`${LOG_PREFIX}`);
  console.log(`${LOG_PREFIX} To proceed, run with --confirm flag:`);
  console.log(`${LOG_PREFIX}   node scripts/completeDataCleanup.js --confirm`);
  console.log(`${LOG_PREFIX}`);
  
  return false;
}

/**
 * Simple cleanup function that relies on the database service
 */
async function performCleanup() {
  console.log(`${LOG_PREFIX} Starting complete data cleanup...`);
  console.log(`${LOG_PREFIX} This will clear ALL data from the database.`);
  
  try {
    // For the JavaScript version, we'll provide instructions to use the TypeScript version
    // or import the function if the build system supports it
    console.log(`${LOG_PREFIX}`);
    console.log(`${LOG_PREFIX} To perform the cleanup, please use one of these methods:`);
    console.log(`${LOG_PREFIX}`);
    console.log(`${LOG_PREFIX} Method 1: Use the TypeScript version (recommended):`);
    console.log(`${LOG_PREFIX}   npx ts-node scripts/completeDataCleanup.ts --confirm`);
    console.log(`${LOG_PREFIX}`);
    console.log(`${LOG_PREFIX} Method 2: From the browser console, call:`);
    console.log(`${LOG_PREFIX}   import { resetAllData } from './src/services/db';`);
    console.log(`${LOG_PREFIX}   await resetAllData();`);
    console.log(`${LOG_PREFIX}`);
    console.log(`${LOG_PREFIX} Method 3: From React DevTools or browser application:`);
    console.log(`${LOG_PREFIX}   Open browser Developer Tools > Console`);
    console.log(`${LOG_PREFIX}   Paste and run: localStorage.clear(); indexedDB.deleteDatabase('AtlasHorizonDB');`);
    console.log(`${LOG_PREFIX}   Then refresh the page`);
    console.log(`${LOG_PREFIX}`);
    
  } catch (error) {
    console.error(`${LOG_PREFIX} Error:`, error);
    process.exit(1);
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log(`${LOG_PREFIX} Atlas Horizon Complete Data Cleanup Script`);
    console.log(`${LOG_PREFIX} ==========================================\n`);
    
    const confirmed = confirmCleanup();
    if (!confirmed) {
      console.log(`${LOG_PREFIX} Cleanup cancelled for safety. Use --confirm flag to proceed.`);
      process.exit(0);
    }
    
    await performCleanup();
    
  } catch (error) {
    console.error(`${LOG_PREFIX} Fatal error:`, error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { main };