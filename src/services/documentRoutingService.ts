// Document Routing Service for Bandeja de entrada
// Handles automatic routing of documents to their proper destinations

export interface RoutingDestination {
  module: 'tesoreria' | 'fiscalidad' | 'inmuebles' | 'personal';
  section: string;
  action: 'create' | 'archive' | 'process';
}

export interface RoutingResult {
  success: boolean;
  destination: RoutingDestination;
  message: string;
  warnings?: string[];
  requiresManualAssignment?: boolean;
  missingFields?: string[];
}

/**
 * Route a document to its appropriate destination based on classification
 */
export async function routeDocument(
  document: any,
  assignment: { inmuebleId?: string; isPersonal?: boolean }
): Promise<RoutingResult> {
  const tipo = document.metadata?.tipo?.toLowerCase();
  const warnings: string[] = [];
  let requiresManualAssignment = false;
  const missingFields: string[] = [];

  // Validate mandatory assignment
  if (!assignment.inmuebleId && !assignment.isPersonal) {
    return {
      success: false,
      destination: { module: 'tesoreria', section: 'inbox', action: 'process' },
      message: 'Asignación obligatoria: Inmueble o Personal',
      requiresManualAssignment: true,
      missingFields: ['assignment']
    };
  }

  switch (tipo) {
    case 'factura':
    case 'recibo':
    case 'mejora':
    case 'mobiliario':
      return await routeInvoice(document, assignment, warnings, missingFields);
    
    case 'contrato':
      return await routeContract(document, assignment, warnings, missingFields);
    
    case 'extracto bancario':
      return await routeBankStatement(document, assignment, warnings, missingFields);
    
    default:
      return await routeOtherDocument(document, assignment, warnings, missingFields);
  }
}

/**
 * Route invoices to Fiscalidad and Tesorería
 */
async function routeInvoice(
  document: any,
  assignment: { inmuebleId?: string; isPersonal?: boolean },
  warnings: string[],
  missingFields: string[]
): Promise<RoutingResult> {
  const metadata = document.metadata || {};
  
  // Check for required fields
  if (!metadata.amount && !metadata.totalAmount) {
    missingFields.push('amount');
  }
  if (!metadata.provider && !metadata.proveedor) {
    missingFields.push('provider');
  }
  if (!metadata.date) {
    missingFields.push('date');
  }

  // Determine classification (Reparación/Conservación, Mejora, Mobiliario 10a)
  let fiscalClassification = 'Reparación/Conservación';
  if (metadata.isCapex || metadata.amount > 300) {
    fiscalClassification = 'Mejora';
  }
  if (metadata.tipo === 'mobiliario') {
    fiscalClassification = 'Mobiliario 10a';
  }

  // Validate fiscal amounts
  const base = parseFloat(metadata.baseAmount || 0);
  const vat = parseFloat(metadata.vatAmount || 0);
  const total = parseFloat(metadata.amount || metadata.totalAmount || 0);
  
  if (base && vat && total) {
    const calculatedTotal = base + vat;
    if (Math.abs(calculatedTotal - total) > 0.01) {
      warnings.push('Totales no cuadran, revisar');
    }
  }

  // Create fiscal entry
  const fiscalEntry = {
    documentId: document.id,
    amount: total,
    provider: metadata.provider || metadata.proveedor,
    date: metadata.date,
    classification: fiscalClassification,
    inmuebleId: assignment.inmuebleId,
    isPersonal: assignment.isPersonal
  };

  // Create treasury entry (linkable to movement)
  const treasuryEntry = {
    documentId: document.id,
    amount: total,
    description: `Factura ${metadata.provider || metadata.proveedor}`,
    category: 'Gasto',
    subcategory: fiscalClassification,
    inmuebleId: assignment.inmuebleId,
    isPersonal: assignment.isPersonal
  };

  // Simulate saving to modules
  console.log('Creating fiscal entry:', fiscalEntry);
  console.log('Creating treasury entry:', treasuryEntry);

  return {
    success: true,
    destination: { module: 'fiscalidad', section: 'detalle', action: 'create' },
    message: `Factura archivada en Fiscalidad (${fiscalClassification}) y Tesorería`,
    warnings: warnings.length > 0 ? warnings : undefined,
    missingFields: missingFields.length > 0 ? missingFields : undefined
  };
}

/**
 * Route contracts to Inmuebles > Contratos
 */
async function routeContract(
  document: any,
  assignment: { inmuebleId?: string; isPersonal?: boolean },
  warnings: string[],
  missingFields: string[]
): Promise<RoutingResult> {
  if (assignment.isPersonal) {
    return {
      success: false,
      destination: { module: 'personal', section: 'documents', action: 'archive' },
      message: 'Los contratos deben asignarse a un inmueble específico',
      requiresManualAssignment: true
    };
  }

  if (!assignment.inmuebleId) {
    missingFields.push('inmuebleId');
    return {
      success: false,
      destination: { module: 'inmuebles', section: 'contratos', action: 'archive' },
      message: 'Selecciona el inmueble para archivar el contrato',
      requiresManualAssignment: true,
      missingFields
    };
  }

  // Archive in Inmuebles > Contratos
  const contractEntry = {
    documentId: document.id,
    filename: document.filename,
    inmuebleId: assignment.inmuebleId,
    tipo: 'contrato',
    fechaArchivo: new Date().toISOString()
  };

  console.log('Archiving contract:', contractEntry);

  return {
    success: true,
    destination: { module: 'inmuebles', section: 'contratos', action: 'archive' },
    message: `Contrato archivado en Inmuebles > Contratos`,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Route bank statements to Tesorería > Movimientos
 */
async function routeBankStatement(
  document: any,
  assignment: { inmuebleId?: string; isPersonal?: boolean },
  warnings: string[],
  missingFields: string[]
): Promise<RoutingResult> {
  const metadata = document.metadata || {};
  
  // Check if account can be inferred
  let targetAccount = metadata.detectedAccount;
  
  if (!targetAccount) {
    missingFields.push('targetAccount');
    return {
      success: false,
      destination: { module: 'tesoreria', section: 'movimientos', action: 'process' },
      message: 'Selecciona la cuenta destino para el extracto bancario',
      requiresManualAssignment: true,
      missingFields
    };
  }

  // Create movements from bank statement
  const movementsEntry = {
    documentId: document.id,
    accountId: targetAccount,
    filename: document.filename,
    inmuebleId: assignment.inmuebleId,
    isPersonal: assignment.isPersonal,
    processingDate: new Date().toISOString()
  };

  console.log('Creating movements from bank statement:', movementsEntry);

  return {
    success: true,
    destination: { module: 'tesoreria', section: 'movimientos', action: 'create' },
    message: `Extracto procesado en Tesorería > Movimientos`,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Route other documents to Inmueble/Personal > Documentos
 */
async function routeOtherDocument(
  document: any,
  assignment: { inmuebleId?: string; isPersonal?: boolean },
  warnings: string[],
  missingFields: string[]
): Promise<RoutingResult> {
  const destination = assignment.isPersonal ? 'Personal' : 'Inmueble';
  const module = assignment.isPersonal ? 'personal' : 'inmuebles';

  const documentEntry = {
    documentId: document.id,
    filename: document.filename,
    tipo: 'documento',
    inmuebleId: assignment.inmuebleId,
    isPersonal: assignment.isPersonal,
    fechaArchivo: new Date().toISOString()
  };

  console.log('Archiving other document:', documentEntry);

  return {
    success: true,
    destination: { module: module as any, section: 'documentos', action: 'archive' },
    message: `Documento archivado en ${destination} > Documentos`,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Check if document can be auto-routed based on auto-save configuration
 */
export function canAutoRoute(document: any, autoSaveConfig: any): boolean {
  if (!autoSaveConfig.enabled) {
    return false;
  }

  const tipo = document.metadata?.tipo?.toLowerCase();
  const classification = document.metadata?.classification;
  
  if (!classification) {
    return false;
  }

  // Check if all required fields are present for auto-routing
  switch (tipo) {
    case 'factura':
      return !!(classification.metadata?.provider && 
                classification.metadata?.amount && 
                classification.metadata?.date);
    
    case 'contrato':
      return !!(classification.metadata?.inmuebleId);
    
    case 'extracto bancario':
      return !!(classification.metadata?.detectedAccount);
    
    default:
      return true; // Other documents can usually be auto-routed
  }
}