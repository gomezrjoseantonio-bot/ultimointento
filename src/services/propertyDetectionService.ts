// ATLAS HORIZON - Property Detection Service
// Detects property by address or CUPS matching

import { PropertyDetectionResult, OCRExtractionResult } from '../types/inboxTypes';

/**
 * Detect property by matching address or CUPS from OCR data
 */
export async function detectProperty(ocrData: OCRExtractionResult): Promise<PropertyDetectionResult> {
  console.log('[PropertyDetection] Analyzing:', {
    service_address: ocrData.service_address,
    supplier_name: ocrData.supplier_name
  });

  // Try CUPS detection first (more reliable)
  const cupsResult = await detectByCUPS(ocrData);
  if (cupsResult.inmueble_id) {
    return cupsResult;
  }

  // Try address detection
  const addressResult = await detectByAddress(ocrData);
  if (addressResult.inmueble_id) {
    return addressResult;
  }

  // No match found
  return {
    inmueble_id: null,
    confidence: 0,
    matchMethod: 'none'
  };
}

/**
 * Detect property by CUPS (Código Universal de Punto de Suministro)
 */
async function detectByCUPS(ocrData: OCRExtractionResult): Promise<PropertyDetectionResult> {
  if (!ocrData.service_address) {
    return { inmueble_id: null, confidence: 0, matchMethod: 'none' };
  }

  // Extract CUPS pattern: ES + 4 digits + 16 alphanumeric
  const cupsPattern = /ES\d{4}[A-Z0-9]{16}/gi;
  const cupsMatches = ocrData.service_address.match(cupsPattern);

  if (cupsMatches && cupsMatches.length > 0) {
    const cups = cupsMatches[0];
    
    // TODO: Query database for property with this CUPS
    // For now, return mock data for development
    if (process.env.NODE_ENV === 'development') {
      return {
        inmueble_id: 'prop_123_cups',
        confidence: 0.95,
        matchMethod: 'cups',
        matchedText: cups
      };
    }
    
    // In production, query the properties database
    const property = await findPropertyByCUPS(cups);
    if (property) {
      return {
        inmueble_id: property.id,
        confidence: 0.95,
        matchMethod: 'cups',
        matchedText: cups
      };
    }
  }

  return { inmueble_id: null, confidence: 0, matchMethod: 'none' };
}

/**
 * Detect property by address matching
 */
async function detectByAddress(ocrData: OCRExtractionResult): Promise<PropertyDetectionResult> {
  if (!ocrData.service_address) {
    return { inmueble_id: null, confidence: 0, matchMethod: 'none' };
  }

  const address = normalizeAddress(ocrData.service_address);
  
  // TODO: Query database for properties and match addresses
  // For now, return mock data for development
  if (process.env.NODE_ENV === 'development') {
    // Mock address matching
    if (address.includes('mayor') && address.includes('123')) {
      return {
        inmueble_id: 'prop_456_address',
        confidence: 0.8,
        matchMethod: 'address',
        matchedText: ocrData.service_address
      };
    }
  }

  // In production, query the properties database
  const properties = await getAllProperties();
  const bestMatch = findBestAddressMatch(address, properties);

  if (bestMatch && bestMatch.confidence > 0.6) {
    return {
      inmueble_id: bestMatch.property.id,
      confidence: bestMatch.confidence,
      matchMethod: 'address',
      matchedText: ocrData.service_address
    };
  }

  return { inmueble_id: null, confidence: 0, matchMethod: 'none' };
}

/**
 * Normalize address for better matching
 */
function normalizeAddress(address: string): string {
  let normalized = address.toLowerCase();
  
  // Remove accents
  normalized = normalized
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/[ñ]/g, 'n');
  
  // Normalize common abbreviations
  normalized = normalized
    .replace(/\bcalle\b/g, 'c/')
    .replace(/\bavenida\b/g, 'av/')
    .replace(/\bplaza\b/g, 'pl/')
    .replace(/\bpaseo\b/g, 'ps/')
    .replace(/\bc\//g, 'calle')
    .replace(/\bav\//g, 'avenida')
    .replace(/\bpl\//g, 'plaza')
    .replace(/\bps\//g, 'paseo');
  
  // Remove extra spaces and punctuation
  normalized = normalized.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  
  return normalized;
}

/**
 * Find best address match among properties
 */
function findBestAddressMatch(
  targetAddress: string, 
  properties: any[]
): { property: any; confidence: number } | null {
  
  let bestMatch: { property: any; confidence: number } | null = null;
  
  for (const property of properties) {
    const propertyAddress = normalizeAddress(property.address || '');
    const confidence = calculateAddressSimilarity(targetAddress, propertyAddress);
    
    if (confidence > 0.6 && (!bestMatch || confidence > bestMatch.confidence)) {
      bestMatch = { property, confidence };
    }
  }
  
  return bestMatch;
}

/**
 * Calculate similarity between two addresses
 */
function calculateAddressSimilarity(address1: string, address2: string): number {
  const words1 = address1.split(/\s+/);
  const words2 = address2.split(/\s+/);
  
  // Check for exact matches of key components
  let exactMatches = 0;
  let totalComponents = Math.max(words1.length, words2.length);
  
  for (const word1 of words1) {
    if (word1.length > 2 && words2.some(word2 => word2.includes(word1) || word1.includes(word2))) {
      exactMatches++;
    }
  }
  
  // Street number matching (important)
  const number1 = extractStreetNumber(address1);
  const number2 = extractStreetNumber(address2);
  
  if (number1 && number2 && number1 === number2) {
    exactMatches += 2; // Give extra weight to street number matches
  }
  
  // Postal code matching (very important)
  const postal1 = extractPostalCode(address1);
  const postal2 = extractPostalCode(address2);
  
  if (postal1 && postal2 && postal1 === postal2) {
    exactMatches += 3; // Give high weight to postal code matches
  }
  
  return Math.min(1.0, exactMatches / totalComponents);
}

/**
 * Extract street number from address
 */
function extractStreetNumber(address: string): string | null {
  const numberMatch = address.match(/\b(\d+)\b/);
  return numberMatch ? numberMatch[1] : null;
}

/**
 * Extract postal code from address
 */
function extractPostalCode(address: string): string | null {
  // Spanish postal codes: 5 digits
  const postalMatch = address.match(/\b(\d{5})\b/);
  return postalMatch ? postalMatch[1] : null;
}

/**
 * Mock function to get all properties (replace with actual DB query)
 */
async function getAllProperties(): Promise<any[]> {
  // TODO: Replace with actual database query
  return [
    {
      id: 'prop_123',
      address: 'C/ Mayor 123, 28013 Madrid',
      postalCode: '28013',
      province: 'Madrid'
    },
    {
      id: 'prop_456', 
      address: 'Av/ Libertad 45, 28004 Madrid',
      postalCode: '28004',
      province: 'Madrid'
    }
  ];
}

/**
 * Mock function to find property by CUPS (replace with actual DB query)
 */
async function findPropertyByCUPS(cups: string): Promise<any | null> {
  // TODO: Replace with actual database query
  // This would search for a property that has this CUPS in its metadata
  return null;
}