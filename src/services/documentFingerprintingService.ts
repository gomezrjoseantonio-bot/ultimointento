// H-HOTFIX: Document Fingerprinting Service
// Handles document fingerprinting for idempotent OCR processing

import { DocumentFingerprint } from '../types/inboxTypes';

/**
 * Simple SHA1 implementation for client-side use
 */
function sha1(data: string): string {
  // Simple hash implementation (for demo purposes)
  // In production, use crypto.subtle.digest or a proper crypto library
  let hash = 0;
  if (data.length === 0) return hash.toString(16);
  
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Normalize monetary amount for fingerprinting
 */
function normalizeAmount(amount: number | string | undefined): string {
  if (!amount) return '';
  
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return '';
  
  // Round to 2 decimals and format consistently
  return numAmount.toFixed(2);
}

/**
 * Normalize supplier name for fingerprinting
 */
function normalizeSupplierName(name: string | undefined): string {
  if (!name) return '';
  
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^\w\s]/g, ' ') // Replace special chars with spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Normalize supplier tax ID for fingerprinting
 */
function normalizeSupplierTaxId(taxId: string | undefined): string {
  if (!taxId) return '';
  
  return taxId
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, ''); // Remove all non-alphanumeric chars
}

/**
 * Normalize date for fingerprinting
 */
function normalizeDate(date: string | undefined): string {
  if (!date) return '';
  
  try {
    // Try to parse and format as YYYY-MM-DD
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) return '';
    
    return parsedDate.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

/**
 * Calculate document fingerprint for idempotent processing
 */
export function calculateDocumentFingerprint(
  fileBytes: ArrayBuffer | Uint8Array | string,
  ocrData: {
    total_amount?: number | string;
    issue_date?: string;
    supplier_tax_id?: string;
    supplier_name?: string;
  }
): DocumentFingerprint {
  
  // Calculate file hash
  const fileData = typeof fileBytes === 'string' 
    ? fileBytes 
    : Array.from(new Uint8Array(fileBytes)).map(b => String.fromCharCode(b)).join('');
  
  const file_hash = sha1(fileData);
  
  // Normalize extracted data
  const normalized_total = parseFloat(normalizeAmount(ocrData.total_amount)) || 0;
  const issue_date = normalizeDate(ocrData.issue_date);
  const supplier_tax_id = normalizeSupplierTaxId(ocrData.supplier_tax_id);
  const supplier_name_lower = normalizeSupplierName(ocrData.supplier_name);
  
  // Calculate document fingerprint based on business data
  const docData = [
    file_hash,
    normalized_total.toString(),
    issue_date,
    supplier_tax_id,
    supplier_name_lower
  ].join('||');
  
  const doc_fingerprint = sha1(docData);
  
  return {
    file_hash,
    doc_fingerprint,
    normalized_total,
    issue_date: issue_date || undefined,
    supplier_tax_id: supplier_tax_id || undefined,
    supplier_name_lower: supplier_name_lower || undefined
  };
}

/**
 * Check if two fingerprints match (for idempotent processing)
 */
export function fingerprintsMatch(fp1: DocumentFingerprint, fp2: DocumentFingerprint): boolean {
  return fp1.doc_fingerprint === fp2.doc_fingerprint;
}

/**
 * Create a simplified fingerprint for quick lookups
 */
export function createLookupKey(fingerprint: DocumentFingerprint): string {
  return fingerprint.doc_fingerprint;
}

/**
 * Extract file content for fingerprinting
 */
export async function extractFileContent(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Check if document with same fingerprint already exists
 */
export async function findExistingDocumentByFingerprint(
  fingerprint: string,
  db: any // IDBPDatabase
): Promise<any | null> {
  try {
    // Search in expensesH5 table for existing document with same fingerprint
    const tx = db.transaction(['expensesH5'], 'readonly');
    const store = tx.objectStore('expensesH5');
    const expenses = await store.getAll();
    
    return expenses.find((expense: any) => expense.doc_fingerprint === fingerprint) || null;
  } catch (error) {
    console.error('Error finding existing document by fingerprint:', error);
    return null;
  }
}