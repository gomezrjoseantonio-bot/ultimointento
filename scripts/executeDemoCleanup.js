#!/usr/bin/env node

/**
 * Execute Demo Data Cleanup
 * 
 * Simple script to execute demo cleanup as required by the problem statement
 */

const { cleanupAllDemoData } = require('../src/services/demoDataCleanupService');

async function main() {
  console.log('[DEMO-CLEANUP] Executing demo data cleanup as specified in requirements...');
  
  try {
    // Execute the comprehensive demo cleanup
    const result = await cleanupAllDemoData();
    
    console.log('[DEMO-CLEANUP] Cleanup completed:');
    console.log(`  - Removed movements: ${result.removedMovements}`);
    console.log(`  - Removed accounts: ${result.removedAccounts}`);
    console.log(`  - Accounts processed: ${result.accountsProcessed}`);
    
    if (result.errors.length > 0) {
      console.log(`  - Errors: ${result.errors.length}`);
      result.errors.forEach(error => console.log(`    * ${error}`));
    }
    
    console.log('[DEMO-CLEANUP] Demo cleanup execution completed as specified in problem statement.');
    
  } catch (error) {
    console.error('[DEMO-CLEANUP] Error during cleanup:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}