/**
 * Document Validation Service for INBOX AUTOGUARDADO OFF
 * 
 * Determines if documents can be auto-published or need manual review
 * Provides specific blocking reasons and quick fix suggestions
 */

export interface ValidationResult {
  isValid: boolean;
  isReadyToPublish: boolean;
  blockingReasons: BlockingReason[];
  warnings: string[];
  missingFields: string[];
  confidenceScore: number;
}

export interface BlockingReason {
  type: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  action?: string;
  severity: 'high' | 'medium' | 'low';
}

export interface DocumentValidationContext {
  document: any;
  ocrResult?: any;
  existingDocuments?: any[];
  availableProperties?: any[];
  availableAccounts?: any[];
}

/**
 * Main validation function for pending queue
 */
export const validateDocumentForPending = (context: DocumentValidationContext): ValidationResult => {
  const { document, ocrResult } = context;
  const blockingReasons: BlockingReason[] = [];
  const warnings: string[] = [];
  const missingFields: string[] = [];
  
  let isValid = true;
  let isReadyToPublish = true;
  let confidenceScore = 1.0;

  // 1. OCR Confidence validation
  if (ocrResult) {
    confidenceScore = ocrResult.confidenceGlobal || 0;
    
    if (confidenceScore < 0.80) {
      blockingReasons.push({
        type: 'error',
        code: 'LOW_OCR_CONFIDENCE',
        message: `Confianza OCR <0,80 (${Math.round(confidenceScore * 100)}%)`,
        action: 'Revisar campos extraídos manualmente',
        severity: 'high'
      });
      isReadyToPublish = false;
    }
  }

  // 2. Document type specific validations
  const docType = (document.metadata?.tipo || document.metadata?.detection?.tipo || '').toLowerCase();
  
  switch (docType) {
    case 'factura':
    case 'recibo':
      validateInvoice(context, blockingReasons, missingFields, warnings);
      break;
    case 'contrato':
      validateContract(context, blockingReasons, missingFields, warnings);
      break;
    case 'extracto bancario':
      validateBankStatement(context, blockingReasons, missingFields, warnings);
      break;
    default:
      validateGenericDocument(context, blockingReasons, missingFields, warnings);
  }

  // 3. Property/Account assignment validation
  if (!document.metadata?.inmuebleId && !document.metadata?.isPersonal) {
    blockingReasons.push({
      type: 'error',
      code: 'NO_PROPERTY_ASSIGNED',
      message: 'Sin inmueble',
      action: 'Asignar inmueble o marcar como personal',
      severity: 'high'
    });
    isReadyToPublish = false;
  }

  // 4. Duplicate detection
  if (document.metadata?.duplicateDetected) {
    blockingReasons.push({
      type: 'warning',
      code: 'DUPLICATE_DETECTED',
      message: 'Posible duplicado',
      action: 'Verificar si es versión diferente o eliminar',
      severity: 'medium'
    });
    isReadyToPublish = false;
  }

  // 5. File format validation
  if (!isSupportedFileFormat(document.filename, document.type)) {
    blockingReasons.push({
      type: 'error',
      code: 'UNSUPPORTED_FORMAT',
      message: 'Formato no soportado',
      action: 'Convertir a PDF, JPG, PNG, DOC, CSV, XLS o ZIP',
      severity: 'high'
    });
    isValid = false;
    isReadyToPublish = false;
  }

  // Calculate final validation state
  if (blockingReasons.some(r => r.type === 'error')) {
    isValid = false;
    isReadyToPublish = false;
  }

  return {
    isValid,
    isReadyToPublish,
    blockingReasons,
    warnings,
    missingFields,
    confidenceScore
  };
};

/**
 * Validate invoice/receipt documents
 */
function validateInvoice(
  context: DocumentValidationContext, 
  blockingReasons: BlockingReason[], 
  missingFields: string[], 
  warnings: string[]
) {
  const { document, ocrResult } = context;
  const metadata = document.metadata || {};
  
  // Required fields for invoices
  const requiredFields = ['proveedor', 'fecha', 'importe'];
  
  requiredFields.forEach(field => {
    const value = getFieldValue(metadata, ocrResult, field);
    const stringValue = String(value || '');
    if (!value || stringValue.trim() === '') {
      blockingReasons.push({
        type: 'error',
        code: `MISSING_${field.toUpperCase()}`,
        message: `Sin ${field}`,
        action: `Introducir ${field} manualmente`,
        severity: 'high'
      });
      missingFields.push(field);
    }
  });

  // IVA validation (Base + IVA ≈ Total with ±0.01€ tolerance)
  const baseAmount = parseFloat(getFieldValue(metadata, ocrResult, 'base') || '0');
  const ivaAmount = parseFloat(getFieldValue(metadata, ocrResult, 'iva') || '0');
  const totalAmount = parseFloat(getFieldValue(metadata, ocrResult, 'importe') || '0');
  
  if (baseAmount > 0 && ivaAmount > 0 && totalAmount > 0) {
    const calculatedTotal = baseAmount + ivaAmount;
    const difference = Math.abs(totalAmount - calculatedTotal);
    
    if (difference > 0.01) {
      blockingReasons.push({
        type: 'error',
        code: 'IVA_INCONSISTENT',
        message: 'IVA inconsistente',
        action: `Corregir: Base ${baseAmount.toFixed(2)} + IVA ${ivaAmount.toFixed(2)} ≠ Total ${totalAmount.toFixed(2)}`,
        severity: 'high'
      });
    }
  }

  // IBAN validation for receipts
  if (metadata.tipo?.toLowerCase() === 'recibo') {
    const iban = getFieldValue(metadata, ocrResult, 'iban');
    if (!iban) {
      blockingReasons.push({
        type: 'warning',
        code: 'NO_IBAN',
        message: 'IBAN desconocido',
        action: 'Asignar cuenta bancaria para conciliación automática',
        severity: 'medium'
      });
    }
  }

  // Reform detection
  const isReform = detectReformInvoice(metadata, ocrResult);
  if (isReform) {
    blockingReasons.push({
      type: 'info',
      code: 'REFORM_DETECTED',
      message: 'Reforma detectada',
      action: 'Dividir en Mejora, Mobiliario y R&C',
      severity: 'medium'
    });
  }
}

/**
 * Validate contract documents
 */
function validateContract(
  context: DocumentValidationContext, 
  blockingReasons: BlockingReason[], 
  missingFields: string[], 
  warnings: string[]
) {
  const { document, ocrResult } = context;
  const metadata = document.metadata || {};
  
  // Basic contract validation
  const requiredFields = ['fechaInicio', 'partes'];
  
  requiredFields.forEach(field => {
    const value = getFieldValue(metadata, ocrResult, field);
    const stringValue = String(value || '');
    if (!value || stringValue.trim() === '') {
      blockingReasons.push({
        type: 'error',
        code: `MISSING_${field.toUpperCase()}`,
        message: `Sin ${field}`,
        action: `Introducir ${field} manualmente`,
        severity: 'high'
      });
      missingFields.push(field);
    }
  });
}

/**
 * Validate bank statement documents
 */
function validateBankStatement(
  context: DocumentValidationContext, 
  blockingReasons: BlockingReason[], 
  missingFields: string[], 
  warnings: string[]
) {
  const { document } = context;
  const metadata = document.metadata || {};
  
  // Check if template mapping exists
  const bankTemplate = metadata.bankTemplate;
  if (!bankTemplate || !bankTemplate.isValid) {
    blockingReasons.push({
      type: 'error',
      code: 'CSV_HEADERS_UNKNOWN',
      message: 'Cabeceras CSV',
      action: 'Mapear columnas con wizard',
      severity: 'high'
    });
  }

  // Check account identification
  if (!metadata.accountId) {
    blockingReasons.push({
      type: 'error',
      code: 'ACCOUNT_NOT_IDENTIFIED',
      message: 'Cuenta no identificada',
      action: 'Seleccionar cuenta de destino',
      severity: 'high'
    });
  }
}

/**
 * Validate generic documents
 */
function validateGenericDocument(
  context: DocumentValidationContext, 
  blockingReasons: BlockingReason[], 
  missingFields: string[], 
  warnings: string[]
) {
  const { document } = context;
  
  // Basic file validation
  if (document.size > 50 * 1024 * 1024) { // 50MB limit
    blockingReasons.push({
      type: 'warning',
      code: 'LARGE_FILE',
      message: 'Archivo muy grande',
      action: 'Considerar comprimir o dividir',
      severity: 'low'
    });
  }
}

/**
 * Get field value from metadata or OCR result
 */
function getFieldValue(metadata: any, ocrResult: any, fieldName: string): string {
  // Try metadata first
  if (metadata[fieldName]) {
    return String(metadata[fieldName]);
  }
  
  // Try OCR fields
  if (ocrResult?.fields) {
    const field = ocrResult.fields.find((f: any) => f.name === fieldName);
    if (field?.value) {
      return String(field.value);
    }
  }
  
  return '';
}

/**
 * Detect if invoice is related to construction/reform
 */
function detectReformInvoice(metadata: any, ocrResult: any): boolean {
  const reformKeywords = [
    'obra', 'reforma', 'construcción', 'material', 'fontanería', 
    'electricidad', 'pintura', 'azulejo', 'suelo', 'cocina', 'baño'
  ];
  
  const description = getFieldValue(metadata, ocrResult, 'concepto').toLowerCase();
  const provider = getFieldValue(metadata, ocrResult, 'proveedor').toLowerCase();
  
  return reformKeywords.some(keyword => 
    description.includes(keyword) || provider.includes(keyword)
  );
}

/**
 * Check if file format is supported
 */
function isSupportedFileFormat(filename: string, mimeType: string): boolean {
  const supportedExtensions = [
    '.pdf', '.jpg', '.jpeg', '.png', '.heic', 
    '.doc', '.docx', '.eml', '.msg', '.zip', 
    '.csv', '.xls', '.xlsx', '.ofx'
  ];
  
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return supportedExtensions.includes(ext);
}

/**
 * Get validation summary for display
 */
export const getValidationSummary = (validation: ValidationResult): string => {
  if (validation.isReadyToPublish) {
    return 'Listo para publicar';
  }
  
  const errorCount = validation.blockingReasons.filter(r => r.type === 'error').length;
  const warningCount = validation.blockingReasons.filter(r => r.type === 'warning').length;
  
  if (errorCount > 0) {
    return `${errorCount} error${errorCount > 1 ? 'es' : ''} que corregir`;
  }
  
  if (warningCount > 0) {
    return `${warningCount} advertencia${warningCount > 1 ? 's' : ''} que revisar`;
  }
  
  return 'Revisión pendiente';
};