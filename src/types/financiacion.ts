// Updated Préstamos types for standalone Financing module
// Following the requirements from the problem statement

export interface PrestamoFinanciacion {
  id: string;
  
  // Identification & Account Selection (Step 1)
  ambito: 'PERSONAL' | 'INMUEBLE';       // Scope selector
  inmuebleId?: string;                   // Only if scope is INMUEBLE
  cuentaCargoId: string;                 // Charge account - mandatory
  alias?: string;                        // Optional alias
  fechaFirma: string;                    // Signing date (ISO date)
  fechaPrimerCargo: string;              // First charge date (ISO date)
  diaCobroMes: number;                   // Collection day of month (1-28)
  esquemaPrimerRecibo: 'NORMAL' | 'SOLO_INTERESES' | 'PRORRATA'; // First receipt scheme

  // Financial Conditions (Step 2)
  capitalInicial: number;                // Initial capital
  plazoTotal: number;                    // Total term in months or years
  plazoPeriodo: 'MESES' | 'AÑOS';       // Term period type
  carencia: 'NINGUNA' | 'CAPITAL' | 'TOTAL'; // Grace period type
  carenciaMeses?: number;                // Grace period in months if not NINGUNA
  
  tipo: 'FIJO' | 'VARIABLE' | 'MIXTO';
  
  // Fixed rate
  tinFijo?: number;                      // Fixed TIN % (e.g., 0.0345 = 3.45%)
  
  // Variable rate
  indice?: 'EURIBOR' | 'OTRO';          // Index reference
  valorIndice?: number;                  // Current index value %
  diferencial?: number;                  // Differential %
  revision: 6 | 12;                     // Review period: 6 or 12 months
  
  // Mixed rate
  tramoFijoAnos?: number;               // Fixed period in years
  tinTramoFijo?: number;                // TIN for fixed period
  
  sistema: 'FRANCES';                   // Only French system supported
  
  // Commissions
  comisionApertura?: number;            // Opening commission %
  comisionMantenimiento?: number;       // Maintenance commission €/month
  comisionAmortizacionAnticipada?: number; // Early amortization commission %

  // Bonifications (Step 3)
  bonificaciones?: BonificacionFinanciacion[];

  // Audit
  createdAt: string;
  updatedAt: string;
}

export interface BonificacionFinanciacion {
  id: string;
  tipo: 'NOMINA' | 'RECIBOS' | 'TARJETA' | 'SEGURO_HOGAR' | 'SEGURO_VIDA' | 
        'PLAN_PENSIONES' | 'ALARMA' | 'INGRESOS_RECURRENTES' | 'OTROS';
  nombre: string;                       // Display name
  condicionParametrizable: string;      // Parametrizable condition description
  descuentoTIN: number;                // TIN discount in percentage points (p.p.)
  impacto: { puntos: number };         // p.ej. -0,10 p.p.
  aplicaEn: 'FIJO'|'VARIABLE'|'MIXTO_SECCION_FIJA'|'MIXTO_SECCION_VARIABLE';
  ventanaEvaluacion: number;           // Evaluation window in months (e.g., 6)
  periodicidadRevision?: number;       // Review periodicity (inherits from loan if not defined)
  periodoGraciaInicial?: number;       // Initial grace period in months (e.g., 6)
  fuenteVerificacion: 'TESORERIA' | 'SEGUROS' | 'MANUAL'; // Verification source
  estadoInicial: 'CUMPLE' | 'NO_CUMPLE' | 'GRACIA_ACTIVA'; // Initial state
  topeAcumulado?: number;              // Accumulated cap in p.p. (e.g., -1.20)
  
  // Alta (día 1):
  seleccionado?: boolean;              // el usuario lo marca
  graciaMeses?: 0|6|12;               // opcional (selector)
  
  activa: boolean;                     // Whether bonification is active/selected
}

export interface CalculoLive {
  cuotaEstimada: number;               // Estimated monthly payment
  taeAproximada: number;               // Approximate APR
  proximaFechaRevision?: string;       // Next review date (if variable/mixed)
  tinEfectivo: number;                 // Effective TIN (base TIN - bonifications)
  tinBase: number;                     // Base TIN before bonifications
  sumaPuntosAplicada: number;          // Total bonification points applied
  ahorroMensual?: number;              // Monthly savings with bonifications
  ahorroAnual?: number;                // Annual savings with bonifications
  proximoCambio?: {                    // Next expected change
    fecha: string;                     // Date of next change
    tipo: 'FIN_PROMO' | 'REVISION_ANUAL'; // Type of change
    descripcion: string;               // Human readable description
  };
}

export interface CuadroAmortizacion {
  prestamoId: string;
  fechaGeneracion: string;
  periodos: PeriodoAmortizacion[];
  resumen: {
    totalIntereses: number;
    totalCuotas: number;
    fechaFinalizacion: string;
    capitalTotal: number;
  };
}

export interface PeriodoAmortizacion {
  numero: number;                      // Period number (1..N)
  fechaVencimiento: string;           // Due date
  cuota: number;                      // Payment amount
  capital: number;                    // Principal amount
  interes: number;                    // Interest amount
  capitalPendiente: number;           // Outstanding principal
  esMixto?: boolean;                  // Whether it's in mixed rate period
  tinPeriodo: number;                 // TIN for this period
}

export interface ResumenFinal {
  capital: number;
  plazo: string;                      // Formatted term (e.g., "25 años")
  tinBase: number;                    // Base TIN %
  tinEfectivo: number;                // Effective TIN (with bonifications) %
  cuotaEstimada: number;              // Estimated monthly payment
  bonificacionesTotales: number;      // Total bonifications in p.p.
  ahorroAnual: number;                // Annual savings with bonifications
}

// Bank account interface for account selection
export interface CuentaBancaria {
  id: string;
  iban: string;
  entidad: string;                    // Bank name
  logo?: string;                      // Bank logo URL
  alias?: string;                     // Account alias
  saldo?: number;                     // Current balance
}

// Form validation error types
export interface ValidationError {
  field: string;
  message: string;
}

export interface FormValidationState {
  isValid: boolean;
  errors: ValidationError[];
}