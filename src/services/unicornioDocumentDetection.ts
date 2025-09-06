// UNICORNIO PROMPT - Document Type Detection Service
// Implements exact 5 document types according to specification

export type DocumentType = 
  | 'extracto_bancario'
  | 'factura_suministro' 
  | 'factura_reforma'
  | 'contrato'
  | 'documento_generico';

export interface DocumentDetectionResult {
  type: DocumentType;
  confidence: number;
  shouldUseOCR: boolean;
  reason: string;
  detectedKeywords: string[];
}

/**
 * Detects document type according to UNICORNIO PROMPT specification
 * Combines MIME/extension analysis with fast OCR preview
 */
export function detectDocType(filename: string, mimeType: string): DocumentDetectionResult {
  const extension = filename.toLowerCase().split('.').pop() || '';
  const filenameText = filename.toLowerCase();

  // 1. Banking files - Direct by extension
  if (['xls', 'xlsx', 'csv'].includes(extension)) {
    return {
      type: 'extracto_bancario',
      confidence: 0.95,
      shouldUseOCR: false,
      reason: 'Excel/CSV file detected - likely bank statement',
      detectedKeywords: ['bank_file_extension']
    };
  }

  // 2. Quick filename analysis for other types
  const utilityKeywords = [
    'cups', 'kwh', 'electricidad', 'gas', 'agua', 'fibra', 'internet', 'telco',
    'iberdrola', 'endesa', 'naturgy', 'movistar', 'orange', 'vodafone',
    'canal', 'aqualia', 'factura', 'iban'
  ];

  const reformKeywords = [
    'presupuesto', 'albaran', 'reforma', 'mobiliario', 'iva',
    'construccion', 'obra', 'material', 'instalacion'
  ];

  const contractKeywords = [
    'arrendamiento', 'arrendatario', 'fianza', 'renta mensual',
    'contrato', 'alquiler', 'inquilino'
  ];

  // Check filename for quick classification
  const foundUtility = utilityKeywords.some(keyword => filenameText.includes(keyword));
  const foundReform = reformKeywords.some(keyword => filenameText.includes(keyword));
  const foundContract = contractKeywords.some(keyword => filenameText.includes(keyword));

  if (foundUtility) {
    return {
      type: 'factura_suministro',
      confidence: 0.8,
      shouldUseOCR: true,
      reason: 'Utility keywords detected in filename',
      detectedKeywords: utilityKeywords.filter(k => filenameText.includes(k))
    };
  }

  if (foundReform) {
    return {
      type: 'factura_reforma',
      confidence: 0.8,
      shouldUseOCR: true,
      reason: 'Reform keywords detected in filename',
      detectedKeywords: reformKeywords.filter(k => filenameText.includes(k))
    };
  }

  if (foundContract) {
    return {
      type: 'contrato',
      confidence: 0.8,
      shouldUseOCR: true,
      reason: 'Contract keywords detected in filename',
      detectedKeywords: contractKeywords.filter(k => filenameText.includes(k))
    };
  }

  // 3. For PDF/IMG/DOCX - require OCR for final classification
  if (['pdf', 'jpg', 'jpeg', 'png', 'docx'].includes(extension)) {
    return {
      type: 'documento_generico',
      confidence: 0.6,
      shouldUseOCR: true,
      reason: 'Document requires OCR for classification',
      detectedKeywords: []
    };
  }

  // 4. Default fallback
  return {
    type: 'documento_generico',
    confidence: 0.5,
    shouldUseOCR: false,
    reason: 'Unknown document type',
    detectedKeywords: []
  };
}

/**
 * Enhanced classification with OCR results
 * Used after OCR to refine initial detection
 */
export function classifyWithOCR(
  initialDetection: DocumentDetectionResult,
  ocrText: string
): DocumentDetectionResult {
  const text = ocrText.toLowerCase();

  // Utility patterns in OCR text
  const utilityPatterns = [
    /cups\s*[\d\w]+/i,
    /kwh|kw\s*h/i,
    /electricidad|electric/i,
    /gas natural|gas/i,
    /agua|water/i,
    /fibra|internet|adsl/i,
    /factura.*suministro/i,
    /\*{4}\d{4}/i // IBAN masked pattern
  ];

  // Reform patterns
  const reformPatterns = [
    /presupuesto|albaran/i,
    /reforma|construccion/i,
    /mobiliario|muebles/i,
    /iva.*[\d,]+/i,
    /base\s*imponible/i
  ];

  // Contract patterns
  const contractPatterns = [
    /arrendamiento|alquiler/i,
    /arrendatario|inquilino/i,
    /renta\s*mensual/i,
    /fianza/i,
    /vigencia|duracion/i
  ];

  const utilityMatches = utilityPatterns.filter(pattern => pattern.test(text));
  const reformMatches = reformPatterns.filter(pattern => pattern.test(text));
  const contractMatches = contractPatterns.filter(pattern => pattern.test(text));

  // Determine best match
  if (utilityMatches.length >= 2) {
    return {
      type: 'factura_suministro',
      confidence: 0.9,
      shouldUseOCR: true,
      reason: 'Multiple utility patterns found in OCR',
      detectedKeywords: utilityMatches.map(p => p.source)
    };
  }

  if (reformMatches.length >= 2) {
    return {
      type: 'factura_reforma',
      confidence: 0.9,
      shouldUseOCR: true,
      reason: 'Multiple reform patterns found in OCR',
      detectedKeywords: reformMatches.map(p => p.source)
    };
  }

  if (contractMatches.length >= 2) {
    return {
      type: 'contrato',
      confidence: 0.9,
      shouldUseOCR: true,
      reason: 'Multiple contract patterns found in OCR',
      detectedKeywords: contractMatches.map(p => p.source)
    };
  }

  // If we found some invoice patterns but not specific enough
  if (text.includes('factura') || text.includes('invoice')) {
    return {
      type: 'factura_suministro', // Default to utility for invoices
      confidence: 0.7,
      shouldUseOCR: true,
      reason: 'Generic invoice detected, defaulting to utility',
      detectedKeywords: ['factura']
    };
  }

  // Return refined detection or keep original
  return {
    ...initialDetection,
    confidence: Math.max(initialDetection.confidence - 0.1, 0.4),
    reason: 'OCR did not improve classification'
  };
}