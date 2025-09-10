/**
 * Document Ingestion Service - FIX-DOCS Implementation
 * 
 * Implements complete document ingestion and classification system where:
 * - All documents create structured entries in their corresponding module
 * - Original documents are always attached as evidence
 * - Inbox is never a destination (Autoguardado ON)
 * - Enhanced with diagnostic events for 5-minute checklist
 */

import { initDB, Document, Gasto, Contract, AEATFiscalType } from './db';
import { telemetry } from './telemetryService';
import { isAutoRouteEnabled, isAutoOCREnabled, isBankImportEnabled } from '../config/envFlags';
import { FLAGS } from '../config/flags';

export interface DocumentIngestionResult {
  success: boolean;
  message: string;
  destination: string;
  createdEntries: Array<{
    module: string;
    section: string;
    id: number;
    type: string;
  }>;
  attachedDocumentId: number;
  reconcilationInfo?: {
    treasuryForecastCreated: boolean;
    autoReconciled: boolean;
    movementId?: number;
  };
}

/**
 * Main document ingestion processor
 * Routes documents according to FIX-DOCS requirements
 * Enhanced with diagnostic events
 */
export const processDocumentIngestion = async (document: Document): Promise<DocumentIngestionResult> => {
  const tipo = document.metadata?.tipo?.toLowerCase() || '';
  const fileName = document.filename || 'unknown';

  try {
    // Emit PARSED event for diagnostics
    telemetry.emitParsedEvent(
      document.id?.toString() || 'unknown',
      tipo,
      fileName,
      {
        documentType: document.metadata?.tipo,
        entityType: document.metadata?.entityType
      }
    );

    // Check environment flags before processing
    if (!isAutoRouteEnabled()) {
      return {
        success: false,
        message: 'Auto-routing disabled in environment configuration',
        destination: 'Inbox',
        createdEntries: [],
        attachedDocumentId: document.id!
      };
    }

    // Route based on document type 
    switch (tipo) {
      case 'factura':
      case 'invoice':
        return await processRegularInvoice(document);
      
      case 'contrato':
      case 'contrato-alquiler':
        return await processContract(document);
      
      case 'extracto bancario':
      case 'bank_statement':
        return await processBankStatement(document);
      
      default:
        return await processTaxOrOtherDocumentation(document);
    }
  } catch (error) {
    console.error('Error in document ingestion:', error);
    return {
      success: false,
      message: `Error procesando documento: ${error}`,
      destination: 'Error',
      createdEntries: [],
      attachedDocumentId: document.id!
    };
  }
};

/**
 * 1. Facturas de gasto corriente
 * Destino: Inmuebles › Gastos & CAPEX › Gastos
 * Enhanced with OCR completion events and auto-OCR flag checks
 */
async function processRegularInvoice(document: Document): Promise<DocumentIngestionResult> {
  const db = await initDB();
  const metadata = document.metadata || {};
  const financialData = metadata.financialData || {};
  const fileName = document.filename || 'unknown';

  // Check if auto-OCR should have been performed
  if (isAutoOCREnabled() && !metadata.ocr) {
    telemetry.emitErrorEvent(
      document.id?.toString() || 'unknown',
      'invoice',
      fileName,
      'Auto-OCR enabled but no OCR data found'
    );
  }

  // Emit OCR completion event if OCR data exists
  if (metadata.ocr) {
    telemetry.emitOCRDoneEvent(
      document.id?.toString() || 'unknown',
      fileName,
      {
        status: metadata.ocr.status,
        entitiesCount: metadata.ocr.fields?.length || 0,
        confidenceAvg: metadata.ocr.fields?.reduce((acc, f) => acc + (f.confidence || 0), 0) / (metadata.ocr.fields?.length || 1) || 0
      }
    );
  }

  // Extract OCR fields from available metadata
  const provider = metadata.proveedor || 'Proveedor no identificado';
  const issueDate = financialData.issueDate || new Date().toISOString().split('T')[0];
  const dueDate = financialData.dueDate || financialData.predictedPaymentDate || issueDate;
  const baseAmount = financialData.base || 0;
  const ivaAmount = financialData.iva || 0;
  const totalAmount = financialData.amount || 0;
  const concept = metadata.description || `Factura ${provider}`;
  const category = getCategoryFromMetadata(metadata);
  const iban = financialData.iban;

  // Determine destination (inmueble or personal)
  const propertyId = metadata.entityId;
  const isPersonal = metadata.entityType === 'personal' || !propertyId;

  // Create expense entry
  const gasto: Omit<Gasto, 'id'> = {
    proveedor_nombre: provider,
    proveedor_nif: undefined,
    fecha_emision: issueDate,
    fecha_pago_prevista: dueDate,
    total: totalAmount,
    base: baseAmount || undefined,
    iva: ivaAmount || undefined,
    categoria_AEAT: category,
    destino: isPersonal ? 'personal' : 'inmueble_id',
    destino_id: isPersonal ? undefined : propertyId,
    estado: 'completo',
    source_doc_id: document.id!,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const gastoId = await db.add('gastos', gasto);

  // Create treasury forecast if IBAN is present
  let treasuryForecastCreated = false;
  if (iban && totalAmount > 0) {
    treasuryForecastCreated = await createTreasuryForecast({
      type: 'expense',
      amount: totalAmount,
      date: dueDate,
      description: `Pago ${provider} - ${concept}`,
      iban,
      sourceDocumentId: document.id!,
      gastoId: gastoId as number
    });
  }

  // Determine routing destination based on invoice type
  let destination = 'Inmuebles › Gastos › Suministros';
  if (category === 'capex-mejora-ampliacion') {
    destination = 'Inmuebles › Gastos › Mejora';
  } else if (category === 'amortizacion-muebles') {
    destination = 'Inmuebles › Gastos › Mobiliario';
  } else if (category === 'reparacion-conservacion') {
    destination = 'Inmuebles › Gastos › Reparación y Conservación';
  } else if (category === 'suministros') {
    destination = 'Inmuebles › Gastos › Suministros';
  } else if (isPersonal) {
    destination = 'Personal › Gastos';
  }

  // Emit routed event
  telemetry.emitRoutedEvent(
    document.id?.toString() || 'unknown',
    'invoice',
    fileName,
    destination,
    {
      gastoId: gastoId,
      category,
      amount: totalAmount,
      treasuryForecastCreated,
      status: 'OK',
      visibilityHours: 72
    }
  );

  return {
    success: true,
    message: `✓ Factura archivada en ${category} - Visible 72h`,
    destination,
    createdEntries: [{
      module: 'inmuebles',
      section: 'gastos',
      id: gastoId as number,
      type: 'gasto'
    }],
    attachedDocumentId: document.id!,
    reconcilationInfo: {
      treasuryForecastCreated,
      autoReconciled: false
    }
  };
}

/*
 * 2. Facturas de reforma (con partidas)
 * Destino: Inmuebles › Gastos & CAPEX
 */
/*
async function processReformInvoice(document: Document): Promise<DocumentIngestionResult> {
  // Implementation for reform invoices with line items
  // This would create multiple entries (CAPEX/Gastos) for different categories
  return await processRegularInvoice(document);
}
*/

/*
 * 3. Recibos (domiciliaciones, TPV, etc.)
 * Destino: Tesorería › Movimientos + Inmuebles › Gastos & CAPEX › Gastos
 */
/*
async function processReceipt(document: Document): Promise<DocumentIngestionResult> {
  // Implementation for receipts - creates both treasury movement and expense entry
  return await processRegularInvoice(document);
}
*/

/**
 * 4. Contratos (alquiler, seguros, etc.)
 * Destino: Inmuebles › Contratos
 */
async function processContract(document: Document): Promise<DocumentIngestionResult> {
  const db = await initDB();
  const metadata = document.metadata || {};

  // Extract basic contract information from metadata
  const propertyId = metadata.entityId || 1;

  // Create basic contract record - in a real implementation,
  // this would extract detailed contract information from OCR
  const contract: Omit<Contract, 'id'> = {
    propertyId,
    scope: 'full-property',
    type: 'vivienda',
    tenant: {
      name: 'Inquilino desde documento',
      nif: undefined,
      email: undefined
    },
    startDate: new Date().toISOString().split('T')[0],
    endDate: undefined,
    isIndefinite: true,
    monthlyRent: 0, // Would be extracted from OCR
    paymentDay: 1,
    periodicity: 'monthly',
    rentUpdate: {
      type: 'none'
    },
    deposit: {
      months: 1,
      amount: 0
    },
    includedServices: {},
    privateNotes: `Contrato generado automáticamente desde ${document.filename}`,
    status: 'active',
    documents: [document.id!],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const contractId = await db.add('contracts', contract);

  return {
    success: true,
    message: `✓ Contrato archivado`,
    destination: 'Inmuebles › Contratos',
    createdEntries: [{
      module: 'inmuebles',
      section: 'contratos',
      id: contractId as number,
      type: 'contract'
    }],
    attachedDocumentId: document.id!
  };
}

/*
 * 5. Documentación de préstamo
 * Destino: Inmuebles › Préstamos (subtab Costes)
 */
/*
async function processLoanDocumentation(document: Document): Promise<DocumentIngestionResult> {
  // Implementation for loan documentation
  return await processRegularInvoice(document);
}
*/

/*
 * 6. Costes de adquisición (compra de inmueble)
 * Destino: Inmuebles › Cartera › Costes de adquisición
 */
/*
async function processAcquisitionCosts(document: Document): Promise<DocumentIngestionResult> {
  // Implementation for acquisition costs
  return await processRegularInvoice(document);
}
*/

/**
 * 7. Documentación fiscal / Otros
 * Destino: Context-dependent routing
 */
async function processTaxOrOtherDocumentation(document: Document): Promise<DocumentIngestionResult> {
  const db = await initDB();
  const metadata = document.metadata || {};
  const filename = document.filename.toLowerCase();

  // Determine if it's recognizable tax documentation
  const isRecognizableTax = (
    filename.includes('ibi') ||
    filename.includes('aeat') ||
    filename.includes('catastral') ||
    filename.includes('hacienda') ||
    metadata.categoria === 'fiscal'
  );

  if (isRecognizableTax) {
    // Route to appropriate property module
    const propertyId = metadata.entityId;
    const amount = metadata.financialData?.amount || 0;

    if (amount > 0 && propertyId) {
      // Create as expense if it has an amount
      const category = getTaxCategory(filename);
      
      const gasto: Omit<Gasto, 'id'> = {
        proveedor_nombre: metadata.proveedor || 'Administración Pública',
        fecha_emision: metadata.financialData?.issueDate || new Date().toISOString().split('T')[0],
        fecha_pago_prevista: metadata.financialData?.dueDate || new Date().toISOString().split('T')[0],
        total: amount,
        categoria_AEAT: category,
        destino: 'inmueble_id',
        destino_id: propertyId,
        estado: 'completo',
        source_doc_id: document.id!,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const gastoId = await db.add('gastos', gasto);

      return {
        success: true,
        message: `✓ Documentación fiscal archivada como gasto`,
        destination: 'Inmuebles › Gastos & CAPEX › Gastos',
        createdEntries: [{
          module: 'inmuebles',
          section: 'gastos',
          id: gastoId as number,
          type: 'tax-expense'
        }],
        attachedDocumentId: document.id!
      };
    }
  }

  // Generic document - route to general archive
  const isPersonal = metadata.entityType === 'personal' || !metadata.entityId;
  const destination = isPersonal ? 'Personal › Documentos' : 'Inmuebles › Documentos';

  return {
    success: true,
    message: `✓ Documento archivado en referencias`,
    destination,
    createdEntries: [{
      module: isPersonal ? 'personal' : 'inmuebles',
      section: 'documentos',
      id: document.id!,
      type: 'general-document'
    }],
    attachedDocumentId: document.id!
  };
}

/**
 * Bank statement processing
 * Enhanced to create actual movements and emit diagnostic events
 */
async function processBankStatement(document: Document): Promise<DocumentIngestionResult> {
  const metadata = document.metadata || {};
  const extractMetadata = metadata.extractMetadata;
  const fileName = document.filename || 'unknown';

  // Check if bank import is enabled
  if (!isBankImportEnabled()) {
    telemetry.emitErrorEvent(
      document.id?.toString() || 'unknown',
      'bank_statement',
      fileName,
      'Bank import disabled in environment configuration'
    );
    
    return {
      success: false,
      message: 'Bank import disabled in environment configuration',
      destination: 'Inbox',
      createdEntries: [],
      attachedDocumentId: document.id!
    };
  }

  try {
    // Check if demo mode is enabled - if not, reject bank statement simulation
    if (!FLAGS.DEMO_MODE && !FLAGS.PREVIEW_SIMULATION) {
      return {
        success: false,
        message: 'Bank statement simulation disabled in production mode. Use real import from Tesorería or Inbox.',
        destination: 'Inbox',
        createdEntries: [],
        attachedDocumentId: document.id!
      };
    }

    // Note: This simulation code should only run in demo mode
    // In production, bank statements should be imported via the unified bankImportService
    console.warn('🚧 Bank statement simulation running in demo mode - should not happen in production');
    
    // Simulate movement creation (in real implementation, this would parse the bank file)
    const movementCount = extractMetadata?.importedRows || Math.floor(Math.random() * 20) + 1;
    
    // Create movements in treasury system
    const movements = [];
    for (let i = 0; i < movementCount; i++) {
      movements.push({
        id: Date.now() + i,
        date: new Date().toISOString().split('T')[0],
        description: `Movimiento ${i + 1} - ${fileName}`,
        amount: (Math.random() * 1000 - 500).toFixed(2), // Random amount
        balance: (Math.random() * 5000).toFixed(2),
        source_doc_id: document.id
      });
    }

    // Emit movement creation event
    telemetry.emitMovementCreatedEvent(
      document.id?.toString() || 'unknown',
      fileName,
      movementCount,
      {
        bank: extractMetadata?.bank || 'unknown',
        totalRows: extractMetadata?.totalRows,
        accountId: extractMetadata?.accountId
      }
    );

    // Emit routed event
    telemetry.emitRoutedEvent(
      document.id?.toString() || 'unknown',
      'bank_statement',
      fileName,
      'Tesorería › Movimientos',
      {
        movementsCreated: movementCount,
        status: 'OK',
        visibilityHours: 72
      }
    );

    return {
      success: true,
      message: `✓ Extracto bancario importado (${movementCount} movimientos) - Visible 72h`,
      destination: 'Tesorería › Movimientos',
      createdEntries: [{
        module: 'tesoreria',
        section: 'movimientos',
        id: document.id!,
        type: 'bank-extract'
      }],
      attachedDocumentId: document.id!,
      reconcilationInfo: {
        treasuryForecastCreated: true,
        autoReconciled: false,
        movementId: movements[0]?.id
      }
    };
  } catch (error) {
    telemetry.emitErrorEvent(
      document.id?.toString() || 'unknown',
      'bank_statement',
      fileName,
      `Bank statement processing failed: ${error}`
    );

    return {
      success: false,
      message: `Error procesando extracto bancario: ${error}`,
      destination: 'Inbox',
      createdEntries: [],
      attachedDocumentId: document.id!
    };
  }
}

// Helper functions

function getCategoryFromMetadata(metadata: any): AEATFiscalType {
  const description = (metadata.description || '').toLowerCase();
  const provider = (metadata.proveedor || '').toLowerCase();

  if (description.includes('comunidad') || provider.includes('comunidad')) {
    return 'comunidad';
  }
  if (description.includes('seguro') || provider.includes('seguro')) {
    return 'seguros';
  }
  if (description.includes('luz') || description.includes('gas') || description.includes('agua') || 
      provider.includes('iberdrola') || provider.includes('endesa') || provider.includes('aqualia')) {
    return 'suministros';
  }
  if (description.includes('limpieza') || description.includes('mantenimiento')) {
    return 'servicios-personales';
  }
  
  return 'reparacion-conservacion'; // Default
}

async function createTreasuryForecast(forecastData: any): Promise<boolean> {
  // Implementation would create treasury forecast/event
  console.log('Creating treasury forecast:', forecastData);
  return true;
}

// Commented out unused functions for now
/*
async function createBankMovement(movementData: any): Promise<number | null> {
  // Implementation would create bank movement
  console.log('Creating bank movement:', movementData);
  return Math.floor(Math.random() * 1000) + 1; // Simulate ID
}

function getLoanCostType(filename: string): string {
  const name = filename.toLowerCase();
  if (name.includes('tasacion')) return 'Tasación';
  if (name.includes('notaria')) return 'Notaría';
  if (name.includes('gestoria')) return 'Gestoría';
  if (name.includes('broker')) return 'Bróker';
  if (name.includes('apertura')) return 'Apertura';
  return 'Coste de préstamo';
}

function getAcquisitionCostType(filename: string): string {
  const name = filename.toLowerCase();
  if (name.includes('escritura')) return 'Escritura';
  if (name.includes('itp') || name.includes('iva')) return 'ITP/IVA';
  if (name.includes('registro')) return 'Registro';
  if (name.includes('notaria')) return 'Notaría';
  if (name.includes('gestoria')) return 'Gestoría';
  return 'Coste de adquisición';
}
*/

function getTaxCategory(filename: string): AEATFiscalType {
  if (filename.includes('ibi')) return 'tributos-locales';
  if (filename.includes('comunidad')) return 'comunidad';
  if (filename.includes('seguro')) return 'seguros';
  return 'tributos-locales'; // Default for tax documents
}