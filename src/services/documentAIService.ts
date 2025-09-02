// H-OCR-FIX: Enhanced OCR Service for Google Document AI integration
import { OCRResult, OCRField } from './db';

// H-OCR-FIX: Document AI entity type mappings
const ENTITY_TYPE_MAPPINGS: Record<string, string> = {
  'total_amount': 'total_amount',
  'purchase_total': 'purchase_total', 
  'total_monto': 'total_monto',
  'subtotal': 'subtotal',
  'net_amount': 'net_amount',
  'tax_amount': 'tax_amount',
  'invoice_id': 'invoice_id',
  'invoice_date': 'invoice_date',
  'date': 'date',
  'supplier_name': 'supplier_name',
  'receiver_name': 'receiver_name',
  'supplier_tax_id': 'supplier_tax_id',
  'tax_id': 'tax_id',
  'iban': 'iban'
};

// H-OCR-FIX: Format currency value from Document AI
const formatCurrencyFromDocumentAI = (value: any): string => {
  if (typeof value === 'object' && value.moneyValue) {
    const units = parseInt(value.moneyValue.units || '0');
    const nanos = parseInt(value.moneyValue.nanos || '0');
    const amount = units + (nanos / 1_000_000_000);
    
    return new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }
  
  if (typeof value === 'string') {
    // Parse and normalize Spanish currency format
    const cleanValue = value.replace(/[^\d,.-]/g, '');
    const parsedAmount = parseFloat(cleanValue.replace(',', '.'));
    
    if (!isNaN(parsedAmount)) {
      return new Intl.NumberFormat('es-ES', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(parsedAmount);
    }
  }
  
  return value?.toString() || '';
};

// H-OCR-FIX: Format date value from Document AI
const formatDateFromDocumentAI = (value: any): string => {
  if (typeof value === 'object' && value.dateValue) {
    const { year, month, day } = value.dateValue;
    const date = new Date(year, month - 1, day); // month is 1-based in API
    
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  }
  
  if (typeof value === 'string') {
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return new Intl.DateTimeFormat('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }).format(date);
      }
    } catch {
      // Return original if parsing fails
    }
  }
  
  return value?.toString() || '';
};

// H-OCR-FIX: Process Document AI entity to OCRField
const processDocumentAIEntity = (entity: any): OCRField | null => {
  const entityType = entity.type?.toLowerCase();
  const mappedType = ENTITY_TYPE_MAPPINGS[entityType];
  
  if (!mappedType) {
    return null; // Skip unmapped entity types
  }
  
  let processedValue = '';
  
  // Process based on normalized value type
  if (entity.normalizedValue) {
    if (entity.normalizedValue.moneyValue) {
      processedValue = formatCurrencyFromDocumentAI(entity.normalizedValue);
    } else if (entity.normalizedValue.dateValue) {
      processedValue = formatDateFromDocumentAI(entity.normalizedValue);
    } else if (entity.normalizedValue.text) {
      processedValue = entity.normalizedValue.text;
    }
  }
  
  // Fallback to mention text if no normalized value
  if (!processedValue && entity.mentionText) {
    processedValue = entity.mentionText.trim();
  }
  
  return {
    name: mappedType,
    value: processedValue,
    confidence: entity.confidence || 0,
    raw: entity.mentionText || ''
  };
};

// H-OCR-FIX: Call Document AI Netlify Function
export const callDocumentAIFunction = async (file: File): Promise<any> => {
  try {
    // Convert file to bytes for direct upload (as per requirements)
    const fileBytes = await file.arrayBuffer();
    
    // DEV telemetry: Log OCR call details
    if (process.env.NODE_ENV === 'development') {
      const sizeKB = Math.round(fileBytes.byteLength / 1024);
      console.log('OCR call → endpoint: /.netlify/functions/ocr-documentai, sizeKB:', sizeKB);
    }
    
    const response = await fetch('/.netlify/functions/ocr-documentai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream'
      },
      body: fileBytes
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // Handle specific error codes as requested
      if ([403, 404, 429].includes(response.status) || errorData.code === 'CONFIG') {
        const errorCode = errorData.code || response.status.toString();
        // This will be handled by the calling component to show toast/banner
        throw new Error(`OCR_ERROR_${errorCode}: ${errorData.message || errorData.error || `Error HTTP ${response.status}`}`);
      }
      
      throw new Error(errorData.error || `Error HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Document AI Function Error:', error);
    throw error;
  }
};

// H-OCR-FIX: Process Document AI response to OCRResult
export const processDocumentAIResponse = (apiResponse: any, filename: string): OCRResult => {
  if (!apiResponse.success || !apiResponse.results || apiResponse.results.length === 0) {
    return {
      engine: 'document-ai-invoice:Error',
      timestamp: new Date().toISOString(),
      confidenceGlobal: 0,
      fields: [],
      status: 'error',
      error: 'No se pudieron procesar los documentos'
    };
  }
  
  // Process first successful result (for now)
  const firstResult = apiResponse.results.find((r: any) => r.status === 'success');
  
  if (!firstResult) {
    const firstError = apiResponse.results.find((r: any) => r.status === 'error');
    return {
      engine: 'document-ai-invoice:Error',
      timestamp: new Date().toISOString(),
      confidenceGlobal: 0,
      fields: [],
      status: 'error',
      error: firstError?.error || 'Error al procesar el documento'
    };
  }
  
  // Process entities to OCR fields
  const fields: OCRField[] = [];
  
  if (firstResult.entities) {
    for (const entity of firstResult.entities) {
      const ocrField = processDocumentAIEntity(entity);
      if (ocrField) {
        fields.push(ocrField);
      }
    }
  }
  
  // Calculate global confidence
  const globalConfidence = fields.length > 0 
    ? fields.reduce((sum, field) => sum + field.confidence, 0) / fields.length
    : 0;
  
  // Prepare page information
  const pageInfo = firstResult.pages ? {
    totalPages: firstResult.pages.length,
    selectedPage: 1,
    pageScore: 1.0,
    allPageScores: firstResult.pages.map((_: any, index: number) => 1.0 - (index * 0.1))
  } : undefined;
  
  return {
    engine: 'document-ai-invoice:Document AI — Invoice (EU)',
    timestamp: new Date().toISOString(),
    confidenceGlobal: globalConfidence,
    fields,
    status: 'completed',
    engineInfo: {
      type: 'document-ai-invoice',
      displayName: 'Document AI — Invoice (EU)',
      description: 'Specialized invoice processor'
    },
    pageInfo
  };
};

// H-OCR-FIX: Main OCR processing function
export const processDocumentOCR = async (documentBlob: Blob, filename: string): Promise<OCRResult> => {
  try {
    // Convert blob to file for form data
    const file = new File([documentBlob], filename, { type: documentBlob.type });
    
    // Call Document AI function
    const apiResponse = await callDocumentAIFunction(file);
    
    // Process response
    const ocrResult = processDocumentAIResponse(apiResponse, filename);
    
    return ocrResult;
  } catch (error) {
    console.error('OCR Processing Error:', error);
    
    return {
      engine: 'document-ai-invoice:Error',
      timestamp: new Date().toISOString(),
      confidenceGlobal: 0,
      fields: [],
      status: 'error',
      error: error instanceof Error ? error.message : 'Error desconocido en OCR'
    };
  }
};

// H-OCR-FIX: Check if OCR suggests expense creation
export const shouldSuggestExpense = (ocrResult: OCRResult): boolean => {
  const hasRequiredFields = ocrResult.fields.some(field => 
    ['total_amount', 'purchase_total', 'total_monto'].includes(field.name) && field.confidence >= 0.80
  ) && ocrResult.fields.some(field => 
    ['invoice_date', 'date'].includes(field.name) && field.confidence >= 0.80
  );
  
  return hasRequiredFields && ocrResult.status === 'completed';
};

// H-OCR-FIX: Check if OCR suggests CAPEX creation  
export const shouldSuggestCAPEX = (ocrResult: OCRResult): boolean => {
  // Basic heuristic - could be enhanced with more business logic
  return shouldSuggestExpense(ocrResult) && ocrResult.confidenceGlobal >= 0.60;
};

// H-OCR-FIX: Get critical fields status
export const getCriticalFieldsStatus = (ocrResult: OCRResult): {
  allCriticalValid: boolean;
  hasEmptyCritical: boolean;
  criticalFields: string[];
} => {
  const criticalFieldNames = ['total_amount', 'purchase_total', 'total_monto', 'invoice_date', 'date'];
  const CONFIDENCE_THRESHOLD = 0.80;
  
  const foundCriticalFields = ocrResult.fields.filter(field => 
    criticalFieldNames.includes(field.name)
  );
  
  const validCriticalFields = foundCriticalFields.filter(field => 
    field.confidence >= CONFIDENCE_THRESHOLD && field.value.trim() !== ''
  );
  
  const hasValidTotal = validCriticalFields.some(f => 
    ['total_amount', 'purchase_total', 'total_monto'].includes(f.name)
  );
  const hasValidDate = validCriticalFields.some(f => 
    ['invoice_date', 'date'].includes(f.name)
  );
  
  return {
    allCriticalValid: hasValidTotal && hasValidDate,
    hasEmptyCritical: foundCriticalFields.length < 2,
    criticalFields: foundCriticalFields.map(f => f.name)
  };
};

// H-OCR-FIX: Create expense data from OCR result
export const createExpenseFromOCR = (ocrResult: OCRResult): any => {
  const getFieldValue = (fieldNames: string[]): string => {
    const field = ocrResult.fields.find(f => fieldNames.includes(f.name));
    return field?.value || '';
  };
  
  const getFieldAmount = (fieldNames: string[]): number => {
    const value = getFieldValue(fieldNames);
    const cleanValue = value.replace(/[^\d,.-]/g, '').replace(',', '.');
    return parseFloat(cleanValue) || 0;
  };
  
  return {
    provider: getFieldValue(['supplier_name', 'receiver_name']),
    amount: getFieldAmount(['total_amount', 'purchase_total', 'total_monto']),
    date: getFieldValue(['invoice_date', 'date']),
    invoiceNumber: getFieldValue(['invoice_id']),
    base: getFieldAmount(['subtotal', 'net_amount']),
    iva: getFieldAmount(['tax_amount']),
    nifProveedor: getFieldValue(['supplier_tax_id', 'tax_id']),
    iban: getFieldValue(['iban']),
    tipo: 'Factura',
    categoria: 'Suministros',
    destination: '',
    ocrMeta: {
      engine: ocrResult.engine,
      timestamp: ocrResult.timestamp,
      confidenceGlobal: ocrResult.confidenceGlobal,
      usedFields: ocrResult.fields.filter(f => f.confidence >= 0.80).map(f => ({
        type: f.name,
        value: f.value,
        confidence: f.confidence
      }))
    }
  };
};

// H-OCR-FIX: Bank reconciliation suggestion
export const suggestBankReconciliation = async (
  amount: number, 
  date: string, 
  windowDays: number = 7, 
  tolerance: number = 0.01
): Promise<any[]> => {
  // This would integrate with your bank movements/transactions
  // For now, return empty array as this requires the H8 banking system
  return [];
};

// H-OCR-FIX: Legacy compatibility exports
export { formatCurrency } from './ocrService';
export { normalizeDateToSpanish } from './ocrService';