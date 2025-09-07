import { openDB, IDBPDatabase } from 'idb';
import JSZip from 'jszip';
import { UtilityType, ReformBreakdown } from '../types/inboxTypes';

const DB_NAME = 'AtlasHorizonDB';
const DB_VERSION = 12; // H9: Added new budget system (Presupuesto/PresupuestoLinea) per specification

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

// H9-FISCAL: Property improvements for AEAT amortization
export interface PropertyImprovement {
  id?: number;
  propertyId: number;
  year: number; // año de la mejora
  amount: number; // importe de la mejora
  date?: string; // fecha opcional
  daysInYear?: number; // días de amortización del año (si la mejora es del propio año)
  providerNIF?: string; // NIF proveedor (opcional)
  description: string; // descripción de la mejora
  // Metadata
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
    proveedor?: string;
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

// H7: Enhanced Contract interface
export interface Contract {
  id?: number;
  propertyId: number;
  // Property scope
  scope: 'full-property' | 'units';
  selectedUnits?: string[]; // For multi-unit properties (e.g., ['H1', 'H2'])
  type: 'vivienda' | 'habitacion';
  
  // Tenant information
  tenant: {
    name: string;
    nif?: string;
    email?: string;
  };
  
  // Contract dates
  startDate: string;
  endDate?: string; // Optional for indefinite contracts
  isIndefinite: boolean;
  noticePeriodDays?: number;
  
  // Financial terms
  monthlyRent: number;
  paymentDay: number; // 1-31
  periodicity: 'monthly'; // Only monthly for now
  
  // Rent updates
  rentUpdate: {
    type: 'none' | 'fixed-percentage' | 'ipc';
    fixedPercentage?: number; // For fixed percentage updates
    ipcPercentage?: number; // Manual IPC percentage
  };
  
  // Deposit and guarantees
  deposit: {
    months: number;
    amount: number; // Calculated but editable
  };
  additionalGuarantees?: number;
  
  // Services (informational checkboxes)
  includedServices: {
    electricity?: boolean;
    water?: boolean;
    gas?: boolean;
    internet?: boolean;
    cleaning?: boolean;
    [key: string]: boolean | undefined;
  };
  
  // Notes and status
  privateNotes?: string;
  status: 'active' | 'upcoming' | 'terminated';
  
  // Documents
  documents: number[];
  
  // Metadata
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
  provider: string;
  providerNIF?: string;
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
  provider: string;
  providerNIF?: string;
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
  createdAt: string;
  updatedAt: string;
}

// H8: Treasury Account types
export type AccountDestination = 'horizon' | 'pulse';

// H-HOTFIX: Account usage scope for reconciliation preferences
export type AccountUsageScope = 'personal' | 'inmuebles' | 'mixto';

export interface Account {
  id?: number;
  name: string; // Will serve as 'alias' in the requirements
  bank: string;
  iban?: string;
  destination: AccountDestination;
  balance: number;
  openingBalance: number;
  openingBalanceDate?: string; // New field for treasury_accounts requirement
  includeInConsolidated?: boolean; // New field for treasury_accounts requirement
  currency: string;
  isActive: boolean;
  minimumBalance?: number; // H9: For treasury alerts
  isAtRisk?: boolean; // H9: Treasury events - risk flag when projected balance < minimum
  // H-HOTFIX: Usage scope for reconciliation prioritization
  usage_scope?: AccountUsageScope; // Default: 'mixto'
  logo_url?: string; // Logo image URL (JPG/PNG, max 512KB)
  createdAt: string;
  updatedAt: string;
}

// H8: Movement types - enhanced to match treasury_transactions requirements
export type MovementStatus = 'pendiente' | 'parcial' | 'conciliado' | 'no-documentado';
export type TransactionState = 'pending' | 'reconciled' | 'ignored'; // New field for treasury_transactions

// H10: Treasury reconciliation status
export type ReconciliationStatus = 'sin_conciliar' | 'conciliado';

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
  // Treasury_transactions specific fields
  state?: TransactionState; // 'pending'|'reconciled'|'ignored'
  sourceBank?: string; // source_bank field
  currency?: string; // currency field  
  balance?: number; // balance field (different from saldo)
  
  // FIX-EXTRACTOS: REMOVED rawRow to comply with privacy requirements
  // rawRow?: any; // REMOVED - never store original file data
  
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
  createdAt: string;
  updatedAt: string;
}

// H9: Treasury Forecast Events
export interface TreasuryEvent {
  id?: number;
  type: 'income' | 'expense';
  amount: number;
  predictedDate: string;
  description: string;
  // Source tracking
  sourceType: 'document' | 'contract' | 'manual';
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
  // Metadata
  createdAt: string;
  updatedAt: string;
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

// H10: Treasury Ingreso (Income) types
export type IngresoOrigen = 'contrato_id' | 'nomina_id' | 'doc_id';
export type IngresoDestino = 'personal' | 'inmueble_id';
export type IngresoEstado = 'previsto' | 'cobrado' | 'incompleto';

export interface Ingreso {
  id?: number;
  origen: IngresoOrigen;
  origen_id?: number; // ID del contrato, nómina o documento
  proveedor_contraparte: string;
  fecha_emision: string;
  fecha_prevista_cobro: string;
  importe: number;
  moneda: 'EUR' | 'USD' | 'GBP';
  destino: IngresoDestino;
  destino_id?: number; // ID del inmueble si aplica
  estado: IngresoEstado;
  movement_id?: number; // Link to reconciled movement
  from_doc?: boolean; // Flag for exceptional income from documents
  createdAt: string;
  updatedAt: string;
}

// H10: Treasury Gasto (Expense) types  
export type GastoEstado = 'completo' | 'incompleto' | 'pagado';
export type GastoDestino = 'personal' | 'inmueble_id';

export interface Gasto {
  id?: number;
  proveedor_nombre: string;
  proveedor_nif?: string;
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
  proveedor: string;
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
  box0105: number; // Interests/financing
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
  providerName?: string;               // Proveedor: "Endesa", opcional
  accountId?: UUID;                    // Cuenta de cargo/abono (obligatorio antes de guardar)
  sourceRef?: UUID;                    // ID de Contrato, Préstamo, etc. (opcional)
  // Importes mensuales - Array de 12 posiciones para ENE...DIC
  amountByMonth: number[];             // Importes mensuales [12]
  note?: string;                       // Nota opcional
  // Campos de compatibilidad (mantener por ahora)
  tipo?: TipoLinea;                    // DEPRECATED: usar type
  categoria?: CategoriaGasto | CategoriaIngreso; // DEPRECATED: usar category
  tipoConcepto?: string;               // DEPRECATED: usar label
  proveedor?: string;                  // DEPRECATED: usar providerName
  proveedorNif?: string;               // DEPRECATED
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

interface AtlasHorizonDB {
  properties: Property;
  documents: Document;
  contracts: Contract;
  rentCalendar: RentCalendar; // H7: Rent calendar entries
  rentPayments: RentPayment; // H7: Rent payment tracking
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
  keyval: any; // General key-value store for application configuration
}

let dbPromise: Promise<IDBPDatabase<AtlasHorizonDB>>;

export const initDB = async () => {
  if (!dbPromise) {
    dbPromise = openDB<AtlasHorizonDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Properties store
        if (!db.objectStoreNames.contains('properties')) {
          const propertyStore = db.createObjectStore('properties', { keyPath: 'id', autoIncrement: true });
          propertyStore.createIndex('alias', 'alias', { unique: false });
          propertyStore.createIndex('address', 'address', { unique: false });
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

        // General key-value store for application configuration
        if (!db.objectStoreNames.contains('keyval')) {
          db.createObjectStore('keyval');
        }
      }
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

export const resetAllData = async (): Promise<void> => {
  try {
    const db = await initDB();
    
    // Start transaction to clear all stores
    const tx = db.transaction(['properties', 'documents', 'contracts', 'rentCalendar', 'rentPayments', 'expenses'], 'readwrite');
    
    await Promise.all([
      tx.objectStore('properties').clear(),
      tx.objectStore('documents').clear(),
      tx.objectStore('contracts').clear(),
      tx.objectStore('rentCalendar').clear(),
      tx.objectStore('rentPayments').clear(),
      tx.objectStore('expenses').clear(),
    ]);
    
    await tx.done;
    
    // Also clear localStorage backup
    localStorage.removeItem('atlas-inbox-documents');
    
  } catch (error) {
    console.error('Error resetting data:', error);
    throw new Error('No se pudo restablecer los datos');
  }
};