// Préstamos - Comprehensive Loan Data Models
// Following the requirements from the problem statement

// ── DestinoCapital ─────────────────────────────────────────────────────────
// Para qué se pide el dinero — determina fiscalidad (no la garantía)

export interface DestinoCapital {
  id: string;                         // uuid corto
  tipo: 'ADQUISICION'                 // comprar un inmueble
      | 'REFORMA'                     // reformar un inmueble
      | 'CANCELACION_DEUDA'           // cancelar otro préstamo/deuda
      | 'INVERSION'                   // financiar inversión mobiliaria
      | 'PERSONAL'                    // gasto personal (no deducible)
      | 'OTRA';

  // Vinculación al activo (según tipo)
  inmuebleId?: string;                // si ADQUISICION o REFORMA
  inversionId?: string;               // si INVERSION
  prestamoIdCancelado?: string;       // si CANCELACION_DEUDA

  importe: number;                    // € destinados a este fin
  porcentaje?: number;                // calculado: importe / principalInicial * 100
  descripcion?: string;               // texto libre: "Compra Tenderina 48"
}

// ── Garantia ───────────────────────────────────────────────────────────────
// Qué responde si no pagas — informativa, NO afecta fiscalidad

export interface Garantia {
  tipo: 'HIPOTECARIA'                 // un inmueble responde
      | 'PERSONAL'                    // la persona responde
      | 'PIGNORATICIA';               // un activo financiero responde

  // Vinculación al activo que garantiza
  inmuebleId?: string;                // si HIPOTECARIA
  inversionId?: string;               // si PIGNORATICIA (fondo, PP, depósito)

  descripcion?: string;               // "Buigas 15 Sant Fruitós" o "Plan pensiones Orange"
}

export interface Prestamo {
  id: string;
  ambito: 'PERSONAL' | 'INMUEBLE';
  // NOTE: ambito se CALCULA de destinos:
  //   Si algún destino tiene inmuebleId → 'INMUEBLE'
  //   Si ninguno → 'PERSONAL'

  // ── NUEVO v2: Destino y Garantía ─────────────────────────────────────────
  /**
   * Para qué se pide el dinero — determina fiscalidad.
   * sum(destinos[].importe) debe === principalInicial.
   * Si vacío → usar inmuebleId/afectacionesInmueble como fallback (legacy).
   */
  destinos?: DestinoCapital[];
  /**
   * Qué responde si no pagas — informativo, NO afecta cálculos fiscales.
   */
  garantias?: Garantia[];

  // ── LEGACY (mantener para migración, no usar en código nuevo) ────────────
  /** @deprecated Usar destinos[].inmuebleId */
  inmuebleId?: string;
  /**
   * @deprecated Usar destinos[] con un DestinoCapital por cada inmueble.
   * Distribución opcional del préstamo entre varios inmuebles.
   */
  afectacionesInmueble?: AfectacionInmueblePrestamo[];
  /**
   * @deprecated Usar destinos[].tipo
   * Finalidad económica principal del préstamo.
   */
  finalidad?: 'ADQUISICION' | 'REFORMA' | 'INVERSION' | 'PERSONAL' | 'OTRA';

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
  estado?: 'vivo' | 'cancelado' | 'pendiente_cancelacion_venta' | 'pendiente_completar';
  fechaCancelacion?: string;

  // Intereses anuales declarados por ejercicio fiscal (ej: { 2023: 1200.50 })
  interesesAnualesDeclarados?: Record<number, number>;

  // Importación
  origenCreacion: 'MANUAL' | 'FEIN' | 'IMPORTACION';
  cuotasPagadasAlImportar?: number;
  capitalVivoAlImportar?: number;
  documentoFEIN?: string;

  /**
   * V60 (TAREA 7 sub-tarea 1): liquidación final del préstamo (cancelación
   * total o parcial). Absorbe los datos del store eliminado
   * `loan_settlements` (sub-tarea 4 elimina el store y migra los registros
   * al campo `prestamos[].liquidacion` correspondiente).
   *
   * Tipo `unknown` aquí para evitar dependencia circular con
   * `services/db.ts` donde vive la interfaz `LoanSettlement` completa.
   * Los consumidores que necesiten el tipo concreto deben hacer cast a
   * `LoanSettlement` desde `src/services/db.ts`.
   *
   * Default `null` post-V60 (préstamo vivo). `undefined` para préstamos
   * pre-V60 (campo aún no inicializado).
   */
  liquidacion?: unknown | null;

  /**
   * TAREA 15 sub-tarea 15.3 · plan de pagos del préstamo.
   *
   * Antes de T15 vivía en `keyval[planpagos_${prestamoId}]` · datos del
   * usuario disfrazados de configuración (categoría C del audit T15.1).
   * `migrateKeyvalPlanpagosToPrestamos` mueve cada entrada del store
   * `keyval` a este campo y borra la entrada origen.
   *
   * `undefined` mientras no se haya generado o migrado el plan · objeto
   * `PlanPagos` cuando esté disponible.
   */
  planPagos?: PlanPagos;

  activo: boolean;

  // Audit
  createdAt: string;
  updatedAt: string;
}

export interface AfectacionInmueblePrestamo {
  inmuebleId: string;
  porcentaje: number; // 0..100
  tipoRelacion?: 'GARANTIA' | 'DESTINO_CAPITAL' | 'MIXTA';
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
  metadata?: {
    source?: 'generated' | 'property_sale' | 'loan_settlement';
    operationType?: 'TOTAL' | 'PARTIAL';
    operationDate?: string;
    partialMode?: 'REDUCIR_PLAZO' | 'REDUCIR_CUOTA';
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

// ─── NUEVO v2: Destino y Garantía ───

export interface DestinoCapital {
  id: string;
  tipo: 'ADQUISICION' | 'REFORMA' | 'CANCELACION_DEUDA' | 'INVERSION' | 'PERSONAL' | 'OTRA';
  inmuebleId?: string;
  inversionId?: string;
  prestamoIdCancelado?: string;
  importe: number;
  porcentaje?: number;           // opcional: puede venir almacenado (legacy) o derivarse como importe / principalInicial * 100
  descripcion?: string;
}

export interface Garantia {
  tipo: 'HIPOTECARIA' | 'PERSONAL' | 'PIGNORATICIA';
  inmuebleId?: string;
  inversionId?: string;
  descripcion?: string;
}
