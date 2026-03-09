// ATLAS HORIZON - Document Type Detection Service
// Implements exact triggers: factura/recibo_sepa → OCR, extracto_banco → skip OCR
// Following exact requirements from problem statement

export interface DetectionResult {
  documentType: 'factura' | 'recibo_sepa' | 'extracto_banco' | 'fein' | 'otros';
  confidence: number;
  shouldSkipOCR: boolean;
  reason: string;
  triggers: string[];
  tipo?: string; // Legacy compatibility
}

/**
 * Main detection function following exact requirements:
 * - factura, recibo_sepa → launch OCR
 * - extracto_banco → skip OCR (parse with movement importer) 
 * - otros → launch OCR
 */
export const detectDocumentType = async (
  file: File,
  filename: string = file.name
): Promise<DetectionResult> => {
  const fileName = filename.toLowerCase();
  const mimeType = file.type;

  // 1. EXTRACTO_BANCO detection (skip OCR) - highest priority
  const bankResult = detectBankStatement(fileName, mimeType);
  if (bankResult.shouldSkipOCR) {
    return bankResult;
  }

  // 2. FEIN detection (special processing) - high priority
  const feinResult = await detectFEIN(file, fileName, mimeType);
  if (feinResult.documentType === 'fein') {
    return feinResult;
  }

  // 3. RECIBO_SEPA detection (launch OCR)
  const reciboResult = detectReciboSepa(fileName);
  if (reciboResult.documentType === 'recibo_sepa') {
    return reciboResult;
  }

  // 4. FACTURA detection (launch OCR)
  const facturaResult = detectFactura(fileName, mimeType);
  if (facturaResult.documentType === 'factura') {
    return facturaResult;
  }

  // 4. Default to OTROS (launch OCR)
  return {
    documentType: 'otros',
    confidence: 0.5,
    shouldSkipOCR: false,
    reason: 'No specific patterns detected - default to otros',
    triggers: ['unknown_type'],
    tipo: 'other'
  };
};

/**
 * Detect FEIN documents - should use specialized FEIN processing
 */
const detectFEIN = async (file: File, fileName: string, mimeType: string): Promise<DetectionResult> => {
  // Only process PDFs for FEIN detection
  if (mimeType !== 'application/pdf') {
    return {
      documentType: 'otros',
      confidence: 0,
      shouldSkipOCR: false,
      reason: 'Not a PDF document',
      triggers: []
    };
  }

  // Check filename patterns
  const feinFileKeywords = [
    'fein', 'ficha europea', 'informacion normalizada', 
    'hipoteca', 'prestamo', 'loan information'
  ];
  
  const fileKeywordMatches = feinFileKeywords.filter(keyword => 
    fileName.includes(keyword.replace(' ', ''))
  );

  // If filename suggests FEIN, do quick content check
  if (fileKeywordMatches.length > 0) {
    try {
      const quickContentCheck = await performQuickFEINContentCheck(file);
      if (quickContentCheck.isFEIN) {
        return {
          documentType: 'fein',
          confidence: 0.9,
          shouldSkipOCR: false, // FEIN needs specialized processing
          reason: `FEIN detected: ${quickContentCheck.triggers.join(', ')}`,
          triggers: [...fileKeywordMatches, ...quickContentCheck.triggers],
          tipo: 'fein'
        };
      }
    } catch (error) {
      console.warn('FEIN content check failed:', error);
    }
  }

  return {
    documentType: 'otros',
    confidence: 0,
    shouldSkipOCR: false,
    reason: 'Not a FEIN document',
    triggers: []
  };
};

/**
 * Quick content check for FEIN documents using text extraction
 */
const performQuickFEINContentCheck = async (file: File): Promise<{ isFEIN: boolean; triggers: string[] }> => {
  // This would typically use a PDF text extraction library
  // For now, we'll return a placeholder implementation
  // In production, this should extract first few pages and look for FEIN markers
  
  const triggers: string[] = [];
  
  // Simulated FEIN detection - in real implementation, extract text from PDF
  // and look for key phrases like:
  // - "Ficha Europea de Información Normalizada"
  // - "FEIN"
  // - Combined with financial terms: "TAE", "TIN", "Euríbor", "diferencial"
  
  // For now, we'll use filename as primary indicator
  // This should be replaced with actual PDF text extraction
  
  return {
    isFEIN: false, // Conservative approach - require stronger signals
    triggers
  };
};

/**
 * Detect bank statements - should skip OCR
 */
const detectBankStatement = (fileName: string, mimeType: string): DetectionResult => {
  const bankKeywords = [
    'extracto', 'movimientos', 'movements', 'statement',
    'bank', 'bancario', 'cuenta', 'saldo', 'posiciones'
  ];

  const csvExcelTypes = [
    'text/csv', 'application/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];

  const keywordMatches = bankKeywords.filter(keyword => fileName.includes(keyword));
  const isSpreadsheet = csvExcelTypes.includes(mimeType);

  if (keywordMatches.length > 0 || isSpreadsheet) {
    const triggers = [...keywordMatches];
    if (isSpreadsheet) triggers.push('spreadsheet_format');

    return {
      documentType: 'extracto_banco',
      confidence: 0.9,
      shouldSkipOCR: true,
      reason: `Bank statement detected: ${triggers.join(', ')}`,
      triggers,
      tipo: 'bank_statement'
    };
  }

  return {
    documentType: 'otros',
    confidence: 0,
    shouldSkipOCR: false,
    reason: 'Not a bank statement',
    triggers: []
  };
};

/**
 * Detect SEPA receipts - should launch OCR
 */
const detectReciboSepa = (fileName: string): DetectionResult => {
  const reciboKeywords = [
    'recibo', 'adeudo', 'sepa', 'domiciliacion',
    'cuota', 'subscription', 'periodico', 'mensual'
  ];

  const matches = reciboKeywords.filter(keyword => fileName.includes(keyword));

  if (matches.length > 0) {
    return {
      documentType: 'recibo_sepa',
      confidence: 0.85,
      shouldSkipOCR: false,
      reason: `SEPA receipt detected: ${matches.join(', ')}`,
      triggers: matches,
      tipo: 'recibo'
    };
  }

  return {
    documentType: 'otros',
    confidence: 0,
    shouldSkipOCR: false,
    reason: 'Not a SEPA receipt',
    triggers: []
  };
};

/**
 * Detect invoices - should launch OCR
 */
const detectFactura = (fileName: string, mimeType: string): DetectionResult => {
  const facturaKeywords = [
    'factura', 'invoice', 'bill', 'reforma', 'obra',
    'suministro', 'luz', 'agua', 'gas', 'telefon',
    'internet', 'fibra', 'electricidad', 'energia'
  ];

  const utilityProviders = [
    'iberdrola', 'endesa', 'naturgy', 'totalenergies',
    'holaluz', 'wekiwi', 'vodafone', 'movistar', 'orange',
    'telefonica', 'yoigo', 'pepephone', 'aqualia'
  ];

  const facturaMatches = facturaKeywords.filter(keyword => fileName.includes(keyword));
  const providerMatches = utilityProviders.filter(provider => fileName.includes(provider));
  const allMatches = [...facturaMatches, ...providerMatches];

  if (allMatches.length > 0) {
    return {
      documentType: 'factura',
      confidence: 0.9,
      shouldSkipOCR: false,
      reason: `Invoice detected: ${allMatches.join(', ')}`,
      triggers: allMatches,
      tipo: 'invoice'
    };
  }

  // PDF files are likely invoices
  if (mimeType === 'application/pdf') {
    return {
      documentType: 'factura',
      confidence: 0.7,
      shouldSkipOCR: false,
      reason: 'PDF document, likely invoice',
      triggers: ['pdf_format'],
      tipo: 'invoice'
    };
  }

  // Image files are likely invoices/receipts
  const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/tiff'];
  if (imageTypes.includes(mimeType)) {
    return {
      documentType: 'factura',
      confidence: 0.6,
      shouldSkipOCR: false,
      reason: 'Image document, likely invoice/receipt',
      triggers: ['image_format'],
      tipo: 'invoice'
    };
  }

  return {
    documentType: 'otros',
    confidence: 0,
    shouldSkipOCR: false,
    reason: 'Not a recognizable invoice',
    triggers: []
  };
};

// Legacy compatibility functions
export const shouldAutoOCR = (detectionResult: DetectionResult): boolean => {
  return !detectionResult.shouldSkipOCR && detectionResult.confidence > 0.5;
};

export const getProcessingPipeline = (detectionResult: DetectionResult): 'ocr' | 'bank-parser' | 'manual' => {
  if (detectionResult.shouldSkipOCR && detectionResult.documentType === 'extracto_banco') {
    return 'bank-parser';
  }
  
  if (shouldAutoOCR(detectionResult)) {
    return 'ocr';
  }
  
  return 'manual';
};

export const getDetectionExplanation = (result: DetectionResult): string => {
  const { documentType, confidence, reason, triggers } = result;
  
  let explanation = `Detectado como "${documentType}" con ${(confidence * 100).toFixed(0)}% confianza.\n`;
  explanation += `Razón: ${reason}\n`;
  
  if (triggers && triggers.length > 0) {
    explanation += `Triggers encontrados: ${triggers.join(', ')}`;
  }
  
  return explanation;
};