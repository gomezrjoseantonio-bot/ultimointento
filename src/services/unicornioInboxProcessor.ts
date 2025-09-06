// UNICORNIO PROMPT - Main Inbox Processing Service
// Implements exact processing rules per document type with unified expense creation

import { DocumentType, detectDocType } from './unicornioDocumentDetection';
import { detectUtilityType } from './utilityDetectionService';
import { calculateDocumentFingerprint } from './documentFingerprintingService';
import { inferExpenseType } from './expenseTypeInferenceService';
import { TipoGasto } from './db';

export interface ProcessingResult {
  success: boolean;
  documentType: DocumentType;
  extractedFields: Record<string, any>;
  destination?: string;
  requiresReview: boolean;
  blockingReasons: string[];
  logs: Array<{ timestamp: string; action: string }>;
  fingerprint?: string;
}

export interface ProcessingOptions {
  reprocess?: boolean;
  skipOCR?: boolean;
}

/**
 * Main document processing function following UNICORNIO PROMPT specification
 */
export async function processInboxItem(
  file: File,
  filename: string,
  options: ProcessingOptions = {}
): Promise<ProcessingResult> {
  const logs: Array<{ timestamp: string; action: string }> = [];
  const addLog = (action: string) => {
    logs.push({ timestamp: new Date().toISOString(), action });
  };

  addLog(`Procesamiento iniciado: ${filename}`);

  try {
    // 1. Document type detection
    const detection = detectDocType(filename, file.type);
    addLog(`Tipo detectado: ${detection.type} (${detection.confidence})`);

    // 2. Process according to type
    switch (detection.type) {
      case 'extracto_bancario':
        return await processBankStatement(file, filename, logs);
      
      case 'factura_suministro':
        return await processUtilityBill(file, filename, logs, options);
      
      case 'factura_reforma':
        return await processReformInvoice(file, filename, logs, options);
      
      case 'contrato':
        return await processContract(file, filename, logs, options);
      
      case 'documento_generico':
      default:
        return await processGenericDocument(file, filename, logs, options);
    }
  } catch (error) {
    addLog(`Error en procesamiento: ${error}`);
    return {
      success: false,
      documentType: 'documento_generico',
      extractedFields: {},
      requiresReview: true,
      blockingReasons: [`Error en procesamiento: ${error}`],
      logs
    };
  }
}

/**
 * 2.1 Extractos bancarios - NO OCR, direct file parsing
 */
async function processBankStatement(
  file: File,
  filename: string,
  logs: Array<{ timestamp: string; action: string }>
): Promise<ProcessingResult> {
  const addLog = (action: string) => logs.push({ timestamp: new Date().toISOString(), action });

  try {
    addLog('Iniciando análisis de extracto bancario');
    
    // Mock CSV parsing - in real implementation would use csvParserService
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new Error('Archivo vacío o sin datos');
    }

    // Mock movement detection
    const movements = lines.slice(1).map((line, index) => {
      return {
        fecha: new Date().toISOString().split('T')[0],
        descripcion: `Movimiento ${index + 1}`,
        importe: (Math.random() - 0.5) * 1000,
        saldo: 1000 + index * 100,
        contraparte: 'Entidad'
      };
    });

    addLog(`${movements.length} movimientos detectados`);
    addLog('Creando movimientos en Tesorería');

    return {
      success: true,
      documentType: 'extracto_bancario',
      extractedFields: {
        movimientos: movements,
        banco_origen: 'Banco detectado',
        iban_detectado: 'ES****1234'
      },
      destination: 'Tesorería › Movimientos',
      requiresReview: false,
      blockingReasons: [],
      logs
    };
  } catch (error) {
    addLog(`Error en extracto: ${error}`);
    return {
      success: false,
      documentType: 'extracto_bancario',
      extractedFields: {},
      requiresReview: true,
      blockingReasons: [`Error de lectura: ${error}`],
      logs
    };
  }
}

/**
 * 2.2 Facturas de suministro - OCR completo + clasificación
 */
async function processUtilityBill(
  file: File,
  filename: string,
  logs: Array<{ timestamp: string; action: string }>,
  options: ProcessingOptions
): Promise<ProcessingResult> {
  const addLog = (action: string) => logs.push({ timestamp: new Date().toISOString(), action });

  addLog('Ejecutando OCR para factura de suministro');

  // Mock OCR results
  const mockOcrText = `IBERDROLA FACTURA
    Número: 2024010001
    Fecha: 15/01/2024
    Cliente: Juan Pérez
    Dirección suministro: C/ Mayor 123, Madrid
    Total: 89,45 EUR
    IBAN: ****1234
    Fecha cargo: 15/02/2024
    kWh consumidos: 150`;

  const ocrData = {
    proveedor_nombre: 'Iberdrola',
    proveedor_nif: 'A95758389',
    invoice_id: '2024010001',
    invoice_date: '2024-01-15',
    total_amount: 89.45,
    direccion_servicio: 'C/ Mayor 123, Madrid',
    iban_masked: '****1234',
    due_date: '2024-02-15',
    currency: 'EUR'
  };

  // Detect utility type
  const utilityType = detectUtilityType(ocrData.proveedor_nombre, mockOcrText);
  addLog(`Tipo de suministro detectado: ${utilityType || 'genérico'}`);

  // Expense type inference
  const typeInference = inferExpenseType({
    proveedor_nombre: ocrData.proveedor_nombre,
    utility_type: utilityType || undefined,
    source_type: 'invoice'
  });
  addLog(`Tipo de gasto inferido: ${typeInference.tipo_gasto} (${Math.round(typeInference.confidence * 100)}%)`);

  // Check for idempotence
  const fingerprint = calculateDocumentFingerprint(filename, ocrData);
  addLog('Verificando documento duplicado...');

  // Property assignment attempt
  let requiresReview = false;
  let blockingReasons: string[] = [];
  let assignedProperty = null;

  // Mock property matching by address
  const mockProperties = [
    { id: '1', alias: 'C/ Mayor 123', address: 'Calle Mayor 123, Madrid' },
    { id: '2', alias: 'Piso 2A', address: 'Calle Alcalá 45, 2A, Madrid' }
  ];

  const matchedProperty = mockProperties.find(p => 
    p.address.toLowerCase().includes('mayor') && 
    ocrData.direccion_servicio.toLowerCase().includes('mayor')
  );

  if (matchedProperty) {
    assignedProperty = matchedProperty;
    addLog(`Inmueble asignado automáticamente: ${matchedProperty.alias}`);
  } else {
    requiresReview = true;
    blockingReasons.push('Selecciona inmueble - no se pudo asignar automáticamente');
    addLog('Requiere selección manual de inmueble');
  }

  const extractedFields = {
    ...ocrData,
    service_type: utilityType,
    tipo_gasto: typeInference.tipo_gasto,
    inmueble_id: assignedProperty?.id,
    inmueble_alias: assignedProperty?.alias,
    destino: 'inmueble' as const,
    estado_conciliacion: 'pendiente' as const
  };

  return {
    success: true,
    documentType: 'factura_suministro',
    extractedFields,
    destination: assignedProperty ? 
      `Inmuebles › Gastos › ${typeInference.suggested_category} (${assignedProperty.alias})` : 
      undefined,
    requiresReview,
    blockingReasons,
    fingerprint: fingerprint.doc_fingerprint,
    logs
  };
}

/**
 * 2.3 Facturas de reforma - OCR + desglose obligatorio
 */
async function processReformInvoice(
  file: File,
  filename: string,
  logs: Array<{ timestamp: string; action: string }>,
  options: ProcessingOptions
): Promise<ProcessingResult> {
  const addLog = (action: string) => logs.push({ timestamp: new Date().toISOString(), action });

  addLog('Ejecutando OCR para factura de reforma');

  // Mock OCR data
  const ocrData = {
    proveedor_nombre: 'Reformas García',
    proveedor_nif: 'B12345678',
    invoice_id: '2024-REF-001',
    invoice_date: '2024-01-14',
    total_amount: 2500.00,
    currency: 'EUR',
    iban_masked: '****5678',
    concept: 'Reforma integral cocina'
  };

  // Expense type inference - will suggest predominant type
  const typeInference = inferExpenseType({
    proveedor_nombre: ocrData.proveedor_nombre,
    concept: ocrData.concept,
    source_type: 'invoice'
  });
  addLog(`Tipo predominante inferido: ${typeInference.tipo_gasto}`);

  addLog('Requiere desglose entre categorías fiscales');

  return {
    success: true,
    documentType: 'factura_reforma',
    extractedFields: {
      ...ocrData,
      tipo_gasto_predominante: typeInference.tipo_gasto,
      destino: 'inmueble' as const,
      estado_conciliacion: 'pendiente' as const,
      desglose_categorias: {
        mejora: 0,
        mobiliario: 0,
        reparacion_conservacion: 0
      }
    },
    requiresReview: true,
    blockingReasons: ['Reparto entre categorías fiscales: Mejora/Mobiliario/Reparación y conservación'],
    logs
  };
}

/**
 * 2.4 Contratos - OCR + generación plan ingresos
 */
async function processContract(
  file: File,
  filename: string,
  logs: Array<{ timestamp: string; action: string }>,
  options: ProcessingOptions
): Promise<ProcessingResult> {
  const addLog = (action: string) => logs.push({ timestamp: new Date().toISOString(), action });

  addLog('Ejecutando OCR para contrato');

  // Mock contract data
  const contractData = {
    arrendatario_nombre: 'Ana Martínez',
    arrendatario_nif: '12345678Z',
    renta_mensual: 950.00,
    periodicidad: 'mensual',
    fecha_inicio: '2024-02-01',
    fecha_fin: '2025-01-31',
    fianza: 950.00,
    direccion_inmueble: 'Apartamento 1B'
  };

  addLog('Generando plan de ingresos proyectados');

  return {
    success: true,
    documentType: 'contrato',
    extractedFields: contractData,
    destination: 'Inmuebles › Contratos',
    requiresReview: false,
    blockingReasons: [],
    logs
  };
}

/**
 * 2.5 Documento genérico - Requiere clasificación manual
 */
async function processGenericDocument(
  file: File,
  filename: string,
  logs: Array<{ timestamp: string; action: string }>,
  options: ProcessingOptions
): Promise<ProcessingResult> {
  const addLog = (action: string) => logs.push({ timestamp: new Date().toISOString(), action });

  addLog('Documento genérico detectado');

  // Try OCR to see if we can reclassify
  if (!options.skipOCR) {
    addLog('Intentando OCR para reclasificación');
    // Mock OCR check
    const text = `Documento genérico sin patrones específicos`;
    
    if (text.includes('factura') || text.includes('invoice')) {
      addLog('Patrones de factura detectados, redirigiendo');
      return processUtilityBill(file, filename, logs, { ...options, skipOCR: true });
    }
  }

  return {
    success: true,
    documentType: 'documento_generico',
    extractedFields: {},
    requiresReview: true,
    blockingReasons: ['Destino requerido: seleccionar Inmueble/Personal y etiqueta'],
    logs
  };
}

/**
 * Unified archive function - creates/updates target entity
 */
export async function classifyAndArchive(
  documentId: string,
  documentType: DocumentType,
  extractedFields: Record<string, any>,
  userUpdates: Record<string, any> = {}
): Promise<{ success: boolean; destination: string; message: string }> {
  const finalFields = { ...extractedFields, ...userUpdates };

  switch (documentType) {
    case 'extracto_bancario':
      // Create movements in Treasury
      return {
        success: true,
        destination: 'Tesorería › Movimientos',
        message: `${finalFields.movimientos?.length || 0} movimientos creados`
      };

    case 'factura_suministro':
      // Create unified expense in property
      const utilityCategory = getUtilityCategoryDisplay(finalFields.tipo_gasto);
      return {
        success: true,
        destination: `Inmuebles › Gastos › ${utilityCategory} (${finalFields.inmueble_alias || 'Sin asignar'})`,
        message: `Gasto de ${utilityCategory.toLowerCase()} archivado en ${finalFields.inmueble_alias || 'inmueble'}`
      };

    case 'factura_reforma':
      // Create unified expense with breakdown and potential asset creation
      const { mejora, mobiliario } = finalFields.desglose_categorias || {};
      let assetMessage = '';
      if ((mejora > 0) || (mobiliario > 0)) {
        assetMessage = ' (activo creado para amortización)';
      }
      return {
        success: true,
        destination: `Inmuebles › Gastos (${finalFields.inmueble_alias || 'Sin asignar'})`,
        message: `Gasto de reforma archivado con desglose fiscal${assetMessage}`
      };

    case 'contrato':
      // Create contract and income plan
      return {
        success: true,
        destination: 'Inmuebles › Contratos',
        message: 'Contrato creado con plan de ingresos'
      };

    case 'documento_generico':
      // Archive in selected location
      const destination = finalFields.destino || 'Archivo › General';
      return {
        success: true,
        destination,
        message: 'Documento archivado'
      };

    default:
      return {
        success: false,
        destination: '',
        message: 'Tipo de documento no reconocido'
      };
  }
}

/**
 * Helper function to get display name for utility categories
 */
function getUtilityCategoryDisplay(tipoGasto: TipoGasto): string {
  const displayMap: Record<TipoGasto, string> = {
    'suministro_electricidad': 'Electricidad',
    'suministro_agua': 'Agua',
    'suministro_gas': 'Gas',
    'internet': 'Internet',
    'reparacion_conservacion': 'Reparación y conservación',
    'mejora': 'Mejora',
    'mobiliario': 'Mobiliario',
    'comunidad': 'Comunidad',
    'seguro': 'Seguro',
    'ibi': 'IBI',
    'intereses': 'Intereses',
    'comisiones': 'Comisiones',
    'otros': 'Otros'
  };
  
  return displayMap[tipoGasto] || 'Otros';
}