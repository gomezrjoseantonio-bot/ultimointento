// H-OCR: OCR Service for Google Document AI integration
import { OCRResult, OCRField } from './db';

// H-OCR: Configuration interface
interface OCRConfig {
  autoRun?: boolean;
  confidenceThreshold?: number;
}

// H-OCR: Mapped invoice fields from Google Document AI
// interface InvoiceFields {
//   proveedor?: string;
//   proveedorNIF?: string;
//   numeroFactura?: string;
//   fechaEmision?: string;
//   fechaVencimiento?: string;
//   importe?: number;
//   base?: number;
//   iva?: number;
//   periodoDesde?: string;
//   periodoHasta?: string;
//   cups?: string;
//   direccionSuministro?: string;
//   cuentaCargo?: string;
// }

// H-OCR: Format currency in Spanish locale
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

// H-OCR: Format percentage in Spanish locale
export const formatPercentage = (value: number): string => {
  return new Intl.NumberFormat('es-ES', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value / 100);
};

// H-OCR: Get OCR configuration from environment/localStorage
export const getOCRConfig = (): OCRConfig => {
  return {
    autoRun: localStorage.getItem('OCR_AUTORUN') === 'true',
    confidenceThreshold: parseFloat(localStorage.getItem('OCR_CONFIDENCE_THRESHOLD') || '0.7')
  };
};

// H-OCR: Simulate Google Document AI processing (real implementation would call serverless function)
export const processDocumentOCR = async (documentBlob: Blob, filename: string): Promise<OCRResult> => {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

  // Simulate different outcomes based on file type
  const isInvoice = filename.toLowerCase().includes('factura') || 
                   filename.toLowerCase().includes('invoice') ||
                   filename.toLowerCase().includes('recibo');
  
  const isConstructionRelated = filename.toLowerCase().includes('obra') ||
                               filename.toLowerCase().includes('reforma') ||
                               filename.toLowerCase().includes('construccion') ||
                               filename.toLowerCase().includes('material');

  if (Math.random() < 0.1) {
    // 10% chance of error
    throw new Error('Error al procesar el documento: archivo no válido o dañado');
  }

  // Generate mock OCR fields based on document type
  const fields: OCRField[] = [];
  
  if (isInvoice) {
    // Mock invoice fields
    fields.push(
      { name: 'proveedor', value: 'Endesa Energía XXI, S.L.U.', confidence: 0.95 },
      { name: 'proveedorNIF', value: 'B82846817', confidence: 0.92 },
      { name: 'numeroFactura', value: 'FE-2024-001234', confidence: 0.98 },
      { name: 'fechaEmision', value: '2024-01-15', confidence: 0.94 },
      { name: 'fechaVencimiento', value: '2024-02-15', confidence: 0.89 },
      { name: 'importe', value: '156.78', confidence: 0.96 },
      { name: 'base', value: '129.65', confidence: 0.93 },
      { name: 'iva', value: '27.13', confidence: 0.91 },
      { name: 'cups', value: 'ES0031406512345678JY0F', confidence: 0.87 },
      { name: 'direccionSuministro', value: 'Calle Mayor, 123, 28001 Madrid', confidence: 0.85 }
    );
  } else {
    // Generic document fields
    fields.push(
      { name: 'proveedor', value: 'Empresa Ejemplo S.L.', confidence: 0.85 },
      { name: 'fechaEmision', value: '2024-01-20', confidence: 0.88 },
      { name: 'importe', value: '245.30', confidence: 0.82 }
    );
  }

  // Add construction-related indicators for CAPEX detection
  if (isConstructionRelated) {
    fields.push(
      { name: 'categoria', value: 'Reforma/CAPEX', confidence: 0.78 },
      { name: 'concepto', value: 'Material de construcción', confidence: 0.82 }
    );
  }

  const globalConfidence = fields.reduce((sum, field) => sum + field.confidence, 0) / fields.length;

  return {
    engine: 'gdocai:invoice',
    timestamp: new Date().toISOString(),
    confidenceGlobal: globalConfidence,
    fields,
    status: 'completed'
  };
};

// H-OCR: Check if document suggests expense creation
export const shouldSuggestExpense = (ocrResult: OCRResult): boolean => {
  const hasInvoiceFields = ocrResult.fields.some(field => 
    ['proveedor', 'numeroFactura', 'importe'].includes(field.name)
  );
  return hasInvoiceFields && ocrResult.confidenceGlobal >= 0.7;
};

// H-OCR: Check if document suggests CAPEX creation
export const shouldSuggestCAPEX = (ocrResult: OCRResult): boolean => {
  const hasConstructionIndicators = ocrResult.fields.some(field => 
    (field.name === 'categoria' && field.value.toLowerCase().includes('reforma')) ||
    (field.name === 'concepto' && (
      field.value.toLowerCase().includes('obra') ||
      field.value.toLowerCase().includes('reforma') ||
      field.value.toLowerCase().includes('construcción') ||
      field.value.toLowerCase().includes('material')
    ))
  );
  return hasConstructionIndicators || ocrResult.confidenceGlobal >= 0.6;
};

// H-OCR: Get OCR field by name
export const getOCRField = (ocrResult: OCRResult, fieldName: string): OCRField | undefined => {
  return ocrResult.fields.find(field => field.name === fieldName);
};

// H-OCR: Filter fields by confidence threshold
export const getHighConfidenceFields = (ocrResult: OCRResult, threshold: number = 0.7): OCRField[] => {
  return ocrResult.fields.filter(field => field.confidence >= threshold);
};

// H-OCR: Create expense data from OCR result
export const createExpenseFromOCR = (ocrResult: OCRResult) => {
  const provider = getOCRField(ocrResult, 'proveedor')?.value || '';
  const amount = parseFloat(getOCRField(ocrResult, 'importe')?.value || '0');
  const date = getOCRField(ocrResult, 'fechaEmision')?.value || new Date().toISOString().split('T')[0];
  const invoiceNumber = getOCRField(ocrResult, 'numeroFactura')?.value || '';
  const base = parseFloat(getOCRField(ocrResult, 'base')?.value || '0');
  const iva = parseFloat(getOCRField(ocrResult, 'iva')?.value || '0');

  return {
    provider,
    amount,
    date,
    invoiceNumber,
    base,
    iva,
    tipo: 'Factura',
    categoria: 'Suministros', // Default suggestion
    // Try to match property by CUPS or address
    destination: '', // Will be suggested based on CUPS/address matching
  };
};