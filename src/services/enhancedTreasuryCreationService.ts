/**
 * Enhanced Treasury Creation Service
 * 
 * Handles Treasury movement creation from Inbox documents with:
 * - Origin differentiation (ocr_document vs bank_extract)
 * - Enhanced field extraction for treasury integration
 * - Account linking for bank statements
 * - Document correction workflow support
 */

import { initDB, Movement, Account, Ingreso, Gasto, CAPEX } from './db';
import { DocumentType } from './unicornioDocumentDetection';
import { safeMatch } from '../utils/safe';

export type TreasuryOrigin = 'ocr_document' | 'bank_extract' | 'manual_entry';

export interface TreasuryMovementCreationResult {
  success: boolean;
  movementId?: number;
  recordId?: number;
  recordType?: 'ingreso' | 'gasto' | 'capex' | 'movement';
  origen: TreasuryOrigin;
  message: string;
  requiresAccountSelection?: boolean;
  suggestedAccounts?: Account[];
}

export interface DocumentOCRFields {
  // Basic document info
  proveedor_nombre?: string;
  total_amount?: number;
  invoice_date?: string;
  due_date?: string;
  
  // Property assignment
  inmueble_alias?: string;
  property_id?: number;
  
  // Banking info
  iban_detectado?: string;
  iban_masked?: string;
  banco_nombre?: string;
  
  // Contract/tenant info
  arrendatario_nombre?: string;
  contrato_id?: number;
  
  // Tax info
  iva_rate?: number;
  iva_amount?: number;
  base_amount?: number;
  
  // Additional classification
  expense_category?: string;
  is_capex?: boolean;
  aeat_classification?: string;
  
  // Bank extract specific
  account_balance?: number;
  transaction_reference?: string;
  counterparty?: string;
}

/**
 * Creates treasury movement from OCR document
 */
export const createTreasuryMovementFromOCR = async (
  documentId: string,
  documentType: DocumentType,
  extractedFields: DocumentOCRFields,
  filename: string
): Promise<TreasuryMovementCreationResult> => {
  try {
    // Validate required fields
    if (!extractedFields.total_amount || extractedFields.total_amount <= 0) {
      return {
        success: false,
        origen: 'ocr_document',
        message: 'No se detectó un importe válido en el documento'
      };
    }

    // Determine record type based on document type and content
    const recordType = determineRecordType(documentType, extractedFields);
    
    switch (recordType) {
      case 'ingreso':
        return await createIngresoFromOCR(documentId, extractedFields, filename);
        
      case 'gasto':
        return await createGastoFromOCR(documentId, extractedFields, filename);
        
      case 'capex':
        return await createCAPEXFromOCR(documentId, extractedFields, filename);
        
      default:
        return {
          success: false,
          origen: 'ocr_document',
          message: 'No se pudo determinar el tipo de registro de tesorería'
        };
    }
    
  } catch (error) {
    console.error('Error creating treasury movement from OCR:', error);
    return {
      success: false,
      origen: 'ocr_document',
      message: `Error al crear movimiento de tesorería: ${error}`
    };
  }
};

/**
 * Creates treasury movement from bank extract
 */
export const createTreasuryMovementFromBankExtract = async (
  extractData: {
    accountId?: number;
    transactions: Array<{
      date: string;
      amount: number;
      description: string;
      counterparty?: string;
      reference?: string;
      balance?: number;
    }>;
  },
  filename: string
): Promise<TreasuryMovementCreationResult> => {
  try {
    const db = await initDB();
    
    // Check if account is selected
    if (!extractData.accountId) {
      // Get available accounts for selection
      const accounts = await db.getAll('accounts');
      const activeAccounts = accounts.filter(acc => acc.isActive);
      
      return {
        success: false,
        origen: 'bank_extract',
        message: 'Selecciona una cuenta bancaria para importar los movimientos',
        requiresAccountSelection: true,
        suggestedAccounts: activeAccounts
      };
    }

    // Validate account exists
    const account = await db.get('accounts', extractData.accountId);
    if (!account) {
      return {
        success: false,
        origen: 'bank_extract',
        message: 'La cuenta seleccionada no existe'
      };
    }

    // Create movements for all transactions
    const createdMovements: number[] = [];
    
    for (const transaction of extractData.transactions) {
      const movement: Omit<Movement, 'id'> = {
        accountId: extractData.accountId,
        date: transaction.date,
        amount: transaction.amount,
        description: transaction.description,
        counterparty: transaction.counterparty,
        reference: transaction.reference,
        balance: transaction.balance,
        status: 'pendiente',
        state: 'pending',
        sourceBank: account.bank,
        currency: 'EUR',
        saldo: transaction.balance,
        estado_conciliacion: 'sin_conciliar',
        type: transaction.amount > 0 ? 'Ingreso' : 'Gasto',
        origin: 'CSV',
        movementState: 'Confirmado',
        // ATLAS HORIZON: Required fields
        unifiedStatus: 'no_planificado',
        source: 'import',
        category: {
          tipo: transaction.amount > 0 ? 'Ingresos' : 'Gastos'
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const movementId = await db.add('movements', movement);
      createdMovements.push(movementId as number);
    }

    return {
      success: true,
      origen: 'bank_extract',
      recordType: 'movement',
      message: `${createdMovements.length} movimientos importados correctamente desde ${filename}`,
      movementId: createdMovements[0] // Return first movement ID
    };
    
  } catch (error) {
    console.error('Error creating treasury movements from bank extract:', error);
    return {
      success: false,
      origen: 'bank_extract',
      message: `Error al importar extracto bancario: ${error}`
    };
  }
};

/**
 * Determines the type of treasury record based on document type and extracted fields
 */
function determineRecordType(
  documentType: DocumentType, 
  fields: DocumentOCRFields
): 'ingreso' | 'gasto' | 'capex' {
  
  // Check if explicitly marked as CAPEX
  if (fields.is_capex || fields.aeat_classification?.includes('capex')) {
    return 'capex';
  }
  
  // Check for income indicators
  if (documentType === 'extracto_bancario' && fields.total_amount && fields.total_amount > 0) {
    return 'ingreso';
  }
  
  if (fields.arrendatario_nombre || fields.contrato_id) {
    return 'ingreso';
  }
  
  // Check expense category for CAPEX classification
  if (fields.expense_category) {
    const capexCategories = ['reforma', 'mejora', 'mobiliario', 'instalacion', 'equipamiento'];
    if (capexCategories.some(cat => fields.expense_category?.toLowerCase().includes(cat))) {
      return 'capex';
    }
  }
  
  // Default to expense for most invoice types
  return 'gasto';
}

/**
 * Creates Ingreso record from OCR data
 */
async function createIngresoFromOCR(
  documentId: string,
  fields: DocumentOCRFields,
  filename: string
): Promise<TreasuryMovementCreationResult> {
  const db = await initDB();
  
  const ingreso: Omit<Ingreso, 'id'> = {
    origen: 'doc_id',
    origen_id: parseInt(documentId) || 0,
    proveedor_contraparte: fields.arrendatario_nombre || fields.proveedor_nombre || 'Proveedor no identificado',
    fecha_emision: fields.invoice_date || new Date().toISOString().split('T')[0],
    fecha_prevista_cobro: fields.due_date || fields.invoice_date || new Date().toISOString().split('T')[0],
    importe: fields.total_amount!,
    moneda: 'EUR',
    estado: 'previsto',
    destino: fields.property_id ? 'inmueble_id' : 'personal',
    destino_id: fields.property_id,
    from_doc: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  const ingresoId = await db.add('ingresos', ingreso);
  
  return {
    success: true,
    recordId: ingresoId as number,
    recordType: 'ingreso',
    origen: 'ocr_document',
    message: `Ingreso creado correctamente desde ${filename}`
  };
}

/**
 * Creates Gasto record from OCR data
 */
async function createGastoFromOCR(
  documentId: string,
  fields: DocumentOCRFields,
  filename: string
): Promise<TreasuryMovementCreationResult> {
  const db = await initDB();
  
  const gasto: Omit<Gasto, 'id'> = {
    proveedor_nombre: fields.proveedor_nombre || 'Proveedor no identificado',
    proveedor_nif: '', // Not available from OCR
    fecha_emision: fields.invoice_date || new Date().toISOString().split('T')[0],
    fecha_pago_prevista: fields.due_date || fields.invoice_date || new Date().toISOString().split('T')[0],
    total: fields.total_amount!,
    base: fields.base_amount,
    iva: fields.iva_amount,
    categoria_AEAT: 'suministros', // Default category
    estado: 'incompleto',
    destino: fields.property_id ? 'inmueble_id' : 'personal',
    destino_id: fields.property_id,
    source_doc_id: parseInt(documentId) || undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  const gastoId = await db.add('gastos', gasto);
  
  return {
    success: true,
    recordId: gastoId as number,
    recordType: 'gasto',
    origen: 'ocr_document',
    message: `Gasto creado correctamente desde ${filename}`
  };
}

/**
 * Creates CAPEX record from OCR data
 */
async function createCAPEXFromOCR(
  documentId: string,
  fields: DocumentOCRFields,
  filename: string
): Promise<TreasuryMovementCreationResult> {
  const db = await initDB();
  
  const capex: Omit<CAPEX, 'id'> = {
    inmueble_id: fields.property_id || 1, // Default to property 1 if not specified
    proveedor: fields.proveedor_nombre || 'Proveedor no identificado',
    fecha_emision: fields.invoice_date || new Date().toISOString().split('T')[0],
    total: fields.total_amount!,
    tipo: 'mejora', // Default CAPEX type
    anos_amortizacion: 10, // Default amortization years
    estado: 'incompleto',
    source_doc_id: parseInt(documentId) || undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  const capexId = await db.add('capex', capex);
  
  return {
    success: true,
    recordId: capexId as number,
    recordType: 'capex',
    origen: 'ocr_document',
    message: `CAPEX creado correctamente desde ${filename}`
  };
}

/**
 * Gets available accounts for bank extract import
 */
export const getAvailableAccountsForImport = async (): Promise<Account[]> => {
  const db = await initDB();
  const accounts = await db.getAll('accounts');
  return accounts.filter(acc => acc.isActive);
};

/**
 * Enhanced OCR field extraction with treasury focus
 */
export const enhanceOCRFieldExtraction = (
  rawOCRData: any,
  documentType: DocumentType,
  filename: string
): DocumentOCRFields => {
  const enhanced: DocumentOCRFields = {
    // Basic fields from existing OCR
    proveedor_nombre: rawOCRData.provider_name || rawOCRData.proveedor,
    total_amount: parseAmount(rawOCRData.total_amount || rawOCRData.amount),
    invoice_date: rawOCRData.invoice_date || rawOCRData.fecha,
    due_date: rawOCRData.due_date || rawOCRData.fecha_vencimiento,
    
    // Enhanced property detection
    inmueble_alias: detectPropertyFromText(rawOCRData.full_text || filename),
    
    // Enhanced banking info
    iban_detectado: extractIBAN(rawOCRData.full_text || ''),
    banco_nombre: rawOCRData.bank_name,
    
    // Tax information extraction
    iva_rate: rawOCRData.vat_rate || detectVATRate(rawOCRData.full_text),
    iva_amount: parseAmount(rawOCRData.vat_amount),
    base_amount: parseAmount(rawOCRData.base_amount),
    
    // Category classification
    expense_category: classifyExpenseCategory(rawOCRData.full_text || '', filename),
    is_capex: detectCAPEXIndicators(rawOCRData.full_text || '', filename),
    
    // Enhanced contract/tenant detection
    arrendatario_nombre: detectTenantName(rawOCRData.full_text || ''),
  };
  
  return enhanced;
};

// Helper functions for enhanced extraction

function parseAmount(value: any): number | undefined {
  if (typeof value === 'number') return value;
  if (!value) return undefined;
  
  const cleanValue = value.toString()
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '.');
    
  const parsed = parseFloat(cleanValue);
  return isNaN(parsed) ? undefined : parsed;
}

function extractIBAN(text: string): string | undefined {
  const ibanPattern = /[A-Z]{2}\d{2}[\s]?[\d\s]{16,34}/g;
  const matches = safeMatch(text, ibanPattern);
  return matches ? matches[0].replace(/\s/g, '') : undefined;
}

function detectPropertyFromText(text: string): string | undefined {
  const propertyPatterns = [
    /inmueble[:\s]+([^\n]+)/i,
    /propiedad[:\s]+([^\n]+)/i,
    /dirección[:\s]+([^\n]+)/i,
    /calle[:\s]+([^\n]+)/i
  ];
  
  for (const pattern of propertyPatterns) {
    const match = safeMatch(text, pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return undefined;
}

function detectVATRate(text: string): number | undefined {
  const vatPatterns = [
    /iva[:\s]*(\d+)%/i,
    /(\d+)%\s*iva/i,
    /21%|10%|4%/g
  ];
  
  for (const pattern of vatPatterns) {
    const match = safeMatch(text, pattern);
    if (match) {
      const rate = parseInt(match[1] || match[0]);
      if ([21, 10, 4, 0].includes(rate)) {
        return rate;
      }
    }
  }
  return undefined;
}

function classifyExpenseCategory(text: string, filename: string): string | undefined {
  const categories: Record<string, string[]> = {
    'Suministros': ['luz', 'agua', 'gas', 'electricidad', 'iberdrola', 'endesa', 'naturgy'],
    'Mantenimiento': ['reparacion', 'mantenimiento', 'limpieza', 'jardin'],
    'Administración': ['administrador', 'comunidad', 'seguro'],
    'Reforma': ['reforma', 'obras', 'albañil', 'pintura', 'fontanero'],
    'Mobiliario': ['mueble', 'electrodomestico', 'decoracion'],
    'Servicios profesionales': ['abogado', 'gestor', 'arquitecto', 'ingeniero']
  };
  
  const searchText = (text + ' ' + filename).toLowerCase();
  
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => searchText.includes(keyword))) {
      return category;
    }
  }
  
  return undefined;
}

function detectCAPEXIndicators(text: string, filename: string): boolean {
  const capexKeywords = [
    'reforma', 'mejora', 'instalacion', 'obra', 'construccion',
    'mobiliario', 'equipamiento', 'maquinaria', 'herramienta'
  ];
  
  const searchText = (text + ' ' + filename).toLowerCase();
  return capexKeywords.some(keyword => searchText.includes(keyword));
}

function detectTenantName(text: string): string | undefined {
  const tenantPatterns = [
    /inquilino[:\s]+([^\n]+)/i,
    /arrendatario[:\s]+([^\n]+)/i,
    /cliente[:\s]+([^\n]+)/i
  ];
  
  for (const pattern of tenantPatterns) {
    const match = safeMatch(text, pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return undefined;
}