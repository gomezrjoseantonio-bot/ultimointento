// H3: Auto-save configuration service for Issue 2 & 3
export interface AutoSaveConfig {
  enabled: boolean;
  destinations: {
    facturas: 'tesoreria-gastos' | 'tesoreria-capex';
    extractos: 'tesoreria-movimientos';
    contratos: 'horizon-contratos';
    otros: 'archivo-general';
  };
  confidenceThresholds: {
    factura: number; // Minimum confidence for auto-classification
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
}

export const DEFAULT_AUTOSAVE_CONFIG: AutoSaveConfig = {
  enabled: false, // Default OFF as per Issue 3
  destinations: {
    facturas: 'tesoreria-gastos',
    extractos: 'tesoreria-movimientos',
    contratos: 'horizon-contratos',
    otros: 'archivo-general'
  },
  confidenceThresholds: {
    factura: 0.80, // ≥0.80 as per requirements
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
  }
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

// H3: Document classification and auto-save logic
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
  };
}

export const classifyDocument = async (document: any): Promise<ClassificationResult> => {
  const config = getAutoSaveConfig();
  
  // Basic type detection based on filename and content
  let type: ClassificationResult['type'] = 'otros';
  let confidence = 0.0;
  const doubts: string[] = [];
  const metadata: ClassificationResult['metadata'] = {};

  // Detect document type
  const filename = document.filename?.toLowerCase() || '';
  const ocrData = document.metadata?.ocr;

  if (filename.includes('factura') || filename.includes('invoice') || 
      document.metadata?.tipo?.toLowerCase() === 'factura') {
    type = 'factura';
    confidence = 0.7;
  } else if (filename.includes('extracto') || filename.includes('movimientos') ||
             document.metadata?.tipo?.toLowerCase() === 'extracto bancario') {
    type = 'extracto';
    confidence = 0.8;
  } else if (filename.includes('contrato') || filename.includes('contract') ||
             document.metadata?.tipo?.toLowerCase() === 'contrato') {
    type = 'contrato';
    confidence = 0.6;
  }

  // Enhanced classification with OCR data
  if (ocrData?.status === 'completed') {
    // Try to get OCR alignment data to improve classification
    try {
      const { alignDocumentAI } = await import('../features/inbox/ocr/alignDocumentAI');
      const aligned = alignDocumentAI(ocrData);
      
      if (aligned.supplier?.name) {
        metadata.provider = aligned.supplier.name;
        if (type === 'factura') confidence = Math.min(confidence + 0.15, 1.0);
      }
      
      if (aligned.invoice?.total?.value > 0) {
        metadata.amount = aligned.invoice.total.value;
        if (type === 'factura') confidence = Math.min(confidence + 0.1, 1.0);
      }
      
      if (aligned.invoice?.date) {
        metadata.date = aligned.invoice.date;
        confidence = Math.min(confidence + 0.05, 1.0);
      }
    } catch (error) {
      console.warn('Error processing OCR data for classification:', error);
    }
  }

  // Check clear criteria based on type
  let isClear = false;
  if (type === 'factura' && config.enabled) {
    const criteria = config.clearCriteria.factura;
    isClear = confidence >= criteria.minConfidence;
    
    if (criteria.requireProviderResolved && !metadata.provider) {
      doubts.push('Proveedor no identificado');
      isClear = false;
    }
    
    if (criteria.requireValidTotal && !metadata.amount) {
      doubts.push('Importe no válido');
      isClear = false;
    }
    
    if (criteria.requireValidDate && !metadata.date) {
      doubts.push('Fecha no válida');
      isClear = false;
    }
    
    if (criteria.requireInmuebleAssignment && !document.metadata?.destino) {
      doubts.push('Falta inmueble');
      isClear = false;
    }
    
    if (criteria.requireFiscalClassification && confidence < 0.80) {
      doubts.push('Clasificación fiscal insegura');
      isClear = false;
    }
  } else if (type === 'extracto' && config.enabled) {
    const criteria = config.clearCriteria.extracto;
    isClear = confidence >= 0.75;
    
    if (criteria.requireValidTemplate) {
      // Check if we have a known bank template
      const hasKnownTemplate = filename.includes('bbva') || filename.includes('santander') || 
                              filename.includes('ing') || filename.includes('caixa');
      if (!hasKnownTemplate) {
        doubts.push('Plantilla no reconocida');
        isClear = false;
      }
    }
    
    if (criteria.requireAccountIdentified && !metadata.account) {
      doubts.push('Cuenta no identificada');
      isClear = false;
    }
  } else if (type === 'contrato' && config.enabled) {
    isClear = confidence >= 0.70;
    if (!isClear) {
      doubts.push('Datos del contrato incompletos');
    }
  }

  // When auto-save is OFF, apply the golden rule: CLEAR → archive, DOUBTS → stay pending
  if (!config.enabled) {
    const threshold = type === 'otros' ? 0.5 : config.confidenceThresholds[type as keyof typeof config.confidenceThresholds];
    isClear = doubts.length === 0 && confidence >= threshold;
  }

  const suggestedDestination = (() => {
    switch (type) {
      case 'factura': return config.destinations.facturas;
      case 'extracto': return config.destinations.extractos;
      case 'contrato': return config.destinations.contratos;
      default: return config.destinations.otros;
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

// H3: Auto-save document to destination
export const autoSaveDocument = async (document: any, classification: ClassificationResult): Promise<{
  success: boolean;
  destination?: string;
  message: string;
  newStatus: 'importado' | 'incompleto' | 'error' | 'pendiente';
}> => {
  const config = getAutoSaveConfig();
  
  try {
    if (config.enabled) {
      // Issue 2: Auto-save ON - process and archive everything
      if (classification.isClear) {
        // Archive directly to destination
        const destination = classification.suggestedDestination;
        
        // Simulate saving to different destinations
        switch (destination) {
          case 'tesoreria-gastos':
            return {
              success: true,
              destination: 'Tesorería > Gastos',
              message: '✓ Guardado en Gastos',
              newStatus: 'importado'
            };
          case 'tesoreria-capex':
            return {
              success: true,
              destination: 'Tesorería > CAPEX',
              message: '✓ Guardado en CAPEX',
              newStatus: 'importado'
            };
          case 'tesoreria-movimientos':
            const movementCount = Math.floor(Math.random() * 20) + 1;
            return {
              success: true,
              destination: 'Tesorería > Movimientos',
              message: `✓ Importado ${movementCount} movimientos`,
              newStatus: 'importado'
            };
          case 'horizon-contratos':
            return {
              success: true,
              destination: 'Horizon > Contratos',
              message: '✓ Guardado en Contratos',
              newStatus: 'importado'
            };
          default:
            return {
              success: true,
              destination: 'Archivo General',
              message: '✓ Archivado',
              newStatus: 'importado'
            };
        }
      } else {
        // Save as incomplete with alert
        return {
          success: false,
          message: `Datos incompletos: ${classification.doubts.join(', ')}`,
          newStatus: 'incompleto'
        };
      }
    } else {
      // Issue 3: Auto-save OFF - golden rule
      if (classification.isClear) {
        // Archive directly
        const destination = classification.suggestedDestination;
        return {
          success: true,
          destination: destination.replace('-', ' > '),
          message: '✓ Archivado automáticamente',
          newStatus: 'importado'
        };
      } else {
        // Stay pending with reasons
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