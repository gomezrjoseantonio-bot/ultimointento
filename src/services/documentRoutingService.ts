// ATLAS HORIZON - Document Routing Service
// Handles automatic routing of documents to their proper destinations following exact requirements

import { RoutingDestinationResult, InboxItem, OCRExtractionResult, ClassificationResult, PropertyDetectionResult } from '../types/inboxTypes';

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
 * Route document following ATLAS HORIZON requirements
 */
export async function routeInboxDocument(
  item: InboxItem,
  ocrData: OCRExtractionResult,
  classification: ClassificationResult,
  propertyDetection: PropertyDetectionResult
): Promise<RoutingDestinationResult> {
  
  console.log(`[Routing] Processing ${classification.subtype} document:`, {
    supplier: ocrData.supplier_name,
    amount: ocrData.total_amount,
    property: propertyDetection.inmueble_id
  });

  switch (classification.subtype) {
    case 'suministro':
      return await routeSuministro(item, ocrData, propertyDetection);
    
    case 'recibo':
      return await routeRecibo(item, ocrData, propertyDetection);
    
    case 'reforma':
      return await routeReforma(item, ocrData, propertyDetection);
    
    case 'factura_generica':
      return await routeFacturaGenerica(item, ocrData, propertyDetection);
    
    default:
      return {
        success: false,
        requiresReview: true,
        errorMessage: `Tipo de documento no soportado: ${classification.subtype}`
      };
  }
}

/**
 * 4.1 Suministro → Inmuebles > Gastos > Suministros (o Personal > Gastos si no hay inmueble)
 */
async function routeSuministro(
  item: InboxItem,
  ocrData: OCRExtractionResult,
  propertyDetection: PropertyDetectionResult
): Promise<RoutingDestinationResult> {
  
  try {
    const gasto = {
      tipo: 'Suministros',
      proveedor: ocrData.supplier_name,
      cif: ocrData.supplier_tax_id,
      importe_total: ocrData.total_amount,
      fecha_emision: ocrData.issue_date,
      fecha_prevista_cargo: ocrData.due_date || null,
      inmueble_id: propertyDetection.inmueble_id,
      adjuntos: [item.fileUrl],
      notas: {
        service_address: ocrData.service_address,
        iban_mask: ocrData.iban_mask,
        ocr_meta_optional: ocrData.metadata,
        inbox_id: item.id
      }
    };

    // Create the expense in the appropriate section
    const gastoId = await createGasto(gasto);
    
    const path = propertyDetection.inmueble_id 
      ? 'Inmuebles › Gastos › Suministros'
      : 'Personal › Gastos › Suministros';

    console.log(`[Routing] Created suministro gasto: ${gastoId} in ${path}`);

    return {
      success: true,
      requiresReview: false,
      destRef: {
        kind: 'gasto',
        id: gastoId,
        path
      }
    };

  } catch (error) {
    console.error('[Routing] Error creating suministro gasto:', error);
    return {
      success: false,
      requiresReview: false,
      errorMessage: 'Error al crear gasto de suministro'
    };
  }
}

/**
 * 4.2 Recibo (sin desglose) → Tesorería > Movimientos
 */
async function routeRecibo(
  item: InboxItem,
  ocrData: OCRExtractionResult,
  propertyDetection: PropertyDetectionResult
): Promise<RoutingDestinationResult> {
  
  try {
    const movimiento = {
      fecha: ocrData.due_date || ocrData.issue_date || item.createdAt.toISOString().split('T')[0],
      descripcion: `Recibo ${ocrData.supplier_name}`,
      importe: -(ocrData.total_amount || 0), // Negative for expense
      cuenta_detectada: await detectAccountByIBAN(ocrData.iban_mask),
      contrapartida: ocrData.supplier_name,
      notas: {
        iban_mask: ocrData.iban_mask,
        source: 'recibo_pdf',
        inbox_id: item.id
      },
      adjuntos: [item.fileUrl]
    };

    const movimientoId = await createMovimiento(movimiento);
    
    console.log(`[Routing] Created recibo movimiento: ${movimientoId}`);

    return {
      success: true,
      requiresReview: false,
      destRef: {
        kind: 'movimiento',
        id: movimientoId,
        path: 'Tesorería › Movimientos'
      }
    };

  } catch (error) {
    console.error('[Routing] Error creating recibo movimiento:', error);
    return {
      success: false,
      requiresReview: false,
      errorMessage: 'Error al crear movimiento de recibo'
    };
  }
}

/**
 * 4.3 Reforma → Requires fiscal category selection
 */
async function routeReforma(
  item: InboxItem,
  ocrData: OCRExtractionResult,
  propertyDetection: PropertyDetectionResult
): Promise<RoutingDestinationResult> {
  
  // Always requires manual review for fiscal category
  return {
    success: false,
    requiresReview: true,
    reviewReason: 'Categoría fiscal requerida: Mejora | Mobiliario | Reparación y Conservación'
  };
}

/**
 * 4.4 Factura genérica → Requires manual classification
 */
async function routeFacturaGenerica(
  item: InboxItem,
  ocrData: OCRExtractionResult,
  propertyDetection: PropertyDetectionResult
): Promise<RoutingDestinationResult> {
  
  return {
    success: false,
    requiresReview: true,
    reviewReason: 'Clasificación manual requerida: Suministros | Reforma | Otro gasto'
  };
}

/**
 * Mock function to create gasto (replace with actual implementation)
 */
async function createGasto(gastoData: any): Promise<string> {
  // TODO: Integrate with actual gasto creation service
  console.log('[Routing] Creating gasto:', gastoData);
  return 'gasto_' + Date.now();
}

/**
 * Mock function to create movimiento (replace with actual implementation)
 */
async function createMovimiento(movimientoData: any): Promise<string> {
  // TODO: Integrate with actual movimiento creation service
  console.log('[Routing] Creating movimiento:', movimientoData);
  return 'mov_' + Date.now();
}

/**
 * Detect account by IBAN mask
 */
async function detectAccountByIBAN(ibanMask?: string): Promise<string | null> {
  if (!ibanMask) return null;
  
  // TODO: Query accounts database to find matching account
  // For now, return null (account will need to be selected manually)
  return null;
}

// Legacy functions (keep for backward compatibility)

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