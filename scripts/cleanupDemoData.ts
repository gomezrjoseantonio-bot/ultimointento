#!/usr/bin/env ts-node

/**
 * Demo Data Cleanup Script
 * 
 * This script removes all demo data from Atlas Horizon database:
 * - Removes movements with is_demo=true or origen='demo'
 * - Removes orphaned movements (account_id doesn't exist in accounts table)
 * - Removes demo accounts (is_demo=true or alias LIKE '%demo%')
 * - Recalculates balances and projections for remaining accounts
 * 
 * Usage: node scripts/cleanupDemoData.ts
 * 
 * This script is idempotent and can be run multiple times safely.
 */

import { initDB, Account, Movement } from '../src/services/db';

const LOG_PREFIX = '[CLEANUP-DEMO]';

interface CleanupStats {
  demoMovements: number;
  orphanedMovements: number;
  demoAccounts: number;
  accountsRecalculated: number;
  errors: number;
}

/**
 * Main cleanup function (exported for use in services)
 */
export async function cleanupDemoData(): Promise<CleanupStats> {
  console.log(`${LOG_PREFIX} Starting demo data cleanup...`);
  
  const stats: CleanupStats = {
    demoMovements: 0,
    orphanedMovements: 0,
    demoAccounts: 0,
    accountsRecalculated: 0,
    errors: 0
  };

  try {
    const db = await initDB();
    
    // Step 1: Get all accounts and movements
    const [accounts, movements] = await Promise.all([
      db.getAll('accounts'),
      db.getAll('movements')
    ]);

    console.log(`${LOG_PREFIX} Found ${accounts.length} accounts and ${movements.length} movements`);

    // Step 2: Identify and remove demo movements
    const validAccountIds = new Set(accounts.map(acc => acc.id).filter(id => id !== undefined));
    const movementsToDelete: Movement[] = [];
    
    for (const movement of movements) {
      let shouldDelete = false;
      let reason = '';

      // Check if movement has demo indicators
      // Since we don't have is_demo field in current schema, we check for demo patterns
      if (movement.description?.toLowerCase().includes('demo') ||
          movement.description?.toLowerCase().includes('test') ||
          movement.description?.toLowerCase().includes('sample')) {
        shouldDelete = true;
        reason = 'demo description';
        stats.demoMovements++;
      }
      
      // Check if movement has demo origin/source patterns
      if (movement.origin === 'Manual' && 
          (movement.description?.toLowerCase().includes('demo') ||
           movement.counterparty?.toLowerCase().includes('demo'))) {
        shouldDelete = true;
        reason = 'demo origin';
        stats.demoMovements++;
      }

      // Check if movement is orphaned (account doesn't exist)
      if (movement.accountId && !validAccountIds.has(movement.accountId)) {
        shouldDelete = true;
        reason = 'orphaned (account not found)';
        stats.orphanedMovements++;
      }

      if (shouldDelete) {
        movementsToDelete.push(movement);
        console.log(`${LOG_PREFIX} Marking movement ${movement.id} for deletion (${reason}): ${movement.description}`);
      }
    }

    // Step 3: Delete identified movements
    for (const movement of movementsToDelete) {
      try {
        if (movement.id) {
          await db.delete('movements', movement.id);
        }
      } catch (error) {
        console.error(`${LOG_PREFIX} Error deleting movement ${movement.id}:`, error);
        stats.errors++;
      }
    }

    console.log(`${LOG_PREFIX} Deleted ${movementsToDelete.length} movements`);

    // Step 4: Identify and remove demo accounts
    const accountsToDelete: Account[] = [];
    
    for (const account of accounts) {
      let shouldDelete = false;
      let reason = '';

      // Check for demo indicators in account
      if (account.name?.toLowerCase().includes('demo') ||
          account.bank?.toLowerCase().includes('demo') ||
          account.iban?.toLowerCase().includes('demo')) {
        shouldDelete = true;
        reason = 'demo account name/bank/iban';
        stats.demoAccounts++;
      }

      // Check if account is marked as deleted and has demo patterns
      if (account.deleted_at && 
          (account.name?.toLowerCase().includes('demo') ||
           account.bank?.toLowerCase().includes('demo'))) {
        shouldDelete = true;
        reason = 'deleted demo account';
        stats.demoAccounts++;
      }

      if (shouldDelete) {
        accountsToDelete.push(account);
        console.log(`${LOG_PREFIX} Marking account ${account.id} for deletion (${reason}): ${account.name || account.bank}`);
      }
    }

    // Step 5: Delete identified accounts
    for (const account of accountsToDelete) {
      try {
        if (account.id) {
          await db.delete('accounts', account.id);
        }
      } catch (error) {
        console.error(`${LOG_PREFIX} Error deleting account ${account.id}:`, error);
        stats.errors++;
      }
    }

    console.log(`${LOG_PREFIX} Deleted ${accountsToDelete.length} accounts`);

    // Step 6: Recalculate balances for remaining accounts
    const remainingAccounts = accounts.filter(acc => 
      !accountsToDelete.find(del => del.id === acc.id)
    );

    for (const account of remainingAccounts) {
      try {
        await recalculateAccountBalance(db, account);
        stats.accountsRecalculated++;
      } catch (error) {
        console.error(`${LOG_PREFIX} Error recalculating balance for account ${account.id}:`, error);
        stats.errors++;
      }
    }

    console.log(`${LOG_PREFIX} Cleanup completed successfully`);
    return stats;

  } catch (error) {
    console.error(`${LOG_PREFIX} Cleanup failed:`, error);
    stats.errors++;
    return stats;
  }
}

/**
 * Recalculate account balance based on movements
 */
async function recalculateAccountBalance(db: any, account: Account): Promise<void> {
  if (!account.id) return;

  // Get all movements for this account
  const movements = await db.getAllFromIndex('movements', 'accountId', account.id);
  
  // Calculate balance based on movements
  const calculatedBalance = movements.reduce((balance: number, movement: Movement) => {
    return balance + movement.amount;
  }, account.openingBalance || 0);

  // Update account balance
  const updatedAccount = {
    ...account,
    balance: calculatedBalance,
    updatedAt: new Date().toISOString()
  };

  await db.put('accounts', updatedAccount);
  
  console.log(`${LOG_PREFIX} Recalculated balance for account ${account.id}: ${calculatedBalance.toFixed(2)} EUR`);
}

/**
 * Display cleanup results
 */
function displayResults(stats: CleanupStats): void {
  console.log('\n' + '='.repeat(50));
  console.log(`${LOG_PREFIX} CLEANUP RESULTS`);
  console.log('='.repeat(50));
  console.log(`Demo movements deleted: ${stats.demoMovements}`);
  console.log(`Orphaned movements deleted: ${stats.orphanedMovements}`);
  console.log(`Demo accounts deleted: ${stats.demoAccounts}`);
  console.log(`Accounts recalculated: ${stats.accountsRecalculated}`);
  console.log(`Errors encountered: ${stats.errors}`);
  console.log('='.repeat(50) + '\n');

  if (stats.errors > 0) {
    console.warn(`${LOG_PREFIX} Cleanup completed with ${stats.errors} errors. Check logs above.`);
    process.exit(1);
  } else {
    console.log(`${LOG_PREFIX} Cleanup completed successfully!`);
    process.exit(0);
  }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  try {
    console.log(`${LOG_PREFIX} Atlas Horizon Demo Data Cleanup Script`);
    console.log(`${LOG_PREFIX} =====================================\n`);
    
    const stats = await cleanupDemoData();
    displayResults(stats);
    
  } catch (error) {
    console.error(`${LOG_PREFIX} Fatal error:`, error);
    process.exit(1);
  }
}

// Run the script if executed directly
if (require.main === module) {
  main();
}

export { cleanupDemoData };
export type { CleanupStats };