// Frente C · troceo de db.ts · tipos de dominio (types-contratos).
// Extraídos literalmente. Referencias cruzadas a otros dominios se
// importan del barril ./types (import de tipos · ciclo permitido en TS).

export interface EjercicioFiscalContrato {
  estado: 'declarado' | 'pendiente' | 'en_curso';
  importeDeclarado?: number;
  dias?: number;
  fuente?: 'xml_aeat' | 'atlas' | 'manual';
  fechaImportacion?: string;
  nifsDetectados?: string[];
}

/**
 * V60 (TAREA 7 sub-tarea 1): histórico de cambios de renta mensual de un
 * contrato. Sustituye al store separado `rentaMensual` (eliminado en
 * sub-tarea 3) absorbiendo sus datos en `contracts.historicoRentas[]`.
 *
 * Cada entrada representa el importe `rentaMensual` vigente desde
 * `fechaDesde` hasta el siguiente cambio (o fin de contrato). El cambio
 * suele provenir de una indexación (`origen='indexacion'`), de una
 * renegociación con el inquilino (`'renegociacion'`), de la firma inicial
 * (`'firma_inicial'`) o de un ajuste manual (`'manual'`).
 *
 * Las entradas se mantienen ordenadas por `fechaDesde` ascendente.
 * `Contract.rentaMensual` siempre refleja el importe vigente (= último
 * `importe` del histórico, si existe).
 */
export interface HistoricoRenta {
  /** Fecha desde la que aplica este importe (ISO YYYY-MM-DD). */
  fechaDesde: string;
  /** Importe mensual en € desde `fechaDesde`. */
  importe: number;
  /** Por qué cambió la renta. */
  origen: 'firma_inicial' | 'indexacion' | 'renegociacion' | 'manual';
  /** Comentario opcional (e.g. "IPC 3,5%"). */
  nota?: string;
  /**
   * Si `origen='indexacion'`, copia la fecha registrada en
   * `historicoIndexaciones` para trazabilidad.
   */
  indexacionFecha?: string;
}

/**
 * T6 · histórico · motivo por el que finalizó un contrato.
 */
export type MotivoFin =
  | 'fin_natural'
  | 'cambio_ciudad'
  | 'no_renovacion_precio'
  | 'incidencia_convivencia'
  | 'rescision_impago'
  | 'otros';

/**
 * T6 · histórico · respuesta del propietario a "¿volverías a alquilarle?".
 */
export type VolveriaAAlquilar = 'si' | 'con_reservas' | 'no';

/**
 * V78 · refactor modelo alquileres v3 · Camino 2 del wizard de import XML AEAT.
 *
 * Un `BoteAnualSinIdentificar` representa el importe de alquiler DECLARADO en la AEAT
 * para un (inmueble · año) que NO pudo enrutarse a un Contract identificado (Camino 1):
 * arrendamientos sin NIF, por habitaciones, mixtos, o no-vivienda. Es historia fiscal,
 * NO genera cobros previstos en Tesorería. El usuario lo concilia después vinculando
 * Contracts reales (manual o Rentila) que descuentan del `saldoPendiente`.
 *
 * Invariante: máximo 1 bote por (inmuebleId · año) — garantizado por índice único.
 */
export interface BoteAnualSinIdentificar {
  id?: number;
  inmuebleId: number;
  año: number;                                   // ejercicio fiscal
  importeDeclarado: number;                      // del XML AEAT · acumulado si varios bloques
  díasDeclarados: number;                        // suma · cap 366
  nifsDetectados: string[];                      // todos los NIFs hallados en bloques que van al bote
  tiposArrendamientoOriginales: ('vivienda' | 'no_vivienda' | string)[]; // para auditoría
  importeAsignado: number;                       // suma de lo vinculado · default 0
  saldoPendiente: number;                        // = importeDeclarado - importeAsignado
  estado: 'pendiente_total' | 'parcial' | 'cerrado' | 'sobre_asignado';
  contractsVinculados: BoteContractLink[];       // default []
  fuente: 'xml_aeat';
  fechaImportación: string;                      // ISO
  fechaUltimaModificación: string;               // ISO
}

/** V78 · vinculación de un Contract a un bote (puede ser parcial). */
export interface BoteContractLink {
  contractId: number;
  importeAsignado: number;                       // cuánto del Contract se imputa al bote
  fechaVinculación: string;                      // ISO
  origen: 'sugerencia_atlas' | 'manual_usuario';
}

// Enhanced Contract interface according to CONTRATOS (HORIZON + PULSE) specification
export interface Contract {
  id?: number;
  
  // NEW FIELDS: Property and unit information
  inmuebleId: number; // Changed from propertyId for Spanish terminology
  unidadTipo: 'vivienda' | 'habitacion'; // Unit type: complete dwelling or room
  habitacionId?: string; // Specific room ID if type is 'habitacion'
  
  // NEW FIELDS: Contract modality
  modalidad: 'habitual' | 'temporada' | 'vacacional'; // Dwelling type: habitual, seasonal or vacation rentals
  
  // NEW FIELDS: Tenant information (complete as required)
  inquilino: {
    nombre: string;
    apellidos: string;
    dni: string;
    telefono: string;
    email: string;
    /**
     * V78 · refactor modelo alquileres v3 · NIFs adicionales (cotitulares) cuando un
     * piso completo se declara con N NIFs en el mismo `<Arrendamiento>` (p.ej. pareja).
     * `dni` guarda el NIF principal (TANIFARREND1); `cotitulares` el resto (TANIFARREND2…).
     * Se crea 1 solo Contract (NO N contratos) y la renta NO se divide entre NIFs.
     * Default `[]`. La migración V77→V78 lo inicializa a `[]` en Contracts existentes.
     */
    cotitulares?: string[];
  };
  
  // NEW FIELDS: Contract dates (mandatory for all contracts)
  fechaInicio: string;
  fechaFin: string; // Always required, auto-calculated for habitual (+5 years, editable)
  
  // NEW FIELDS: Financial terms
  rentaMensual: number; // Monthly rent (current/active amount)
  diaPago: number; // Payment day (1-31)
  margenGraciaDias: number; // Grace period in days (default 5)
  
  // NEW FIELDS: Indexation system
  indexacion: 'none' | 'ipc' | 'irav' | 'otros'; // Indexation type
  indexOtros?: {
    formula: string; // Formula or percentage for 'otros'
    frecuencia: string; // Frequency (e.g., 'anual')
    nota?: string; // Reference note
  };
  
  // NEW FIELDS: Historical indexations tracking
  historicoIndexaciones: Array<{
    fecha: string; // Date when indexation was applied
    indice: string; // Index used (IPC, IRAV, otros)
    porcentajeAplicado: number; // Percentage applied
    rentaResultante: number; // Resulting rent amount
  }>;

  /**
   * V60 (TAREA 7 sub-tarea 1): histórico completo de cambios de renta
   * mensual. Absorbe los datos del store eliminado `rentaMensual`
   * (sub-tarea 3 elimina el store; sus consumidores se adaptan a leer
   * de aquí). Ordenado por `fechaDesde` ascendente. Default `[]` para
   * contratos pre-V60 — el campo es opcional para tolerar lecturas
   * legacy.
   */
  historicoRentas?: HistoricoRenta[];
  
  // NEW FIELDS: Deposit information
  fianzaMeses: number; // Number of months (0..∞, default 1)
  fianzaImporte: number; // Amount calculated (months × current rent, editable)
  fianzaEstado: 'retenida' | 'devuelta_parcial' | 'devuelta_total'; // Deposit status
  fechasFianza?: {
    cobro?: string; // Date when deposit was collected
    devolucion?: string; // Date when deposit was returned
  };
  
  // NEW FIELDS: Bank account for payment collection (mandatory)
  cuentaCobroId: number; // ID of bank account for collections
  
  // NEW FIELDS: Contract status
  // `sin_firmar` (V79 · importador Rentila/plantilla ATLAS): contrato recién
  // importado, editable en su totalidad hasta que el usuario lo marque activo.
  estadoContrato: 'activo' | 'rescindido' | 'finalizado' | 'sin_identificar' | 'sin_firmar';

  /** V79 · procedencia del Contract cuando se creó desde el importador de contratos. */
  origenImportacion?: 'rentila' | 'plantilla_atlas';

  /**
   * REORG Contratos · estado DOCUMENTAL · independiente del estado efectivo
   * (vigente/próximo/finalizado, que se calcula por fechas en runtime).
   *
   * `true`  · ATLAS tiene soporte documental firmado del contrato.
   * `false` · falta el PDF firmado (típico de importados Rentila/AEAT o
   *           contratos marcados `sin_firmar`). Visualmente · avatar apagado.
   *
   * Opcional para tolerar lecturas legacy; la migración suave
   * (`backfillDocumentoFirmado`, sin DB bump) lo deja definido en todos los
   * Contracts existentes. Default `true` en contratos creados manualmente.
   */
  documentoFirmado?: boolean;

  // NEW FIELDS: Document preparation for PDF generation
  documentoContrato?: {
    plantilla: 'habitual' | 'temporada' | 'vacacional' | 'habitacion';
    incluirInventario?: boolean;
    incluirCertificadoEnergetico?: boolean;
    clausulasAdicionales?: string;
  };

  // NEW FIELDS: Signature workflow metadata
  firma?: {
    metodo: 'digital' | 'manual';
    proveedor?: 'signaturit' | 'docusign' | 'adobesign' | 'otro';
    emails?: string[];
    enviarCopiaPropietario?: boolean;
    emailPropietario?: string;
    estado?: 'borrador' | 'preparado' | 'enviado' | 'firmado' | 'rechazado';
    fechaEnvio?: string;
    fechaFirma?: string;
  };
  
  // Fiscal reduction per contract (Ley 12/2023 de Vivienda)
  reduccion?: {
    activa: boolean;
    porcentaje: number; // 0, 50, 60, 70, 90
    motivo?: 'transitorio_pre_2023' | 'general_post_2023' | 'rehabilitacion' | 'zona_tensionada_joven' | 'zona_tensionada_rebaja';
  };

  // Historial fiscal por ejercicio — declarado/pendiente/en_curso
  ejerciciosFiscales?: Record<number, EjercicioFiscalContrato>;

  // Additional fields for reduction calculation (Ley 12/2023)
  fechaFirmaContrato?: string; // Actual contract signing date (ISO date), distinct from firma.fechaFirma (digital signature)
  zonaTensionada?: boolean;
  rebajaRenta5pct?: boolean; // Rent reduced ≥5% vs previous contract
  inquilinoJoven?: boolean; // Tenant aged 18-35
  rehabilitacion?: boolean; // Rehabilitation works in last 2 years

  // NEW FIELDS: Rescission information
  rescision?: {
    fecha: string; // Rescission date
    motivo: string; // Rescission reason
  };

  // ===== T6 (histórico) · V76 · campos opcionales · undefined en contratos pre-V76 =====
  /** Motivo de salida clasificado · pill en tabla + caja en drawer ex-contrato. */
  motivoFin?: MotivoFin;
  /** Texto libre explicativo del motivo de salida. */
  detalleMotivoFin?: string;
  /** Valoración del inquilino · 1-5 estrellas. */
  valoracion?: 1 | 2 | 3 | 4 | 5;
  /** Respuesta del propietario a "¿volverías a alquilarle?". */
  volveriaAAlquilar?: VolveriaAAlquilar;
  /** Importe de fianza devuelta en € · 0 si retenida total · undefined si pendiente. */
  fianzaDevuelta?: number;
  /** Notas libres del casero sobre el inquilino. */
  notasCasero?: string;
  /** Fecha real de salida (ISO). Si undefined, se usa `fechaFin` como sustituto. */
  fechaCierre?: string;

  // LEGACY FIELDS for backward compatibility
  propertyId?: number; // Maps to inmuebleId
  scope?: 'full-property' | 'units';
  selectedUnits?: string[]; // For multi-unit properties (e.g., ['H1', 'H2'])
  type?: 'vivienda' | 'habitacion';
  
  // Legacy tenant information
  tenant?: {
    name?: string;
    nif?: string;
    email?: string;
  };
  
  // Legacy contract dates
  startDate?: string;
  endDate?: string; // Optional for indefinite contracts
  isIndefinite?: boolean;
  noticePeriodDays?: number;
  
  // Legacy financial terms
  monthlyRent?: number;
  paymentDay?: number; // 1-31
  periodicity?: 'monthly'; // Only monthly for now
  
  // Legacy rent updates
  rentUpdate?: {
    type: 'none' | 'fixed-percentage' | 'ipc';
    fixedPercentage?: number; // For fixed percentage updates
    ipcPercentage?: number; // Manual IPC percentage
  };
  
  // Legacy deposit and guarantees
  deposit?: {
    months: number;
    amount: number; // Calculated but editable
  };
  additionalGuarantees?: number;
  
  // Legacy services (informational checkboxes)
  includedServices?: {
    electricity?: boolean;
    water?: boolean;
    gas?: boolean;
    internet?: boolean;
    cleaning?: boolean;
    [key: string]: boolean | undefined;
  };
  
  // Legacy notes and status
  privateNotes?: string;
  status: 'active' | 'upcoming' | 'terminated'; // Maps to estadoContrato
  
  // Documents
  documents: number[];
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

// Monthly rent tracking for treasury integration
export interface RentaMensual {
  id?: number;
  contratoId: number;
  periodo: string; // YYYY-MM format
  importePrevisto: number; // Expected amount for the period
  importeCobradoAcum: number; // Accumulated collected amount
  estado: 'pendiente' | 'parcial' | 'cobrada' | 'impago' | 'revision'; // Payment status
  movimientosVinculados: number[]; // Linked treasury movement IDs
  createdAt: string;
  updatedAt: string;
}

// NOTE: RentCalendar and RentPayment interfaces removed in V4.5 — migrated to RentaMensual

// H5: AEAT Tax Classification Types
export type AEATFiscalType = 
  | 'financiacion'           // Financing (interests and associated costs)
  | 'reparacion-conservacion' // Repair & Conservation (R&C)
  | 'comunidad'              // Community fees
  | 'suministros'            // Utilities
  | 'seguros'                // Insurance
  | 'tributos-locales'       // Local taxes (IBI, waste, lighting; no fines)
  | 'servicios-personales'   // Personal services (cleaning, external maintenance, etc.)
  | 'amortizacion-muebles'   // Furniture amortization (10 years)
  | 'capex-mejora-ampliacion'; // Mejora/Ampliación (valor catastral)

export type AEATBox =
  | '0105' // Interests/financing
  | '0106' // R&C
  | '0109' // Community
  | '0112' // Personal services
  | '0113' // Utilities
  | '0114' // Insurance
  | '0115' // Local taxes
  | '0117' // Furniture amortization
  | '0129' // Mejoras realizadas en el ejercicio
  | '0130' // Base de amortización del inmueble
  | '0131'; // Amortización del inmueble

export type ProrationMethod = 'metros-cuadrados' | 'unidades' | 'porcentaje-manual' | 'ocupacion';

export type ExpenseStatus = 'validado' | 'pendiente' | 'por-revisar';

export type ExpenseOrigin = 'manual' | 'inbox';

// UNICORNIO REFACTOR: Unified expense types for single tab gastos
export type TipoGasto = 
  | 'suministro_electricidad'
  | 'suministro_agua' 
  | 'suministro_gas'
  | 'internet'
  | 'reparacion_conservacion'
  | 'mejora'
  | 'mobiliario'
  | 'comunidad'
  | 'seguro'
  | 'ibi'
  | 'intereses'
  | 'comisiones'
  | 'otros';

// UNICORNIO REFACTOR: Conciliation status
export type EstadoConciliacion = 'pendiente' | 'conciliado';

// UNICORNIO REFACTOR: Expense destination
export type DestinoGasto = 'personal' | 'inmueble';

// H5: ExpenseH5, Reform, ReformLineItem — DELETED in cleanup V4.3

// H5: AEAT Limit and Carryforward tracking
export interface AEATCarryForward {
  id?: number;
  propertyId: number;
  taxYear: number;
  totalIncome: number; // Ingresos íntegros del inmueble
  financingAndRepair: number; // Financiación + R&C
  limitApplied: number; // min(financingAndRepair, totalIncome)
  excessAmount: number; // financingAndRepair - limitApplied
  expirationYear: number; // taxYear + 4
  remainingAmount: number; // Current remaining amount that can be used
  // S-FISCAL-FIXES Fix 1 · proporción del exceso por concepto cuando aplica
  carryForwardType?: 'excess_0105' | 'excess_0106' | 'excess_mixed';
  createdAt: string;
  updatedAt: string;
}

// H5: Rental/Availability days tracking
export interface PropertyDays {
  id?: number;
  propertyId: number;
  taxYear: number;
  daysRented: number;
  daysAvailable: number;
  daysUnderRenovation?: number; // Días en obras: sin rendimiento ni imputación
  manualOverride?: boolean; // true when user adjusted values manually
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// H8: Treasury Account types
export type AccountDestination = 'horizon' | 'pulse';

// H-HOTFIX: Account usage scope for reconciliation preferences
export type AccountUsageScope = 'personal' | 'inmuebles' | 'mixto';

// Account status enum for enhanced filtering and hard-delete support
export type AccountStatus = 'ACTIVE' | 'INACTIVE' | 'DELETED';

export interface Account {
  id?: number; // Keep as number for legacy compatibility
  alias?: string;                         // ATLAS: nombre corto opcional que verá el usuario ("Cuenta principal")
  iban: string;                           // normalizado: sin espacios, mayúsculas (p.ej., ES9100491500051234567892)
  ibanMasked?: string;                    // display: "ES91 0049 **** **** **** 7892" (calculated)
  banco?: {
    code?: string;                        // código entidad (4 dígitos IBAN ES, posiciones 5–8)
    name?: string;                        // nombre de banco si lo inferimos por code
    brand?: { logoUrl?: string; color?: string; } // logo/color corporativo si disponible
  };
  logoUser?: string;                      // ATLAS: logo subido por usuario (prioridad 1)
  tipo?: 'CORRIENTE' | 'AHORRO' | 'OTRA' | 'TARJETA_CREDITO'; // default: CORRIENTE
  cardConfig?: {
    settlementDay: number; // Día del cargo del recibo (1-31)
    chargeAccountId: number; // Cuenta bancaria donde se domicilia el recibo
  };
  moneda?: 'EUR';                         // default: EUR (solo EUR por ahora)
  titular?: { nombre?: string; nif?: string; }; // opcional (no obligatorio en alta)
  
  // Enhanced status management for hard/soft delete
  status: AccountStatus;                  // ACTIVE | INACTIVE | DELETED - replaces activa field
  deactivatedAt?: string;                 // ISO timestamp when account was deactivated
  
  activa: boolean;                        // LEGACY: true por defecto - kept for backward compatibility
  isDefault?: boolean;                    // solo una por usuario
  createdAt: string;
  updatedAt: string;

  // Legacy fields for backward compatibility
  name?: string; // Maps to alias
  bank?: string; // Maps to banco.name
  destination?: AccountDestination;
  /**
   * Saldo cacheado de la cuenta · NO es fuente de verdad.
   *
   * V60 (TAREA 7 sub-tarea 1): documentado explícitamente como cache
   * derivada. La fuente real de saldo es `openingBalance` + suma de
   * `movements.amount` para esta `accountId`. Recalcular vía
   * `accountBalanceService.recalculateBalance(accountId)` cuando los
   * movimientos cambien. Mantenido para hot-paths de UI que necesitan
   * lectura O(1) del saldo sin recorrer movements.
   */
  balance?: number;
  openingBalance?: number;
  openingBalanceDate?: string;
  includeInConsolidated?: boolean;
  currency?: string; // Maps to moneda
  isActive?: boolean; // Maps to activa
  deleted_at?: string;
  minimumBalance?: number;
  isAtRisk?: boolean;
  usage_scope?: AccountUsageScope;
  logo_url?: string; // Maps to banco.brand.logoUrl

  esRemunerada?: boolean;
  remuneracion?: {
    tinAnual: number;
    frecuenciaPagos: 'mensual' | 'trimestral' | 'semestral' | 'anual';
    base: 'saldo' | 'fijo';
    importeFijo?: number;
    retencionFiscal: number;
    fechaInicio: string;
  };

  // S-WIZARD-CUENTA-V3 · campos opcionales sin tocar DB_VERSION (sigue v70).
  // Cuentas bancarias (Corriente / Ahorro)
  bic?: string;                          // BIC / SWIFT · 8 u 11 chars
  taeAnual?: number;                     // alias plano · espejo de remuneracion.tinAnual
  frecuenciaLiquidacion?: 'mensual' | 'trimestral' | 'semestral' | 'anual';
  cuentaDestinoIntereses?: number;       // FK a otra account
  // Tarjetas crédito
  ultimosCuatro?: string;                // últimos 4 dígitos visibles
  bancoEmisor?: string;                  // banco emisor (puede diferir del de la cuenta de cargo)
  limiteCredito?: number;                // límite de crédito €
  deudaActual?: number;                  // deuda actual €
  diaCierre?: number;                    // día del mes en que cierra el ciclo (1-31)
  diaPago?: number;                      // día del mes en que se carga (1-31) · espejo de cardConfig.settlementDay
}

// H8: Movement types - enhanced to match treasury_transactions requirements
