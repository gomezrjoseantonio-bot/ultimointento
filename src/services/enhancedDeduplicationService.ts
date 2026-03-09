/**
 * ATLAS HORIZON - Enhanced Deduplication Service
 * 
 * Implements idempotent deduplication per problem statement section 3:
 * - Hash-based deduplication: hash(account_id, date, amount, normalize(description), bank_ref?)
 * - Skip existing duplicates and count them
 * - Normalize descriptions for consistent comparison
 */

import { initDB, Movement } from './db';

const LOG_PREFIX = '[DEDUP]';

/**
 * Simple hash function for browser compatibility
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Normalize description for consistent comparison
 */
function normalizeDescription(description: string): string {
  if (!description) return '';
  
  return description
    .trim()                           // Remove leading/trailing whitespace
    .replace(/\s+/g, ' ')            // Collapse multiple spaces to single space
    .toUpperCase()                   // Convert to uppercase
    .replace(/[^\w\s]/g, '')         // Remove special characters except alphanumeric and spaces
    .replace(/\b(THE|EL|LA|DE|DEL|Y|AND|&)\b/g, '') // Remove common articles/conjunctions
    .trim();
}

/**
 * Generate unique hash for movement
 */
function generateMovementHash(
  accountId: number,
  date: string,
  amount: number,
  description: string,
  bankRef?: string
): string {
  const normalizedDesc = normalizeDescription(description);
  
  // Create deterministic string for hashing
  const hashInput = [
    accountId.toString(),
    date,
    amount.toFixed(2), // Ensure consistent decimal representation
    normalizedDesc,
    bankRef || ''
  ].join('|');
  
  return simpleHash(hashInput);
}

/**
 * Interface for movement to be checked
 */
export interface MovementToCheck {
  accountId: number;
  date: string;
  amount: number;
  description: string;
  bank_ref?: string;
  [key: string]: any; // Allow additional fields
}

/**
 * Deduplication result
 */
export interface DeduplicationResult {
  unique: MovementToCheck[];
  duplicates: MovementToCheck[];
  duplicateHashes: string[];
  summary: {
    total: number;
    unique: number;
    duplicates: number;
  };
}

/**
 * Check for duplicates in existing database
 */
async function getExistingHashes(): Promise<Set<string>> {
  const db = await initDB();
  const existingHashes = new Set<string>();
  
  try {
    const allMovements = await db.getAll('movements');
    
    for (const movement of allMovements) {
      if (movement.accountId && movement.date && movement.amount !== undefined && movement.description) {
        const hash = generateMovementHash(
          movement.accountId,
          movement.date,
          movement.amount,
          movement.description,
          movement.bank_ref
        );
        existingHashes.add(hash);
      }
    }
    
    console.info(`${LOG_PREFIX} Loaded ${existingHashes.size} existing movement hashes`);
    return existingHashes;
    
  } catch (error) {
    console.error(`${LOG_PREFIX} Error loading existing hashes:`, error);
    return new Set();
  }
}

/**
 * Perform deduplication on array of movements
 */
export async function deduplicateMovements(movements: MovementToCheck[]): Promise<DeduplicationResult> {
  console.info(`${LOG_PREFIX} Starting deduplication for ${movements.length} movements`);
  
  try {
    const existingHashes = await getExistingHashes();
    const seenHashes = new Set<string>();
    
    const unique: MovementToCheck[] = [];
    const duplicates: MovementToCheck[] = [];
    const duplicateHashes: string[] = [];
    
    for (const movement of movements) {
      // Skip movements with missing required fields
      if (!movement.accountId || !movement.date || movement.amount === undefined || !movement.description) {
        console.warn(`${LOG_PREFIX} Skipping movement with missing fields:`, {
          accountId: movement.accountId,
          date: movement.date,
          amount: movement.amount,
          hasDescription: !!movement.description
        });
        continue;
      }
      
      const hash = generateMovementHash(
        movement.accountId,
        movement.date,
        movement.amount,
        movement.description,
        movement.bank_ref
      );
      
      // Check against existing movements in database
      if (existingHashes.has(hash)) {
        duplicates.push(movement);
        duplicateHashes.push(hash);
        console.debug(`${LOG_PREFIX} Found duplicate (existing):`, {
          hash: hash.substring(0, 8),
          amount: movement.amount,
          description: movement.description.substring(0, 30)
        });
        continue;
      }
      
      // Check against movements in current batch
      if (seenHashes.has(hash)) {
        duplicates.push(movement);
        duplicateHashes.push(hash);
        console.debug(`${LOG_PREFIX} Found duplicate (batch):`, {
          hash: hash.substring(0, 8),
          amount: movement.amount,
          description: movement.description.substring(0, 30)
        });
        continue;
      }
      
      // This is a unique movement
      seenHashes.add(hash);
      unique.push(movement);
    }
    
    const result: DeduplicationResult = {
      unique,
      duplicates,
      duplicateHashes,
      summary: {
        total: movements.length,
        unique: unique.length,
        duplicates: duplicates.length
      }
    };
    
    console.info(`${LOG_PREFIX} Deduplication complete`, {
      total: movements.length,
      unique: unique.length,
      duplicates: duplicates.length,
      duplicateRate: ((duplicates.length / movements.length) * 100).toFixed(1) + '%'
    });
    
    return result;
    
  } catch (error) {
    console.error(`${LOG_PREFIX} Error during deduplication:`, error);
    
    // Return all movements as unique if deduplication fails
    return {
      unique: movements,
      duplicates: [],
      duplicateHashes: [],
      summary: {
        total: movements.length,
        unique: movements.length,
        duplicates: 0
      }
    };
  }
}

/**
 * Quick duplicate check for single movement
 */
export async function isDuplicateMovement(movement: MovementToCheck): Promise<boolean> {
  try {
    if (!movement.accountId || !movement.date || movement.amount === undefined || !movement.description) {
      return false; // Can't check movements with missing fields
    }
    
    const hash = generateMovementHash(
      movement.accountId,
      movement.date,
      movement.amount,
      movement.description,
      movement.bank_ref
    );
    
    const existingHashes = await getExistingHashes();
    return existingHashes.has(hash);
    
  } catch (error) {
    console.error(`${LOG_PREFIX} Error checking duplicate:`, error);
    return false;
  }
}

/**
 * Store movement hash to prevent future duplicates
 */
export async function storeMovementHash(movement: Movement): Promise<void> {
  // This is automatically handled when movements are stored in the database
  // The getExistingHashes() function will pick them up on next deduplication run
}

/**
 * Get duplicate statistics
 */
export async function getDuplicateStatistics(): Promise<{
  totalMovements: number;
  uniqueHashes: number;
  duplicateRate: number;
}> {
  try {
    const db = await initDB();
    const allMovements = await db.getAll('movements');
    const hashes = new Set<string>();
    
    for (const movement of allMovements) {
      if (movement.accountId && movement.date && movement.amount !== undefined && movement.description) {
        const hash = generateMovementHash(
          movement.accountId,
          movement.date,
          movement.amount,
          movement.description,
          movement.bank_ref
        );
        hashes.add(hash);
      }
    }
    
    const duplicateCount = allMovements.length - hashes.size;
    const duplicateRate = allMovements.length > 0 ? (duplicateCount / allMovements.length) * 100 : 0;
    
    return {
      totalMovements: allMovements.length,
      uniqueHashes: hashes.size,
      duplicateRate
    };
    
  } catch (error) {
    console.error(`${LOG_PREFIX} Error getting duplicate statistics:`, error);
    return {
      totalMovements: 0,
      uniqueHashes: 0,
      duplicateRate: 0
    };
  }
}

/**
 * Find potential duplicates with different criteria (for manual review)
 */
export async function findPotentialDuplicates(
  tolerance: { 
    days?: number;     // ±N days
    amount?: number;   // ±N euros
    description?: number; // Levenshtein distance
  } = {}
): Promise<Array<{ 
  movements: Movement[]; 
  reason: string; 
  confidence: number; 
}>> {
  const db = await initDB();
  const defaults = { days: 1, amount: 0.01, description: 3 };
  const config = { ...defaults, ...tolerance };
  
  try {
    const allMovements = await db.getAll('movements');
    const potentialDuplicates: Array<{ movements: Movement[]; reason: string; confidence: number; }> = [];
    
    // Group movements by account for efficiency
    const movementsByAccount = allMovements.reduce((acc, movement) => {
      if (!acc[movement.accountId]) acc[movement.accountId] = [];
      acc[movement.accountId].push(movement);
      return acc;
    }, {} as Record<number, Movement[]>);
    
    // Check each account separately
    for (const [accountId, movements] of Object.entries(movementsByAccount)) {
      const accountMovements = (movements as Movement[]).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      for (let i = 0; i < accountMovements.length; i++) {
        for (let j = i + 1; j < accountMovements.length; j++) {
          const movement1 = accountMovements[i];
          const movement2 = accountMovements[j];
          
          // Date proximity check
          const date1 = new Date(movement1.date).getTime();
          const date2 = new Date(movement2.date).getTime();
          const daysDiff = Math.abs(date1 - date2) / (1000 * 60 * 60 * 24);
          
          if (daysDiff > config.days) continue;
          
          // Amount proximity check
          const amountDiff = Math.abs(movement1.amount - movement2.amount);
          if (amountDiff > config.amount) continue;
          
          // Description similarity check (simplified)
          const desc1 = normalizeDescription(movement1.description || '');
          const desc2 = normalizeDescription(movement2.description || '');
          const descSimilarity = desc1 === desc2 ? 1 : (desc1.includes(desc2) || desc2.includes(desc1) ? 0.7 : 0);
          
          if (descSimilarity > 0.5) {
            const confidence = Math.min(100, 
              (1 - daysDiff / config.days) * 30 +
              (1 - amountDiff / config.amount) * 40 +
              descSimilarity * 30
            );
            
            potentialDuplicates.push({
              movements: [movement1, movement2],
              reason: `Similar movements: ${daysDiff.toFixed(1)} days apart, ${amountDiff.toFixed(2)}€ difference`,
              confidence
            });
          }
        }
      }
    }
    
    // Sort by confidence and return top candidates
    return potentialDuplicates
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 50); // Limit to top 50 potential duplicates
    
  } catch (error) {
    console.error(`${LOG_PREFIX} Error finding potential duplicates:`, error);
    return [];
  }
}