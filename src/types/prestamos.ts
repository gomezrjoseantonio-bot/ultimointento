// Préstamos - Comprehensive Loan Data Models
// Following the requirements from the problem statement

export interface Prestamo {
  id: string;
  ambito: 'PERSONAL' | 'INMUEBLE';
  inmuebleId?: string;          // optional (required when ambito='INMUEBLE')
  nombre: string;

  principalInicial: number;
  principalVivo: number;

  fechaFirma: string;           // ISO date (e.g., 2025-08-10)
  fechaPrimerCargo: string;     // ISO date of first payment charge
  plazoMesesTotal: number;      // original contractual term

  diaCargoMes: number;          // 1-28
  esquemaPrimerRecibo: 'NORMAL' | 'SOLO_INTERESES' | 'PRORRATA';

  tipo: 'FIJO' | 'VARIABLE' | 'MIXTO';
  sistema: 'FRANCES';

  // FIJO
  tipoNominalAnualFijo?: number; // 3.2 for 3.2%

  // VARIABLE
  indice?: 'EURIBOR' | 'OTRO';
  valorIndiceActual?: number;   // 0.025
  diferencial?: number;         // 0.012
  periodoRevisionMeses?: number; // 6 or 12
  fechaProximaRevision?: string;

  // MIXTO
  tramoFijoMeses?: number;
  tipoNominalAnualMixtoFijo?: number;

  // Carencia
  carencia: 'NINGUNA' | 'CAPITAL' | 'TOTAL';
  carenciaMeses?: number;

  // Initial irregularities
  mesesSoloIntereses?: number;  // 0..N (includes possible first month)
  diferirPrimeraCuotaMeses?: number; // 0..N (e.g., 2 → first payment 2 months later)
  prorratearPrimerPeriodo?: boolean;  // true = interest by actual days until 1st payment
  cobroMesVencido?: boolean;    // true = accrual month t, collection in month t+1

  // Collection details
  cuentaCargoId: string;        // treasury account id

  // Costs/commissions
  comisionApertura?: number;
  comisionMantenimiento?: number;
  comisionAmortizacionAnticipada?: number; // % on amortized amount
  comisionAmortizacionParcial?: number;    // kept for backwards compatibility
  comisionCancelacionTotal?: number;       // % on outstanding balance
  gastosFijosOperacion?: number;           // €

  // Bonifications management
  bonificaciones?: Bonificacion[];
  maximoBonificacionPorcentaje?: number;     // maximum total bonification allowed (e.g., 0.006 = 0.60%)
  periodoRevisionBonificacionMeses?: number; // bonification review period: 6 or 12 months
  fechaFinMaximaBonificacion?: string;       // end date for maximum bonification period

  // Reglas por defecto de bonificaciones
  topeBonificacionesTotal?: number;          // Tope acumulado de descuentos: -1,00 p.p.
  tinMin?: number;                           // Suelo TIN para FIJO: 1,00%
  diferencialMin?: number;                   // Suelo diferencial para VARIABLE: 0,40%

  // Bonification evaluation parameters (when bonifications are active)
  fechaFinPeriodo?: string;           // end of evaluation period (ISO date)
  fechaEvaluacion?: string;           // evaluation date (defaults to finPeriodo - 30 days, editable)
  offsetEvaluacionDias?: number;      // default 30 days before end period

  // Estado de pagos
  cuotasPagadas: number;
  fechaUltimaCuotaPagada?: string;

  // Importación
  origenCreacion: 'MANUAL' | 'FEIN' | 'IMPORTACION';
  cuotasPagadasAlImportar?: number;
  capitalVivoAlImportar?: number;
  documentoFEIN?: string;

  activo: boolean;

  // Audit
  createdAt: string;
  updatedAt: string;
}

export interface Bonificacion {
  id: string;
  tipo: 'NOMINA'|'RECIBOS'|'SEGURO_HOGAR'|'SEGURO_VIDA'|'TARJETA'|'PENSIONES'|'ALARMA'|'OTROS';
  nombre: string;                 // "Nómina", "Seguro hogar", "Tarjeta"…
  reduccionPuntosPorcentuales: number; // e.g., 0.003 = 0.30 pp
  impacto: { puntos: number };    // p.ej. -0,10 p.p.
  aplicaEn: 'FIJO'|'VARIABLE'|'MIXTO_SECCION_FIJA'|'MIXTO_SECCION_VARIABLE';
  lookbackMeses: number;          // compliance window
  regla: ReglaBonificacion;       // declarative rule
  costeAnualEstimado?: number;    // e.g., insurance premium
  cuentaExigidaId?: string;       // if bank requires specific account
  
  // Alta (día 1):
  seleccionado?: boolean;         // el usuario lo marca
  graciaMeses?: 0|6|12;          // opcional (selector)
  
  // Estados a futuro (no en esta vista):
  estado: 'INACTIVO'|'SELECCIONADO'|'ACTIVO_POR_GRACIA'|'ACTIVO_POR_CUMPLIMIENTO'|'PENDIENTE'|'EN_RIESGO'|'CUMPLIDA'|'PERDIDA';
  
  // Progress tracking (for UI)
  progreso?: {
    descripcion: string; // "Llevas 2/4 meses de nómina ≥ 1.200€"
    faltante?: string;   // "Falta 1 mes con nómina ≥ 1.200€"
  };
}

export type ReglaBonificacion =
  | { tipo: 'NOMINA'; minimoMensual: number }
  | { tipo: 'PLAN_PENSIONES'; activo: boolean }
  | { tipo: 'SEGURO_HOGAR'; activo: boolean }
  | { tipo: 'SEGURO_VIDA'; activo: boolean }
  | { tipo: 'TARJETA'; movimientosMesMin?: number; importeMinimo?: number }
  | { tipo: 'ALARMA'; activo: boolean }
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
  pagado: boolean;
  fechaPagoReal?: string;
  movimientoTesoreriaId?: string;
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