// H-OCR: OCR Service for Google Document AI integration
import { OCRResult, OCRField } from './db';
import { findProviderByNIF, findProviderByNameOrAlias, initializeDefaultProviders } from './providerDirectoryService';

// H-OCR-ALIGN: Configuration interface with strict alignment requirements
interface OCRConfig {
  autoRun?: boolean;
  confidenceThreshold?: number;
}

// H-OCR-ALIGN: Configurable confidence threshold (default 0.80 as per requirements)
export const OCR_ACCEPT_CONFIDENCE = parseFloat(
  process.env.REACT_APP_OCR_CONFIDENCE_THRESHOLD || 
  localStorage.getItem('OCR_ACCEPT_CONFIDENCE') || 
  '0.80'
);

// H-OCR-ALIGN: Supported entity types for 1:1 mapping (only these are accepted)
export const SUPPORTED_ENTITY_TYPES = [
  'total_amount', 'subtotal', 'net_amount', 'tax_amount', 'tax_rate', 'currency',
  'supplier_name', 'supplier_tax_id', 'invoice_id', 'invoice_date', 'due_date'
] as const;

export type SupportedEntityType = typeof SUPPORTED_ENTITY_TYPES[number];

// H-OCR-FIX: Provider blacklist for filtering demo/example terms
const PROVIDER_BLACKLIST = [
  'EJEMPLO',
  'DEMO', 
  'PLANTILLA',
  'FACTURA DE EJEMPLO',
  'MUESTRA',
  'TEMPLATE',
  'SAMPLE',
  'TEST',
  'PRUEBA'
];

// H-OCR-FIX: Known provider aliases for Spanish utility companies
const KNOWN_PROVIDER_ALIASES = {
  'ENDESA': ['Endesa Energía XXI', 'Endesa Energía', 'ENDESA ENERGIA', 'Endesa S.A.'],
  'EDP': ['EDP Energía', 'EDP España', 'EDP Comercializadora'],
  'NATURGY': ['Naturgy Energy Group', 'Gas Natural Fenosa', 'Naturgy Iberia'],
  'REPSOL': ['Repsol Comercializadora', 'Repsol Gas'],
  'HOLALUZ': ['Holaluz Energía', 'HOLALUZ-CLIDOM'],
  'TOTALENERGIES': ['TotalEnergies Gas y Electricidad España', 'Total Energies'],
  'IBERDROLA': ['Iberdrola Clientes', 'Iberdrola Comercializacion']
};

// H-OCR-FIX: Engine configuration
interface OCREngineInfo {
  type: 'document-ai-invoice' | 'vision-fallback';
  displayName: string;
  description: string;
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

// H-OCR-FIX: Normalize amounts to Spanish format (comma decimal, dot thousands)
export const normalizeAmountToSpanish = (amount: string | number): string => {
  if (typeof amount === 'number') {
    return new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }
  
  // Parse various formats and normalize to Spanish
  const cleanAmount = amount.toString()
    .replace(/[^\d,.-]/g, '') // Remove non-numeric chars except comma, dot, dash
    .trim();
  
  if (!cleanAmount) return '0,00';
  
  // Try to parse the amount considering different formats
  let parsedAmount = 0;
  
  // Format: 1.234,56 (Spanish)
  if (/^\d{1,3}(\.\d{3})*,\d{2}$/.test(cleanAmount)) {
    parsedAmount = parseFloat(cleanAmount.replace(/\./g, '').replace(',', '.'));
  }
  // Format: 1,234.56 (English)
  else if (/^\d{1,3}(,\d{3})*\.\d{2}$/.test(cleanAmount)) {
    parsedAmount = parseFloat(cleanAmount.replace(/,/g, ''));
  }
  // Format: 1234.56 or 1234,56
  else {
    parsedAmount = parseFloat(cleanAmount.replace(',', '.'));
  }
  
  if (isNaN(parsedAmount)) return '0,00';
  
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(parsedAmount);
};

// H-OCR-FIX: Normalize dates to Spanish format (dd/mm/yyyy)
export const normalizeDateToSpanish = (date: string): string => {
  if (!date) return '';
  
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return date; // Return original if invalid
    
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(dateObj);
  } catch {
    return date; // Return original if parsing fails
  }
};

// H-OCR-ALIGN: Validate invoice amounts harmony (Base + IVA ≈ Total ± 0.01)
export const validateInvoiceAmounts = (base: number, iva: number, total: number, discounts: number = 0): {
  isValid: boolean;
  expectedTotal: number;
  difference: number;
} => {
  const expectedTotal = base + iva - discounts;
  const difference = Math.abs(total - expectedTotal);
  const tolerance = 0.01; // ±0.01 tolerance as specified in requirements
  
  // Round difference to avoid floating point precision issues
  const roundedDifference = Math.round(difference * 100) / 100;
  
  return {
    isValid: roundedDifference <= tolerance,
    expectedTotal,
    difference: roundedDifference
  };
};

// H-OCR-ALIGN: Validate plausible dates according to requirements
export const validateInvoiceDates = (invoiceDate: string, dueDate?: string): {
  invoiceDateValid: boolean;
  dueDateValid: boolean;
  errorMessage?: string;
} => {
  try {
    const today = new Date();
    const invoice = new Date(invoiceDate);
    
    // Check if invoice date is not future > 5 days
    const maxFutureDate = new Date();
    maxFutureDate.setDate(today.getDate() + 5);
    
    const invoiceDateValid = invoice <= maxFutureDate;
    let dueDateValid = true;
    let errorMessage: string | undefined;
    
    if (!invoiceDateValid) {
      errorMessage = 'Fecha factura no puede ser más de 5 días en el futuro';
    }
    
    if (dueDate) {
      const due = new Date(dueDate);
      const maxDueDate = new Date(invoice);
      maxDueDate.setDate(invoice.getDate() + 180); // 180 days max
      
      dueDateValid = due >= invoice && due <= maxDueDate;
      
      if (!dueDateValid && !errorMessage) {
        if (due < invoice) {
          errorMessage = 'Fecha vencimiento debe ser >= fecha factura';
        } else {
          errorMessage = 'Fecha vencimiento no puede ser > 180 días después de factura';
        }
      }
    }
    
    return {
      invoiceDateValid,
      dueDateValid,
      errorMessage
    };
  } catch {
    return {
      invoiceDateValid: false,
      dueDateValid: false,
      errorMessage: 'Formato de fecha inválido'
    };
  }
};

// H-OCR-ALIGN: Check if required fields for Apply are present and valid
export const checkRequiredFieldsForApply = (ocrFields: OCRField[]): {
  hasValidTotal: boolean;
  hasValidDate: boolean;
  hasCurrency: boolean;
  canApply: boolean;
  missingFields: string[];
} => {
  const threshold = OCR_ACCEPT_CONFIDENCE;
  
  const totalAmountField = ocrFields.find(f => 
    f.name === 'total_amount' && f.confidence >= threshold && f.value.trim() !== ''
  );
  
  const invoiceDateField = ocrFields.find(f => 
    (f.name === 'invoice_date' || f.name === 'date') && 
    f.confidence >= threshold && f.value.trim() !== ''
  );
  
  const currencyField = ocrFields.find(f => 
    f.name === 'currency' && f.confidence >= threshold && f.value.trim() !== ''
  );
  
  const hasValidTotal = !!totalAmountField;
  const hasValidDate = invoiceDateField ? validateInvoiceDates(invoiceDateField.value).invoiceDateValid : false;
  const hasCurrency = !!currencyField;
  
  const missingFields: string[] = [];
  if (!hasValidTotal) missingFields.push('total_amount');
  if (!hasValidDate) missingFields.push('invoice_date válida');
  if (!hasCurrency) missingFields.push('currency');
  
  return {
    hasValidTotal,
    hasValidDate,
    hasCurrency,
    canApply: hasValidTotal && hasValidDate && hasCurrency,
    missingFields
  };
};

// H-OCR-FIX: Check if provider name is in blacklist
export const isProviderBlacklisted = (providerName: string): boolean => {
  if (!providerName) return false;
  
  const upperProvider = providerName.toUpperCase().trim();
  return PROVIDER_BLACKLIST.some(blacklisted => 
    upperProvider.includes(blacklisted)
  );
};

// H-OCR-FIX: Enhanced provider resolution using directory and sequential pipeline
export const resolveProviderAdvanced = async (
  detectedProvider: string,
  detectedNIF?: string,
  confidence: number = 0.80
): Promise<{
  canonicalName: string;
  confidence: number;
  source: 'native' | 'nif-directory' | 'alias' | 'directory-match' | 'original' | 'blacklisted';
  suggestions?: string[];
}> => {
  if (!detectedProvider) {
    return { canonicalName: '', confidence: 0, source: 'original' };
  }
  
  const upperProvider = detectedProvider.toUpperCase().trim();
  
  // Step 1: Check blacklist first
  if (isProviderBlacklisted(upperProvider)) {
    return { canonicalName: '', confidence: 0, source: 'blacklisted' };
  }
  
  // Step 2: If this is from native Invoice Parser with high confidence, use it
  if (confidence >= 0.85) {
    // Still check against directory for canonical name
    const directoryMatch = await findProviderByNameOrAlias(detectedProvider);
    if (directoryMatch) {
      return { 
        canonicalName: directoryMatch.canonicalName, 
        confidence: 0.95, 
        source: 'native' 
      };
    }
    return { canonicalName: detectedProvider, confidence, source: 'native' };
  }
  
  // Step 3: NIF/CIF lookup in directory
  if (detectedNIF) {
    const nifMatch = await findProviderByNIF(detectedNIF);
    if (nifMatch) {
      return { 
        canonicalName: nifMatch.canonicalName, 
        confidence: 0.90, 
        source: 'nif-directory' 
      };
    }
  }
  
  // Step 4: Directory search by name/alias
  const directoryMatch = await findProviderByNameOrAlias(detectedProvider);
  if (directoryMatch) {
    return { 
      canonicalName: directoryMatch.canonicalName, 
      confidence: 0.85, 
      source: 'directory-match' 
    };
  }
  
  // Step 5: Fallback to known aliases (legacy method)
  const aliasMatch = resolveProviderAlias(detectedProvider);
  if (aliasMatch.canonicalName && aliasMatch.source === 'alias') {
    return {
      canonicalName: aliasMatch.canonicalName,
      confidence: aliasMatch.confidence,
      source: 'alias'
    };
  }
  
  // Step 6: If confidence is low, return with suggestions for user confirmation
  if (confidence < 0.85) {
    const suggestions = await getProviderSuggestions(detectedProvider);
    return { 
      canonicalName: detectedProvider, 
      confidence, 
      source: 'original',
      suggestions 
    };
  }
  
  // Return original if no match found
  return { canonicalName: detectedProvider, confidence, source: 'original' };
};

// H-OCR-FIX: Resolve provider using known aliases (legacy function)
export const resolveProviderAlias = (detectedProvider: string): {
  canonicalName: string;
  confidence: number;
  source: 'alias' | 'original';
} => {
  if (!detectedProvider) {
    return { canonicalName: '', confidence: 0, source: 'original' };
  }
  
  const upperProvider = detectedProvider.toUpperCase().trim();
  
  // Check if it's blacklisted first
  if (isProviderBlacklisted(upperProvider)) {
    return { canonicalName: '', confidence: 0, source: 'original' };
  }
  
  // Check against known aliases
  for (const [canonical, aliases] of Object.entries(KNOWN_PROVIDER_ALIASES)) {
    // Direct match with canonical name
    if (upperProvider === canonical) {
      return { canonicalName: canonical, confidence: 0.95, source: 'alias' };
    }
    
    // Check aliases
    for (const alias of aliases) {
      if (upperProvider.includes(alias.toUpperCase()) || alias.toUpperCase().includes(upperProvider)) {
        return { canonicalName: canonical, confidence: 0.90, source: 'alias' };
      }
    }
  }
  
  // Return original if no alias found
  return { canonicalName: detectedProvider, confidence: 0.80, source: 'original' };
};

// H-OCR-FIX: Get TOP 3 provider suggestions for low-confidence matches
export const getProviderSuggestions = async (detectedProvider: string): Promise<string[]> => {
  try {
    // Initialize directory if not exists
    await initializeDefaultProviders();
    
    const searchTerm = detectedProvider.toLowerCase();
    const suggestions: { name: string; score: number }[] = [];
    
    // Add known aliases with scoring
    Object.keys(KNOWN_PROVIDER_ALIASES).forEach(canonical => {
      const aliases = (KNOWN_PROVIDER_ALIASES as any)[canonical];
      const score = canonical.toLowerCase().includes(searchTerm) ? 0.8 : 
                   aliases.some((alias: string) => 
                     alias.toLowerCase().includes(searchTerm)) ? 0.6 : 0;
      
      if (score > 0) {
        suggestions.push({ name: canonical, score });
      }
    });
    
    // Sort by score and return top 3
    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(s => s.name);
  } catch (error) {
    console.error('Error getting provider suggestions:', error);
    return [];
  }
};

// H-OCR: Format percentage in Spanish locale
export const formatPercentage = (value: number): string => {
  return new Intl.NumberFormat('es-ES', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value / 100);
};

// H-OCR-ALIGN: Get OCR configuration from environment/localStorage
export const getOCRConfig = (): OCRConfig => {
  return {
    autoRun: localStorage.getItem('OCR_AUTORUN') === 'true',
    confidenceThreshold: OCR_ACCEPT_CONFIDENCE
  };
};

// H-OCR: Process invoice with direct blob upload to Netlify function
export async function processInvoice(blob: Blob): Promise<any> {
  const res = await fetch('/.netlify/functions/ocr-documentai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: blob,
  });
  const text = await res.text();
  try { 
    return JSON.parse(text); 
  } catch { 
    throw new Error(`OCR bad JSON: ${text.slice(0,180)}`); 
  }
}

// H-OCR: Format currency in Spanish locale
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

// H-OCR-FIX: Enhanced OCR processing with provider resolution and Spanish normalization
export const processDocumentOCR = async (documentBlob: Blob, filename: string): Promise<OCRResult> => {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

  // Determine engine type (simulate fallback logic)
  const shouldUseInvoiceParser = filename.toLowerCase().includes('factura') || 
                                filename.toLowerCase().includes('invoice') ||
                                filename.toLowerCase().includes('recibo');
  
  const engineInfo: OCREngineInfo = shouldUseInvoiceParser && Math.random() > 0.1 
    ? { type: 'document-ai-invoice', displayName: 'Document AI — Invoice (EU)', description: 'Specialized invoice processor' }
    : { type: 'vision-fallback', displayName: 'Vision OCR (generic)', description: 'Generic text extraction' };
  
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
    // H-OCR-FIX: Enhanced mock invoice fields with advanced provider resolution
    const rawProvider = Math.random() > 0.2 ? 'Endesa Energía XXI, S.L.U.' : 'EMPRESA EJEMPLO S.L.'; // 20% chance of example
    const rawNIF = Math.random() > 0.2 ? 'B82846817' : '';
    const providerResolution = await resolveProviderAdvanced(rawProvider, rawNIF, 0.95);
    
    // Only add provider if not blacklisted
    if (providerResolution.canonicalName) {
      fields.push({
        name: 'proveedor',
        value: providerResolution.canonicalName,
        confidence: providerResolution.confidence,
        raw: rawProvider
      });
    }
    
    if (rawNIF) {
      fields.push({ name: 'proveedorNIF', value: rawNIF, confidence: 0.92 });
    }
    
    fields.push(
      { name: 'numeroFactura', value: 'FE-2024-001234', confidence: 0.98 },
      { name: 'fechaEmision', value: normalizeDateToSpanish('2024-01-15'), confidence: 0.94 },
      { name: 'fechaVencimiento', value: normalizeDateToSpanish('2024-02-15'), confidence: 0.89 },
      { name: 'importe', value: normalizeAmountToSpanish(156.78), confidence: 0.96 },
      { name: 'base', value: normalizeAmountToSpanish(129.65), confidence: 0.93 },
      { name: 'iva', value: normalizeAmountToSpanish(27.13), confidence: 0.91 },
      { name: 'cups', value: 'ES0031406512345678JY0F', confidence: 0.87 },
      { name: 'direccionSuministro', value: 'Calle Mayor, 123, 28001 Madrid', confidence: 0.85 }
    );
  } else {
    // Generic document fields
    const rawProvider = Math.random() > 0.3 ? 'Empresa Ejemplo S.L.' : 'Naturgy Energy Group S.A.';
    const providerResolution = await resolveProviderAdvanced(rawProvider, '', 0.80);
    
    if (providerResolution.canonicalName) {
      fields.push({
        name: 'proveedor',
        value: providerResolution.canonicalName,
        confidence: providerResolution.confidence,
        raw: rawProvider
      });
    }
    
    fields.push(
      { name: 'fechaEmision', value: normalizeDateToSpanish('2024-01-20'), confidence: 0.88 },
      { name: 'importe', value: normalizeAmountToSpanish(245.30), confidence: 0.82 }
    );
  }

  // Add construction-related indicators for CAPEX detection
  if (isConstructionRelated) {
    fields.push(
      { name: 'categoria', value: 'Reforma/CAPEX', confidence: 0.78 },
      { name: 'concepto', value: 'Material de construcción', confidence: 0.82 }
    );
  }

  // H-OCR-FIX: Simulate multi-page processing
  const mockPages = [
    'FACTURA Nº FE-2024-001234\nEndesa Energía XXI, S.L.U.\nNIF: B82846817\nIMPORTE TOTAL: 156,78 €\nIVA: 27,13 €\nBASE: 129,65 €',
    'CONDICIONES LEGALES\nTérminos y condiciones de suministro\nPolítica de privacidad\nProtección de datos personales',
    'CUPS: ES0031406512345678JY0F\nDirección: Calle Mayor, 123\n28001 Madrid'
  ];
  
  const pageAnalysis = selectBestPageForExtraction(mockPages);

  const globalConfidence = fields.reduce((sum, field) => sum + field.confidence, 0) / fields.length;

  return {
    engine: `${engineInfo.type}:${engineInfo.displayName}`,
    timestamp: new Date().toISOString(),
    confidenceGlobal: globalConfidence,
    fields,
    status: 'completed',
    engineInfo, // H-OCR-FIX: Add engine details for transparency
    pageInfo: {
      totalPages: mockPages.length,
      selectedPage: pageAnalysis.bestPageIndex + 1, // 1-based for UI
      pageScore: pageAnalysis.score,
      allPageScores: pageAnalysis.allScores
    }
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

// H-OCR-FIX: Get critical fields and their validation status
export const getCriticalFieldsStatus = (ocrResult: OCRResult): {
  fields: { name: string; value: string; confidence: number; isCritical: boolean; isValid: boolean }[];
  allCriticalValid: boolean;
  hasEmptyCritical: boolean;
} => {
  const CRITICAL_FIELDS = ['proveedor', 'numeroFactura', 'fechaEmision', 'importe'];
  const CONFIDENCE_THRESHOLD = 0.80;
  
  const fieldStatus = ocrResult.fields.map(field => {
    const isCritical = CRITICAL_FIELDS.includes(field.name);
    const isValid = field.confidence >= CONFIDENCE_THRESHOLD && field.value.trim() !== '';
    
    return {
      name: field.name,
      value: field.value,
      confidence: field.confidence,
      isCritical,
      isValid: isCritical ? isValid : true // Non-critical fields are always "valid"
    };
  });
  
  const criticalFields = fieldStatus.filter(f => f.isCritical);
  const allCriticalValid = criticalFields.every(f => f.isValid);
  const hasEmptyCritical = criticalFields.some(f => !f.value.trim());
  
  return {
    fields: fieldStatus,
    allCriticalValid,
    hasEmptyCritical
  };
};

// H-OCR-FIX: Get confidence icon for field display
export const getConfidenceIcon = (confidence: number): string => {
  if (confidence >= 0.85) return '✅';
  if (confidence >= 0.70) return '⚠️';
  return '⛔';
};

// H-OCR-ALIGN: Multi-page document scoring for better field extraction
export const scorePageForInvoiceFields = (pageText: string): number => {
  const keywords = [
    'FACTURA', 'INVOICE', 'Nº FACTURA', 'INVOICE NUMBER',
    'IVA', 'VAT', 'TOTAL', 'IMPORTE', 'AMOUNT',
    'NIF', 'CIF', 'TAX ID',
    'CUPS', 'IBAN',
    'FECHA', 'DATE', 'VENCIMIENTO', 'DUE'
  ];
  
  const legalTerms = [
    'CONDICIONES LEGALES', 'TÉRMINOS Y CONDICIONES', 'LEGAL CONDITIONS',
    'POLÍTICA DE PRIVACIDAD', 'PRIVACY POLICY', 'PROTECCIÓN DE DATOS',
    'AVISO LEGAL', 'LEGAL NOTICE', 'DISCLAIMER'
  ];
  
  const monetaryTerms = [
    'TOTAL', 'SUBTOTAL', 'IVA', 'IMPORTE', 'AMOUNT', '€', 'EUR',
    'BASE IMPONIBLE', 'TAXABLE BASE'
  ];
  
  let score = 0;
  const upperText = pageText.toUpperCase();
  
  // Positive scoring for relevant keywords
  keywords.forEach(keyword => {
    const matches = (upperText.match(new RegExp(keyword, 'g')) || []).length;
    score += matches * 10;
  });
  
  // Extra points for monetary terms (higher weight for H-OCR-ALIGN)
  monetaryTerms.forEach(term => {
    const matches = (upperText.match(new RegExp(term, 'g')) || []).length;
    score += matches * 15;
  });
  
  // Penalty for legal/footer content
  legalTerms.forEach(term => {
    const matches = (upperText.match(new RegExp(term, 'g')) || []).length;
    score -= matches * 20;
  });
  
  return Math.max(0, score);
};

// H-OCR-ALIGN: Select best page based on monetary entity coverage + confidence
export const selectBestPageForExtraction = (pages: string[], ocrFields?: OCRField[]): {
  bestPageIndex: number;
  score: number;
  allScores: number[];
} => {
  if (pages.length === 0) {
    return { bestPageIndex: -1, score: 0, allScores: [] };
  }
  
  if (pages.length === 1) {
    return { bestPageIndex: 0, score: scorePageForInvoiceFields(pages[0]), allScores: [scorePageForInvoiceFields(pages[0])] };
  }
  
  // If we have OCR fields with page info, prioritize pages with monetary entities
  if (ocrFields && ocrFields.some(f => f.page !== undefined)) {
    const pageScores = new Array(pages.length).fill(0);
    
    ocrFields.forEach(field => {
      if (field.page !== undefined && field.page >= 1 && field.page <= pages.length) {
        const pageIndex = field.page - 1; // Convert to 0-based
        
        // Higher weight for monetary fields (as per H-OCR-ALIGN requirements)
        const monetaryFields = ['total_amount', 'subtotal', 'net_amount', 'tax_amount'];
        const weight = monetaryFields.includes(field.name) ? 20 : 10;
        
        // Add confidence-weighted score
        pageScores[pageIndex] += weight * field.confidence;
      }
    });
    
    const maxScore = Math.max(...pageScores);
    const bestPageIndex = pageScores.indexOf(maxScore);
    
    return {
      bestPageIndex,
      score: maxScore,
      allScores: pageScores
    };
  }
  
  // Fallback to text-based scoring
  const scores = pages.map(page => scorePageForInvoiceFields(page));
  const maxScore = Math.max(...scores);
  const bestPageIndex = scores.indexOf(maxScore);
  
  return {
    bestPageIndex,
    score: maxScore,
    allScores: scores
  };
};

// H-OCR-ALIGN: Get fields suitable for automatic application (high confidence only)
export const getApplicableFields = (ocrResult: OCRResult, threshold: number = OCR_ACCEPT_CONFIDENCE): OCRField[] => {
  return ocrResult.fields.filter(field => 
    field.confidence >= threshold && 
    field.value.trim() !== '' &&
    !isProviderBlacklisted(field.name === 'proveedor' ? field.value : '') &&
    SUPPORTED_ENTITY_TYPES.includes(field.name as SupportedEntityType)
  );
};

// H-OCR: Filter fields by confidence threshold (legacy function for backward compatibility)
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