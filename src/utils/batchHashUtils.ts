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
 *
 * V6 · D1 bis: el hash decide si un extracto ya se importó, así que un hash
 * MALO es peor que ninguno — bloquearía una importación legítima. Por eso:
 *   - se lee el contenido por `text()` o, si no está, por `arrayBuffer()`;
 *   - si no hay forma de leer los bytes, se devuelve `''` (= "sin hash") en vez
 *     de inventar uno con nombre+tamaño, que colisionaría entre ficheros
 *     distintos del mismo banco y mismo mes.
 * Con `''` el llamante degrada al comportamiento anterior (sin idempotencia por
 * fichero) en lugar de rechazar un extracto bueno.
 */
async function generateFallbackHash(file: File): Promise<string> {
  const content = await readFileContent(file);
  if (content === null) return '';

  // Simple hash based on file content + size + name
  let hash = 0;
  const str = `${file.name}_${file.size}_${content}`;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(16);
}

/** Contenido del fichero como texto, o `null` si el entorno no permite leerlo. */
async function readFileContent(file: File): Promise<string | null> {
  try {
    if (typeof file.text === 'function') return await file.text();
  } catch {
    /* sigue con arrayBuffer */
  }
  try {
    if (typeof file.arrayBuffer === 'function') {
      const buf = await file.arrayBuffer();
      return String.fromCharCode(...new Uint8Array(buf));
    }
  } catch {
    /* sin forma de leer */
  }
  return null;
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