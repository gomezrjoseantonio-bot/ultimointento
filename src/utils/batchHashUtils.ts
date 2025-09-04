/**
 * Batch Hash Utilities for FIX-EXTRACTOS
 * 
 * Generates SHA-256 hashes for bank statement file content to ensure idempotency
 * and prevent duplicate imports as per requirements.
 */

/**
 * Generate SHA-256 hash from file content for batch idempotency
 * According to requirements: hash_lote (SHA-256 del contenido)
 */
export async function generateBatchHash(file: File): Promise<string> {
  try {
    // Read file as ArrayBuffer for consistent hashing
    const arrayBuffer = await file.arrayBuffer();
    
    // Generate SHA-256 hash
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    
    // Convert to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
  } catch (error) {
    console.error('Error generating batch hash:', error);
    // Fallback to simple content-based hash if crypto.subtle fails
    return generateFallbackHash(file);
  }
}

/**
 * Fallback hash generation for environments without crypto.subtle
 */
async function generateFallbackHash(file: File): Promise<string> {
  const text = await file.text();
  
  // Simple hash based on file content + size + name
  let hash = 0;
  const str = `${file.name}_${file.size}_${text}`;
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(16);
}

/**
 * Check if a batch with the same hash already exists
 */
export async function checkBatchHashExists(hash: string, db: any): Promise<boolean> {
  try {
    const allBatches = await db.getAll('importBatches');
    return allBatches.some((batch: any) => batch.hashLote === hash);
  } catch (error) {
    console.error('Error checking batch hash:', error);
    return false;
  }
}