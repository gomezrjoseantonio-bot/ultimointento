import { openDB, IDBPDatabase } from 'idb';
import { UtilityType, ReformBreakdown } from '../types/inboxTypes';
import { PosicionInversion } from '../types/inversiones';
import type { 
  PersonalData, 
  PersonalModuleConfig, 
  Nomina, 
  Autonomo, 
  PlanPensionInversion, 
  OtrosIngresos,
  MovimientoPersonal,
  GastoRecurrente,
  GastoPuntual,
  PersonalExpense,
  PensionIngreso
} from '../types/personal';

const DB_NAME = 'AtlasHorizonDB';
const DB_VERSION = 32; // V3.2: objetivos_financieros singleton store for Mi Plan

export interface Property {
  id?: number;
  alias: string;
  globalAlias?: string; // Optional global alias for grouping/referencing
  address: string;
  postalCode: string;
  province: string;
  municipality: string;
  ccaa: string;
  purchaseDate: string;
  cadastralReference?: string;
  squareMeters: number;
  bedrooms: number;
  bathrooms?: number;
  transmissionRegime: 'usada' | 'obra-nueva';
  state: 'activo' | 'vendido' | 'baja';
  notes?: string;
  acquisitionCosts: {
    price: number;
    itp?: number;
    itpIsManual?: boolean;
    iva?: number;
    ivaIsManual?: boolean;
    notary?: number;
    registry?: number;
    management?: number;
    psi?: number;
    realEstate?: number;
    other?: Array<{ concept: string; amount: number; }>;
  };
  documents: number[];
  // H5: Datos fiscales auxiliares
  fiscalData?: {
    cadastralValue?: number;
    constructionCadastralValue?: number;
    constructionPercentage?: number;
    acquisitionDate?: string;
    contractUse?: 'vivienda-habitual' | 'turistico' | 'otros';
    housingReduction?: boolean;
    isAccessory?: boolean;
    mainPropertyId?: number;
    accessoryData?: {
      cadastralReference: string;
      acquisitionDate: string;
      cadastralValue: number;
      constructionCadastralValue: number;
    };
  };
  // H9-FISCAL: AEAT Amortization data
  aeatAmortization?: {
    // Acquisition type and dates
    acquisitionType: 'onerosa' | 'lucrativa' | 'mixta';
    firstAcquisitionDate: string; // fecha_adquisición (primera)
    transmissionDate?: string; // fecha_transmisión (if applicable)
    
    // Cadastral values proportional to ownership
    cadastralValue: number; // VC proporcional a la titularidad
    constructionCadastralValue: number; // VCc proporcional a la titularidad
    constructionPercentage: number; // % construcción sobre VC (VCc / VC)
    
    // Oneroso acquisition costs
    onerosoAcquisition?: {
      acquisitionAmount: number; // importe de adquisición
      acquisitionExpenses: number; // gastos y tributos (notaría, registro, ITP/IVA, gestoría...)
    };
    
    // Lucrativo acquisition costs  
    lucrativoAcquisition?: {
      isdValue: number; // valor ISD (sin exceder valor de mercado)
      isdTax: number; // impuesto ISD satisfecho
      inherentExpenses: number; // gastos inherentes
    };
    
    // Special cases configuration
    specialCase?: {
      type: 'usufructo-temporal' | 'usufructo-vitalicio' | 'diferenciado' | 'parcial-alquiler' | 
            'cambio-porcentaje' | 'sin-valor-catastral' | 'ultimo-ano' | 'porcentaje-menor';
      // Usufructo específico
      usufructoDuration?: number; // años para temporal
      maxDeductibleIncome?: number; // tope por rendimientos íntegros
      // Parcial alquiler
      rentedPercentage?: number; // porcentaje alquilado
      // Sin valor catastral
      estimatedLandPercentage?: number; // porcentaje estimado de suelo (default 10%)
      // Porcentaje manual
      customPercentage?: number; // porcentaje < 3%
      manualAmount?: number; // importe manual en casos especiales
    };
  };
}

export interface PropertySale {
  id?: number;
  propertyId: number;
  saleDate: string;
  salePrice: number;
  saleCosts: {
    agencyCommission: number;
    municipalTax: number;
    saleNotaryCosts: number;
    otherCosts: number;
  };
  loanSettlement: {
    payoffAmount: number;
    cancellationFee: number;
    total: number;
  };
  grossProceeds: number;
  netProceeds: number;
  status: 'draft' | 'confirmed' | 'reverted';
  source: 'cartera' | 'detalle' | 'analisis';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoanSettlement {
  id?: number;
  loanId: string;
  operationType: 'TOTAL' | 'PARTIAL';
  partialMode?: 'REDUCIR_PLAZO' | 'REDUCIR_CUOTA';
  operationDate: string;
  settlementAccountId: number;
  principalBefore: number;
  principalApplied: number;
  accruedInterest: number;
  feeAmount: number;
  fixedCosts: number;
  totalCashOut: number;
  principalAfter: number;
  monthlyPaymentBefore?: number;
  monthlyPaymentAfter?: number;
  termMonthsBefore?: number;
  termMonthsAfter?: number;
  interestSavings?: number;
  status: 'confirmed' | 'reverted';
  source: 'financiacion' | 'inmueble_venta';
  notes?: string;
  movementId?: number;
  treasuryEventId?: number;
  createdAt: string;
  updatedAt: string;
}

// H9-FISCAL: Property improvements for AEAT amortization
export interface PropertyImprovement {
  id?: number;
  propertyId: number;
  year: number; // año de la mejora
  amount: number; // importe de la mejora
  date?: string; // fecha opcional
  daysInYear?: number; // días de amortización del año (si la mejora es del propio año)
  counterpartyNIF?: string; // NIF contraparte (opcional)
  description: string; // descripción de la mejora
  // Metadata
  originExerciseYear?: number; // año fiscal origen para trazabilidad histórica
  sourceResultadoEjercicioId?: number; // FK resultadosEjercicio.id cuando aplica
  createdAt: string;
  updatedAt: string;
}

// H-OCR: OCR field definition
export interface OCRField {
  name: string;
  value: string;
  confidence: number; // 0-1
  raw?: string; // Original raw value before normalization
  page?: number; // H-OCR-ALIGN: Page number (1-based) for multi-page support
}

// H-OCR: OCR result structure
export interface OCRResult {
  engine: string; // e.g., "gdocai:invoice"
  timestamp: string;
  confidenceGlobal: number; // Overall confidence 0-1
  fields: OCRField[];
  data?: {
    proveedor?: string;
    numero_factura?: string;
    fecha?: string;
    base_imponible?: string | number;
    iva?: string | number;
    importe_total?: string | number;
    moneda?: string;
    confianza?: number;
    notas?: string;
    direccion?: string;
    tipo_gasto?: string;
  }; // Raw extracted payload using snake_case keys from OCR backend
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
  validationWarnings?: string[]; // Validation warnings for Base + VAT ≈ Total checks
  engineInfo?: {
    type: 'document-ai-invoice' | 'vision-fallback';
    displayName: string;
    description: string;
  }; // H-OCR-FIX: Engine transparency information
  pageInfo?: {
    totalPages: number;
    selectedPage: number;
    pageScore: number;
    allPageScores: number[];
  }; // H-OCR-FIX: Multi-page processing information
}

// H-OCR: OCR history entry
export interface OCRHistoryEntry {
  timestamp: string;
  engine: string;
  confidenceGlobal: number;
  fieldsCount: number;
  status: 'completed' | 'error';
}

export interface Document {
  id?: number;
  filename: string;
  type: string;
  size: number;
  lastModified: number;
  content: Blob;
  metadata: {
    title?: string;
    description?: string;
    tags?: string[];
    entityType?: 'property' | 'contract' | 'expense' | 'personal';
    entityId?: number;
    // H-OCR: OCR metadata
    ocr?: OCRResult;
    ocrHistory?: OCRHistoryEntry[];
    // H8: Extended metadata for inbox documents
    contraparte?: string;
    counterpartyName?: string; // New counterparty field for enhanced classification
    proveedor?: string; // Backward compatibility
    tipo?: 'Factura' | 'Contrato' | 'CAPEX' | 'Extracto bancario' | 'Otros';
    categoria?: string;
    destino?: 'Personal' | 'Inmueble';
    status?: 'Nuevo' | 'Procesado' | 'Asignado' | 'Archivado';
    notas?: string;
    carpeta?: 'todos' | 'facturas' | 'contratos' | 'extractos' | 'capex' | 'otros';
    // H9: Enhanced fiscal classification
    aeatClassification?: {
      fiscalType?: AEATFiscalType;
      box?: AEATBox;
      suggested?: boolean;
      exerciseYear?: number;
      status?: 'Vivo' | 'Prescrito'; // Based on fiscal year
    };
    // H9: Enhanced financial data
    financialData?: {
      amount?: number;
      base?: number;
      iva?: number;
      invoiceNumber?: string;
      issueDate?: string;
      dueDate?: string;
      servicePeriod?: {
        from?: string;
        to?: string;
      };
      serviceAddress?: string;
      cups?: string;
      paymentMethod?: 'Domiciliado' | 'Transferencia' | 'TPV' | 'Efectivo';
      iban?: string;
      predictedPaymentDate?: string;
      isCapex?: boolean;
    };
    // H8: Bank extract specific metadata
    extractMetadata?: {
      bank: string;
      totalRows: number;
      importedRows: number;
      accountId?: number;
      importBatchId?: string;
      dateRange?: {
        from: string;
        to: string;
      };
    };
  };
  uploadDate: string;
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
  estadoContrato: 'activo' | 'rescindido' | 'finalizado';

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
  
  // NEW FIELDS: Rescission information
  rescision?: {
    fecha: string; // Rescission date
    motivo: string; // Rescission reason
  };
  
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

// H7: Rent calendar entry
export interface RentCalendar {
  id?: number;
  contractId: number;
  period: string; // YYYY-MM format
  expectedAmount: number;
  isProrated: boolean;
  proratedDays?: number;
  totalDaysInMonth?: number;
  notes?: string;
  createdAt: string;
}

// H7: Rent payment tracking
export interface RentPayment {
  id?: number;
  contractId: number;
  period: string; // YYYY-MM format
  expectedAmount: number;
  status: 'pending' | 'paid' | 'partial';
  
  // Payment details
  paidAmount?: number;
  paymentDate?: string;
  paymentNotes?: string;
  
  // Documents
  receiptDocuments: number[];
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

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
  | 'capex-mejora-ampliacion'; // CAPEX (Improvement/Expansion)

export type AEATBox = 
  | '0105' // Interests/financing
  | '0106' // R&C
  | '0109' // Community
  | '0112' // Personal services
  | '0113' // Utilities
  | '0114' // Insurance
  | '0115' // Local taxes
  | '0117'; // Furniture amortization

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

// H5: Enhanced Expense interface
export interface ExpenseH5 {
  id?: number;
  date: string;
  counterparty: string;
  counterpartyNIF?: string;
  concept: string;
  amount: number;
  currency: string;
  fiscalType: AEATFiscalType;
  aeatBox?: AEATBox;
  taxYear: number; // Ejercicio de devengo
  taxIncluded: boolean;
  propertyId?: number; // Optional for personal expenses
  unit: 'completo' | string; // 'completo' or 'habitacion-X'
  prorationMethod: ProrationMethod;
  prorationDetail: string; // % or other details based on method
  status: ExpenseStatus;
  origin: ExpenseOrigin;
  documentId?: number;
  
  // UNICORNIO REFACTOR: Unified expense fields
  tipo_gasto: TipoGasto; // Inferred type for classification and filtering
  destino: DestinoGasto; // 'personal' or 'inmueble'
  destino_id?: number; // propertyId when destino='inmueble'
  estado_conciliacion: EstadoConciliacion;
  
  // H-HOTFIX: Utility-specific fields
  utility_type?: UtilityType;
  supply_address?: string;
  expected_charge_date?: string;
  iban_masked?: string;
  
  // H-HOTFIX: Reform breakdown for multi-category assignments
  reform_breakdown?: ReformBreakdown;
  
  // UNICORNIO REFACTOR: Amortizable breakdown (for mejora/mobiliario)
  desglose_amortizable?: {
    mejora_importe: number;
    mobiliario_importe: number;
    ficha_activo_id?: number; // Link to asset record for amortization
  };
  
  // H-HOTFIX: Document fingerprinting for idempotence
  doc_fingerprint?: string;
  revision?: number; // Incremented on each OCR reprocess
  last_ocr_at?: string;
  processor_version?: string;
  createdAt: string;
  updatedAt: string;
}

// H5: CAPEX Treatment Types
export type CAPEXTreatment = 'capex-mejora' | 'mobiliario-10-años' | 'reparacion-conservacion';

export type ReformStatus = 'abierta' | 'cerrada';

// H5: Reform (CAPEX project)
export interface Reform {
  id?: number;
  title: string;
  propertyId: number;
  startDate: string;
  endDate?: string;
  notes?: string;
  status: ReformStatus;
  createdAt: string;
  updatedAt: string;
}

// H5: Reform Line Item
export interface ReformLineItem {
  id?: number;
  reformId: number;
  source: 'documento' | 'manual';
  documentId?: number;
  counterparty: string;
  counterpartyNIF?: string;
  concept: string;
  amount: number;
  taxIncluded: boolean;
  treatment: CAPEXTreatment;
  aeatBoxSuggested?: AEATBox;
  executionDate: string;
  prorationMethod: ProrationMethod;
  prorationDetail: string;
  // H-OCR-REFORM: Enhanced breakdown fields
  baseAmount?: number; // Base amount before tax
  ivaRate?: number; // VAT rate (21, 10, 4, 0)
  ivaAmount?: number; // VAT amount
  categorizationConfidence?: number; // OCR categorization confidence (0-1)
  fechaFinObra?: string; // For 'mejora' items - completion date
  fechaAltaMobiliario?: string; // For 'mobiliario' items - installation date
  createdAt: string;
  updatedAt: string;
}

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
}

// H8: Movement types - enhanced to match treasury_transactions requirements
export type MovementStatus = 'pendiente' | 'parcial' | 'conciliado' | 'no-documentado';
export type TransactionState = 'pending' | 'reconciled' | 'ignored'; // New field for treasury_transactions

// H10: Treasury reconciliation status
export type ReconciliationStatus = 'sin_conciliar' | 'conciliado';

// V1.0: Enhanced movement types and statuses per requirements
export type MovementType = 'Ingreso' | 'Gasto' | 'Transferencia' | 'Ajuste';
export type MovementOrigin = 'OCR' | 'CSV' | 'Manual';
export type MovementState = 'Previsto' | 'Confirmado' | 'Conciliado' | 'Revisar';

// ATLAS HORIZON: Unified movement status per problem statement
export type UnifiedMovementStatus = 
  | 'previsto'      // forecast income/expense from budget
  | 'confirmado'    // confirmed transaction matching budget
  | 'vencido'       // overdue forecast without real transaction
  | 'no_planificado' // real transaction without budget match
  | 'conciliado';   // confirmed and reconciled with budget

// ATLAS HORIZON: Movement source types
export type MovementSource = 'import' | 'manual' | 'inbox';

export interface Movement {
  id?: number;
  accountId: number;
  date: string; // booking_date in treasury_transactions
  valueDate?: string; // value_date in treasury_transactions
  amount: number;
  description: string;
  counterparty?: string;
  reference?: string;
  status: MovementStatus;
  
  // ATLAS HORIZON: Enhanced fields per problem statement
  // Core identification fields
  bank_ref?: string;        // bank reference ID if exists
  iban_detected?: string;   // IBAN detected from file
  
  // Status and reconciliation (per problem statement)
  unifiedStatus: UnifiedMovementStatus; // previsto|confirmado|vencido|no_planificado|conciliado
  source: MovementSource;   // import|manual|inbox
  plan_match_id?: string;   // ID of budget item this matches
  property_id?: string;     // property ID if applicable
  category: {               // hierarchical category
    tipo: string;           // e.g., "Suministros"
    subtipo?: string;       // e.g., "Luz"
  };
  
  // Transfer detection
  is_transfer?: boolean;
  transfer_group_id?: string; // groups the two transfer legs
  
  // Invoice/OCR linking
  invoice_id?: string;      // link to OCR invoice if matched
  
  // Legacy compatibility fields
  state?: TransactionState; // 'pending'|'reconciled'|'ignored'
  sourceBank?: string; // source_bank field
  currency?: string; // currency field  
  balance?: number; // balance field (different from saldo)
  
  // H10: Enhanced reconciliation fields
  saldo?: number;
  id_import?: string;
  estado_conciliacion?: ReconciliationStatus; // Default to 'sin_conciliar'
  linked_registro?: {
    type: 'ingreso' | 'gasto' | 'capex';
    id: number;
  }; // Link to Ingreso/Gasto/CAPEX record
  // Legacy reconciliation links
  expenseIds?: number[]; // For movements linked to expenses
  documentIds?: number[]; // H9: Link to invoices/documents
  reconciliationNotes?: string;
  // Import metadata (FIX-EXTRACTOS compliant - no file content)
  importBatch?: string; // ID of the import batch
  csvRowIndex?: number; // Original row index in CSV (metadata only)
  
  // V1.0: New fields per requirements
  type: MovementType; // Ingreso/Gasto/Transferencia/Ajuste
  origin: MovementOrigin; // OCR/CSV/Manual
  movementState: MovementState; // Previsto/Confirmado/Conciliado/Revisar
  tags?: string[]; // Auto-assigned tags from rules
  transferGroupId?: string; // For linked transfer movements
  attachedDocumentId?: number; // Single primary document
  appliedRuleId?: number; // Rule that auto-categorized this movement
  isAutoTagged?: boolean; // Whether category came from rules
  
  // Audit fields for quick actions (section 14)
  lastModifiedBy?: string; // User who made the change
  changeReason?: 'user_ok' | 'inline_edit_amount' | 'inline_edit_date' | 'bulk_ok' | 'manual_edit';
  
  // V1.1: Treasury extension fields for auto-reclassification and learning
  categoria?: string; // Category assigned automatically or manually
  ambito: 'PERSONAL' | 'INMUEBLE'; // Scope for reconciliation (default PERSONAL)
  inmuebleId?: string; // Required if ambito='INMUEBLE'
  statusConciliacion: 'sin_match' | 'match_automatico' | 'match_manual'; // Reconciliation status
  learnKey?: string; // Hash for learning rules (normalized counterparty + description pattern + amount sign)
  isOpeningBalance?: boolean; // Marks the system-generated opening balance movement

  createdAt: string;
  updatedAt: string;
}

// ATLAS HORIZON: Import logging interface per problem statement (section 11)
export interface ImportLog {
  id?: number;
  fileName: string;
  fileSize: number;
  importedAt: string;
  account_id?: number;
  detected_iban?: string;
  
  // Results summary
  totalRows: number;
  created: number;
  conciliated: number;
  unplanned: number;
  skipped: number;
  transfers: number;
  errors: number;
  
  // Error details
  errorDetails?: Array<{
    line: number;
    error: string;
    data?: any;
  }>;
  
  // Source information
  source: 'treasury_import' | 'inbox_auto';
  batchId: string;
  userId?: string;
}

// ATLAS HORIZON: Matching configuration per problem statement (section 6)
export interface MatchingConfiguration {
  id?: number;
  dateWindow: number;        // ±N days (default 5)
  amountTolerancePercent: number; // ±N% (default 15)
  amountToleranceFixed: number;   // ±N€ (default 0)
  
  // Matching criteria weights
  useIbanMatching: boolean;
  useProviderMatching: boolean;
  useDescriptionMatching: boolean;
  useCategoryMatching: boolean;
  
  // Transfer detection
  transferDateWindow: number; // ±N days (default 2)
  transferKeywords: string[]; // keywords for transfer detection
  
  createdAt: string;
  updatedAt: string;
}

// V1.0: Auto-tagging rules
export interface MovementRule {
  id?: number;
  name: string;
  isActive: boolean;
  condition: {
    field: 'description' | 'counterparty' | 'amount';
    operator: 'contains' | 'equals' | 'greater_than' | 'less_than';
    value: string | number;
    caseSensitive?: boolean;
  };
  actions: {
    setCategory?: string;
    setProvider?: string;
    addTag?: string;
  };
  createdAt: string;
  updatedAt: string;
}

// V1.0: Transfer suggestions
export interface TransferSuggestion {
  id?: number;
  fromAccountId: number;
  toAccountId: number;
  suggestedAmount: number;
  reason: string;
  triggerDate: string;
  isActive: boolean;
  createdAt: string;
}
export interface TreasuryEvent {
  id?: number;
  type: 'income' | 'expense' | 'financing';
  amount: number;
  predictedDate: string;
  description: string;
  // Source tracking
  sourceType: 'document' | 'contract' | 'manual' | 'ingreso' | 'gasto' | 'opex_rule' | 'gasto_recurrente' | 'personal_expense' | 'nomina' | 'contrato' | 'prestamo' | 'hipoteca' | 'autonomo' | 'autonomo_ingreso' | 'otros_ingresos' | 'inversion_compra' | 'inversion_aportacion' | 'inversion_rendimiento' | 'inversion_dividendo' | 'inversion_liquidacion' | 'irpf_prevision';
  sourceId?: number; // Document ID or Contract ID
  // Account information
  accountId?: number;
  paymentMethod?: 'Domiciliado' | 'Transferencia' | 'TPV' | 'Efectivo';
  iban?: string;
  // Status
  status: 'predicted' | 'confirmed' | 'executed';
  actualDate?: string;
  actualAmount?: number;
  movementId?: number; // Link to actual bank movement
  // Loan installment reference (for hipoteca / prestamo events)
  prestamoId?: string;
  numeroCuota?: number;
  // Metadata
  createdAt: string;
  updatedAt: string;
}

// V1.1: Reconciliation audit log for security and auditing
export interface ReconciliationAuditLog {
  id?: number;
  action: 'manual_reconcile' | 'auto_reclassify' | 'budget_trigger' | 'learn_rule_created' | 'learn_rule_applied';
  movimientoId: number;
  categoria?: string;
  ambito?: 'PERSONAL' | 'INMUEBLE';
  inmuebleId?: string;
  learnKey?: string;
  timestamp: string;
  userId?: string; // Optional user identifier
}

// V1.1: Learning rules for automatic movement classification
export interface MovementLearningRule {
  id?: number;
  learnKey: string; // Unique key for this rule pattern
  counterpartyPattern: string; // Normalized counterparty
  descriptionPattern: string; // Description pattern 
  amountSign: 'positive' | 'negative'; // Income or expense
  categoria: string;
  ambito: 'PERSONAL' | 'INMUEBLE';
  inmuebleId?: string;
  source: 'IMPLICIT'; // Reserved for future 'EXPLICIT'
  createdAt: string;
  updatedAt: string;
  appliedCount: number; // How many times this rule has been applied
  lastAppliedAt?: string;
}

// V1.1: Learning log for audit trail (without PII)
export interface LearningLog {
  id?: number;
  action: 'CREATE_RULE' | 'APPLY_RULE' | 'BACKFILL';
  movimientoId?: number;
  ruleId?: number;
  learnKey: string;
  categoria: string;
  ambito: 'PERSONAL' | 'INMUEBLE';
  inmuebleId?: string;
  ts: string; // ISO timestamp
}

// H9: Treasury Recommendations
export interface TreasuryRecommendation {
  id?: string;
  type: 'transfer' | 'alert';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  // Transfer specific
  fromAccountId?: number;
  toAccountId?: number;
  suggestedAmount?: number;
  suggestedDate?: string;
  // Status
  status: 'active' | 'dismissed' | 'executed';
  createdAt: string;
  dismissedAt?: string;
}

// ─── V2.7: Ejercicios Fiscales ─────────────────────────────────────────────────

export type EstadoEjercicio = 'vivo' | 'cerrado' | 'declarado';
export type OrigenEjercicio = 'calculado' | 'importado' | 'mixto';

export interface EjercicioFiscal {
  id?: number;
  año: number;                    // e.g. 2024, 2025
  estado: EstadoEjercicio;        // vivo → cerrado → declarado
  origen: OrigenEjercicio;        // de dónde vienen los datos
  fechaCierre?: string;           // ISO date when closed
  fechaRevisionFinal?: string;    // ISO date when final review was completed
  fechaDeclaracion?: string;      // ISO date when declared
  snapshotId?: number;            // FK → snapshotsDeclaracion.id
  resultadoEjercicioId?: number;  // FK → resultadosEjercicio.id (snapshot canónico)
  // Resumen de alto nivel (se rellena al cerrar)
  resumen?: {
    baseImponibleGeneral: number;
    baseImponibleAhorro: number;
    cuotaIntegra: number;
    deducciones: number;
    retencionesYPagos: number;
    resultado: number;            // >0 a pagar, <0 a devolver
  };
  notas?: string;
  createdAt: string;
  updatedAt: string;
}


// ─── V2.9: Resultado de Ejercicio (snapshot fiscal canónico) ─────────────────

export interface ResultadoEjercicio {
  id?: number;
  ejercicio: number;
  origen: 'cierre' | 'importacion_manual' | 'mixto';
  estadoEjercicio: EstadoEjercicio;
  fechaGeneracion: string;
  fechaCierre?: string;
  fechaPresentacion?: string;
  moneda: 'EUR';
  resumen: {
    ingresosIntegros: number;
    gastosDeducibles: number;
    amortizacion: number;
    reducciones: number;
    baseImponibleGeneral: number;
    baseImponibleAhorro: number;
    cuotaIntegra: number;
    cuotaLiquida: number;
    deducciones: number;
    retencionesYPagosCuenta: number;
    resultado: number;
    tipoEfectivo: number;
  };
  arrastres: {
    generados: Array<{
      arrastreId?: number;
      tipo: TipoArrastre;
      importe: number;
      ejercicioCaducidad?: number;
    }>;
    aplicados: Array<{
      arrastreId?: number;
      tipo: TipoArrastre;
      importe: number;
      ejercicioOrigen?: number;
    }>;
  };
  casillasAEAT?: Record<string, number>;
  metadatos: {
    validadoContraDatosReales: boolean;
    notasRevision?: string;
    origenDatos: OrigenEjercicio;
    generadoPor: 'sistema' | 'usuario';
  };
  createdAt: string;
  updatedAt: string;
}

// ─── V2.7: Arrastres IRPF (cross-ejercicio) ───────────────────────────────────

export type TipoArrastre =
  | 'perdidas_patrimoniales_general'    // Art. 48 LIRPF - 4 años
  | 'perdidas_patrimoniales_ahorro'     // Art. 49 LIRPF - 4 años
  | 'exceso_gastos_0105_0106'           // Art. 23.1 LIRPF - sin caducidad
  | 'deduccion_vivienda_habitual'       // DT 18ª LIRPF
  | 'deduccion_maternidad'
  | 'otros';

export interface ArrastreIRPF {
  id?: number;
  ejercicioOrigen: number;         // Año en que se generó
  tipo: TipoArrastre;
  importeOriginal: number;         // Importe generado
  importePendiente: number;        // Importe aún no aplicado
  ejercicioCaducidad?: number;     // Año en que caduca (undefined/missing = sin caducidad)
  inmuebleId?: number;             // FK → properties.id (si aplica, e.g. exceso 0105+0106)
  aplicaciones: {                  // Historial FIFO de consumos
    ejercicio: number;
    importe: number;
    fecha: string;                 // ISO date
  }[];
  estado: 'pendiente' | 'aplicado_parcial' | 'aplicado_total' | 'caducado';
  createdAt: string;
  updatedAt: string;
}

// ─── V2.7: Snapshots de Declaración ────────────────────────────────────────────

export interface SnapshotDeclaracion {
  id?: number;
  ejercicio: number;               // Año fiscal
  fechaSnapshot: string;           // ISO date del momento de congelación
  // Blob congelado con todos los datos AEAT
  datos: {
    baseGeneral: any;              // BaseGeneral completa del motor IRPF
    baseAhorro: any;               // BaseAhorro completa
    reducciones: any;              // Reducciones aplicadas
    minimosPersonales: any;        // Mínimos personales
    liquidacion: any;              // Resultado de liquidación completo
    arrastresGenerados: number[];  // IDs de ArrastreIRPF generados
    arrastresAplicados: number[];  // IDs de ArrastreIRPF consumidos
  };
  // Casillas AEAT principales para consulta rápida
  casillasAEAT?: Record<string, number>; // e.g. { "0505": 12345.67, "0620": 890.12 }
  // Origen: automático (cierre) o manual (importación)
  origen: 'cierre_automatico' | 'importacion_manual';
  hash?: string;                   // Hash de integridad del blob
  createdAt: string;
}

// H10: Treasury Ingreso (Income) types
export type IngresoOrigen = 'contrato_id' | 'nomina_id' | 'doc_id';
export type IngresoDestino = 'personal' | 'inmueble_id';
export type IngresoEstado = 'previsto' | 'cobrado' | 'incompleto';

export interface Ingreso {
  id?: number;
  origen: IngresoOrigen;
  origen_id?: number; // ID del contrato, nómina o documento
  contraparte: string;
  fecha_emision: string;
  fecha_prevista_cobro: string;
  importe: number;
  moneda: 'EUR' | 'USD' | 'GBP';
  destino: IngresoDestino;
  destino_id?: number; // ID del inmueble si aplica
  estado: IngresoEstado;
  movement_id?: number; // Link to reconciled movement
  tipoFiscal?: 'alquiler' | 'nomina' | 'autonomo' | 'dividendo' | 'otros';
  ejercicioFiscal?: number;
  from_doc?: boolean; // Flag for exceptional income from documents
  createdAt: string;
  updatedAt: string;
}

// H10: Treasury Gasto (Expense) types  
export type GastoEstado = 'completo' | 'incompleto' | 'pagado';
export type GastoDestino = 'personal' | 'inmueble_id';

export interface Gasto {
  id?: number;
  contraparte_nombre: string;
  contraparte_nif?: string;
  fecha_emision: string;
  fecha_pago_prevista: string;
  total: number;
  base?: number;
  iva?: number;
  categoria_AEAT: AEATFiscalType;
  destino: GastoDestino;
  destino_id?: number; // ID del inmueble si aplica
  estado: GastoEstado;
  movement_id?: number; // Link to reconciled movement
  tipoFiscal?: 'comunidad' | 'seguro' | 'hipoteca' | 'suministro' | 'impuesto' | 'reparacion' | 'otros';
  ejercicioFiscal?: number;
  source_doc_id?: number; // Link to source document
  createdAt: string;
  updatedAt: string;
}

// H10: Treasury CAPEX types
export type CAPEXTipo = 'mejora' | 'ampliacion' | 'mobiliario' | 'reparacion';
export type CAPEXEstado = 'completo' | 'incompleto' | 'pagado' | 'amortizando';

export interface CAPEX {
  id?: number;
  inmueble_id: number;
  contraparte: string;
  fecha_emision: string;
  total: number;
  tipo: CAPEXTipo;
  anos_amortizacion: number; // Años de amortización
  estado: CAPEXEstado;
  movement_id?: number; // Link to reconciled movement
  source_doc_id?: number; // Link to source document
  createdAt: string;
  updatedAt: string;
}

// H9: Fiscal Summary by Property and Year
export interface FiscalSummary {
  id?: number;
  propertyId: number;
  exerciseYear: number;
  // AEAT Box totals
  box0105: number; // Interests/financing (manual docs + auto loans)
  box0105_auto?: number; // Interests auto-calculated from linked loans (subset of box0105)
  box0106: number; // R&C
  box0109: number; // Community
  box0112: number; // Personal services
  box0113: number; // Utilities
  box0114: number; // Insurance
  box0115: number; // Local taxes
  box0117: number; // Furniture amortization
  capexTotal: number; // Construction value increase
  // Calculated fields
  deductibleExcess?: number; // 0105+0106 excess over income
  constructionValue: number; // Current construction value
  annualDepreciation: number; // 3% of construction value
  status: 'Vivo' | 'Prescrito';
  // H9-FISCAL: AEAT Amortization details
  aeatAmortization?: {
    // Rental days information
    daysRented: number; // días de arrendamiento en el año
    daysAvailable: number; // días disponibles (365/366)
    
    // Base calculation
    calculationMethod: 'general' | 'special'; // regla general vs casos especiales
    baseAmount: number; // base amortizable (mayor entre coste construcción y VCc)
    percentageApplied: number; // porcentaje aplicado (3% por defecto)
    
    // Amount breakdown
    propertyAmortization: number; // amortización del inmueble
    improvementsAmortization: number; // amortización de mejoras
    furnitureAmortization: number; // amortización de mobiliario
    totalAmortization: number; // total amortización
    
    // Special cases
    specialCaseJustification?: string; // justificación del caso especial
    
    // Historical tracking for future sales
    accumulatedStandard: number; // acumulado al 3% (para minoración futura)
    accumulatedActual: number; // acumulado real deducido
  };
  // Metadata
  ejercicioFiscalId?: number; // FK ejerciciosFiscales.id si existe
  resultadoEjercicioId?: number; // FK resultadosEjercicio.id para histórico inmutable
  snapshotLocked?: boolean; // evita recalcular histórico cerrado/importado
  createdAt: string;
  updatedAt: string;
}

// H8: CSV Import Batch tracking - Enhanced for FIX-EXTRACTOS requirements
export interface ImportBatch {
  id?: string;
  filename: string;
  accountId: number;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  duplicatedRows: number;
  errorRows: number; // New: count of failed rows
  
  // FIX-EXTRACTOS: Required batch metadata for audit
  origenBanco: string; // Detected bank origin (e.g., 'bbva', 'santander', 'generic')
  formatoDetectado: 'CSV' | 'XLS' | 'XLSX'; // Detected format
  cuentaIban?: string; // Account IBAN from file or user selection
  rangoFechas: {
    min: string; // ISO date format yyyy-mm-dd
    max: string; // ISO date format yyyy-mm-dd
  };
  timestampImport: string; // ISO timestamp of import
  hashLote: string; // SHA-256 hash of file content for idempotency
  usuario?: string; // User who performed the import
  
  // Legacy fields
  inboxItemId?: number; // Link to the created inbox item
  createdAt: string;
}

// Legacy Expense interface (keep for backward compatibility)
export interface Expense {
  id?: number;
  propertyId: number;
  date: string;
  amount: number;
  description: string;
  category: 'repair' | 'capex' | 'furniture' | 'tax' | 'utility' | 'management' | 'other';
  isCapex: boolean;
  capexBreakdown?: {
    construction: number;
    materials: number;
    labor: number;
    permits: number;
    other: number;
  };
  documentId?: number;
}

// H9: Budget Wizard - Types aligned with AEAT fiscal categories
export type FiscalCategory = 
  | 'ingresos-alquiler'
  | 'intereses-prestamos'
  | 'amortizacion-capital'
  | 'ibi'
  | 'comunidad'
  | 'seguros'
  | 'suministros'
  | 'reparacion-conservacion'
  | 'mejora'
  | 'mobiliario'
  | 'gestion-psi-administracion'
  | 'otros-deducibles';

export type PaymentFrequency = 
  | 'mensual'
  | 'trimestral'
  | 'anual'
  | 'fraccionado'
  | 'unico';

// H9: New Budget Model - Updated types per specification
export type UUID = string;

export type FrecuenciaPago = 
  | "Mensual"
  | "Bimestral"
  | "Trimestral"
  | "Semestral"
  | "Anual"
  | "Unico";   // pago único en fecha puntual

export type TipoLinea = "Ingreso" | "Gasto";

export type CategoriaGasto =
  | "Suministros"            // Luz/Agua/Gas/Telco/TV (subtipo en 'tipo')
  | "Seguros"
  | "Comunidad"
  | "IBI"
  | "InteresesHipoteca"
  | "CuotaHipoteca"
  | "ReparaciónYConservación"
  | "Mantenimiento"
  | "Honorarios"
  | "Tasas"
  | "OtrosGastos"
  | "Mejora"                 // fiscalmente amortizable
  | "Mobiliario";            // fiscalmente amortizable

export type CategoriaIngreso =
  | "Alquiler"
  | "OtrosIngresos";

export type PlanningLayer = "LRP" | "BUDGET" | "FORECAST" | "ACTUAL";

export type EstadoCertidumbre =
  | "estimado"
  | "previsto"
  | "confirmado"
  | "conciliado"
  | "desviado";

export type OrigenLinea = 
  | "SemillaAuto"      // generada automáticamente
  | "ManualUsuario"    // creada o editada por el usuario
  | "AjusteSistema";   // recalculada por compra/venta, prorrateos, etc.

// H9: New Budget Model per specification
export interface Presupuesto {
  id: UUID;
  year: number;                // año del presupuesto
  creadoEn: string;            // ISO
  actualizadoEn: string;       // ISO
  estado: "Borrador" | "Activo" | "Cerrado";
  // metadatos de generación
  generadoDesde?: {
    fecha: string;             // ISO
    porcentajeComplecionInicial: number; // 0-100 estimado
  };
}

export interface PresupuestoLinea {
  id: UUID;
  presupuestoId: UUID;
  scope: "INMUEBLES" | "PERSONAL";     // Ámbito: Inmuebles o Personal
  type: "INGRESO" | "COSTE";           // Tipo: Ingreso o Coste
  inmuebleId?: UUID;                   // requerido salvo líneas globales
  roomId?: UUID;                       // opcional; si aplica por habitación
  // Categorización AEAT
  category: string;                    // Categoría principal: "Rentas de alquiler", "Nómina", "IBI", "Suministros", etc.
  subcategory?: string;                // Subcategoría: "Luz", "Agua", "Gas", "Telco" para Suministros
  label: string;                       // Texto libre: "Renta Piso Tenderina", "IBI piso X"
  counterpartyName?: string;           // Contraparte: "Endesa", opcional
  accountId?: UUID;                    // Cuenta de cargo/abono (obligatorio antes de guardar)
  sourceRef?: UUID;                    // ID de Contrato, Préstamo, etc. (opcional)
  // Importes mensuales - Array de 12 posiciones para ENE...DIC
  amountByMonth: number[];             // DEPRECATED gradual: mantener compatibilidad con forecastAmountByMonth
  planAmountByMonth?: number[];        // Nuevo: baseline anual (budget)
  forecastAmountByMonth?: number[];    // Nuevo: mejor estimación viva
  actualAmountByMonth?: number[];      // Nuevo: movimientos reales conciliados
  statusCertidumbreByMonth?: EstadoCertidumbre[]; // Nuevo: estado de confianza por mes
  planningLayer?: PlanningLayer;       // Nuevo: capa principal de la línea
  note?: string;                       // Nota opcional
  // Campos de compatibilidad (mantener por ahora)
  tipo?: TipoLinea;                    // DEPRECATED: usar type
  categoria?: CategoriaGasto | CategoriaIngreso; // DEPRECATED: usar category
  tipoConcepto?: string;               // DEPRECATED: usar label
  proveedor?: string;                  // DEPRECATED: usar counterpartyName
  proveedorNif?: string;               // DEPRECATED: usar counterpartyNif
  cuentaId?: UUID;                     // DEPRECATED: usar accountId
  frecuencia?: FrecuenciaPago;         // DEPRECATED
  dayOfMonth?: number;                 // DEPRECATED
  mesesActivos?: number[];             // DEPRECATED
  fechaUnica?: string;                 // DEPRECATED
  importeUnitario?: number;            // DEPRECATED
  ivaIncluido?: boolean;               // DEPRECATED
  desde?: string;                      // DEPRECATED
  hasta?: string;                      // DEPRECATED
  origen?: OrigenLinea;                // DEPRECATED
  editable?: boolean;                  // DEPRECATED
  notas?: string;                      // DEPRECATED: usar note
  contratoId?: UUID;                   // DEPRECATED: usar sourceRef
  prestamoId?: UUID;                   // DEPRECATED: usar sourceRef
}

// Legacy Budget Line interface (keep for backward compatibility)
export interface BudgetLine {
  id?: number;
  budgetId: number;
  propertyId?: number; // Optional for portfolio-level items
  category: FiscalCategory;
  description: string;
  amount: number; // Total annual amount
  frequency: PaymentFrequency;
  startMonth: number; // 1-12, for annual/fractionated/one-time
  installments?: number; // For fractionated payments
  
  // Monthly breakdown (auto-calculated from amount + frequency)
  monthlyAmounts: number[]; // 12 positions for each month
  
  // Metadata
  isAutoGenerated: boolean; // True if generated from contracts/loans
  sourceType?: 'contract' | 'loan' | 'historical' | 'manual';
  sourceId?: number; // Link to source contract/loan/expense ID
  notes?: string;
  
  createdAt: string;
  updatedAt: string;
}

// Legacy Budget interface (keep for backward compatibility)
export interface Budget {
  id?: number;
  year: number;
  version: string; // v1.0, v1.1, etc.
  name: string; // "Presupuesto 2026"
  
  // Scope configuration
  scope: {
    propertyIds: number[]; // Selected properties
    roomIds?: string[]; // Selected rooms if applicable
    startMonth: number; // 1-12, if starting mid-year
    isFullYear: boolean; // true = fill retro estimated, false = leave blanks
  };
  
  // Status and metadata
  status: 'draft' | 'confirmed'; // draft during wizard, confirmed when saved
  isLocked: boolean; // true once confirmed, prevents automatic updates
  
  // Budget lines
  lines: BudgetLine[];
  
  // Totals (calculated)
  totals: {
    annualIncome: number;
    annualExpenses: number;
    monthlyBreakdown: {
      income: number[];
      expenses: number[];
      result: number[];
    };
  };
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy?: string; // User identifier
}

// Patrimonio Snapshots - Historical tracking of net worth
export interface PatrimonioSnapshot {
  id?: number;
  fecha: string; // YYYY-MM format (e.g., "2026-02")
  total: number;
  inmuebles: number;
  inversiones: number;
  cuentas: number;
  deuda: number;
  createdAt: string; // ISO timestamp
}

export type OpexCategory = 'impuesto' | 'suministro' | 'comunidad' | 'seguro' | 'servicio' | 'gestion' | 'otro';
export type OpexFrequency = 'semanal' | 'mensual' | 'bimestral' | 'trimestral' | 'semestral' | 'anual' | 'meses_especificos';
export type OpexEstacionalidad = 'plana' | 'invierno' | 'verano';
export type ExpenseBusinessType = 'recurrente' | 'reparacion' | 'mejora' | 'mobiliario';

export interface AsymmetricPayment {
  mes: number; // 1-12
  importe: number;
}

export interface OpexRule {
  id?: number;
  propertyId: number;
  accountId?: number; // Para linkar con Tesorería
  categoria: OpexCategory;
  concepto: string; // ej: "IBI", "Netflix", "Property Management"
  importeEstimado: number; // Por ciclo de cobro
  frecuencia: OpexFrequency;
  mesesCobro?: number[]; // [1, 7] para Enero y Julio si es meses_especificos
  diaCobro?: number; // Día del mes estimado (1-31)
  diaDeLaSemana?: number; // 0=Lunes ... 6=Domingo, para frecuencia semanal
  mesInicio?: number; // 1-12, mes de inicio para frecuencias periódicas
  asymmetricPayments?: AsymmetricPayment[]; // Importes distintos por mes (meses_especificos)
  estacionalidad?: OpexEstacionalidad; // Para suministros: 'plana' | 'invierno' | 'verano'
  casillaAEAT?: string; // Override manual de la casilla AEAT (ej: '0109', '0114'…)
  businessType?: ExpenseBusinessType;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

// V2.6: ConfiguracionFiscal — IRPF fiscal configuration
export interface ConfiguracionFiscal {
  id?: number; // always 1 (single record)
  cuenta_irpf_id?: number;
  mes_declaracion: number; // default 6 (June)
  dia_declaracion: number; // default 25
  incluir_prevision_irpf: boolean;
  fraccionarPago: boolean;
  modelo130_pagados: { ejercicio: number; trimestre: number; importe: number; fechaPago: string }[];
  modelo303_pagados: { ejercicio: number; trimestre: number; importe: number; fechaPago: string }[];
  minusvalias_pendientes: { anio: number; importe: number }[];
  updatedAt: string;
}

interface AtlasHorizonDB {
  properties: Property;
  property_sales: PropertySale;
  loan_settlements: LoanSettlement;
  documents: Document;
  contracts: Contract;
  rentCalendar: RentCalendar; // H7: Rent calendar entries
  rentPayments: RentPayment; // H7: Rent payment tracking
  rentaMensual: RentaMensual; // CONTRATOS: Monthly rent tracking for treasury integration
  expenses: Expense; // Legacy
  expensesH5: ExpenseH5; // H5: New expense system
  reforms: Reform; // H5: CAPEX reforms
  reformLineItems: ReformLineItem; // H5: Reform line items
  aeatCarryForwards: AEATCarryForward; // H5: Tax carryforwards
  propertyDays: PropertyDays; // H5: Rental/availability days
  propertyImprovements: PropertyImprovement; // H9-FISCAL: Property improvements for AEAT
  kpiConfigurations: any; // H6: KPI configurations
  accounts: Account; // H8: Treasury accounts
  movements: Movement; // H8: Bank movements
  importBatches: ImportBatch; // H8: CSV import tracking
  treasuryEvents: TreasuryEvent; // H9: Treasury forecasting
  treasuryRecommendations: TreasuryRecommendation; // H9: Treasury recommendations
  fiscalSummaries: FiscalSummary; // H9: Fiscal summaries by property/year
  ingresos: Ingreso; // H10: Treasury income records
  gastos: Gasto; // H10: Treasury expense records
  capex: CAPEX; // H10: Treasury CAPEX records
  budgets: Budget; // H9: Annual budget wizard (legacy)
  budgetLines: BudgetLine; // H9: Budget line items (legacy)
  presupuestos: Presupuesto; // H9: New budget system per specification
  presupuestoLineas: PresupuestoLinea; // H9: New budget lines per specification
  importLogs: ImportLog; // ATLAS HORIZON: Import logging for banking movements pipeline
  matchingConfiguration: MatchingConfiguration; // ATLAS HORIZON: Matching rules configuration
  reconciliationAuditLogs: ReconciliationAuditLog; // V1.1: Audit logs for reconciliation actions
  movementLearningRules: MovementLearningRule; // V1.1: Learning rules for automatic classification
  learningLogs: LearningLog; // V1.1: Learning audit log without PII
  inversiones: PosicionInversion; // V1.3: Investment positions
  patrimonioSnapshots: PatrimonioSnapshot; // Dashboard: Historical net worth tracking
  personalData: PersonalData; // V1.2: Personal data
  personalModuleConfig: PersonalModuleConfig; // V1.2: Personal module configuration
  nominas: Nomina; // V1.2: Salary data
  autonomos: Autonomo; // V1.2: Self-employed data
  planesPensionInversion: PlanPensionInversion; // V1.2: Pension and investment plans
  otrosIngresos: OtrosIngresos; // V1.2: Other income
  movimientosPersonales: MovimientoPersonal; // V1.2: Personal movements
  gastosRecurrentes: GastoRecurrente; // V1.4: Recurring expenses
  gastosPuntuales: GastoPuntual; // V1.4: One-time expenses
  pensiones: PensionIngreso; // V2.5: Pension income records
  personalExpenses: PersonalExpense; // V2.3: OPEX-style personal expenses
  prestamos: any; // Financiacion: Loan records
  valoraciones_historicas: any; // Monthly valuation: Historical valuations per asset
  valoraciones_mensuales: any; // Monthly valuation: Monthly snapshots
  keyval: any; // General key-value store for application configuration
  objetivos_financieros: {
    id: 1;
    rentaPasivaObjetivo: number;
    patrimonioNetoObjetivo: number;
    cajaMinima: number;
    dtiMaximo: number;
    ltvMaximo: number;
    yieldMinimaCartera: number;
    tasaAhorroMinima: number;
    updatedAt: string;
  }; // V3.2: financial goals singleton store
  opexRules: OpexRule; // V2.2: OPEX recurring expense rules per property
  configuracion_fiscal: any; // V2.6: IRPF forecast configuration (singleton, id='default')
  ejerciciosFiscales: EjercicioFiscal; // V2.7: Fiscal year lifecycle
  resultadosEjercicio: ResultadoEjercicio; // V2.9: Immutable yearly fiscal snapshots
  arrastresIRPF: ArrastreIRPF; // V2.7: IRPF carry-forwards cross-year
  snapshotsDeclaracion: SnapshotDeclaracion; // V2.7: Frozen declaration snapshots
}

let dbPromise: Promise<IDBPDatabase<AtlasHorizonDB>>;

export const initDB = async () => {
  if (!dbPromise) {
    dbPromise = openDB<AtlasHorizonDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        // Properties store
        if (!db.objectStoreNames.contains('properties')) {
          const propertyStore = db.createObjectStore('properties', { keyPath: 'id', autoIncrement: true });
          propertyStore.createIndex('alias', 'alias', { unique: false });
          propertyStore.createIndex('address', 'address', { unique: false });
        }

        if (!db.objectStoreNames.contains('property_sales')) {
          const propertySalesStore = db.createObjectStore('property_sales', { keyPath: 'id', autoIncrement: true });
          propertySalesStore.createIndex('propertyId', 'propertyId', { unique: false });
          propertySalesStore.createIndex('saleDate', 'saleDate', { unique: false });
          propertySalesStore.createIndex('status', 'status', { unique: false });
          propertySalesStore.createIndex('property-status', ['propertyId', 'status'], { unique: false });
        }

        if (!db.objectStoreNames.contains('loan_settlements')) {
          const loanSettlementsStore = db.createObjectStore('loan_settlements', { keyPath: 'id', autoIncrement: true });
          loanSettlementsStore.createIndex('loanId', 'loanId', { unique: false });
          loanSettlementsStore.createIndex('operationDate', 'operationDate', { unique: false });
          loanSettlementsStore.createIndex('status', 'status', { unique: false });
          loanSettlementsStore.createIndex('loan-status', ['loanId', 'status'], { unique: false });
        }

        if (oldVersion < 32 && !db.objectStoreNames.contains('objetivos_financieros')) {
          db.createObjectStore('objetivos_financieros', { keyPath: 'id' });
        }

        // Documents store
        if (!db.objectStoreNames.contains('documents')) {
          const documentStore = db.createObjectStore('documents', { keyPath: 'id', autoIncrement: true });
          documentStore.createIndex('type', 'type', { unique: false });
          documentStore.createIndex('entityType', 'metadata.entityType', { unique: false });
          documentStore.createIndex('entityId', 'metadata.entityId', { unique: false });
        }

        // Contracts store
        if (!db.objectStoreNames.contains('contracts')) {
          const contractStore = db.createObjectStore('contracts', { keyPath: 'id', autoIncrement: true });
          contractStore.createIndex('propertyId', 'propertyId', { unique: false });
        }

        // Legacy Expenses store (keep for backward compatibility)
        if (!db.objectStoreNames.contains('expenses')) {
          const expenseStore = db.createObjectStore('expenses', { keyPath: 'id', autoIncrement: true });
          expenseStore.createIndex('propertyId', 'propertyId', { unique: false });
          expenseStore.createIndex('category', 'category', { unique: false });
          expenseStore.createIndex('isCapex', 'isCapex', { unique: false });
        }

        // H5: Enhanced Expenses store
        if (!db.objectStoreNames.contains('expensesH5')) {
          const expenseH5Store = db.createObjectStore('expensesH5', { keyPath: 'id', autoIncrement: true });
          expenseH5Store.createIndex('propertyId', 'propertyId', { unique: false });
          expenseH5Store.createIndex('fiscalType', 'fiscalType', { unique: false });
          expenseH5Store.createIndex('taxYear', 'taxYear', { unique: false });
          expenseH5Store.createIndex('status', 'status', { unique: false });
          expenseH5Store.createIndex('origin', 'origin', { unique: false });
          expenseH5Store.createIndex('date', 'date', { unique: false });
        }

        // H5: Reforms store
        if (!db.objectStoreNames.contains('reforms')) {
          const reformStore = db.createObjectStore('reforms', { keyPath: 'id', autoIncrement: true });
          reformStore.createIndex('propertyId', 'propertyId', { unique: false });
          reformStore.createIndex('status', 'status', { unique: false });
        }

        // H5: Reform Line Items store
        if (!db.objectStoreNames.contains('reformLineItems')) {
          const reformLineItemStore = db.createObjectStore('reformLineItems', { keyPath: 'id', autoIncrement: true });
          reformLineItemStore.createIndex('reformId', 'reformId', { unique: false });
          reformLineItemStore.createIndex('treatment', 'treatment', { unique: false });
          reformLineItemStore.createIndex('source', 'source', { unique: false });
        }

        // H5: AEAT Carry Forwards store
        if (!db.objectStoreNames.contains('aeatCarryForwards')) {
          const carryForwardStore = db.createObjectStore('aeatCarryForwards', { keyPath: 'id', autoIncrement: true });
          carryForwardStore.createIndex('propertyId', 'propertyId', { unique: false });
          carryForwardStore.createIndex('taxYear', 'taxYear', { unique: false });
          carryForwardStore.createIndex('expirationYear', 'expirationYear', { unique: false });
        }

        // H5: Property Days store
        if (!db.objectStoreNames.contains('propertyDays')) {
          const propertyDaysStore = db.createObjectStore('propertyDays', { keyPath: 'id', autoIncrement: true });
          propertyDaysStore.createIndex('propertyId', 'propertyId', { unique: false });
          propertyDaysStore.createIndex('taxYear', 'taxYear', { unique: false });
          propertyDaysStore.createIndex('property-year', ['propertyId', 'taxYear'], { unique: true });
        }

        // H9-FISCAL: Property Improvements store
        if (!db.objectStoreNames.contains('propertyImprovements')) {
          const propertyImprovementsStore = db.createObjectStore('propertyImprovements', { keyPath: 'id', autoIncrement: true });
          propertyImprovementsStore.createIndex('propertyId', 'propertyId', { unique: false });
          propertyImprovementsStore.createIndex('year', 'year', { unique: false });
          propertyImprovementsStore.createIndex('property-year', ['propertyId', 'year'], { unique: false });
        }

        // H6: KPI Configurations store
        if (!db.objectStoreNames.contains('kpiConfigurations')) {
          db.createObjectStore('kpiConfigurations', { keyPath: 'id' }); // id will be 'horizon' or 'pulse'
        }

        // H7: Rent Calendar store
        if (!db.objectStoreNames.contains('rentCalendar')) {
          const rentCalendarStore = db.createObjectStore('rentCalendar', { keyPath: 'id', autoIncrement: true });
          rentCalendarStore.createIndex('contractId', 'contractId', { unique: false });
          rentCalendarStore.createIndex('period', 'period', { unique: false });
        }

        // H7: Rent Payments store
        if (!db.objectStoreNames.contains('rentPayments')) {
          const rentPaymentsStore = db.createObjectStore('rentPayments', { keyPath: 'id', autoIncrement: true });
          rentPaymentsStore.createIndex('contractId', 'contractId', { unique: false });
          rentPaymentsStore.createIndex('period', 'period', { unique: false });
          rentPaymentsStore.createIndex('status', 'status', { unique: false });
        }

        // CONTRATOS: Monthly rent tracking for treasury integration
        if (!db.objectStoreNames.contains('rentaMensual')) {
          const rentaMensualStore = db.createObjectStore('rentaMensual', { keyPath: 'id', autoIncrement: true });
          rentaMensualStore.createIndex('contratoId', 'contratoId', { unique: false });
          rentaMensualStore.createIndex('periodo', 'periodo', { unique: false });
          rentaMensualStore.createIndex('estado', 'estado', { unique: false });
        }

        // H8: Treasury Accounts store
        if (!db.objectStoreNames.contains('accounts')) {
          const accountsStore = db.createObjectStore('accounts', { keyPath: 'id', autoIncrement: true });
          accountsStore.createIndex('destination', 'destination', { unique: false });
          accountsStore.createIndex('bank', 'bank', { unique: false });
          accountsStore.createIndex('isActive', 'isActive', { unique: false });
        }

        // H8: Treasury Movements store
        if (!db.objectStoreNames.contains('movements')) {
          const movementsStore = db.createObjectStore('movements', { keyPath: 'id', autoIncrement: true });
          movementsStore.createIndex('accountId', 'accountId', { unique: false });
          movementsStore.createIndex('date', 'date', { unique: false });
          movementsStore.createIndex('status', 'status', { unique: false });
          movementsStore.createIndex('importBatch', 'importBatch', { unique: false });
          // Duplicate detection index
          movementsStore.createIndex('duplicate-key', ['accountId', 'date', 'amount', 'description'], { unique: false });
        }

        // H8: Import Batches store
        if (!db.objectStoreNames.contains('importBatches')) {
          const importBatchesStore = db.createObjectStore('importBatches', { keyPath: 'id' });
          importBatchesStore.createIndex('accountId', 'accountId', { unique: false });
          importBatchesStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // H9: Treasury Events store
        if (!db.objectStoreNames.contains('treasuryEvents')) {
          const treasuryEventsStore = db.createObjectStore('treasuryEvents', { keyPath: 'id', autoIncrement: true });
          treasuryEventsStore.createIndex('type', 'type', { unique: false });
          treasuryEventsStore.createIndex('predictedDate', 'predictedDate', { unique: false });
          treasuryEventsStore.createIndex('accountId', 'accountId', { unique: false });
          treasuryEventsStore.createIndex('status', 'status', { unique: false });
          treasuryEventsStore.createIndex('sourceType', 'sourceType', { unique: false });
          treasuryEventsStore.createIndex('sourceId', 'sourceId', { unique: false });
        }

        // H9: Treasury Recommendations store
        if (!db.objectStoreNames.contains('treasuryRecommendations')) {
          const treasuryRecommendationsStore = db.createObjectStore('treasuryRecommendations', { keyPath: 'id' });
          treasuryRecommendationsStore.createIndex('type', 'type', { unique: false });
          treasuryRecommendationsStore.createIndex('status', 'status', { unique: false });
          treasuryRecommendationsStore.createIndex('severity', 'severity', { unique: false });
          treasuryRecommendationsStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // H9: Fiscal Summaries store
        if (!db.objectStoreNames.contains('fiscalSummaries')) {
          const fiscalSummariesStore = db.createObjectStore('fiscalSummaries', { keyPath: 'id', autoIncrement: true });
          fiscalSummariesStore.createIndex('propertyId', 'propertyId', { unique: false });
          fiscalSummariesStore.createIndex('exerciseYear', 'exerciseYear', { unique: false });
          fiscalSummariesStore.createIndex('status', 'status', { unique: false });
          fiscalSummariesStore.createIndex('property-year', ['propertyId', 'exerciseYear'], { unique: true });
        }

        // H10: Treasury Ingresos store
        if (!db.objectStoreNames.contains('ingresos')) {
          const ingresosStore = db.createObjectStore('ingresos', { keyPath: 'id', autoIncrement: true });
          ingresosStore.createIndex('origen', 'origen', { unique: false });
          ingresosStore.createIndex('estado', 'estado', { unique: false });
          ingresosStore.createIndex('fecha_prevista_cobro', 'fecha_prevista_cobro', { unique: false });
          ingresosStore.createIndex('destino', 'destino', { unique: false });
          ingresosStore.createIndex('movement_id', 'movement_id', { unique: false });
        }

        // H10: Treasury Gastos store
        if (!db.objectStoreNames.contains('gastos')) {
          const gastosStore = db.createObjectStore('gastos', { keyPath: 'id', autoIncrement: true });
          gastosStore.createIndex('categoria_AEAT', 'categoria_AEAT', { unique: false });
          gastosStore.createIndex('estado', 'estado', { unique: false });
          gastosStore.createIndex('fecha_pago_prevista', 'fecha_pago_prevista', { unique: false });
          gastosStore.createIndex('destino', 'destino', { unique: false });
          gastosStore.createIndex('movement_id', 'movement_id', { unique: false });
          gastosStore.createIndex('source_doc_id', 'source_doc_id', { unique: false });
        }

        // H10: Treasury CAPEX store
        if (!db.objectStoreNames.contains('capex')) {
          const capexStore = db.createObjectStore('capex', { keyPath: 'id', autoIncrement: true });
          capexStore.createIndex('inmueble_id', 'inmueble_id', { unique: false });
          capexStore.createIndex('tipo', 'tipo', { unique: false });
          capexStore.createIndex('estado', 'estado', { unique: false });
          capexStore.createIndex('fecha_emision', 'fecha_emision', { unique: false });
          capexStore.createIndex('movement_id', 'movement_id', { unique: false });
          capexStore.createIndex('source_doc_id', 'source_doc_id', { unique: false });
        }

        // H9: Budget Wizard - Budgets store
        if (!db.objectStoreNames.contains('budgets')) {
          const budgetsStore = db.createObjectStore('budgets', { keyPath: 'id', autoIncrement: true });
          budgetsStore.createIndex('year', 'year', { unique: false });
          budgetsStore.createIndex('version', 'version', { unique: false });
          budgetsStore.createIndex('status', 'status', { unique: false });
          budgetsStore.createIndex('year-version', ['year', 'version'], { unique: true });
        }

        // H9: Budget Wizard - Budget Lines store
        if (!db.objectStoreNames.contains('budgetLines')) {
          const budgetLinesStore = db.createObjectStore('budgetLines', { keyPath: 'id', autoIncrement: true });
          budgetLinesStore.createIndex('budgetId', 'budgetId', { unique: false });
          budgetLinesStore.createIndex('propertyId', 'propertyId', { unique: false });
          budgetLinesStore.createIndex('category', 'category', { unique: false });
          budgetLinesStore.createIndex('frequency', 'frequency', { unique: false });
          budgetLinesStore.createIndex('sourceType', 'sourceType', { unique: false });
          budgetLinesStore.createIndex('sourceId', 'sourceId', { unique: false });
        }

        // H9: New Budget System - Presupuestos store (per specification)
        if (!db.objectStoreNames.contains('presupuestos')) {
          const presupuestosStore = db.createObjectStore('presupuestos', { keyPath: 'id' });
          presupuestosStore.createIndex('year', 'year', { unique: false });
          presupuestosStore.createIndex('estado', 'estado', { unique: false });
        }

        // H9: New Budget System - Presupuesto Lineas store (per specification)
        if (!db.objectStoreNames.contains('presupuestoLineas')) {
          const presupuestoLineasStore = db.createObjectStore('presupuestoLineas', { keyPath: 'id' });
          presupuestoLineasStore.createIndex('presupuestoId', 'presupuestoId', { unique: false });
          presupuestoLineasStore.createIndex('inmuebleId', 'inmuebleId', { unique: false });
          presupuestoLineasStore.createIndex('tipo', 'tipo', { unique: false });
          presupuestoLineasStore.createIndex('categoria', 'categoria', { unique: false });
          presupuestoLineasStore.createIndex('frecuencia', 'frecuencia', { unique: false });
          presupuestoLineasStore.createIndex('origen', 'origen', { unique: false });
          presupuestoLineasStore.createIndex('cuentaId', 'cuentaId', { unique: false });
          presupuestoLineasStore.createIndex('contratoId', 'contratoId', { unique: false });
          presupuestoLineasStore.createIndex('prestamoId', 'prestamoId', { unique: false });
        }

        // ATLAS HORIZON: Import logs store for banking movements pipeline
        if (!db.objectStoreNames.contains('importLogs')) {
          const importLogsStore = db.createObjectStore('importLogs', { keyPath: 'id', autoIncrement: true });
          importLogsStore.createIndex('fileName', 'fileName', { unique: false });
          importLogsStore.createIndex('importedAt', 'importedAt', { unique: false });
          importLogsStore.createIndex('source', 'source', { unique: false });
          importLogsStore.createIndex('batchId', 'batchId', { unique: false });
          importLogsStore.createIndex('account_id', 'account_id', { unique: false });
        }

        // ATLAS HORIZON: Matching configuration store
        if (!db.objectStoreNames.contains('matchingConfiguration')) {
          const matchingConfigStore = db.createObjectStore('matchingConfiguration', { keyPath: 'id', autoIncrement: true });
          matchingConfigStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // V1.1: Reconciliation audit logs store
        if (!db.objectStoreNames.contains('reconciliationAuditLogs')) {
          const auditLogsStore = db.createObjectStore('reconciliationAuditLogs', { keyPath: 'id', autoIncrement: true });
          auditLogsStore.createIndex('action', 'action', { unique: false });
          auditLogsStore.createIndex('movimientoId', 'movimientoId', { unique: false });
          auditLogsStore.createIndex('timestamp', 'timestamp', { unique: false });
          auditLogsStore.createIndex('categoria', 'categoria', { unique: false });
        }

        // V1.1: Movement learning rules store
        if (!db.objectStoreNames.contains('movementLearningRules')) {
          const learningRulesStore = db.createObjectStore('movementLearningRules', { keyPath: 'id', autoIncrement: true });
          learningRulesStore.createIndex('learnKey', 'learnKey', { unique: true });
          learningRulesStore.createIndex('categoria', 'categoria', { unique: false });
          learningRulesStore.createIndex('ambito', 'ambito', { unique: false });
          learningRulesStore.createIndex('createdAt', 'createdAt', { unique: false });
          learningRulesStore.createIndex('appliedCount', 'appliedCount', { unique: false });
        }

        // V1.1: Learning logs store for audit trail (no PII)
        if (!db.objectStoreNames.contains('learningLogs')) {
          const learningLogsStore = db.createObjectStore('learningLogs', { keyPath: 'id', autoIncrement: true });
          learningLogsStore.createIndex('action', 'action', { unique: false });
          learningLogsStore.createIndex('learnKey', 'learnKey', { unique: false });
          learningLogsStore.createIndex('categoria', 'categoria', { unique: false });
          learningLogsStore.createIndex('ts', 'ts', { unique: false });
          learningLogsStore.createIndex('movimientoId', 'movimientoId', { unique: false });
          learningLogsStore.createIndex('ruleId', 'ruleId', { unique: false });
        }

        // V1.2: Personal V1 module data stores
        if (!db.objectStoreNames.contains('personalData')) {
          const personalDataStore = db.createObjectStore('personalData', { keyPath: 'id', autoIncrement: true });
          personalDataStore.createIndex('dni', 'dni', { unique: true });
          personalDataStore.createIndex('fechaActualizacion', 'fechaActualizacion', { unique: false });
        }

        if (!db.objectStoreNames.contains('personalModuleConfig')) {
          const configStore = db.createObjectStore('personalModuleConfig', { keyPath: 'personalDataId' });
          configStore.createIndex('fechaActualizacion', 'fechaActualizacion', { unique: false });
        }

        if (!db.objectStoreNames.contains('nominas')) {
          const nominasStore = db.createObjectStore('nominas', { keyPath: 'id', autoIncrement: true });
          nominasStore.createIndex('personalDataId', 'personalDataId', { unique: false });
          nominasStore.createIndex('activa', 'activa', { unique: false });
          nominasStore.createIndex('fechaActualizacion', 'fechaActualizacion', { unique: false });
        }

        if (!db.objectStoreNames.contains('autonomos')) {
          const autonomosStore = db.createObjectStore('autonomos', { keyPath: 'id', autoIncrement: true });
          autonomosStore.createIndex('personalDataId', 'personalDataId', { unique: false });
          autonomosStore.createIndex('activo', 'activo', { unique: false });
          autonomosStore.createIndex('fechaActualizacion', 'fechaActualizacion', { unique: false });
        }

        if (!db.objectStoreNames.contains('planesPensionInversion')) {
          const planesStore = db.createObjectStore('planesPensionInversion', { keyPath: 'id', autoIncrement: true });
          planesStore.createIndex('personalDataId', 'personalDataId', { unique: false });
          planesStore.createIndex('tipo', 'tipo', { unique: false });
          planesStore.createIndex('titularidad', 'titularidad', { unique: false });
          planesStore.createIndex('esHistorico', 'esHistorico', { unique: false });
          planesStore.createIndex('fechaActualizacion', 'fechaActualizacion', { unique: false });
        }

        if (!db.objectStoreNames.contains('otrosIngresos')) {
          const otrosIngresosStore = db.createObjectStore('otrosIngresos', { keyPath: 'id', autoIncrement: true });
          otrosIngresosStore.createIndex('personalDataId', 'personalDataId', { unique: false });
          otrosIngresosStore.createIndex('tipo', 'tipo', { unique: false });
          otrosIngresosStore.createIndex('activo', 'activo', { unique: false });
          otrosIngresosStore.createIndex('fechaActualizacion', 'fechaActualizacion', { unique: false });
        }

        if (!db.objectStoreNames.contains('movimientosPersonales')) {
          const movimientosPersonalesStore = db.createObjectStore('movimientosPersonales', { keyPath: 'id' });
          movimientosPersonalesStore.createIndex('tipo', 'tipo', { unique: false });
          movimientosPersonalesStore.createIndex('origenId', 'origenId', { unique: false });
          movimientosPersonalesStore.createIndex('fecha', 'fecha', { unique: false });
          movimientosPersonalesStore.createIndex('cuenta', 'cuenta', { unique: false });
          movimientosPersonalesStore.createIndex('esRecurrente', 'esRecurrente', { unique: false });
        }

        // V1.3: Inversiones (Investment positions) store
        if (!db.objectStoreNames.contains('inversiones')) {
          const inversionesStore = db.createObjectStore('inversiones', { keyPath: 'id', autoIncrement: true });
          inversionesStore.createIndex('tipo', 'tipo', { unique: false });
          inversionesStore.createIndex('activo', 'activo', { unique: false });
          inversionesStore.createIndex('entidad', 'entidad', { unique: false });
        }

        // Dashboard refactor: Patrimonio Snapshots for historical tracking
        if (!db.objectStoreNames.contains('patrimonioSnapshots')) {
          const snapshotsStore = db.createObjectStore('patrimonioSnapshots', { keyPath: 'id', autoIncrement: true });
          snapshotsStore.createIndex('fecha', 'fecha', { unique: true });
          snapshotsStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // General key-value store for application configuration
        if (!db.objectStoreNames.contains('keyval')) {
          db.createObjectStore('keyval');
        }

        // Financiacion: Prestamos store for loan persistence
        if (!db.objectStoreNames.contains('prestamos')) {
          const prestamosStore = db.createObjectStore('prestamos', { keyPath: 'id' });
          prestamosStore.createIndex('inmuebleId', 'inmuebleId', { unique: false });
          prestamosStore.createIndex('tipo', 'tipo', { unique: false });
          prestamosStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // V2.1: Valoraciones historicas store for monthly valuation system
        if (!db.objectStoreNames.contains('valoraciones_historicas')) {
          const valoracionesStore = db.createObjectStore('valoraciones_historicas', { keyPath: 'id', autoIncrement: true });
          valoracionesStore.createIndex('tipo_activo', 'tipo_activo', { unique: false });
          valoracionesStore.createIndex('activo_id', 'activo_id', { unique: false });
          valoracionesStore.createIndex('fecha_valoracion', 'fecha_valoracion', { unique: false });
          valoracionesStore.createIndex('tipo-activo-fecha', ['tipo_activo', 'activo_id', 'fecha_valoracion'], { unique: false });
        }

        // V2.1: Valoraciones mensuales store for monthly snapshots
        if (!db.objectStoreNames.contains('valoraciones_mensuales')) {
          const snapshotsStore = db.createObjectStore('valoraciones_mensuales', { keyPath: 'id', autoIncrement: true });
          snapshotsStore.createIndex('fecha_cierre', 'fecha_cierre', { unique: true });
        }

        // V2.2: OPEX Rules store for recurring expense templates per property
        if (!db.objectStoreNames.contains('opexRules')) {
          const opexStore = db.createObjectStore('opexRules', { keyPath: 'id', autoIncrement: true });
          opexStore.createIndex('propertyId', 'propertyId', { unique: false });
        }

        // V2.3: Personal Expenses store (OPEX-style recurring expenses for personal finance)
        if (!db.objectStoreNames.contains('personalExpenses')) {
          const personalExpensesStore = db.createObjectStore('personalExpenses', { keyPath: 'id', autoIncrement: true });
          personalExpensesStore.createIndex('personalDataId', 'personalDataId', { unique: false });
        }

        // V2.4: Gastos Recurrentes store (recurring personal expenses)
        if (!db.objectStoreNames.contains('gastosRecurrentes')) {
          const gastosRecurrentesStore = db.createObjectStore('gastosRecurrentes', { keyPath: 'id', autoIncrement: true });
          gastosRecurrentesStore.createIndex('personalDataId', 'personalDataId', { unique: false });
        }

        // V2.4: Gastos Puntuales store (one-time personal expenses)
        if (!db.objectStoreNames.contains('gastosPuntuales')) {
          const gastosPuntualesStore = db.createObjectStore('gastosPuntuales', { keyPath: 'id', autoIncrement: true });
          gastosPuntualesStore.createIndex('personalDataId', 'personalDataId', { unique: false });
        }

        // V2.5: Pensiones store (pension income records)
        if (!db.objectStoreNames.contains('pensiones')) {
          const pensionesStore = db.createObjectStore('pensiones', { keyPath: 'id', autoIncrement: true });
          pensionesStore.createIndex('personalDataId', 'personalDataId', { unique: false });
          pensionesStore.createIndex('activa', 'activa', { unique: false });
        }

        // V2.6: Configuración fiscal (IRPF forecast, singleton with id='default')
        if (!db.objectStoreNames.contains('configuracion_fiscal')) {
          db.createObjectStore('configuracion_fiscal', { keyPath: 'id' });
        }

        // V2.7: Ejercicios Fiscales store
        if (!db.objectStoreNames.contains('ejerciciosFiscales')) {
          const ejerciciosStore = db.createObjectStore('ejerciciosFiscales', { keyPath: 'id', autoIncrement: true });
          ejerciciosStore.createIndex('año', 'año', { unique: true });
          ejerciciosStore.createIndex('estado', 'estado', { unique: false });
          ejerciciosStore.createIndex('origen', 'origen', { unique: false });
          ejerciciosStore.createIndex('snapshotId', 'snapshotId', { unique: false });
        }


        // V2.9: Resultado de ejercicio store (immutable yearly snapshots)
        if (!db.objectStoreNames.contains('resultadosEjercicio')) {
          const resultadosStore = db.createObjectStore('resultadosEjercicio', { keyPath: 'id', autoIncrement: true });
          resultadosStore.createIndex('ejercicio', 'ejercicio', { unique: false });
          resultadosStore.createIndex('estadoEjercicio', 'estadoEjercicio', { unique: false });
          resultadosStore.createIndex('origen', 'origen', { unique: false });
          resultadosStore.createIndex('ejercicio-estado', ['ejercicio', 'estadoEjercicio'], { unique: false });
        }

        // V2.7: Arrastres IRPF store (carry-forwards between fiscal years)
        if (!db.objectStoreNames.contains('arrastresIRPF')) {
          const arrastresStore = db.createObjectStore('arrastresIRPF', { keyPath: 'id', autoIncrement: true });
          arrastresStore.createIndex('ejercicioOrigen', 'ejercicioOrigen', { unique: false });
          arrastresStore.createIndex('tipo', 'tipo', { unique: false });
          arrastresStore.createIndex('estado', 'estado', { unique: false });
          arrastresStore.createIndex('ejercicioCaducidad', 'ejercicioCaducidad', { unique: false });
          arrastresStore.createIndex('inmuebleId', 'inmuebleId', { unique: false });
          arrastresStore.createIndex('ejercicioOrigen-tipo', ['ejercicioOrigen', 'tipo'], { unique: false });
        }

        // V2.7: Snapshots de Declaración store (frozen IRPF declaration data)
        if (!db.objectStoreNames.contains('snapshotsDeclaracion')) {
          const snapshotsStore = db.createObjectStore('snapshotsDeclaracion', { keyPath: 'id', autoIncrement: true });
          snapshotsStore.createIndex('ejercicio', 'ejercicio', { unique: false });
          snapshotsStore.createIndex('origen', 'origen', { unique: false });
          snapshotsStore.createIndex('fechaSnapshot', 'fechaSnapshot', { unique: false });
        }


        // V2.8: Allow multiple snapshots per ejercicio (force snapshots)
        if (db.objectStoreNames.contains('snapshotsDeclaracion')) {
          const snapshotsStore = transaction.objectStore('snapshotsDeclaracion');
          if (snapshotsStore.indexNames.contains('ejercicio')) {
            snapshotsStore.deleteIndex('ejercicio');
          }
          snapshotsStore.createIndex('ejercicio', 'ejercicio', { unique: false });
        }
      },
      blocked() {
        console.warn('Database upgrade blocked by another connection');
      },
      blocking() {
        console.warn('This connection is blocking a database upgrade');
      },
      terminated() {
        console.warn('Database connection was terminated');
        dbPromise = null!; // Reset promise to allow reconnection
      }
    }).catch(error => {
      console.error('Database initialization failed:', error);
      dbPromise = null!; // Reset promise to allow retry
      throw error;
    });
  }
  return dbPromise;
};

// Blob storage and download utilities (H0.4 requirement)
export const getDocumentBlob = async (id: number): Promise<Blob | null> => {
  try {
    const db = await initDB();
    const doc = await db.get('documents', id);
    return doc?.content || null;
  } catch (error) {
    console.error('Error retrieving document blob:', error);
    return null;
  }
};

export const downloadBlob = (blob: Blob, filename: string): void => {
  try {
    // For iOS/Safari compatibility, try dataURL method first for smaller files
    const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    
    if (isIOSSafari && blob.size < 50 * 1024 * 1024) { // < 50MB for iOS Safari
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };
      reader.readAsDataURL(blob);
    } else {
      // Standard blob URL method for other browsers
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error('Error downloading file:', error);
    throw new Error('No se pudo descargar el archivo');
  }
};

export const saveDocumentWithBlob = async (document: Omit<Document, 'id'> & { id?: number }): Promise<number> => {
  try {
    const db = await initDB();
    
    // Ensure proper type detection for ZIP files
    if (!document.type || document.type === '') {
      const filename = document.filename.toLowerCase();
      if (filename.endsWith('.zip')) {
        document.type = 'application/zip';
      } else {
        document.type = 'application/octet-stream';
      }
    }
    
    // Add metadata for blob storage
    const docWithMetadata = {
      ...document,
      metadata: {
        ...document.metadata,
        createdAt: new Date().toISOString(),
        blobStored: true,
      }
    };
    
    if (document.id) {
      await db.put('documents', docWithMetadata as Document);
      return document.id;
    } else {
      const id = await db.add('documents', docWithMetadata);
      return id as number;
    }
  } catch (error) {
    console.error('Error saving document with blob:', error);
    throw new Error('No se pudo guardar el documento');
  }
};

export const deleteDocumentAndBlob = async (id: number): Promise<void> => {
  try {
    const db = await initDB();
    await db.delete('documents', id);
    // The blob is automatically deleted with the document record
  } catch (error) {
    console.error('Error deleting document and blob:', error);
    throw new Error('No se pudo eliminar el documento');
  }
};

// Enhanced Export & Import snapshot functions with ZIP support (H1 requirement)
export const exportSnapshot = async (): Promise<void> => {
  try {
    const db = await initDB();
    
    // Get all data from the database
    const [properties, documents, contracts, expenses] = await Promise.all([
      db.getAll('properties'),
      db.getAll('documents'),
      db.getAll('contracts'),
      db.getAll('expenses'),
    ]);

    // Dynamic import of JSZip to reduce main bundle size
    const JSZip = (await import('jszip')).default;
    
    // Create a new ZIP file
    const zip = new JSZip();
    
    // Create the main data JSON
    const dataObj = {
      properties,
      contracts,
      expenses,
      documents: documents.map(doc => ({
        ...doc,
        content: null, // We'll store files separately
      })),
      metadata: {
        exportDate: new Date().toISOString(),
        version: '1.0',
        app: 'ATLAS-Horizon-Pulse'
      }
    };
    
    // Add the main data file
    zip.file('atlas-data.json', JSON.stringify(dataObj, null, 2));
    
    // Add document files to a documents folder
    const documentsFolder = zip.folder('documents');
    if (documentsFolder) {
      for (const doc of documents) {
        if (doc.content && doc.content instanceof Blob) {
          // Use document ID as filename to avoid conflicts, keep original extension
          const extension = doc.filename.split('.').pop() || 'bin';
          const safeFilename = `${doc.id}.${extension}`;
          documentsFolder.file(safeFilename, doc.content);
          
          // Also create a mapping file for filename reference
          documentsFolder.file(`${doc.id}.meta.json`, JSON.stringify({
            originalFilename: doc.filename,
            type: doc.type,
            uploadDate: doc.uploadDate,
            metadata: doc.metadata
          }, null, 2));
        }
      }
    }
    
    // Generate the ZIP file
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    
    // Create filename with current date and time
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').split('T');
    const dateStr = timestamp[0].replace(/-/g, '');
    const timeStr = timestamp[1].split('-')[0].replace(/-/g, '');
    const filename = `ATLAS-snapshot-${dateStr}-${timeStr}.zip`;
    
    // Download the ZIP file
    downloadBlob(zipBlob, filename);
    
  } catch (error) {
    console.error('Error exporting snapshot:', error);
    throw new Error('No se pudo exportar el snapshot');
  }
};

export const importSnapshot = async (file: File, mode: 'replace' | 'merge' = 'replace'): Promise<void> => {
  try {
    const db = await initDB();
    
    // Dynamic import of JSZip to reduce main bundle size
    const JSZip = (await import('jszip')).default;
    
    // Read the ZIP file
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(file);
    
    // Get the main data file
    const dataFile = zipContent.file('atlas-data.json');
    if (!dataFile) {
      throw new Error('Archivo de snapshot inválido: no se encontró atlas-data.json');
    }
    
    const dataJson = await dataFile.async('text');
    const data = JSON.parse(dataJson);
    
    // Validate the data structure
    if (!data.properties || !data.documents || !data.contracts || !data.expenses) {
      throw new Error('Archivo de snapshot inválido: estructura de datos incorrecta');
    }
    
    // Start transaction
    const tx = db.transaction(['properties', 'documents', 'contracts', 'expenses'], 'readwrite');
    
    // Clear existing data if replace mode
    if (mode === 'replace') {
      await Promise.all([
        tx.objectStore('properties').clear(),
        tx.objectStore('documents').clear(),
        tx.objectStore('contracts').clear(),
        tx.objectStore('expenses').clear(),
      ]);
    }
    
    // Import properties
    for (const property of data.properties) {
      if (mode === 'merge' && property.id) {
        await tx.objectStore('properties').put(property);
      } else {
        const { id, ...propertyWithoutId } = property;
        await tx.objectStore('properties').add(propertyWithoutId);
      }
    }
    
    // Import contracts
    for (const contract of data.contracts) {
      if (mode === 'merge' && contract.id) {
        await tx.objectStore('contracts').put(contract);
      } else {
        const { id, ...contractWithoutId } = contract;
        await tx.objectStore('contracts').add(contractWithoutId);
      }
    }
    
    // Import expenses
    for (const expense of data.expenses) {
      if (mode === 'merge' && expense.id) {
        await tx.objectStore('expenses').put(expense);
      } else {
        const { id, ...expenseWithoutId } = expense;
        await tx.objectStore('expenses').add(expenseWithoutId);
      }
    }
    
    // Import documents with their files
    const documentsFolder = zipContent.folder('documents');
    for (const document of data.documents) {
      let documentBlob: Blob | null = null;
      
      if (documentsFolder && document.id) {
        // Try to find the document file
        const extension = document.filename.split('.').pop() || 'bin';
        const documentFile = documentsFolder.file(`${document.id}.${extension}`);
        
        if (documentFile) {
          // Reconstruct the blob from the ZIP
          const fileData = await documentFile.async('blob');
          documentBlob = new Blob([fileData], { type: document.type });
        }
      }
      
      const docToImport = {
        ...document,
        content: documentBlob || new Blob([''], { type: 'text/plain' })
      };
      
      if (mode === 'merge' && document.id) {
        await tx.objectStore('documents').put(docToImport);
      } else {
        const { id, ...docWithoutId } = docToImport;
        await tx.objectStore('documents').add(docWithoutId);
      }
    }
    
    await tx.done;
    
  } catch (error) {
    console.error('Error importing snapshot:', error);
    throw new Error('No se pudo importar el snapshot: ' + (error instanceof Error ? error.message : 'Error desconocido'));
  }
};

// Enhanced performance-optimized database cleanup
export const resetAllData = async (): Promise<void> => {
  try {
    const db = await initDB();
    
    // Get all existing object stores from the database
    const storeNames = Array.from(db.objectStoreNames);
    console.log(`[RESET] Clearing ${storeNames.length} object stores:`, storeNames);
    
    // Performance optimization: Process stores in batches to avoid overwhelming the browser
    const BATCH_SIZE = 8; // Process 8 stores at a time
    const batches = [];
    for (let i = 0; i < storeNames.length; i += BATCH_SIZE) {
      batches.push(storeNames.slice(i, i + BATCH_SIZE));
    }
    
    // Clear stores in batches for better performance
    for (const batch of batches) {
      const tx = db.transaction(batch, 'readwrite');
      const clearPromises = batch.map(storeName => {
        console.log(`[RESET] Clearing store: ${storeName}`);
        return tx.objectStore(storeName).clear();
      });
      
      await Promise.all(clearPromises);
      await tx.done;
      
      // Small delay between batches to prevent blocking the UI
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    // Clear localStorage more efficiently
    const localStorageKeys = [
      'atlas-inbox-documents',
      'atlas-horizon-settings',
      'atlas-user-preferences',
      'classificationRules',
      'bankProfiles',
      'demo-mode',
      'atlas-kpi-configurations',
      'treasury-cache',
      'fiscal-cache'
    ];
    
    // Clear known keys first
    localStorageKeys.forEach(key => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        console.log(`[RESET] Cleared localStorage: ${key}`);
      }
    });
    
    // Performance optimization: Use a more efficient scan for remaining Atlas-related keys
    const allKeys = Object.keys(localStorage);
    const atlasKeys = allKeys.filter(key => {
      const lowerKey = key.toLowerCase();
      return lowerKey.includes('atlas') || 
             lowerKey.includes('horizon') || 
             lowerKey.includes('treasury') ||
             lowerKey.includes('demo');
    });
    
    atlasKeys.forEach(key => {
      localStorage.removeItem(key);
      console.log(`[RESET] Cleared additional localStorage: ${key}`);
    });
    
    // Clear IndexedDB caches and force garbage collection hint
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        const atlasCaches = cacheNames.filter(name => 
          name.toLowerCase().includes('atlas') ||
          name.toLowerCase().includes('horizon')
        );
        await Promise.all(atlasCaches.map(name => caches.delete(name)));
        console.log(`[RESET] Cleared ${atlasCaches.length} cache entries`);
      } catch (error) {
        console.warn('[RESET] Could not clear caches:', error);
      }
    }
    
    console.log('[RESET] Enhanced database and localStorage cleanup completed successfully');
    
  } catch (error) {
    console.error('Error resetting data:', error);
    throw new Error('No se pudo restablecer los datos completamente');
  }
};

// Performance-optimized bulk data operations
export const bulkClearStores = async (storeNames: string[]): Promise<void> => {
  const db = await initDB();
  const BATCH_SIZE = 5;
  
  for (let i = 0; i < storeNames.length; i += BATCH_SIZE) {
    const batch = storeNames.slice(i, i + BATCH_SIZE);
    const tx = db.transaction(batch, 'readwrite');
    
    await Promise.all(batch.map(storeName => 
      tx.objectStore(storeName).clear()
    ));
    
    await tx.done;
    // Micro-delay to prevent UI blocking
    await new Promise(resolve => setTimeout(resolve, 5));
  }
};
