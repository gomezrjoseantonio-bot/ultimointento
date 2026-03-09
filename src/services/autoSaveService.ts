// H8: Enhanced auto-save configuration service with H8 requirements
export interface AutoSaveConfig {
  enabled: boolean;
  destinations: {
    facturas: 'tesoreria-gastos' | 'tesoreria-capex';
    extractos: 'tesoreria-movimientos';
    contratos: 'horizon-contratos';
    otros: 'archivo-general';
  };
  confidenceThresholds: {
    factura: number; // H8: ≥0.80 as per requirements
    extracto: number;
    contrato: number;
  };
  clearCriteria: {
    factura: {
      requireProviderResolved: boolean;
      requireValidTotal: boolean;
      requireValidDate: boolean;
      requireFiscalClassification: boolean;
      requireInmuebleAssignment: boolean;
      minConfidence: number;
    };
    extracto: {
      requireValidTemplate: boolean;
      requireConsistentDates: boolean;
      requireAccountIdentified: boolean;
    };
    contrato: {
      requireValidParties: boolean;
      requireValidDates: boolean;
    };
  };
  // H8: New settings for auto-OCR behavior
  autoOcrEnabled: boolean;
  capexThresholdAmount: number; // Amount threshold for CAPEX detection (e.g., 300€)
  showWarningOnLowConfidence: boolean; // Show "Revisar: confianza baja" warning
}

export const DEFAULT_AUTOSAVE_CONFIG: AutoSaveConfig = {
  enabled: false, // H8: Default OFF as per Issue 3
  destinations: {
    facturas: 'tesoreria-gastos',
    extractos: 'tesoreria-movimientos',
    contratos: 'horizon-contratos',
    otros: 'archivo-general'
  },
  confidenceThresholds: {
    factura: 0.80, // H8: ≥0.80 as per requirements
    extracto: 0.75,
    contrato: 0.70
  },
  clearCriteria: {
    factura: {
      requireProviderResolved: true,
      requireValidTotal: true,
      requireValidDate: true,
      requireFiscalClassification: true,
      requireInmuebleAssignment: true,
      minConfidence: 0.80
    },
    extracto: {
      requireValidTemplate: true,
      requireConsistentDates: true,
      requireAccountIdentified: true
    },
    contrato: {
      requireValidParties: true,
      requireValidDates: true
    }
  },
  // H8: New auto-OCR settings
  autoOcrEnabled: true, // H8: Auto-OCR enabled by default
  capexThresholdAmount: 300, // H8: 300€ threshold for CAPEX detection
  showWarningOnLowConfidence: true // H8: Show warnings for low confidence
};

export const getAutoSaveConfig = (): AutoSaveConfig => {
  try {
    const stored = localStorage.getItem('AUTOSAVE_CONFIG');
    if (stored) {
      return { ...DEFAULT_AUTOSAVE_CONFIG, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.warn('Error loading auto-save config:', error);
  }
  return DEFAULT_AUTOSAVE_CONFIG;
};

export const setAutoSaveConfig = (config: Partial<AutoSaveConfig>): void => {
  try {
    const currentConfig = getAutoSaveConfig();
    const newConfig = { ...currentConfig, ...config };
    localStorage.setItem('AUTOSAVE_CONFIG', JSON.stringify(newConfig));
  } catch (error) {
    console.error('Error saving auto-save config:', error);
  }
};

export const toggleAutoSave = (): boolean => {
  const config = getAutoSaveConfig();
  const newEnabled = !config.enabled;
  setAutoSaveConfig({ enabled: newEnabled });
  return newEnabled;
};

// FIX-DOCS: Enhanced document classification and auto-save logic
export interface ClassificationResult {
  type: 'factura' | 'extracto' | 'contrato' | 'otros';
  confidence: number;
  isClear: boolean;
  doubts: string[];
  suggestedDestination: string;
  metadata: {
    provider?: string;
    amount?: number;
    date?: string;
    account?: string;
    inmueble?: string;
    nif?: string;
    invoiceNumber?: string;
    baseAmount?: number;
    vatAmount?: number;
    totalAmount?: number;
    category?: string;
    entityType?: 'personal' | 'inmueble';
    duplicateDetected?: boolean;
    suggestedDestination?: string; // H8: Enhanced metadata
    isCapex?: boolean; // H8: CAPEX detection
    warningMessage?: string; // H8: Low confidence warning
    // FIX-DOCS: Document type flags for enhanced processing
    isReform?: boolean; // Reform invoice (multiple entries)
    isReceipt?: boolean; // Receipt (Treasury + Expense)
    isLoanDocumentation?: boolean; // Loan costs
    isAcquisitionCost?: boolean; // Property acquisition costs
    isFiscalDocument?: boolean; // Tax/fiscal documentation
  };
}

// H6: Invoice duplicate detection (binary hash + heuristic)
export const detectInvoiceDuplicate = (document: any, existingDocuments: any[]): boolean => {
  const provider = document.metadata?.provider?.toLowerCase() || '';
  const amount = document.metadata?.amount || 0;
  const date = document.metadata?.date || '';
  
  // Check for exact binary duplicates first (same filename + size)
  const binaryDuplicate = existingDocuments.find(existing => 
    existing.filename === document.filename && 
    existing.size === document.size &&
    existing.id !== document.id
  );
  
  if (binaryDuplicate) {
    console.log('Binary duplicate detected:', document.filename);
    return true;
  }
  
  // Heuristic duplicate detection (provider + date + total)
  if (provider && amount && date) {
    const heuristicDuplicate = existingDocuments.find(existing => {
      const existingProvider = existing.metadata?.provider?.toLowerCase() || '';
      const existingAmount = existing.metadata?.amount || 0;
      const existingDate = existing.metadata?.date || '';
      
      return existingProvider === provider &&
             Math.abs(existingAmount - amount) < 0.01 && // Allow for rounding differences
             existingDate === date &&
             existing.id !== document.id;
    });
    
    if (heuristicDuplicate) {
      console.log('Heuristic duplicate detected:', { provider, amount, date });
      return true;
    }
  }
  
  return false;
};

// H3: Enhanced document classification for immediate processing
export const classifyDocument = async (document: any, existingDocuments: any[] = []): Promise<ClassificationResult> => {
  const config = getAutoSaveConfig();
  
  // Basic type detection based on filename and content
  let type: ClassificationResult['type'] = 'otros';
  let confidence = 0.0;
  const doubts: string[] = [];
  const metadata: ClassificationResult['metadata'] = {};

  // Detect document type
  const filename = document.filename?.toLowerCase() || '';
  const ocrData = document.metadata?.ocr;

  // FIX-DOCS: Enhanced type detection for all 7 document types
  
  // 1. Facturas de gasto corriente
  if (filename.includes('factura') || filename.includes('invoice') || 
      document.metadata?.tipo?.toLowerCase() === 'factura') {
    type = 'factura';
    confidence = 0.7;
    
    // H6: Check for invoice duplicates
    if (detectInvoiceDuplicate(document, existingDocuments)) {
      return {
        type,
        confidence: 0,
        isClear: false,
        doubts: ['Documento duplicado'],
        suggestedDestination: '',
        metadata: { ...metadata, duplicateDetected: true }
      } as ClassificationResult;
    }
  }
  
  // 2. Facturas de reforma (with reform keywords)
  else if (filename.includes('reforma') || filename.includes('mejora') || 
           filename.includes('ampliacion') || filename.includes('mobiliario') ||
           document.metadata?.tipo?.toLowerCase() === 'factura-reforma') {
    type = 'factura';
    confidence = 0.8;
    metadata.isReform = true;
    document.metadata.tipo = 'factura-reforma'; // Mark for reform processing
  }
  
  // 3. Recibos (domiciliaciones, TPV, etc.)
  else if (filename.includes('recibo') || filename.includes('domiciliacion') ||
           filename.includes('tpv') || filename.includes('cargo') ||
           document.metadata?.tipo?.toLowerCase() === 'recibo') {
    type = 'factura'; // Process as expense but mark as receipt
    confidence = 0.8;
    metadata.isReceipt = true;
    document.metadata.tipo = 'recibo';
  }
  
  // 4. Contratos (alquiler, seguros, etc.)
  else if (filename.includes('contrato') || filename.includes('contract') ||
           filename.includes('alquiler') || filename.includes('seguro') ||
           document.metadata?.tipo?.toLowerCase() === 'contrato') {
    type = 'contrato';
    confidence = 0.6;
  }
  
  // 5. Documentación de préstamo
  else if (filename.includes('prestamo') || filename.includes('hipoteca') ||
           filename.includes('tasacion') || filename.includes('notaria') ||
           filename.includes('broker') || filename.includes('apertura') ||
           document.metadata?.tipo?.toLowerCase() === 'prestamo') {
    type = 'factura'; // Process as expense but mark as loan documentation
    confidence = 0.7;
    metadata.isLoanDocumentation = true;
    document.metadata.tipo = 'prestamo';
  }
  
  // 6. Costes de adquisición
  else if (filename.includes('escritura') || filename.includes('adquisicion') ||
           filename.includes('itp') || filename.includes('registro') ||
           filename.includes('compra') || 
           document.metadata?.tipo?.toLowerCase() === 'adquisicion') {
    type = 'factura'; // Process as expense but mark as acquisition cost
    confidence = 0.8;
    metadata.isAcquisitionCost = true;
    document.metadata.tipo = 'adquisicion';
  }
  
  // 7. Documentación fiscal / Otros
  else if (filename.includes('ibi') || filename.includes('aeat') ||
           filename.includes('catastral') || filename.includes('hacienda') ||
           document.metadata?.tipo?.toLowerCase() === 'fiscal') {
    type = 'otros';
    confidence = 0.7;
    metadata.isFiscalDocument = true;
    document.metadata.tipo = 'fiscal';
  }
  
  // Bank extracts
  else if (filename.includes('extracto') || filename.includes('movimientos') ||
           filename.includes('xlsx') || filename.includes('csv') ||
           document.metadata?.tipo?.toLowerCase() === 'extracto bancario') {
    type = 'extracto';
    confidence = 0.8;
  }
  
  // Default to otros
  else {
    type = 'otros';
    confidence = 0.5;
  }

  // H3: Enhanced classification with OCR data for Invoice processing
  if (ocrData?.status === 'completed' && type === 'factura') {
    try {
      const { alignDocumentAI } = await import('../features/inbox/ocr/alignDocumentAI');
      const aligned = alignDocumentAI(ocrData);
      
      // Map provider, NIF, invoice number, date, base, VAT, total
      if (aligned.supplier?.name) {
        metadata.provider = aligned.supplier.name;
        confidence = Math.min(confidence + 0.15, 1.0);
      }
      
      if (aligned.supplier?.taxId) {
        metadata.nif = aligned.supplier.taxId;
        confidence = Math.min(confidence + 0.05, 1.0);
      }
      
      if (aligned.invoice?.id) {
        metadata.invoiceNumber = aligned.invoice.id;
        confidence = Math.min(confidence + 0.05, 1.0);
      }
      
      if (aligned.invoice?.date) {
        metadata.date = aligned.invoice.date;
        confidence = Math.min(confidence + 0.05, 1.0);
      }
      
      if (aligned.invoice?.net?.value > 0) {
        metadata.baseAmount = aligned.invoice.net.value;
        confidence = Math.min(confidence + 0.05, 1.0);
      }
      
      if (aligned.invoice?.tax?.value > 0) {
        metadata.vatAmount = aligned.invoice.tax.value;
        confidence = Math.min(confidence + 0.05, 1.0);
      }
      
      if (aligned.invoice?.total?.value > 0) {
        metadata.amount = aligned.invoice.total.value;
        metadata.totalAmount = aligned.invoice.total.value;
        confidence = Math.min(confidence + 0.1, 1.0);
      }
      
      // Determine entity type (inmueble/personal) and category
      if (aligned.service?.serviceAddress || 
          metadata.provider?.toLowerCase().includes('comunidad')) {
        metadata.entityType = 'inmueble';
        metadata.category = 'Comunidad';
      } else {
        metadata.entityType = 'personal';
        metadata.category = 'Otros';
      }
      
    } catch (error) {
      console.warn('Error processing OCR data for invoice classification:', error);
      doubts.push('Error procesando OCR');
    }
  }

  // H8: Enhanced destination classification with CAPEX detection
  const enhancedClassification = classifyDestination(ocrData, metadata, type, confidence, config);
  type = enhancedClassification.type as ClassificationResult['type'];
  confidence = enhancedClassification.confidence;
  if (enhancedClassification.suggestedDestination) {
    metadata.suggestedDestination = enhancedClassification.suggestedDestination;
  }
  if (enhancedClassification.doubts) {
    doubts.push(...enhancedClassification.doubts);
  }

  // H3: Enhanced classification for bank extracts
  if (type === 'extracto') {
    // Check for known bank templates
    const bankPatterns = {
      'bbva': /bbva/i,
      'santander': /santander/i,
      'ing': /ing/i,
      'caixa': /caixa|lacaixa/i,
      'bankinter': /bankinter/i
    };
    
    let bankDetected = false;
    for (const [bank, pattern] of Object.entries(bankPatterns)) {
      if (pattern.test(filename)) {
        metadata.account = bank.toUpperCase();
        bankDetected = true;
        confidence = Math.min(confidence + 0.1, 1.0);
        break;
      }
    }
    
    if (!bankDetected) {
      doubts.push('Plantilla bancaria no reconocida');
    }
  }

  // H5: Enhanced clear criteria based on type for Issue 5
  let isClear = false;
  
  if (type === 'factura') {
    // H5: Clear invoice criteria = provider resolved, valid total and date, classification ≥0.80, destination resolved
    const hasProviderResolved = !!metadata.provider;
    const hasValidTotal = !!(metadata.amount && metadata.amount > 0);
    const hasValidDate = !!metadata.date;
    const hasHighConfidence = confidence >= 0.80;
    const hasDestinationResolved = true; // We always have a destination
    
    if (config.enabled) {
      // Auto-save ON: Use stricter criteria
      const criteria = config.clearCriteria.factura;
      isClear = confidence >= criteria.minConfidence;
      
      if (criteria.requireProviderResolved && !hasProviderResolved) {
        doubts.push('Proveedor no identificado');
        isClear = false;
      }
      
      if (criteria.requireValidTotal && !hasValidTotal) {
        doubts.push('Importe no válido');
        isClear = false;
      }
      
      if (criteria.requireValidDate && !hasValidDate) {
        doubts.push('Fecha no válida');
        isClear = false;
      }
      
      if (criteria.requireInmuebleAssignment && !document.metadata?.destino) {
        doubts.push('Falta inmueble');
        isClear = false;
      }
      
      if (criteria.requireFiscalClassification && !hasHighConfidence) {
        doubts.push('Clasificación fiscal insegura');
        isClear = false;
      }
    } else {
      // H5: Auto-save OFF - Golden rule: CLEAR → archive, DOUBTS → pending
      isClear = hasProviderResolved && hasValidTotal && hasValidDate && hasHighConfidence && hasDestinationResolved;
      
      if (!hasProviderResolved) doubts.push('Proveedor no resuelto');
      if (!hasValidTotal) doubts.push('Total no válido');
      if (!hasValidDate) doubts.push('Fecha no válida');
      if (!hasHighConfidence) doubts.push('Clasificación < 0.80');
      if (!metadata.inmueble && !document.metadata?.destino) doubts.push('Falta inmueble');
    }
    
  } else if (type === 'extracto') {
    // H5: Clear extract criteria = template applied, correct dates/decimals, account identified
    const hasValidTemplate = !!metadata.account;
    const hasConsistentDates = true; // Would need actual parsing to verify
    const hasAccountIdentified = !!metadata.account;
    
    if (config.enabled) {
      const criteria = config.clearCriteria.extracto;
      isClear = confidence >= 0.75;
      
      if (criteria.requireValidTemplate && !hasValidTemplate) {
        doubts.push('Plantilla no reconocida');
        isClear = false;
      }
      
      if (criteria.requireAccountIdentified && !hasAccountIdentified) {
        doubts.push('Cuenta no identificada');
        isClear = false;
      }
    } else {
      // H5: Auto-save OFF - Golden rule
      isClear = hasValidTemplate && hasConsistentDates && hasAccountIdentified;
      
      if (!hasValidTemplate) doubts.push('Plantilla rota');
      if (!hasAccountIdentified) doubts.push('Cuenta no identificada');
    }
    
  } else if (type === 'contrato') {
    // H3: Contracts go to Horizon > Contracts (draft if incomplete)
    isClear = confidence >= 0.70;
    if (!isClear) {
      doubts.push('Datos del contrato incompletos');
    }
  } else {
    // H3: Others → archive in References
    const threshold = 0.5;
    isClear = confidence >= threshold;
    if (!isClear) {
      doubts.push('Clasificación insegura');
    }
  }

  const suggestedDestination = (() => {
    switch (type) {
      case 'factura': return config.destinations.facturas;
      case 'extracto': return config.destinations.extractos;
      case 'contrato': return config.destinations.contratos;
      default: return config.destinations.otros; // H3: Others → archive in References (archivo-general)
    }
  })();

  return {
    type,
    confidence,
    isClear,
    doubts,
    suggestedDestination,
    metadata
  };
};

// FIX-DOCS: Enhanced auto-save with complete document ingestion
export const autoSaveDocument = async (document: any, classification: ClassificationResult): Promise<{
  success: boolean;
  destination?: string;
  message: string;
  newStatus: 'importado' | 'incompleto' | 'error' | 'pendiente' | 'duplicado';
}> => {
  const config = getAutoSaveConfig();
  
  try {
    if (config.enabled) {
      // FIX-DOCS: Auto-save ON - process and create structured entries with document attachments
      if (classification.isClear) {
        // Use the new document ingestion service
        const { processDocumentIngestion } = await import('./documentIngestionService');
        const ingestionResult = await processDocumentIngestion(document);
        
        if (ingestionResult.success) {
          return {
            success: true,
            destination: ingestionResult.destination,
            message: ingestionResult.message,
            newStatus: 'importado'
          };
        } else {
          return {
            success: false,
            message: `Error en procesamiento: ${ingestionResult.message}`,
            newStatus: 'error'
          };
        }
      } else {
        // H4: If missing data → archived as Incomplete with alert in destination
        return {
          success: false,
          message: `Archivado incompleto: ${classification.doubts.join(', ')}`,
          newStatus: 'incompleto'
        };
      }
    } else {
      // H5: Issue 5 - Auto-save OFF - Golden rule: CLEAR → archive, DOUBTS → pending
      if (classification.isClear) {
        // CLEAR → archive directly using document ingestion service
        const { processDocumentIngestion } = await import('./documentIngestionService');
        const ingestionResult = await processDocumentIngestion(document);
        
        if (ingestionResult.success) {
          return {
            success: true,
            destination: ingestionResult.destination,
            message: ingestionResult.message,
            newStatus: 'importado'
          };
        } else {
          return {
            success: false,
            message: `Error: ${ingestionResult.message}`,
            newStatus: 'error'
          };
        }
      } else {
        // DOUBTS → stay pending in Inbox with visible reasons
        return {
          success: false,
          message: `Pendiente: ${classification.doubts.join(', ')}`,
          newStatus: 'pendiente'
        };
      }
    }
  } catch (error) {
    console.error('Error in auto-save:', error);
    return {
      success: false,
      message: 'Error en el procesamiento',
      newStatus: 'error'
    };
  }
};

// H8: Enhanced destination classification with CAPEX and contract detection
const classifyDestination = (
  ocrData: any,
  metadata: any,
  currentType: string,
  currentConfidence: number,
  config: AutoSaveConfig
): {
  type: string;
  confidence: number;
  suggestedDestination?: string;
  doubts?: string[];
} => {
  const doubts: string[] = [];
  let type = currentType;
  let confidence = currentConfidence;
  let suggestedDestination: string | undefined;

  // H8: CAPEX detection based on keywords and amount
  if (type === 'factura' && ocrData?.status === 'completed') {
    const textContent = ocrData.fields
      ?.map((field: any) => field.value?.toLowerCase() || '')
      .join(' ') || '';
    
    const capexKeywords = [
      'obra', 'reforma', 'proyecto', 'presupuesto', 'carpintería',
      'instalación', 'climatización', 'construcción', 'reparación',
      'mejora', 'renovación', 'ampliación'
    ];
    
    const hasCapexKeywords = capexKeywords.some(keyword => 
      textContent.includes(keyword)
    );
    
    const amount = metadata.totalAmount || metadata.amount || 0;
    const isHighAmount = amount > config.capexThresholdAmount;
    
    if (hasCapexKeywords && isHighAmount) {
      // Suggest CAPEX instead of regular expense
      suggestedDestination = 'tesoreria-capex';
      metadata.isCapex = true;
      confidence = Math.min(confidence + 0.10, 1.0);
      
      if (process.env.NODE_ENV === 'development') {
        console.info('CAPEX detected:', { keywords: hasCapexKeywords, amount, threshold: config.capexThresholdAmount });
      }
    }
  }

  // H8: Contract detection enhancement
  if (ocrData?.status === 'completed') {
    const textContent = ocrData.fields
      ?.map((field: any) => field.value?.toLowerCase() || '')
      .join(' ') || '';
    
    const contractKeywords = [
      'contrato', 'arrendamiento', 'anexo', 'hipoteca', 'préstamo',
      'contract', 'lease', 'amendment', 'mortgage', 'loan',
      'acuerdo', 'agreement', 'términos', 'terms'
    ];
    
    const hasContractKeywords = contractKeywords.some(keyword =>
      textContent.includes(keyword)
    );
    
    if (hasContractKeywords && type !== 'contrato') {
      type = 'contrato';
      confidence = Math.max(confidence, 0.75);
      suggestedDestination = config.destinations.contratos;
    }
  }

  // H8: Apply preference hierarchy (Contratos > Extractos > CAPEX > Facturas > Otros)
  if (!suggestedDestination) {
    switch (type) {
      case 'contrato':
        suggestedDestination = config.destinations.contratos;
        break;
      case 'extracto':
        suggestedDestination = config.destinations.extractos;
        break;
      case 'factura':
        suggestedDestination = metadata.isCapex 
          ? 'tesoreria-capex' 
          : config.destinations.facturas;
        break;
      default:
        suggestedDestination = config.destinations.otros;
    }
  }

  // H8: Add warning for low confidence if enabled
  if (config.showWarningOnLowConfidence && confidence < 0.80) {
    metadata.warningMessage = 'Revisar: confianza baja';
    doubts.push('Confianza baja');
  }

  return {
    type,
    confidence,
    suggestedDestination,
    doubts: doubts.length > 0 ? doubts : undefined
  };
};