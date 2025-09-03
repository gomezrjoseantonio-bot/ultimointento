import { ParsedMovement } from '../types/bankProfiles';

/**
 * Generate a hash for duplicate detection based on date, amount, and normalized description
 * According to requirements: hash by (date_posted + amount + description_normalized)
 */
export function generateMovementHash(movement: ParsedMovement): string {
  // Normalize description for comparison
  const normalizedDescription = normalizeDescription(movement.description);
  
  // Format date as YYYY-MM-DD
  const dateStr = movement.date.toISOString().split('T')[0];
  
  // Format amount with 2 decimal places
  const amountStr = movement.amount.toFixed(2);
  
  // Create hash string
  const hashString = `${dateStr}|${amountStr}|${normalizedDescription}`;
  
  // Simple hash function (could be replaced with crypto.subtle.digest in production)
  return btoa(hashString).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
}

/**
 * Normalize description for consistent duplicate detection
 */
function normalizeDescription(description: string): string {
  if (!description) return '';
  
  return description
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();
}

/**
 * Detect duplicates in an array of movements
 */
export function detectDuplicates(movements: ParsedMovement[]): ParsedMovement[] {
  const hashMap = new Map<string, number>();
  
  // First pass: generate hashes and count occurrences
  movements.forEach((movement, index) => {
    const hash = generateMovementHash(movement);
    movement.duplicateHash = hash;
    
    if (hashMap.has(hash)) {
      hashMap.set(hash, hashMap.get(hash)! + 1);
    } else {
      hashMap.set(hash, 1);
    }
  });
  
  // Second pass: mark duplicates
  movements.forEach(movement => {
    const count = hashMap.get(movement.duplicateHash!);
    movement.isDuplicate = count! > 1;
  });
  
  return movements;
}

/**
 * Filter out duplicate movements, keeping only the first occurrence
 */
export function removeDuplicates(movements: ParsedMovement[]): ParsedMovement[] {
  const seenHashes = new Set<string>();
  
  return movements.filter(movement => {
    const hash = movement.duplicateHash || generateMovementHash(movement);
    
    if (seenHashes.has(hash)) {
      return false; // Skip duplicate
    }
    
    seenHashes.add(hash);
    return true; // Keep first occurrence
  });
}

/**
 * Get statistics about duplicates in the movements
 */
export function getDuplicateStats(movements: ParsedMovement[]): {
  total: number;
  duplicates: number;
  unique: number;
  duplicateGroups: number;
} {
  const hashCounts = new Map<string, number>();
  
  movements.forEach(movement => {
    const hash = movement.duplicateHash || generateMovementHash(movement);
    hashCounts.set(hash, (hashCounts.get(hash) || 0) + 1);
  });
  
  const duplicateGroups = Array.from(hashCounts.values()).filter(count => count > 1).length;
  const duplicates = movements.filter(m => m.isDuplicate).length;
  
  return {
    total: movements.length,
    duplicates,
    unique: movements.length - duplicates,
    duplicateGroups
  };
}