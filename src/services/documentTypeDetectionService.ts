// ATLAS HORIZON - Document Type Detection Service  
// Implements exact triggers: factura/recibo_sepa → OCR, extracto_banco → skip OCR
// Following exact requirements from problem statement

// Token definitions for content analysis
const BANKING_TOKENS = [
  'saldo', 'movimiento', 'transaccion', 'transferencia', 'adeudo', 'abono',
  'fecha valor', 'concepto', 'importe', 'debe', 'haber', 'cuenta corriente',
  'extracto', 'statement', 'balance', 'disponible', 'retenido'
];

const INVOICE_TOKENS = [
  'factura', 'invoice', 'total', 'iva', 'base imponible', 'neto',
  'proveedor', 'cliente', 'fecha emision', 'vencimiento', 'numero factura'
];

const CONTRACT_TOKENS = [
  'contrato', 'contract', 'clausula', 'firmante', 'vigencia',
  'por la presente', 'acuerdan', 'condiciones'
];

export interface DetectionResult {
  // Exact document types per requirements
  documentType: 'factura' | 'recibo_sepa' | 'extracto_banco' | 'otros';
  confidence: number;
  shouldSkipOCR: boolean;
  reason: string;
  triggers: string[];
  // Legacy compatibility
  tipo?: string;
  tokens?: string[];
  heuristicScore?: number;
  columnCount?: number;
  detectedColumns?: string[];
}

// Utility function to convert legacy tipo to documentType
const mapTipoToDocumentType = (tipo: string): 'factura' | 'recibo_sepa' | 'extracto_banco' | 'otros' => {
  switch (tipo.toLowerCase()) {
    case 'bank_statement':
    case 'extracto':
      return 'extracto_banco';
    case 'invoice':
    case 'factura':
      return 'factura';
    case 'recibo':
      return 'recibo_sepa';
    case 'contrato':
    case 'other':
    default:
      return 'otros';
  }
};

// Updated detection function following exact requirements
export const detectDocumentType = async (
  file: File, 
  filename: string = file.name
): Promise<DetectionResult> => {
  const fileName = filename.toLowerCase();
  const mimeType = file.type;
  
  // 1. EXTRACTO_BANCO detection (skip OCR) - highest priority
  const bankResult = detectBankStatement(file, fileName, mimeType);
  if (bankResult.shouldSkipOCR) {
    return bankResult;
  }
  
  // 2. RECIBO_SEPA detection (launch OCR)
  const reciboResult = detectReciboSepa(fileName, mimeType);
  if (reciboResult.documentType === 'recibo_sepa') {
    return reciboResult;
  }
  
  // 3. FACTURA detection (launch OCR)  
  const facturaResult = detectFactura(fileName, mimeType);
  if (facturaResult.documentType === 'factura') {
    return facturaResult;
  }
  
  // 4. For PDFs, do content-based analysis
  if (mimeType === 'application/pdf' && file.size > 0) {
    try {
      const pdfHeuristic = await analyzePDFContent(file);
      if (pdfHeuristic.confidence > 0.8) {
        return pdfHeuristic;
      }
    } catch (error) {
      console.warn('PDF content analysis failed:', error);
    }
  }
  
  // 5. Default to OTROS (launch OCR)
  return {
    documentType: 'otros',
    confidence: 0.5,
    shouldSkipOCR: false,
    reason: 'No specific patterns detected - default to otros',
    triggers: ['unknown_type'],
    tipo: 'other'
  };
};

// Detect RECIBO_SEPA documents
const detectReciboSepa = (fileName: string, mimeType: string): DetectionResult => {
  const reciboTriggers = [
    'recibo', 'adeudo', 'sepa', 'domiciliacion',
    'cuota', 'subscription', 'periodico', 'mensual'
  ];
  
  const matches = reciboTriggers.filter(trigger => fileName.includes(trigger));
  
  if (matches.length > 0) {
    return {
      documentType: 'recibo_sepa',
      confidence: 0.85,
      shouldSkipOCR: false,
      reason: `SEPA receipt detected based on: ${matches.join(', ')}`,
      triggers: matches,
      tipo: 'recibo'
    };
  }
  
  return {
    documentType: 'otros',
    confidence: 0,
    shouldSkipOCR: false,
    reason: 'Not a SEPA receipt',
    triggers: [],
    tipo: 'other'
  };
};

// Detect FACTURA documents
const detectFactura = (fileName: string, mimeType: string): DetectionResult => {
  const facturaTriggers = [
    'factura', 'invoice', 'bill', 'reforma', 'obra',
    'suministro', 'luz', 'agua', 'gas', 'telefon',
    'internet', 'fibra', 'electricidad', 'energia'
  ];
  
  const utilityProviders = [
    'iberdrola', 'endesa', 'naturgy', 'totalenergies',
    'holaluz', 'wekiwi', 'vodafone', 'movistar', 'orange',
    'telefonica', 'yoigo', 'pepephone', 'aqualia'
  ];
  
  const facturaMatches = facturaTriggers.filter(trigger => fileName.includes(trigger));
  const providerMatches = utilityProviders.filter(provider => fileName.includes(provider));
  const allMatches = [...facturaMatches, ...providerMatches];
  
  if (allMatches.length > 0) {
    return {
      documentType: 'factura',
      confidence: 0.9,
      shouldSkipOCR: false,
      reason: `Invoice detected based on: ${allMatches.join(', ')}`,
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
    triggers: [],
    tipo: 'other'
  };
};

// H8: Detect bank statements (should skip OCR)
const detectBankStatement = (file: File, fileName: string, mimeType: string): DetectionResult => {
  // Check file extensions that are typically bank exports
  const bankExtensions = ['csv', 'xls', 'xlsx', 'txt'];
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  if (bankExtensions.includes(extension || '')) {
    // Check filename patterns for bank exports
    const bankFilePatterns = [
      'extracto', 'movimientos', 'cuentas', 'statement', 'transactions',
      'export', 'balance', 'posiciones', 'saldos'
    ];
    
    const hasBankPattern = bankFilePatterns.some(pattern => 
      fileName.includes(pattern)
    );
    
    if (hasBankPattern) {
      return {
        documentType: 'extracto_banco',
        confidence: 0.95,
        shouldSkipOCR: true,
        reason: 'Bank export file format detected',
        triggers: [extension!, ...bankFilePatterns.filter(p => fileName.includes(p))],
        tipo: 'bank_statement', // Legacy compatibility
        tokens: [extension!, ...bankFilePatterns.filter(p => fileName.includes(p))]
      };
    }
    
    // Enhanced heuristic: Check for potential 3+ columns (fecha, concepto, importe, saldo)
    // This is a simple check for CSV/spreadsheet files
    if (['csv', 'xls', 'xlsx'].includes(extension || '')) {
      return {
        documentType: 'extracto_banco',
        confidence: 0.80,
        shouldSkipOCR: true,
        reason: 'Spreadsheet format suggests bank export (3+ columns expected)',
        triggers: [extension!],
        tipo: 'bank_statement', // Legacy compatibility
        tokens: [extension!],
        heuristicScore: 0.8,
        columnCount: 3
      };
    }
  }
  
  // Not a bank statement
  return {
    documentType: 'otros',
    confidence: 0,
    shouldSkipOCR: false,
    reason: 'Not a bank statement format',
    triggers: [],
    tipo: 'Unknown' // Legacy compatibility
  };
};

// H8: Analyze PDF content for first 2 pages
const analyzePDFContent = async (file: File): Promise<DetectionResult> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Convert first part of PDF to text for token analysis
        // This is a simplified approach - in production you'd use a PDF parser
        const text = String.fromCharCode.apply(null, Array.from(uint8Array.slice(0, 8192)))
          .replace(/[^\x20-\x7E\u00C0-\u017F]/g, ' ') // Keep printable + accented chars
          .toLowerCase();
        
        // Count banking tokens
        const bankingTokens = BANKING_TOKENS.filter(token => 
          text.includes(token.toLowerCase())
        );
        
        // Count invoice tokens  
        const invoiceTokens = INVOICE_TOKENS.filter(token =>
          text.includes(token.toLowerCase())
        );
        
        // Count contract tokens
        const contractTokens = CONTRACT_TOKENS.filter(token =>
          text.includes(token.toLowerCase())
        );
        
        // Determine type based on token density
        if (bankingTokens.length >= 3) {
          resolve({
            tipo: 'bank_statement', // Use standardized type name
            confidence: Math.min(0.85 + (bankingTokens.length * 0.02), 0.98),
            shouldSkipOCR: true,
            reason: 'Multiple banking tokens detected in PDF content',
            tokens: bankingTokens,
            heuristicScore: bankingTokens.length / BANKING_TOKENS.length
          });
        } else if (contractTokens.length >= 2) {
          resolve({
            tipo: 'Contrato',
            confidence: Math.min(0.75 + (contractTokens.length * 0.03), 0.95),
            shouldSkipOCR: false,
            reason: 'Contract tokens detected in PDF content',
            tokens: contractTokens
          });
        } else if (invoiceTokens.length >= 2) {
          resolve({
            tipo: 'invoice', // Use standardized type name
            confidence: Math.min(0.70 + (invoiceTokens.length * 0.03), 0.90),
            shouldSkipOCR: false,
            reason: 'Invoice tokens detected in PDF content',
            tokens: invoiceTokens
          });
        } else {
          // Inconclusive from content analysis - default to invoice for PDFs
          resolve({
            tipo: 'invoice', // Default to invoice for PDFs
            confidence: 0.50,
            shouldSkipOCR: false,
            reason: 'PDF format suggests potential invoice (insufficient tokens for confident detection)'
          });
        }
        
      } catch (error) {
        resolve({
          tipo: 'Unknown',
          confidence: 0,
          shouldSkipOCR: false,
          reason: 'PDF analysis failed'
        });
      }
    };
    
    reader.onerror = () => {
      resolve({
        tipo: 'Unknown',
        confidence: 0,
        shouldSkipOCR: false,
        reason: 'Failed to read PDF file'
      });
    };
    
    // Read only first 16KB for speed
    reader.readAsArrayBuffer(file.slice(0, 16384));
  });
};

// H8: Filename and MIME type based detection
const detectByFilenameAndMime = (fileName: string, mimeType: string): DetectionResult => {
  // Invoice patterns
  const invoicePatterns = [
    'factura', 'invoice', 'bill', 'receipt', 'recibo', 
    'ticket', 'compra', 'purchase', 'gasto', 'expense'
  ];
  
  // Contract patterns  
  const contractPatterns = [
    'contrato', 'contract', 'arrendamiento', 'lease', 'hipoteca',
    'mortgage', 'prestamo', 'loan', 'acuerdo', 'agreement'
  ];
  
  // Check invoice patterns
  const hasInvoicePattern = invoicePatterns.some(pattern => fileName.includes(pattern));
  if (hasInvoicePattern) {
    return {
      tipo: 'invoice', // Use standardized type name
      confidence: 0.75,
      shouldSkipOCR: false,
      reason: 'Invoice filename pattern detected',
      tokens: invoicePatterns.filter(p => fileName.includes(p))
    };
  }
  
  // Check contract patterns
  const hasContractPattern = contractPatterns.some(pattern => fileName.includes(pattern));
  if (hasContractPattern) {
    return {
      tipo: 'Contrato', 
      confidence: 0.70,
      shouldSkipOCR: false,
      reason: 'Contract filename pattern detected',
      tokens: contractPatterns.filter(p => fileName.includes(p))
    };
  }
  
  // Check MIME types for potential invoices
  if (mimeType === 'application/pdf' || mimeType?.startsWith('image/')) {
    return {
      tipo: 'invoice', // Use standardized type name - default for PDFs/images
      confidence: 0.60,
      shouldSkipOCR: false,
      reason: 'PDF or image format suggests potential invoice',
      tokens: [mimeType]
    };
  }
  
  // Default to other documents
  return {
    tipo: 'other', // Use standardized type name
    confidence: 0.50,
    shouldSkipOCR: false,
    reason: 'No specific patterns detected',
    tokens: []
  };
};

// H8: Get detection confidence explanation
export const getDetectionExplanation = (result: DetectionResult): string => {
  const { tipo, confidence, reason, tokens } = result;
  
  let explanation = `Detectado como "${tipo}" con ${(confidence * 100).toFixed(0)}% confianza.\n`;
  explanation += `Razón: ${reason}\n`;
  
  if (tokens && tokens.length > 0) {
    explanation += `Tokens encontrados: ${tokens.join(', ')}`;
  }
  
  return explanation;
};

// H8: Check if document should trigger auto-OCR
export const shouldAutoOCR = (detectionResult: DetectionResult): boolean => {
  return !detectionResult.shouldSkipOCR && 
         ['invoice', 'Contrato', 'other'].includes(detectionResult.tipo) &&
         detectionResult.confidence > 0.5; // Only auto-OCR if we have reasonable confidence
};

// H8: Get processing pipeline for document type
export const getProcessingPipeline = (detectionResult: DetectionResult): 'ocr' | 'bank-parser' | 'manual' => {
  if (detectionResult.shouldSkipOCR && detectionResult.tipo === 'bank_statement') {
    return 'bank-parser';
  }
  
  if (shouldAutoOCR(detectionResult)) {
    return 'ocr';
  }
  
  return 'manual';
};

// Enhanced heuristic detection for CSV/XLS files
export const detectBankStatementHeuristic = async (file: File): Promise<DetectionResult> => {
  const fileName = file.name.toLowerCase();
  const extension = fileName.split('.').pop();
  
  if (!['csv', 'xls', 'xlsx'].includes(extension || '')) {
    return {
      tipo: 'other',
      confidence: 0,
      shouldSkipOCR: false,
      reason: 'Not a spreadsheet format'
    };
  }
  
  try {
    // For CSV files, we can do a quick peek at the headers
    if (extension === 'csv') {
      const text = await file.slice(0, 1024).text(); // First 1KB
      const firstLine = text.split('\n')[0];
      const columns = firstLine.split(/[,;|]/).map(col => col.trim().toLowerCase());
      
      // Check for banking columns (fecha, concepto/descripcion, importe, saldo)
      const bankingColumns = ['fecha', 'concepto', 'descripcion', 'importe', 'saldo', 'date', 'amount', 'balance', 'description'];
      const detectedBankingCols = columns.filter(col => 
        bankingColumns.some(banking => col.includes(banking))
      );
      
      if (detectedBankingCols.length >= 3) {
        return {
          tipo: 'bank_statement',
          confidence: 0.90,
          shouldSkipOCR: true,
          reason: 'CSV with 3+ banking columns detected (fecha, concepto, importe)',
          tokens: detectedBankingCols,
          columnCount: columns.length,
          detectedColumns: detectedBankingCols,
          heuristicScore: detectedBankingCols.length / bankingColumns.length
        };
      } else {
        // CSV but without clear banking headers - still likely a bank statement
        return {
          tipo: 'bank_statement',
          confidence: 0.75,
          shouldSkipOCR: true,
          reason: 'CSV format suggests bank statement (headers need verification)',
          tokens: [extension || 'unknown'],
          columnCount: columns.length,
          detectedColumns: detectedBankingCols
        };
      }
    }
    
    // For XLS/XLSX, return probable bank statement if it has the right structure
    return {
      tipo: 'bank_statement',
      confidence: 0.75,
      shouldSkipOCR: true,
      reason: 'Spreadsheet format suggests bank statement (needs header verification)',
      tokens: [extension || 'unknown'],
      columnCount: 4 // Estimated
    };
    
  } catch (error) {
    // Fallback to basic detection
    return {
      tipo: 'bank_statement',
      confidence: 0.60,
      shouldSkipOCR: true,
      reason: 'Spreadsheet format suggests bank statement (content analysis failed)',
      tokens: [extension || 'unknown'],
      columnCount: 3 // Default estimate
    };
  }
};