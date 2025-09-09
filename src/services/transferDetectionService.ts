/**
 * ATLAS HORIZON - Transfer Detection Service
 * 
 * Implements transfer detection per problem statement section 7:
 * - Detect symmetric movements (same amount, opposite sign) between user accounts
 * - Date window ±2 days and keyword matching
 * - Group transfers with transfer_group_id
 */

import { initDB, Movement, Account, MatchingConfiguration } from './db';

const LOG_PREFIX = '[TRANSFER-DETECT]';

// Generate unique transfer group ID
function generateTransferGroupId(): string {
  return `trf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export interface TransferPair {
  debitMovement: Movement;   // The outgoing movement (negative amount)
  creditMovement: Movement;  // The incoming movement (positive amount)
  transferGroupId: string;
  confidence: number;        // 0-100
  detectionCriteria: string[];
}

export interface TransferDetectionResult {
  detectedTransfers: TransferPair[];
  pendingTransfers: Movement[]; // Movements waiting for their pair
  summary: {
    total: number;
    detected: number;
    pending: number;
  };
}

/**
 * Check if description contains transfer keywords
 */
function containsTransferKeywords(description: string, keywords: string[]): boolean {
  const desc = description.toUpperCase();
  return keywords.some(keyword => desc.includes(keyword.toUpperCase()));
}

/**
 * Get user accounts (to identify transfers between owned accounts)
 */
async function getUserAccounts(): Promise<Account[]> {
  const db = await initDB();
  
  try {
    const accounts = await db.getAll('accounts');
    // Filter only active accounts
    return accounts.filter(account => !account.deleted_at);
  } catch (error) {
    console.error(`${LOG_PREFIX} Error getting user accounts:`, error);
    return [];
  }
}

/**
 * Check if two movements form a valid transfer pair
 */
function isValidTransferPair(
  movement1: Movement, 
  movement2: Movement, 
  config: MatchingConfiguration,
  userAccountIds: number[]
): { isValid: boolean; criteria: string[]; confidence: number } {
  const criteria: string[] = [];
  let confidence = 0;

  // Both movements must be in user accounts
  if (!userAccountIds.includes(movement1.accountId) || !userAccountIds.includes(movement2.accountId)) {
    return { isValid: false, criteria: [], confidence: 0 };
  }

  // Must be different accounts
  if (movement1.accountId === movement2.accountId) {
    return { isValid: false, criteria: [], confidence: 0 };
  }

  // Amounts must be symmetric (same absolute value, opposite signs)
  const amount1 = Math.abs(movement1.amount);
  const amount2 = Math.abs(movement2.amount);
  const amountDifference = Math.abs(amount1 - amount2);
  const amountTolerance = Math.max(amount1, amount2) * 0.01; // 1% tolerance for rounding

  if (amountDifference <= amountTolerance) {
    confidence += 40;
    criteria.push('symmetric_amounts');
  } else {
    return { isValid: false, criteria: [], confidence: 0 };
  }

  // Must have opposite signs
  if ((movement1.amount > 0 && movement2.amount > 0) || (movement1.amount < 0 && movement2.amount < 0)) {
    return { isValid: false, criteria: [], confidence: 0 };
  }
  confidence += 30;
  criteria.push('opposite_signs');

  // Date proximity (within transfer date window)
  const date1 = new Date(movement1.date).getTime();
  const date2 = new Date(movement2.date).getTime();
  const daysDifference = Math.abs(date1 - date2) / (1000 * 60 * 60 * 24);

  if (daysDifference <= config.transferDateWindow) {
    const dateScore = Math.max(0, 20 - (daysDifference / config.transferDateWindow) * 10);
    confidence += dateScore;
    criteria.push(`date_proximity_${daysDifference.toFixed(1)}days`);
  } else {
    return { isValid: false, criteria: [], confidence: 0 };
  }

  // Transfer keywords in description (bonus points)
  const hasKeywords1 = containsTransferKeywords(movement1.description || '', config.transferKeywords);
  const hasKeywords2 = containsTransferKeywords(movement2.description || '', config.transferKeywords);

  if (hasKeywords1 || hasKeywords2) {
    confidence += 10;
    criteria.push('transfer_keywords');
  }

  // Reference matching (if available)
  if (movement1.reference && movement2.reference && movement1.reference === movement2.reference) {
    confidence += 15;
    criteria.push('reference_match');
  }

  return {
    isValid: confidence >= 70, // Minimum confidence threshold
    criteria,
    confidence: Math.min(100, confidence)
  };
}

/**
 * Detect transfers in a set of movements
 */
export async function detectTransfers(movements: Movement[]): Promise<TransferDetectionResult> {
  console.info(`${LOG_PREFIX} Starting transfer detection for ${movements.length} movements`);

  try {
    // Get matching configuration
    const db = await initDB();
    const configs = await db.getAll('matchingConfiguration');
    const config = configs[0] || {
      transferDateWindow: 2,
      transferKeywords: ['TRASPASO', 'TRANSFERENCIA', 'ENVÍO ENTRE CUENTAS', 'TRANSFER', 'ENVIO']
    };

    // Get user accounts
    const userAccounts = await getUserAccounts();
    const userAccountIds = userAccounts.map(acc => acc.id!);

    console.info(`${LOG_PREFIX} Found ${userAccountIds.length} user accounts for transfer detection`);

    const detectedTransfers: TransferPair[] = [];
    const processedMovements = new Set<number>();

    // Sort movements by date to process chronologically
    const sortedMovements = [...movements].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Check each movement against others for transfer pairs
    for (let i = 0; i < sortedMovements.length; i++) {
      const movement1 = sortedMovements[i];
      
      if (processedMovements.has(movement1.id!)) continue;
      if (!userAccountIds.includes(movement1.accountId)) continue;

      // Look for matching movement within date window
      const movement1Date = new Date(movement1.date).getTime();
      const windowStart = movement1Date - (config.transferDateWindow * 24 * 60 * 60 * 1000);
      const windowEnd = movement1Date + (config.transferDateWindow * 24 * 60 * 60 * 1000);

      for (let j = i + 1; j < sortedMovements.length; j++) {
        const movement2 = sortedMovements[j];
        
        if (processedMovements.has(movement2.id!)) continue;
        if (!userAccountIds.includes(movement2.accountId)) continue;

        const movement2Date = new Date(movement2.date).getTime();
        
        // Skip if outside date window
        if (movement2Date > windowEnd) break;
        if (movement2Date < windowStart) continue;

        // Check if they form a valid transfer pair
        const validation = isValidTransferPair(movement1, movement2, config, userAccountIds);
        
        if (validation.isValid) {
          const transferGroupId = generateTransferGroupId();
          
          // Determine which is debit (outgoing) and credit (incoming)
          const debitMovement = movement1.amount < 0 ? movement1 : movement2;
          const creditMovement = movement1.amount > 0 ? movement1 : movement2;

          detectedTransfers.push({
            debitMovement,
            creditMovement,
            transferGroupId,
            confidence: validation.confidence,
            detectionCriteria: validation.criteria
          });

          processedMovements.add(movement1.id!);
          processedMovements.add(movement2.id!);

          console.info(`${LOG_PREFIX} Detected transfer pair`, {
            transferGroupId,
            debitAccount: debitMovement.accountId,
            creditAccount: creditMovement.accountId,
            amount: Math.abs(debitMovement.amount),
            confidence: validation.confidence,
            criteria: validation.criteria
          });

          break; // Found pair for movement1, move to next
        }
      }
    }

    // Find pending transfers (movements that look like transfers but missing pair)
    const pendingTransfers = movements.filter(movement => {
      if (processedMovements.has(movement.id!)) return false;
      if (!userAccountIds.includes(movement.accountId)) return false;
      
      // Check if it looks like a transfer based on keywords or description
      return containsTransferKeywords(movement.description || '', config.transferKeywords);
    });

    const result: TransferDetectionResult = {
      detectedTransfers,
      pendingTransfers,
      summary: {
        total: movements.length,
        detected: detectedTransfers.length * 2, // Each transfer involves 2 movements
        pending: pendingTransfers.length
      }
    };

    console.info(`${LOG_PREFIX} Transfer detection complete`, {
      total: movements.length,
      transfers: detectedTransfers.length,
      pending: pendingTransfers.length
    });

    return result;

  } catch (error) {
    console.error(`${LOG_PREFIX} Error during transfer detection:`, error);
    return {
      detectedTransfers: [],
      pendingTransfers: [],
      summary: { total: movements.length, detected: 0, pending: 0 }
    };
  }
}

/**
 * Apply transfer detection results to movements
 */
export async function applyTransferDetection(result: TransferDetectionResult): Promise<void> {
  const db = await initDB();

  try {
    console.info(`${LOG_PREFIX} Applying transfer detection results`);

    // Update detected transfer pairs
    for (const transfer of result.detectedTransfers) {
      const updatedDebit: Movement = {
        ...transfer.debitMovement,
        is_transfer: true,
        transfer_group_id: transfer.transferGroupId,
        unifiedStatus: 'conciliado', // Transfers are automatically reconciled
        updatedAt: new Date().toISOString()
      };

      const updatedCredit: Movement = {
        ...transfer.creditMovement,
        is_transfer: true,
        transfer_group_id: transfer.transferGroupId,
        unifiedStatus: 'conciliado', // Transfers are automatically reconciled
        updatedAt: new Date().toISOString()
      };

      await db.put('movements', updatedDebit);
      await db.put('movements', updatedCredit);
    }

    // Mark pending transfers
    for (const pendingMovement of result.pendingTransfers) {
      const updated: Movement = {
        ...pendingMovement,
        is_transfer: true,
        transfer_group_id: `pending_${pendingMovement.id}`,
        unifiedStatus: 'no_planificado', // Pending until pair is found
        updatedAt: new Date().toISOString()
      };

      await db.put('movements', updated);
    }

    console.info(`${LOG_PREFIX} Applied transfer detection - ${result.detectedTransfers.length} pairs, ${result.pendingTransfers.length} pending`);

  } catch (error) {
    console.error(`${LOG_PREFIX} Error applying transfer detection:`, error);
    throw error;
  }
}

/**
 * Check for pending transfer completions when new movements arrive
 */
export async function checkPendingTransferCompletions(newMovements: Movement[]): Promise<void> {
  console.info(`${LOG_PREFIX} Checking for pending transfer completions`);

  try {
    const db = await initDB();
    
    // Get all pending transfers
    const allMovements = await db.getAll('movements');
    const pendingTransfers = allMovements.filter(m => 
      m.is_transfer && 
      m.transfer_group_id?.startsWith('pending_') && 
      m.unifiedStatus === 'no_planificado'
    );

    if (pendingTransfers.length === 0) {
      return;
    }

    console.info(`${LOG_PREFIX} Found ${pendingTransfers.length} pending transfers to check`);

    // Check each new movement against pending transfers
    for (const newMovement of newMovements) {
      for (const pendingTransfer of pendingTransfers) {
        // Try to pair them using the same validation logic
        const configs = await db.getAll('matchingConfiguration');
        const config = configs[0] || {
          transferDateWindow: 2,
          transferKeywords: ['TRASPASO', 'TRANSFERENCIA', 'ENVÍO ENTRE CUENTAS', 'TRANSFER', 'ENVIO']
        };

        const userAccounts = await getUserAccounts();
        const userAccountIds = userAccounts.map(acc => acc.id!);

        const validation = isValidTransferPair(
          newMovement, 
          pendingTransfer, 
          config, 
          userAccountIds
        );

        if (validation.isValid) {
          const transferGroupId = generateTransferGroupId();
          
          // Complete the transfer pair
          const debitMovement = newMovement.amount < 0 ? newMovement : pendingTransfer;
          const creditMovement = newMovement.amount > 0 ? newMovement : pendingTransfer;

          // Update both movements
          const updatedDebit: Movement = {
            ...debitMovement,
            is_transfer: true,
            transfer_group_id: transferGroupId,
            unifiedStatus: 'conciliado',
            updatedAt: new Date().toISOString()
          };

          const updatedCredit: Movement = {
            ...creditMovement,
            is_transfer: true,
            transfer_group_id: transferGroupId,
            unifiedStatus: 'conciliado',
            updatedAt: new Date().toISOString()
          };

          await db.put('movements', updatedDebit);
          await db.put('movements', updatedCredit);

          console.info(`${LOG_PREFIX} Completed pending transfer`, {
            transferGroupId,
            pendingId: pendingTransfer.id,
            newMovementId: newMovement.id,
            confidence: validation.confidence
          });

          break; // Found pair for this pending transfer
        }
      }
    }

  } catch (error) {
    console.error(`${LOG_PREFIX} Error checking pending transfer completions:`, error);
  }
}