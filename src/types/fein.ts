// FEIN (Financial Information Extraction) types for loan creation
// Implements requirements from PROMPT 3 — CREACIÓN DE PRÉSTAMOS DESDE FEIN

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
  
  // Account Information
  cuentaCargoIban?: string;          // Charge account IBAN
  
  // Dates
  fechaPrimerPago?: string;          // Expected first payment date
  
  // Bonifications (seguros, domiciliaciones, tarjetas, ingresos recurrentes, plan pensiones)
  bonificaciones?: FEINBonificacion[];
  
  // Commissions
  comisionApertura?: number;         // Opening commission %
  comisionAmortizacionParcial?: number; // Partial amortization commission %
  comisionCancelacionTotal?: number;  // Total cancellation commission %
  
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
  data?: FEINData;
  errors: string[];
  warnings: string[];
  confidence?: number;               // Overall confidence score (0-1)
  fieldsExtracted: string[];         // List of successfully extracted fields
  fieldsMissing: string[];           // List of missing critical fields
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