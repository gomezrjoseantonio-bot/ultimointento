// H-HOTFIX: Utility Detection Service
// Handles detection and classification of utility bills

import { UtilityType } from '../types/inboxTypes';

// Supplier patterns for utility type detection
const UTILITY_SUPPLIERS = {
  electricity: [
    'endesa', 'iberdrola', 'naturgy', 'holaluz', 'repsol luz', 'wekiwi', 
    'pvpc', 'peaje atr', 'edp', 'factor energia', 'escandinavia', 'lucera',
    'totalenergies', 'octopus energy', 'som energia'
  ],
  water: [
    'canal', 'emasesa', 'emasa', 'aqualia', 'hidralia', 'aguas de',
    'aigües', 'empresa municipal de aguas', 'canal de isabel ii',
    'aguas municipales', 'gestagua'
  ],
  gas: [
    'nedgia', 'redexis', 'naturgy gas', 'repsol gas', 'iberdrola gas',
    'endesa gas', 'distribuidora de gas'
  ],
  telecom: [
    'movistar', 'orange', 'vodafone', 'masmovil', 'digi', 'jazztel',
    'pepephone', 'lowi', 'yoigo', 'telecable', 'euskaltel', 'r cable',
    'fibra', 'adsl'
  ]
};

// Terminology patterns for each utility type
const UTILITY_KEYWORDS = {
  electricity: [
    'kwh', 'potencia', 'peaje acceso', 'atr', 'electricidad', 'energia electrica',
    'termino fijo', 'termino energia', 'impuesto electricidad', 'alquiler equipos',
    'tarifa', 'discriminacion horaria'
  ],
  water: [
    'm³', 'm3', 'metro cubico', 'consumo agua', 'suministro agua', 'agua potable',
    'saneamiento', 'depuracion', 'canon agua', 'alcantarillado', 'contador agua'
  ],
  gas: [
    'kwh gas', 'gas natural', 'termino fijo gas', 'termino variable gas',
    'peaje transporte', 'impuesto gas', 'suministro gas', 'distribucion gas'
  ],
  telecom: [
    'fibra', 'router', 'gb', 'megas', 'internet', 'telefono', 'movil',
    'adsl', 'linea telefonica', 'datos moviles', 'roaming', 'llamadas',
    'mensajes', 'sms', 'conexion'
  ]
};

/**
 * Detect utility type from supplier name and document content
 */
export function detectUtilityType(
  supplierName?: string,
  documentText?: string,
  serviceDescription?: string
): UtilityType | null {
  
  if (!supplierName && !documentText && !serviceDescription) {
    return null;
  }

  // Normalize text for comparison
  const normalizeText = (text: string): string => 
    text.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^\w\s]/g, ' ') // Replace special chars with spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

  const fullText = [supplierName, documentText, serviceDescription]
    .filter(Boolean)
    .map(text => normalizeText(text!))
    .join(' ');

  // Check supplier patterns first (more reliable)
  for (const [utilityType, suppliers] of Object.entries(UTILITY_SUPPLIERS)) {
    for (const supplier of suppliers) {
      if (fullText.includes(supplier)) {
        return utilityType as UtilityType;
      }
    }
  }

  // Check keyword patterns
  const typeScores: Record<UtilityType, number> = {
    electricity: 0,
    water: 0,
    gas: 0,
    telecom: 0
  };

  for (const [utilityType, keywords] of Object.entries(UTILITY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (fullText.includes(keyword)) {
        typeScores[utilityType as UtilityType]++;
      }
    }
  }

  // Return type with highest score (if any)
  const maxScore = Math.max(...Object.values(typeScores));
  if (maxScore === 0) return null;

  const winnerType = Object.entries(typeScores)
    .find(([, score]) => score === maxScore)?.[0] as UtilityType;

  return winnerType || null;
}

/**
 * Get utility type display name in Spanish
 */
export function getUtilityTypeDisplayName(utilityType: UtilityType): string {
  const displayNames: Record<UtilityType, string> = {
    electricity: 'Electricidad',
    water: 'Agua',
    gas: 'Gas',
    telecom: 'Telecomunicaciones'
  };
  
  return displayNames[utilityType];
}

/**
 * Validate if an expense should be classified as utility
 */
export function isUtilityExpense(
  supplierName?: string,
  conceptText?: string,
  documentText?: string
): boolean {
  const detectedType = detectUtilityType(supplierName, documentText, conceptText);
  return detectedType !== null;
}

/**
 * Extract utility-specific fields from OCR text
 */
export function extractUtilityFields(
  ocrText: string,
  utilityType: UtilityType
): {
  supply_address?: string;
  cups?: string;
  consumption?: string;
  iban_masked?: string;
} {
  const result: any = {};

  // Extract CUPS (electricity/gas identifier)
  if (utilityType === 'electricity' || utilityType === 'gas') {
    const cupsMatch = ocrText.match(/CUPS[:\s]*([A-Z]{2}\d{4}[A-Z]{2}\d{10}[A-Z]{2})/i);
    if (cupsMatch) {
      result.cups = cupsMatch[1];
    }
  }

  // Extract consumption patterns
  const consumptionPatterns = {
    electricity: /(\d+(?:[,.]?\d+)?)\s*kWh/gi,
    water: /(\d+(?:[,.]?\d+)?)\s*m[³3]/gi,
    gas: /(\d+(?:[,.]?\d+)?)\s*kWh\s*gas/gi,
    telecom: /(\d+(?:[,.]?\d+)?)\s*GB/gi
  };

  const pattern = consumptionPatterns[utilityType];
  if (pattern) {
    const match = ocrText.match(pattern);
    if (match) {
      result.consumption = match[0];
    }
  }

  // Extract IBAN with masking
  const ibanMatch = ocrText.match(/(?:IBAN[:\s]*)?[A-Z]{2}\d{2}[A-Z0-9*]{4}\*+[A-Z0-9*]{4,}/gi);
  if (ibanMatch) {
    result.iban_masked = ibanMatch[0];
  }

  // Extract supply address (look for "Dirección suministro", "Punto suministro", etc.)
  const addressPatterns = [
    /(?:dirección|direccion|punto|lugar)[\s\w]*suministro[:\s]*([^\n\r]+)/gi,
    /suministro[:\s]*([^\n\r]+)/gi
  ];

  for (const pattern of addressPatterns) {
    const match = ocrText.match(pattern);
    if (match && match[1]) {
      result.supply_address = match[1].trim();
      break;
    }
  }

  return result;
}