// H-OCR-FIX: Enhanced OCR Service for Google Document AI integration
import { OCRResult, OCRField } from './db';
import { callScanChat } from './scanChatService';

const ENTITY_TYPE_MAPPINGS: Record<string, string> = {
  'total_amount': 'total_amount',
  'net_amount': 'net_amount', 
  'subtotal_amount': 'subtotal',
  'tax_amount': 'tax_amount',
  'total_tax_amount': 'tax_amount',
  'vat_amount': 'tax_amount',
  'purchase_total': 'total_amount',
  'total_monto': 'total_amount',
  'subtotal': 'subtotal',
  'currency': 'currency',
  'invoice_id': 'invoice_id',
  'invoice_number': 'invoice_id',
  'document_id': 'invoice_id',
  'invoice_date': 'invoice_date',
  'issue_date': 'invoice_date',
  'date': 'invoice_date',
  'due_date': 'due_date',
  'payment_due_date': 'due_date',
  'supplier_name': 'supplier_name',
  'supplier_address': 'supplier_address',
  'supplier_tax_id': 'supplier_tax_id',
  'supplier_registration_number': 'supplier_tax_id',
  'supplier_email': 'supplier_email',
  'supplier_phone': 'supplier_phone',
  'vendor_name': 'supplier_name',
  'vendor_address': 'supplier_address',
  'receiver_name': 'receiver_name',
  'receiver_address': 'receiver_address',
  'receiver_tax_id': 'receiver_tax_id',
  'customer_name': 'receiver_name',
  'customer_address': 'receiver_address',
  'tax_id': 'tax_id',
  'vat_id': 'supplier_tax_id',
  'tax_rate': 'tax_rate',
  'vat_rate': 'tax_rate',
  'iban': 'iban',
  'account_number': 'iban',
  'payment_terms': 'payment_terms',
  'line_item': 'line_item',
  'line_item_description': 'line_item_description',
  'line_item_quantity': 'line_item_quantity',
  'line_item_amount': 'line_item_amount'
};

const formatCurrencyFromDocumentAI = (value: any): string => {
  if (typeof value === 'object' && value.moneyValue) {
    const units = parseInt(value.moneyValue.units || '0');
    const nanos = parseInt(value.moneyValue.nanos || '0');
    const amount = units + (nanos / 1_000_000_000);
    return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  }
  if (typeof value === 'string') {
    const cleanValue = value.replace(/[^\d,.-]/g, '');
    const parsedAmount = parseFloat(cleanValue.replace(',', '.'));
    if (!isNaN(parsedAmount)) {
      return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parsedAmount);
    }
  }
  return value?.toString() || '';
};

const formatDateFromDocumentAI = (value: any): string => {
  if (typeof value === 'object' && value.dateValue) {
    const { year, month, day } = value.dateValue;
    const date = new Date(year, month - 1, day);
    return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  }
  if (typeof value === 'string') {
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
      }
    } catch { /* return original */ }
  }
  return value?.toString() || '';
};

const processDocumentAIEntity = (entity: any): OCRField | null => {
  const entityType = entity.type?.toLowerCase();
  const mappedType = ENTITY_TYPE_MAPPINGS[entityType];
  if (!mappedType) return null;

  let processedValue = '';
  if (entity.normalizedValue) {
    if (entity.normalizedValue.moneyValue) {
      processedValue = formatCurrencyFromDocumentAI(entity.normalizedValue);
    } else if (entity.normalizedValue.dateValue) {
      processedValue = formatDateFromDocumentAI(entity.normalizedValue);
    } else if (entity.normalizedValue.text) {
      processedValue = entity.normalizedValue.text;
    }
  }
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

export const callDocumentAIFunction = async (file: File): Promise<any> => {
  try {
    const responseData = await callScanChat(file, file.type || 'application/pdf');
    const extracted = responseData.extraido && typeof responseData.extraido === 'object'
      ? responseData.extraido
      : {};

    const confidence = Number(extracted.confianza);
    const safeConfidence = Number.isFinite(confidence) ? confidence : 0.8;

    const entities = [
      extracted.proveedor      ? { type: 'supplier_name', mentionText: String(extracted.proveedor),      confidence: safeConfidence } : null,
      extracted.numero_factura ? { type: 'invoice_id',    mentionText: String(extracted.numero_factura), confidence: safeConfidence } : null,
      extracted.base_imponible ? { type: 'net_amount',    mentionText: String(extracted.base_imponible), confidence: safeConfidence } : null,
      extracted.importe_total  ? { type: 'total_amount',  mentionText: String(extracted.importe_total),  confidence: safeConfidence } : null,
      extracted.iva            ? { type: 'tax_amount',    mentionText: String(extracted.iva),            confidence: safeConfidence } : null,
      extracted.fecha          ? { type: 'invoice_date',  mentionText: String(extracted.fecha),          confidence: safeConfidence } : null,
      extracted.moneda         ? { type: 'currency',      mentionText: String(extracted.moneda),         confidence: safeConfidence } : null,
    ].filter(Boolean);

    return {
      success: true,
      extractedData: extracted,
      results: [{
        status: 'success',
        entities,
        text: typeof responseData.extraido === 'string'
          ? responseData.extraido
          : (extracted.notas ? String(extracted.notas) : JSON.stringify(extracted))
      }]
    };
  } catch (error) {
    console.error('Document AI Function Error:', error);
    throw error;
  }
};

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

  const firstResult = apiResponse.results.find((r: any) => r.status === 'success');
  const extractedData = apiResponse.extractedData && typeof apiResponse.extractedData === 'object'
    ? apiResponse.extractedData
    : undefined;

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

  const fields: OCRField[] = [];
  if (firstResult.entities) {
    for (const entity of firstResult.entities) {
      const ocrField = processDocumentAIEntity(entity);
      if (ocrField) fields.push(ocrField);
    }
  }

  const globalConfidence = fields.length > 0
    ? fields.reduce((sum, field) => sum + field.confidence, 0) / fields.length
    : 0;

  const validationWarnings: string[] = [];
  const baseAmount  = parseFloat(fields.find(f => f.name === 'net_amount' || f.name === 'subtotal')?.value || '0');
  const taxAmount   = parseFloat(fields.find(f => f.name === 'tax_amount')?.value || '0');
  const totalAmount = parseFloat(fields.find(f => f.name === 'total_amount')?.value || '0');

  if (baseAmount > 0 && taxAmount > 0 && totalAmount > 0) {
    const calculatedTotal = baseAmount + taxAmount;
    const roundedDiff = Math.round(Math.abs(totalAmount - calculatedTotal) * 100) / 100;
    if (roundedDiff > 0.01) {
      validationWarnings.push(
        `Totales no cuadran: Base ${baseAmount.toFixed(2)} + IVA ${taxAmount.toFixed(2)} = ${calculatedTotal.toFixed(2)} ≠ Total ${totalAmount.toFixed(2)} (diferencia: ${roundedDiff.toFixed(2)}€)`
      );
    }
  }

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
    // ── FIX: data incluye direccion y tipo_gasto del nuevo prompt ──
    data: extractedData ? {
      proveedor:      extractedData.proveedor      != null ? String(extractedData.proveedor)      : undefined,
      numero_factura: extractedData.numero_factura != null ? String(extractedData.numero_factura) : undefined,
      fecha:          extractedData.fecha          != null ? String(extractedData.fecha)          : undefined,
      base_imponible: extractedData.base_imponible != null ? extractedData.base_imponible         : undefined,
      iva:            extractedData.iva            != null ? extractedData.iva                    : undefined,
      importe_total:  extractedData.importe_total  != null ? extractedData.importe_total          : undefined,
      moneda:         extractedData.moneda         != null ? String(extractedData.moneda)         : undefined,
      direccion:      extractedData.direccion      != null ? String(extractedData.direccion)      : undefined,
      tipo_gasto:     extractedData.tipo_gasto     != null ? String(extractedData.tipo_gasto)     : undefined,
      confianza:      Number.isFinite(Number(extractedData.confianza)) ? Number(extractedData.confianza) : undefined,
      notas:          extractedData.notas          != null ? String(extractedData.notas)          : undefined,
    } : undefined,
    status: 'completed',
    validationWarnings,
    engineInfo: {
      type: 'document-ai-invoice',
      displayName: 'Document AI — Invoice (EU)',
      description: 'Specialized invoice processor'
    },
    pageInfo
  };
};

export const processDocumentOCR = async (documentBlob: Blob, filename: string): Promise<OCRResult> => {
  try {
    const file = new File([documentBlob], filename, { type: documentBlob.type });
    const apiResponse = await callDocumentAIFunction(file);
    return processDocumentAIResponse(apiResponse, filename);
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

export const shouldSuggestExpense = (ocrResult: OCRResult): boolean => {
  const hasRequiredFields = ocrResult.fields.some(field =>
    ['total_amount', 'purchase_total', 'total_monto'].includes(field.name) && field.confidence >= 0.80
  ) && ocrResult.fields.some(field =>
    ['invoice_date', 'date'].includes(field.name) && field.confidence >= 0.80
  );
  return hasRequiredFields && ocrResult.status === 'completed';
};

export const shouldSuggestCAPEX = (ocrResult: OCRResult): boolean =>
  shouldSuggestExpense(ocrResult) && ocrResult.confidenceGlobal >= 0.60;

export const getCriticalFieldsStatus = (ocrResult: OCRResult): {
  allCriticalValid: boolean;
  hasEmptyCritical: boolean;
  criticalFields: string[];
} => {
  const criticalFieldNames = ['total_amount', 'purchase_total', 'total_monto', 'invoice_date', 'date'];
  const CONFIDENCE_THRESHOLD = 0.80;
  const foundCriticalFields = ocrResult.fields.filter(f => criticalFieldNames.includes(f.name));
  const validCriticalFields = foundCriticalFields.filter(f => f.confidence >= CONFIDENCE_THRESHOLD && f.value.trim() !== '');
  return {
    allCriticalValid: validCriticalFields.some(f => ['total_amount', 'purchase_total', 'total_monto'].includes(f.name))
      && validCriticalFields.some(f => ['invoice_date', 'date'].includes(f.name)),
    hasEmptyCritical: foundCriticalFields.length < 2,
    criticalFields: foundCriticalFields.map(f => f.name)
  };
};

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
        type: f.name, value: f.value, confidence: f.confidence
      }))
    }
  };
};

export const suggestBankReconciliation = async (
  _amount: number, _date: string, _windowDays: number = 7, _tolerance: number = 0.01
): Promise<any[]> => [];

export { formatCurrency } from './ocrService';
export { normalizeDateToSpanish } from './ocrService';
