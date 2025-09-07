// Préstamos - Comprehensive Loan Data Models
// Following the requirements from the problem statement

export interface Prestamo {
  id: string;
  inmuebleId: string;           // mandatory association with property
  nombre: string;

  principalInicial: number;
  principalVivo: number;

  fechaFirma: string;           // ISO date (e.g., 2025-08-10)
  plazoMesesTotal: number;      // original contractual term

  tipo: 'FIJO' | 'VARIABLE' | 'MIXTO';

  // FIJO
  tipoNominalAnualFijo?: number; // 0.032 = 3.2%

  // VARIABLE
  indice?: 'EURIBOR' | 'OTRO';
  valorIndiceActual?: number;   // 0.025
  diferencial?: number;         // 0.012
  periodoRevisionMeses?: number; // 6 or 12
  fechaProximaRevision?: string;

  // MIXTO
  tramoFijoMeses?: number;
  tipoNominalAnualMixtoFijo?: number;

  // Initial irregularities
  mesesSoloIntereses?: number;  // 0..N (includes possible first month)
  diferirPrimeraCuotaMeses?: number; // 0..N (e.g., 2 → first payment 2 months later)
  prorratearPrimerPeriodo?: boolean;  // true = interest by actual days until 1st payment
  cobroMesVencido?: boolean;    // true = accrual month t, collection in month t+1

  // Collection details
  diaCargoMes?: number;         // 1..28 (or 30), e.g., 10
  cuentaCargoId: string;        // treasury account id

  // Costs/commissions
  comisionAmortizacionParcial?: number; // % on amortized amount
  comisionCancelacionTotal?: number;    // % on outstanding balance
  gastosFijosOperacion?: number;        // €

  // Optional bonifications (to be ignored for now)
  bonificaciones?: Bonificacion[];

  // Audit
  createdAt: string;
  updatedAt: string;
}

export interface Bonificacion {
  id: string;
  nombre: string;                 // "Nómina", "Seguro hogar", "Tarjeta"…
  reduccionPuntosPorcentuales: number; // e.g., 0.003 = 0.30 pp
  lookbackMeses: number;          // compliance window
  regla: ReglaBonificacion;       // declarative rule
  costeAnualEstimado?: number;    // e.g., insurance premium
  cuentaExigidaId?: string;       // if bank requires specific account
  estado: 'PENDIENTE' | 'EN_RIESGO' | 'CUMPLIDA' | 'PERDIDA';
  // Progress tracking (for UI)
  progreso?: {
    descripcion: string; // "Llevas 2/4 meses de nómina ≥ 1.200€"
    faltante?: string;   // "Falta 1 mes con nómina ≥ 1.200€"
  };
}

export type ReglaBonificacion =
  | { tipo: 'NOMINA'; minimoMensual: number }
  | { tipo: 'TARJETA'; movimientosMesMin: number }
  | { tipo: 'SEGURO_HOGAR'; activo: boolean }
  | { tipo: 'SEGURO_VIDA'; activo: boolean }
  | { tipo: 'OTRA'; descripcion: string };

export interface PeriodoPago {
  periodo: number;                // 1..N
  devengoDesde: string;          // ISO date
  devengoHasta: string;          // ISO date
  fechaCargo: string;            // ISO date
  cuota: number;                 // €
  interes: number;               // €
  amortizacion: number;          // €
  principalFinal: number;        // €
  esProrrateado?: boolean;       // first period prorated
  esSoloIntereses?: boolean;     // interest-only period
  diasDevengo?: number;          // for prorated calculations
}

export interface PlanPagos {
  prestamoId: string;
  fechaGeneracion: string;       // ISO timestamp
  periodos: PeriodoPago[];
  resumen: {
    totalIntereses: number;
    totalCuotas: number;
    fechaFinalizacion: string;
  };
}

export interface CalculoAmortizacion {
  modo: 'REDUCIR_PLAZO' | 'REDUCIR_CUOTA';
  importeAmortizar: number;
  fechaAmortizacion: string;
  
  // Results
  penalizacion: number;
  nuevaCuota?: number;           // if REDUCIR_CUOTA
  nuevoplazo?: number;           // if REDUCIR_PLAZO
  nuevaFechaFin?: string;
  interesesAhorrados: number;
  puntoEquilibrio?: number;      // months to break even
}