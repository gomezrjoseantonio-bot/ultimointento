/**
 * Demo Data Cleanup Service
 * 
 * Provides functions to detect and remove demo/example movements from treasury
 * Ensures that newly created accounts don't have any default movements
 */

import { initDB, Movement } from './db';
import { isDemoAccount } from './accountValidationService';
import toast from 'react-hot-toast';

const LOG_PREFIX = '[DEMO-CLEANUP]';

export interface CleanupResult {
  removedMovements: number;
  removedAccounts: number;
  accountsProcessed: number;
  errors: string[];
}

/**
 * Detects if a movement is a demo/example movement
 */
export function isDemoMovement(movement: Movement): boolean {
  if (!movement) return false;

  const description = movement.description?.toLowerCase() || '';
  const counterparty = movement.counterparty?.toLowerCase() || '';
  
  // Demo keywords to check - expanded list for better detection
  const demoKeywords = [
    'demo', 'test', 'sample', 'ejemplo', 'prueba',
    'ficticio', 'simulado', 'plantilla', 'muestra',
    'fake', 'mock', 'provisional', 'temporal',
    'placeholder', 'default', 'initial',
    'movimiento de ejemplo', 'movimiento inicial', 'movimiento por defecto'
  ];

  // Check if description or counterparty contains demo keywords
  const hasKeywords = demoKeywords.some(keyword => 
    description.includes(keyword) || counterparty.includes(keyword)
  );

  // Check for typical demo amounts (round numbers like 100, 500, 1000)
  const isDemoAmount = movement.amount !== undefined && (
    movement.amount === 100 ||
    movement.amount === 500 ||
    movement.amount === 1000 ||
    movement.amount === -100 ||
    movement.amount === -500 ||
    movement.amount === -1000 ||
    movement.amount === 0 // Zero amounts are often demo/placeholder
  );

  // Check for demo dates (future dates or specific test dates)
  const isDemoDate = movement.date ? (
    movement.date.includes('2099') ||
    movement.date.includes('1999') ||
    movement.date.includes('2000-01-01') ||
    movement.date.includes('1900-01-01')
  ) : false;

  // Check for movements without proper metadata (likely auto-generated demo)
  const lacksMetadata = !movement.createdAt && movement.origin === 'Manual';
  
  // Additional production safety: movements with no counterparty and round amounts
  const suspiciousPattern = !counterparty && isDemoAmount;

  return hasKeywords || (isDemoAmount && isDemoDate) || lacksMetadata || suspiciousPattern;
}

/**
 * Removes all demo movements from the database
 */
export async function removeDemoMovements(): Promise<CleanupResult> {
  console.log(`${LOG_PREFIX} Starting demo movements cleanup...`);
  
  const result: CleanupResult = {
    removedMovements: 0,
    removedAccounts: 0,
    accountsProcessed: 0,
    errors: []
  };

  try {
    const db = await initDB();
    
    // Get all movements
    const allMovements = await db.getAll('movements');
    console.log(`${LOG_PREFIX} Found ${allMovements.length} total movements`);

    // Identify demo movements
    const demoMovements = allMovements.filter(isDemoMovement);
    console.log(`${LOG_PREFIX} Found ${demoMovements.length} demo movements to remove`);

    // Remove demo movements
    for (const movement of demoMovements) {
      try {
        if (movement.id) {
          await db.delete('movements', movement.id);
          result.removedMovements++;
          console.log(`${LOG_PREFIX} Removed demo movement: ${movement.description}`);
        }
      } catch (error) {
        const errorMsg = `Failed to remove movement ${movement.id}: ${error}`;
        result.errors.push(errorMsg);
        console.error(`${LOG_PREFIX} ${errorMsg}`);
      }
    }

    console.log(`${LOG_PREFIX} Demo movements cleanup completed: ${result.removedMovements} removed`);

  } catch (error) {
    const errorMsg = `Cleanup failed: ${error}`;
    result.errors.push(errorMsg);
    console.error(`${LOG_PREFIX} ${errorMsg}`);
  }

  return result;
}

/**
 * Removes demo accounts and their associated movements
 */
export async function removeDemoAccounts(): Promise<CleanupResult> {
  console.log(`${LOG_PREFIX} Starting demo accounts cleanup...`);
  
  const result: CleanupResult = {
    removedMovements: 0,
    removedAccounts: 0,
    accountsProcessed: 0,
    errors: []
  };

  try {
    const db = await initDB();
    
    // Get all accounts
    const allAccounts = await db.getAll('accounts');
    console.log(`${LOG_PREFIX} Found ${allAccounts.length} total accounts`);

    // Process each account
    for (const account of allAccounts) {
      result.accountsProcessed++;
      
      if (isDemoAccount(account)) {
        try {
          // Remove all movements for this demo account
          const accountMovements = await db.getAllFromIndex('movements', 'accountId', account.id);
          
          for (const movement of accountMovements) {
            if (movement.id) {
              await db.delete('movements', movement.id);
              result.removedMovements++;
            }
          }

          // Mark account as deleted instead of actually deleting
          if (account.id) {
            const updatedAccount = {
              ...account,
              isActive: false,
              deleted_at: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            await db.put('accounts', updatedAccount);
            result.removedAccounts++;
            console.log(`${LOG_PREFIX} Marked demo account as deleted: ${account.name || account.bank}`);
          }

        } catch (error) {
          const errorMsg = `Failed to process demo account ${account.id}: ${error}`;
          result.errors.push(errorMsg);
          console.error(`${LOG_PREFIX} ${errorMsg}`);
        }
      }
    }

    console.log(`${LOG_PREFIX} Demo accounts cleanup completed: ${result.removedAccounts} accounts processed`);

  } catch (error) {
    const errorMsg = `Account cleanup failed: ${error}`;
    result.errors.push(errorMsg);
    console.error(`${LOG_PREFIX} ${errorMsg}`);
  }

  return result;
}

/**
 * Comprehensive cleanup that removes all demo data
 */
export async function cleanupAllDemoData(): Promise<CleanupResult> {
  console.log(`${LOG_PREFIX} Starting comprehensive demo data cleanup...`);
  
  const movementsResult = await removeDemoMovements();
  const accountsResult = await removeDemoAccounts();

  const totalResult: CleanupResult = {
    removedMovements: movementsResult.removedMovements + accountsResult.removedMovements,
    removedAccounts: accountsResult.removedAccounts,
    accountsProcessed: accountsResult.accountsProcessed,
    errors: [...movementsResult.errors, ...accountsResult.errors]
  };

  // Show user-friendly toast notification
  if (totalResult.removedMovements > 0 || totalResult.removedAccounts > 0) {
    toast.success(
      `Limpieza completada: ${totalResult.removedMovements} movimientos y ${totalResult.removedAccounts} cuentas demo eliminados`
    );
  } else {
    toast.success('No se encontraron datos demo para eliminar');
  }

  if (totalResult.errors.length > 0) {
    toast.error(`Cleanup completado con ${totalResult.errors.length} errores`);
  }

  console.log(`${LOG_PREFIX} Comprehensive cleanup completed:`, totalResult);
  return totalResult;
}

/**
 * Validates that an account should not have default movements
 * This function should be called after creating a new account
 */
export async function validateNoDefaultMovements(accountId: number): Promise<boolean> {
  try {
    const db = await initDB();
    
    // Get the account
    const account = await db.get('accounts', accountId);
    if (!account) {
      console.warn(`${LOG_PREFIX} Account ${accountId} not found for validation`);
      return false;
    }

    // Check if it's a demo account
    if (isDemoAccount(account)) {
      console.warn(`${LOG_PREFIX} Account ${accountId} appears to be a demo account`);
      return false;
    }

    // Get movements for this account
    const movements = await db.getAllFromIndex('movements', 'accountId', accountId);
    
    // Check if any movements were created automatically
    const suspiciousMovements = movements.filter(movement => 
      isDemoMovement(movement) || 
      (movement.origin === 'Manual' && !movement.createdAt) // No creation timestamp
    );

    if (suspiciousMovements.length > 0) {
      console.warn(`${LOG_PREFIX} Found ${suspiciousMovements.length} suspicious movements for account ${accountId}`);
      
      // Remove suspicious movements
      for (const movement of suspiciousMovements) {
        if (movement.id) {
          await db.delete('movements', movement.id);
          console.log(`${LOG_PREFIX} Removed suspicious movement: ${movement.description}`);
        }
      }
      
      return false;
    }

    console.log(`${LOG_PREFIX} Account ${accountId} validation passed - no default movements found`);
    return true;

  } catch (error) {
    console.error(`${LOG_PREFIX} Error validating account ${accountId}:`, error);
    return false;
  }
}

/**
 * Enhanced account creation validation hook
 * Should be called every time a new account is created
 */
export async function ensureCleanAccountCreation(accountId: number): Promise<void> {
  console.log(`${LOG_PREFIX} Ensuring clean creation for account ${accountId}`);
  
  // Wait a short moment for any async operations to complete
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const isClean = await validateNoDefaultMovements(accountId);
  
  if (!isClean) {
    console.warn(`${LOG_PREFIX} Account ${accountId} had suspicious data that was cleaned up`);
  }
  
  console.log(`${LOG_PREFIX} Account ${accountId} creation validation completed`);
}