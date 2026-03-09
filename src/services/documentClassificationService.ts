// ATLAS HORIZON - Document Classification Service
// Implements deterministic classification following exact requirements
// Now integrates with ML backend service for enhanced classification

import { ClassificationResult, OCRExtractionResult } from '../types/inboxTypes';
import { mlClassificationService } from './mlClassificationService';

// Classification keywords as specified in requirements
const SUMINISTRO_KEYWORDS = [
  // Energy/utility keywords
  'kwh', 'cups', 'peaje', 'tarifa', 'gas natural', 'agua', 'contador', 
  'telco', 'fibra', 'móvil', 'telefonía', 'electricidad', 'luz', 
  'factura eléctrica', 'potencia', 'consumo',
  
  // Common utility providers (ejemplos)
  'endesa', 'iberdrola', 'naturgy', 'totalenergies', 'repsol', 
  'holaluz', 'wekiwi', 'vodafone', 'movistar', 'orange', 
  'másmóvil', 'yoigo', 'telecable', 'aqualia'
];

const RECIBO_KEYWORDS = [
  'recibo', 'adeudo sepa', 'adeudo directo', 'cuota', 'cobro periódico'
];

const REFORMA_KEYWORDS = [
  'reforma', 'obra', 'albañilería', 'fontanería', 'electricidad', 
  'pintura', 'material', 'instalación', 'presupuesto', 'albarán'
];

/**
 * Classify document based on OCR text and extracted data
 * Now uses ML backend service with fallback to rule-based classification
 */
export async function classifyDocument(
  ocrData: OCRExtractionResult, 
  fullOcrText: string
): Promise<ClassificationResult> {
  
  console.log('[Classification] Starting classification:', {
    textLength: fullOcrText.length,
    supplier: ocrData.supplier_name,
    amount: ocrData.total_amount
  });

  // Use ML backend service with fallback to local rule-based classification
  return await mlClassificationService.classifyDocument(
    ocrData,
    fullOcrText,
    classifyDocumentLocal  // Fallback function
  );
}

/**
 * Local rule-based classification (used as fallback)
 * Lee el texto OCR (todo el documento) y etiqueta subtype
 */
async function classifyDocumentLocal(
  ocrData: OCRExtractionResult, 
  fullOcrText: string
): Promise<ClassificationResult> {
  
  const lowerText = fullOcrText.toLowerCase();
  const supplierName = (ocrData.supplier_name || '').toLowerCase();
  
  console.log('[Classification] Analyzing text:', {
    textLength: fullOcrText.length,
    supplier: ocrData.supplier_name,
    amount: ocrData.total_amount
  });

  // Check for SUMINISTRO
  const suministroMatches = findMatches(lowerText, supplierName, SUMINISTRO_KEYWORDS);
  if (suministroMatches.length > 0) {
    return {
      documentType: 'factura', // Suministro is a type of factura
      subtype: 'suministro',
      confidence: calculateConfidence(suministroMatches, fullOcrText),
      matchedKeywords: suministroMatches,
      reasoning: `Detectadas palabras de suministro: ${suministroMatches.join(', ')}`
    };
  }

  // Check for RECIBO (and verify no tax lines)
  const reciboMatches = findMatches(lowerText, supplierName, RECIBO_KEYWORDS);
  if (reciboMatches.length > 0) {
    const hasTaxLines = checkForTaxLines(lowerText);
    
    if (!hasTaxLines) {
      return {
        documentType: 'recibo_sepa',
        subtype: 'recibo',
        confidence: calculateConfidence(reciboMatches, fullOcrText),
        matchedKeywords: reciboMatches,
        reasoning: `Detectado recibo sin líneas de IVA: ${reciboMatches.join(', ')}`
      };
    } else {
      // Has tax lines, treat as invoice
      return {
        documentType: 'factura',
        subtype: 'factura_generica',
        confidence: 0.6,
        matchedKeywords: reciboMatches,
        reasoning: 'Recibo con líneas de IVA, tratado como factura genérica'
      };
    }
  }

  // Check for REFORMA
  const reformaMatches = findMatches(lowerText, supplierName, REFORMA_KEYWORDS);
  if (reformaMatches.length > 0) {
    return {
      documentType: 'factura',
      subtype: 'reforma',
      confidence: calculateConfidence(reformaMatches, fullOcrText),
      matchedKeywords: reformaMatches,
      reasoning: `Detectadas palabras de reforma: ${reformaMatches.join(', ')}`
    };
  }

  // Default: FACTURA_GENERICA
  return {
    documentType: 'factura',
    subtype: 'factura_generica',
    confidence: 0.3,
    matchedKeywords: [],
    reasoning: 'No se encontraron patrones específicos, clasificado como factura genérica'
  };
}

/**
 * Find keyword matches in text and supplier name
 */
function findMatches(lowerText: string, supplierName: string, keywords: string[]): string[] {
  const matches: string[] = [];
  
  for (const keyword of keywords) {
    const lowerKeyword = keyword.toLowerCase();
    
    // Check in full text
    if (lowerText.includes(lowerKeyword)) {
      matches.push(keyword);
      continue;
    }
    
    // Check in supplier name
    if (supplierName.includes(lowerKeyword)) {
      matches.push(keyword);
      continue;
    }
    
    // Check for partial matches for company names
    if (lowerKeyword.length > 5 && 
        (lowerText.includes(lowerKeyword.substring(0, 5)) || 
         supplierName.includes(lowerKeyword.substring(0, 5)))) {
      matches.push(keyword);
    }
  }
  
  // Remove duplicates manually for compatibility
  const uniqueMatches: string[] = [];
  for (const match of matches) {
    if (!uniqueMatches.includes(match)) {
      uniqueMatches.push(match);
    }
  }
  
  return uniqueMatches;
}

/**
 * Check if document contains tax/IVA lines
 * Used to distinguish between recibo (no tax lines) and factura (with tax lines)
 */
function checkForTaxLines(lowerText: string): boolean {
  const taxPatterns = [
    'iva', 'i.v.a', 'base imponible', 'tipo iva', 'cuota iva',
    'base gravable', 'impuesto', 'total iva', 'importe iva',
    'subtotal', 'base:', 'tipo:', 'cuota:', '%', 'porcentaje'
  ];
  
  let taxIndicators = 0;
  
  for (const pattern of taxPatterns) {
    if (lowerText.includes(pattern)) {
      taxIndicators++;
    }
  }
  
  // Consider it has tax lines if multiple indicators are found
  return taxIndicators >= 2;
}

/**
 * Calculate confidence based on number and quality of matches
 */
function calculateConfidence(matches: string[], fullText: string): number {
  if (matches.length === 0) return 0;
  
  let baseConfidence = Math.min(0.9, 0.3 + (matches.length * 0.2));
  
  // Boost confidence for exact company name matches
  const companyMatches = matches.filter(match => 
    match.length > 5 && 
    ['endesa', 'iberdrola', 'naturgy', 'vodafone', 'movistar'].includes(match.toLowerCase())
  );
  
  if (companyMatches.length > 0) {
    baseConfidence = Math.min(0.95, baseConfidence + 0.2);
  }
  
  // Reduce confidence for very short text (might be OCR errors)
  if (fullText.length < 200) {
    baseConfidence *= 0.8;
  }
  
  return Math.round(baseConfidence * 100) / 100; // Round to 2 decimals
}

/**
 * Get detailed explanation for classification
 */
export function getClassificationExplanation(result: ClassificationResult): string {
  const subtypeNames = {
    'suministro': 'Suministro',
    'recibo': 'Recibo',
    'reforma': 'Reforma',
    'factura_generica': 'Factura Genérica',
    'fein_completa': 'FEIN Completa',
    'fein_revision': 'FEIN para Revisión'
  };
  
  const typeName = subtypeNames[result.subtype] || result.subtype;
  const confidence = Math.round(result.confidence * 100);
  
  if (result.matchedKeywords.length > 0) {
    return `Clasificado como ${typeName} (${confidence}% confianza) por: ${result.matchedKeywords.join(', ')}`;
  } else {
    return `Clasificado como ${typeName} por defecto (${confidence}% confianza)`;
  }
}

/**
 * Validate classification requirements
 */
export function validateClassification(
  result: ClassificationResult, 
  ocrData: OCRExtractionResult
): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // All classifications require total_amount
  if (!ocrData.total_amount || ocrData.total_amount <= 0) {
    issues.push('Falta importe total válido');
  }
  
  // Specific validations per type
  switch (result.subtype) {
    case 'suministro':
      if (!ocrData.supplier_name) {
        issues.push('Suministro requiere nombre del proveedor');
      }
      break;
      
    case 'recibo':
      if (!ocrData.due_date && !ocrData.issue_date) {
        issues.push('Recibo requiere fecha de cargo o emisión');
      }
      break;
      
    case 'reforma':
      if (!ocrData.supplier_name) {
        issues.push('Reforma requiere nombre del proveedor');
      }
      // Note: Fiscal category validation happens in routing phase
      break;
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}