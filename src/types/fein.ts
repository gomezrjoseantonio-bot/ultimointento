// FEIN (Financial Information Extraction) types for loan creation
// Implements requirements from OCR FEIN - Canonical JSON Schema

// Canonical JSON schema following problem statement exactly
export interface FEINCanonicalData {
  docMeta: {
    sourceFile: string;
    uuid: string;
    pages: number;
    parsedAt: string;
    parserVersion: string;
  };
  prestamo: {
    alias: string;
    tipo: 'FIJO' | 'VARIABLE' | 'MIXTO';
    capitalInicial: number;
    plazoMeses: number;                     // Always in months, convert from years if needed
    cuentaCargo: { 
      iban: string; 
      banco: string; 
    };
    sistemaAmortizacion: 'FRANCES';        // Only French system supported
    carencia: 'NINGUNA' | 'CAPITAL' | 'TOTAL';
    comisiones: {
      aperturaPrc: number;                 // % in human format (2.95 = 2.95%)
      mantenimientoMes: number;            // € monthly
      amortizacionAnticipadaPrc: number;   // %
    };
    fijo?: {
      tinFijoPrc: number;
    };
    variable?: {
      indice: string;
      valorIndiceActualPrc: number;
      diferencialPrc: number;
      revisionMeses: 6 | 12;
    };
    mixto?: {
      tramoFijoAnios: number;
      tinFijoTramoPrc: number;
      posteriorVariable: {
        indice: string;
        diferencialPrc: number;
        revisionMeses: 6 | 12;
      };
    };
    bonificaciones: FEINBonificacionCanonical[];
    complementos: {
      taeAproxPrc?: number;
      cuotaEstim?: number;
      proximaRevision?: string;
    };
  };
}

export interface FEINBonificacionCanonical {
  tipo: 'NOMINA' | 'RECIBOS' | 'TARJETA' | 'SEGURO_HOGAR' | 'SEGURO_VIDA' | 
        'ALARMA' | 'PLAN_PENSIONES' | 'INGRESOS_RECURRENTES';
  pp: number;                           // Points percentage (negative if reduces rate)
  estado: 'PENDIENTE' | 'CUMPLE' | 'NO_CUMPLE';
}

// Legacy FEINData interface for backward compatibility during parsing
export interface FEINData {
  // Bank and Entity Information
  bancoEntidad?: string;              // Bank / Entity issuer
  
  // Financial Conditions
  capitalInicial?: number;            // Initial capital
  tin?: number;                       // TIN (Tipo de Interés Nominal)
  tae?: number;                       // TAE (Tasa Anual Equivalente)
  plazoAnos?: number;                 // Term in years
  plazoMeses?: number;                // Term in months
  tipo?: 'FIJO' | 'VARIABLE' | 'MIXTO'; // Loan type
  
  // Variable/Mixed rate specific
  indice?: string;                    // Index reference (e.g., EURIBOR)
  diferencial?: number;               // Differential
  tramoFijoAnos?: number;            // Fixed period for mixed loans
  periodicidadRevision?: number;      // Review periodicity in months (6 or 12)
  
  // Account Information
  cuentaCargoIban?: string;          // Charge account IBAN
  ibanMascarado?: boolean;           // Whether IBAN is masked with ****
  
  // Dates
  fechaPrimerPago?: string;          // Expected first payment date
  fechaEmisionFEIN?: string;         // FEIN emission date
  
  // Bonifications (seguros, domiciliaciones, tarjetas, ingresos recurrentes, plan pensiones)
  bonificaciones?: FEINBonificacion[];
  
  // Commissions
  comisionApertura?: number;         // Opening commission %
  comisionAmortizacionParcial?: number; // Partial amortization commission %
  comisionCancelacionTotal?: number;  // Total cancellation commission %
  comisionSubrogacion?: number;       // Subrogation commission %
  
  // Raw OCR text for debugging
  rawText?: string;
}

export interface FEINBonificacion {
  tipo: 'NOMINA' | 'RECIBOS' | 'TARJETA' | 'SEGURO_HOGAR' | 'SEGURO_VIDA' | 
        'PLAN_PENSIONES' | 'ALARMA' | 'INGRESOS_RECURRENTES' | 'OTROS';
  descripcion: string;               // Description from FEIN
  descuento?: number;                // Discount in percentage points
  condicion?: string;                // Condition for the bonification
}

export interface FEINProcessingResult {
  success: boolean;
  data?: FEINCanonicalData;          // Now returns canonical format
  rawData?: FEINData;                // Legacy format for debugging
  errors: string[];
  warnings: string[];
  confidence?: number;               // Overall confidence score (0-1)
  fieldsExtracted: string[];         // List of successfully extracted fields
  fieldsMissing: string[];           // List of missing critical fields
  uuid?: string;                     // UUID for file tracking
  persistedFiles?: {                 // File persistence references
    rawPdf: string;                  // /fein/raw/{uuid}.pdf
    canonicalJson: string;           // /fein/json/{uuid}.json
    processingLog: string;           // /fein/logs/{uuid}.json
  };
}

export interface FEINValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  missingMandatoryFields: string[];
  suggestedCorrections: Record<string, any>;
}

// Mapping from FEIN data to PrestamoFinanciacion
export interface FEINToLoanMapping {
  alias?: string;                    // Loan alias (user-provided)
  ambito: 'PERSONAL' | 'INMUEBLE';  // Scope (user-selected)
  inmuebleId?: string;              // Property ID (if ambito is INMUEBLE)
  cuentaCargoId: string;            // Charge account ID (user-selected from existing accounts)
  // All other fields mapped from FEIN data
}

// Processing log structure for audit trail
export interface FEINProcessingLog {
  uuid: string;
  startTime: string;
  endTime?: string;
  stages: FEINProcessingStage[];
  errors: string[];
  fileInfo: {
    name: string;
    size: number;
    pages: number;
    mimeType: string;
  };
  ocrInfo: {
    isNativeText: boolean;
    pagesProcessed: number;
    totalChunks?: number;
    retriesRequired?: number;
  };
}

export interface FEINProcessingStage {
  stage: 'upload' | 'validation' | 'ocr' | 'parsing' | 'persistence' | 'complete';
  timestamp: string;
  duration?: number;
  success: boolean;
  details?: any;
  error?: string;
}