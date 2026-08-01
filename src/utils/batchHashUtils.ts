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
    const hashBuffer = await crypto?.subtle?.digest('SHA-256', arrayBuffer);

    // V6 · D1 bis · un `digest` que NO lanza pero devuelve algo inservible es el
    // caso peligroso: hay stubs de `crypto.subtle` (jsdom, algún entorno
    // embebido) que resuelven a `undefined`. Sin esta comprobación,
    // `new Uint8Array(undefined)` da un array vacío, `join('')` da `''` y la
    // función devolvería un hash vacío SIN pasar por el catch — idempotencia
    // perdida en silencio. Si el resultado no sirve, se va al respaldo.
    const hashHex = bufferToHex(hashBuffer);
    if (hashHex) return hashHex;

    return generateFallbackHash(file);
  } catch (error) {
    console.error('Error generating batch hash:', error);
    // Fallback to simple content-based hash if crypto.subtle fails
    return generateFallbackHash(file);
  }
}

/** Hex de un ArrayBuffer, o `''` si no es un buffer con bytes. */
function bufferToHex(buffer: ArrayBuffer | undefined | null): string {
  if (!buffer || typeof (buffer as ArrayBuffer).byteLength !== 'number') return '';
  const bytes = new Uint8Array(buffer);
  if (bytes.length === 0) return '';
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
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
      return bytesToBinaryString(new Uint8Array(await file.arrayBuffer()));
    }
  } catch {
    /* sin forma de leer */
  }
  return null;
}

/**
 * Bytes → string, por bloques.
 *
 * `String.fromCharCode(...bytes)` sobre un extracto de unos cientos de KB pasa
 * cientos de miles de argumentos y revienta con `RangeError: Maximum call stack
 * size exceeded`. Como el llamante captura y degrada a "sin hash", el fallo
 * sería SILENCIOSO: se perdería la idempotencia por fichero justo en los
 * extractos grandes, que son los que más duele duplicar.
 */
function bytesToBinaryString(bytes: Uint8Array): string {
  const CHUNK = 0x8000; // 32 KB · holgado bajo el límite de argumentos
  let out = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return out;
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