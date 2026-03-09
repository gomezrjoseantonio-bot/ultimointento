// ATLAS HORIZON - Auto Destination Inference Service
// Implements exact requirements for autodestino + conciliación futura

import { OCRExtractionResult, PropertyDetectionResult } from '../types/inboxTypes';

export interface AutoDestinationResult {
  destino_preferido: 'tesoreria_movimientos' | 'inmuebles_gastos' | 'personal_gastos' | null;
  destino_text: string;
  inmueble_id?: string;
  cuenta_id?: string;
  confidence: number;
  reasoning: string;
  conciliacion_pendiente?: boolean;
}

// Mock property data for address/CUPS matching
const MOCK_PROPERTIES = [
  { id: 'inmueble_1', address: 'C/ Mayor 123, Madrid', cups: 'ES0021000000000001XX' },
  { id: 'inmueble_2', address: 'Av. Castellana 456, Madrid', cups: 'ES0021000000000002XX' },
  { id: 'inmueble_3', address: 'Plaza España 789, Barcelona', cups: 'ES0021000000000003XX' }
];

// Mock bank accounts for IBAN matching
const MOCK_BANK_ACCOUNTS = [
  { id: 'cuenta_1', iban_mask: '****1234', full_iban: 'ES9121000418401234567890' },
  { id: 'cuenta_2', iban_mask: '****5678', full_iban: 'ES9121000418405678901234' },
  { id: 'cuenta_3', iban_mask: '****9012', full_iban: 'ES9121000418409012345678' }
];

// Known supplier categories for auto-classification
const SUPPLIER_CATEGORIES = {
  'iberdrola': 'suministros',
  'endesa': 'suministros',
  'naturgy': 'suministros',
  'vodafone': 'suministros',
  'movistar': 'suministros',
  'orange': 'suministros',
  'wekiwi': 'suministros'
};

/**
 * Infer auto-destination following exact requirements:
 * - If IBAN match → Tesorería > Movimientos (conciliación)
 * - If service_address/CUPS match → Inmuebles > Gastos
 * - If both → prioritize Inmueble, save IBAN for conciliación
 */
export async function inferAutoDestination(
  ocrData: OCRExtractionResult,
  propertyDetection: PropertyDetectionResult
): Promise<AutoDestinationResult> {
  
  console.log('[AutoDestination] Starting inference:', {
    supplier: ocrData.supplier_name,
    amount: ocrData.total_amount,
    service_address: ocrData.service_address,
    iban_mask: ocrData.iban_mask,
    inmueble_id: propertyDetection.inmueble_id
  });

  // Check for IBAN match
  const ibanMatch = await checkIBANMatch(ocrData.iban_mask);
  
  // Check for property match (already done in propertyDetection)
  const propertyMatch = propertyDetection.inmueble_id !== null;

  // Apply priority rules
  if (propertyMatch && ibanMatch) {
    // Both matches → prioritize property, mark for conciliación
    return {
      destino_preferido: 'inmuebles_gastos',
      destino_text: `Inmuebles › Gastos › ${getCategoryFromSupplier(ocrData.supplier_name)}`,
      inmueble_id: propertyDetection.inmueble_id!,
      cuenta_id: ibanMatch.cuenta_id,
      confidence: Math.min(propertyDetection.confidence, ibanMatch.confidence),
      reasoning: `Detectado inmueble por ${propertyDetection.matchMethod} y cuenta bancaria. Prioridad: inmueble para fiscalidad.`,
      conciliacion_pendiente: true
    };
  }

  if (propertyMatch) {
    // Only property match
    return {
      destino_preferido: 'inmuebles_gastos',
      destino_text: `Inmuebles › Gastos › ${getCategoryFromSupplier(ocrData.supplier_name)}`,
      inmueble_id: propertyDetection.inmueble_id!,
      confidence: propertyDetection.confidence,
      reasoning: `Detectado inmueble por ${propertyDetection.matchMethod}`,
      conciliacion_pendiente: false
    };
  }

  if (ibanMatch) {
    // Only IBAN match
    return {
      destino_preferido: 'tesoreria_movimientos',
      destino_text: 'Tesorería › Movimientos',
      cuenta_id: ibanMatch.cuenta_id,
      confidence: ibanMatch.confidence,
      reasoning: `Detectada cuenta bancaria por IBAN`,
      conciliacion_pendiente: true
    };
  }

  // No matches → default to personal
  return {
    destino_preferido: 'personal_gastos',
    destino_text: `Personal › Gastos › ${getCategoryFromSupplier(ocrData.supplier_name)}`,
    confidence: 0.5,
    reasoning: 'Sin coincidencias específicas, enviado a gastos personales',
    conciliacion_pendiente: false
  };
}

/**
 * Check if IBAN mask matches any known account
 */
async function checkIBANMatch(iban_mask?: string): Promise<{ cuenta_id: string; confidence: number } | null> {
  if (!iban_mask) return null;

  const account = MOCK_BANK_ACCOUNTS.find(acc => acc.iban_mask === iban_mask);
  if (account) {
    return {
      cuenta_id: account.id,
      confidence: 0.95 // High confidence for exact IBAN match
    };
  }

  return null;
}

/**
 * Get category suggestion from supplier name
 */
function getCategoryFromSupplier(supplier_name?: string): string {
  if (!supplier_name) return 'Otros';

  const normalizedSupplier = supplier_name.toLowerCase();
  
  for (const [supplier, category] of Object.entries(SUPPLIER_CATEGORIES)) {
    if (normalizedSupplier.includes(supplier)) {
      return category === 'suministros' ? 'Suministros' : 'Otros';
    }
  }

  return 'Otros';
}

/**
 * Normalize address for matching (remove accents, normalize case, etc.)
 */
export function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/\b(calle|c\/|avenida|av\.?|plaza|pl\.?)\b/g, '') // Remove common abbreviations
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Calculate address similarity score
 */
export function calculateAddressSimilarity(address1: string, address2: string): number {
  const norm1 = normalizeAddress(address1);
  const norm2 = normalizeAddress(address2);
  
  // Simple word-based similarity
  const words1 = norm1.split(' ').filter(w => w.length > 2);
  const words2 = norm2.split(' ').filter(w => w.length > 2);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  let matches = 0;
  for (const word1 of words1) {
    if (words2.some(word2 => 
      word1.includes(word2) || word2.includes(word1) || 
      levenshteinDistance(word1, word2) <= 1
    )) {
      matches++;
    }
  }
  
  return matches / Math.max(words1.length, words2.length);
}

/**
 * Simple Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}