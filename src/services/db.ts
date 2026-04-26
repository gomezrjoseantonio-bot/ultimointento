import { openDB, IDBPDatabase } from 'idb';
import type { DBSchema, IDBPObjectStore, IndexNames, StoreNames } from 'idb';
import type { DeclaracionCompleta } from '../types/declaracionCompleta';
import { PosicionInversion } from '../types/inversiones';
import type {
  PersonalData,
  PersonalModuleConfig,
  Nomina,
  Autonomo,
  PlanPensionInversion,
  OtrosIngresos,
  PensionIngreso,
  TraspasoPlan,
  Ingreso as IngresoPersonal
} from '../types/personal';
import type { CompromisoRecurrente } from '../types/compromisosRecurrentes';
import type { ViviendaHabitual } from '../types/viviendaHabitual';
import type { Escenario, Objetivo, FondoAhorro, Reto } from '../types/miPlan';
import type {
  ArrastresEjercicio,
  DeclaracionInmueble,
  DeclaracionIRPF,
  DocumentoFiscal,
  OrigenDeclaracion,
} from '../types/fiscal';

const DB_NAME = 'AtlasHorizonDB';
const DB_VERSION = 63; // V63 (TAREA 7 sub-tarea 4 + 4-bis): eliminar 8 stores huérfanos fusionados · nominas (deuda sub-tarea 2 · datos ya en ingresos.tipo='nomina') · autonomos→ingresos.tipo='autonomo' · pensiones→ingresos.tipo='pension' · otrosIngresos→ingresos.tipo='otro' (+metadata.otro) · arrastresManual→arrastresIRPF.origen='manual' · documentosFiscales→documents.metadata.tipo='fiscal' · loan_settlements→prestamos.liquidacion · matchingConfiguration→keyval['matchingConfig'] · V62 (sub-tarea 3): eliminar 11 stores duplicados/fósiles V1 · V61 (sub-tarea 2): rename `nominas → ingresos` · V60 (sub-tarea 1): schema extensions.

function ensureIndex<
  DBTypes extends DBSchema | unknown,
  TxStores extends ArrayLike<StoreNames<DBTypes>>,
  StoreName extends StoreNames<DBTypes>,
>(
  store: IDBPObjectStore<DBTypes, TxStores, StoreName, 'versionchange'>,
  indexName: string,
  keyPath: string | string[],
  options: IDBIndexParameters = { unique: false },
): void {
  const typedIndexName = indexName as IndexNames<DBTypes, StoreName>;

  if (store.indexNames.contains(typedIndexName)) {
    return;
  }

  try {
    store.createIndex(typedIndexName, keyPath, options);
  } catch (error) {
    if ((error as DOMException)?.name === 'ConstraintError' && options.unique) {
      console.warn(`[DB] Índice único '${indexName}' degradado a no único por datos legacy duplicados.`);
      store.createIndex(typedIndexName, keyPath, { ...options, unique: false });
      return;
    }

    throw error;
  }
}

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
  porcentajePropiedad?: number;
  esUrbana?: boolean;
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
    cadastralRevised?: boolean; // catastralRevisado AEAT
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
    
    // Amortization base data from AEAT declaration
    baseAmortizacion?: number; // base amortizable (importe adquisición + gastos + mejoras)
    mejorasAnteriores?: number; // mejoras realizadas en ejercicios anteriores
    amortizacionAnualInmueble?: number; // amortización anual del inmueble calculada por AEAT

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
  source: 'cartera' | 'detalle' | 'analisis' | 'wizard';
  notes?: string;
  createdAt: string;
  updatedAt: string;

  // Snapshot fiscal congelado en el momento de la venta.
  // Presente para ventas confirmadas desde el wizard; ausente en ventas
  // anteriores al PR2 (FichaTab muestra "—" si falta).
  fiscalSnapshot?: {
    precioAdquisicion: number;
    gastosAdquisicion: number;
    mejorasCapexAcumuladas: number;
    amortizacionAcumuladaDeclarada: number;
    amortizacionAcumuladaAtlas: number;
    costeFiscalAdquisicion: number;

    gastosVenta: number;
    valorNetoTransmision: number;

    gananciaPatrimonial: number;
    irpfEstimado: number;

    anosDeclaradosXml: number[];
    anosCalculadosAtlas: number[];
    calculatedAt: string;
  };
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


export interface OperacionFiscal {
  id?: number;
  ejercicio: number;
  fecha: string;
  concepto: string;
  casillaAEAT: AEATBox;
  categoriaFiscal: AEATFiscalType;
  base?: number;
  iva?: number;
  total: number;
  inmuebleId: number;
  inmuebleAlias?: string;
  proveedorNIF: string;
  proveedorNombre?: string;
  documentId?: number;
  movementId?: number | string;
  cuentaBancaria?: string;
  origen: 'manual' | 'recurrente' | 'documento' | 'movimiento' | 'migracion';
  origenId?: number | string;
  estado: 'previsto' | 'confirmado' | 'conciliado' | 'documentado' | 'completo';
  patas: number;
  createdAt: string;
  updatedAt: string;
}

export interface MejoraActivo {
  id?: number;
  inmuebleId: number;
  ejercicio: number;
  fecha?: string;
  descripcion: string;
  tipo: 'mejora' | 'ampliacion' | 'reparacion';
  importe: number;
  diasEnEjercicio?: number;
  proveedorNIF: string;
  proveedorNombre?: string;
  documentId?: number;
  movementId?: number | string;
  cuentaBancaria?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MobiliarioActivo {
  id?: number;
  inmuebleId: number;
  ejercicio: number;
  descripcion: string;
  fechaAlta: string;
  importe: number;
  vidaUtil: number;
  activo: boolean;
  fechaBaja?: string;
  proveedorNIF: string;
  proveedorNombre?: string;
  documentId?: number;
  movementId?: number | string;
  cuentaBancaria?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Nuevos tipos unificados para capa de gastos ──

export type GastoCategoria =
  'ibi' | 'comunidad' | 'seguro' | 'suministro' |
  'reparacion' | 'gestion' | 'servicio' | 'intereses' | 'otro';

export type GastoOrigen =
  'xml_aeat' | 'prestamo' | 'recurrente' | 'tesoreria' | 'manual';

export type GastoEstadoNuevo =
  'previsto' | 'confirmado' | 'declarado';

export interface GastoInmueble {
  id?: number;
  inmuebleId: number;
  ejercicio: number;
  fecha: string;
  concepto: string;
  categoria: GastoCategoria;
  casillaAEAT: AEATBox;
  importe: number;
  importeBruto?: number;
  origen: GastoOrigen;
  origenId?: string;
  estado: GastoEstadoNuevo;
  proveedorNombre?: string;
  proveedorNIF?: string;
  // PR5-HOTFIX v3: nº factura del proveedor (opcional, rellenable por OCR).
  invoiceNumber?: string;
  cuentaBancaria?: string;
  documentId?: number;
  movimientoId?: string;
  // PR5.5: estado respecto a la materialización en tesorería, independiente
  // del `estado` fiscal. Tras desconciliar, la línea se conserva pero pasa a
  // 'predicted'.
  estadoTesoreria?: 'predicted' | 'confirmed';
  treasuryEventId?: number;
  // PR5: documentación detallada (factura proveedor + justificante bancario)
  facturaId?: number;
  facturaNoAplica?: boolean;
  justificanteId?: number;
  justificanteNoAplica?: boolean;
  // PR5-HOTFIX v2: identificador canónico del catálogo + sub-tipo
  categoryKey?: string;
  subtypeKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MejoraInmueble {
  id?: number;
  inmuebleId: number;
  ejercicio: number;
  descripcion: string;
  tipo: 'mejora' | 'ampliacion' | 'reparacion';
  importe: number;
  fecha: string;
  proveedorNIF?: string;
  proveedorNombre?: string;
  // PR5-HOTFIX v3: nº factura del proveedor.
  invoiceNumber?: string;
  documentId?: number;
  movimientoId?: string;
  // PR5.5: estado tesorería
  estadoTesoreria?: 'predicted' | 'confirmed';
  treasuryEventId?: number;
  // PR5: documentación detallada
  facturaId?: number;
  facturaNoAplica?: boolean;
  justificanteId?: number;
  justificanteNoAplica?: boolean;
  // PR5-HOTFIX v2: identificador canónico del catálogo
  categoryKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MuebleInmueble {
  id?: number;
  inmuebleId: number;
  ejercicio: number;
  descripcion: string;
  fechaAlta: string;
  importe: number;
  vidaUtil: number;
  activo: boolean;
  fechaBaja?: string;
  proveedorNIF?: string;
  proveedorNombre?: string;
  // PR5-HOTFIX v3: nº factura del proveedor.
  invoiceNumber?: string;
  documentId?: number;
  movimientoId?: string;
  // PR5.5: estado tesorería
  estadoTesoreria?: 'predicted' | 'confirmed';
  treasuryEventId?: number;
  // PR5: documentación detallada
  facturaId?: number;
  facturaNoAplica?: boolean;
  justificanteId?: number;
  justificanteNoAplica?: boolean;
  // PR5-HOTFIX v2: identificador canónico del catálogo
  categoryKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Proveedor {
  nif: string;
  nombre?: string;
  tipos: string[];
  createdAt: string;
  updatedAt: string;
}

export interface OperacionProveedor {
  id?: number;
  proveedorNif: string;
  inmuebleId: number;
  ejercicio: number;
  tipo: 'mejora' | 'reparacion' | 'gestion' | 'servicios';
  importe: number;
  documentId?: number;
  createdAt: string;
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
    /**
     * Clasificación de documento.
     *
     * V60 (TAREA 7 sub-tarea 1): se amplía la unión para añadir el set
     * normalizado coarse 'fiscal' | 'contrato' | 'bancario' | 'otro' que
     * será el destino de la eliminación de `documentosFiscales` en
     * sub-tarea 4 (un documento fiscal pasa a `documents` con
     * `metadata.tipo='fiscal'`). El set capitalizado original
     * ('Factura' | 'Contrato' | ...) se mantiene como valores válidos
     * para no romper consumidores existentes. La normalización completa
     * (decidir si fusionar ambos sets) se evaluará tras sub-tarea 4.
     */
    tipo?: 'Factura' | 'Contrato' | 'Mejora' | 'Extracto bancario' | 'Otros'
      | 'fiscal' | 'contrato' | 'bancario' | 'otro';
    categoria?: string;
    destino?: 'Personal' | 'Inmueble';
    status?: 'Nuevo' | 'Procesado' | 'Asignado' | 'Archivado' | 'pendiente_vinculacion' | 'pendiente_asignacion';
    notas?: string;
    carpeta?: 'todos' | 'facturas' | 'contratos' | 'extractos' | 'mejoras' | 'otros';
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
      isMejora?: boolean;
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
    ejercicio?: number;
    origen?: string;
    fechaImportacion?: string;
    casillasExtraidas?: number;
    metodoExtraccion?: 'texto' | 'ocr';
    // Pieza 8: Document → operation matching
    matchCandidates?: Array<{
      store: 'mejorasActivo' | 'mobiliarioActivo';
      id: number;
      inmuebleId: number;
      inmuebleAlias: string;
      tipo: string;
      ejercicio: number;
      importe: number;
      descripcion: string;
      proveedorNIF: string;
      proveedorNombre?: string;
      alreadyLinked: boolean;
      score: number;
    }>;
  };
  uploadDate: string;
}

// Historial fiscal por ejercicio para contratos
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
  estadoContrato: 'activo' | 'rescindido' | 'finalizado' | 'sin_identificar';

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
  // PR5-HOTFIX v3: campos estructurados de proveedor. `counterparty` se
  // mantiene por compatibilidad; los nuevos flujos escriben `providerName`.
  providerName?: string;
  providerNif?: string;
  invoiceNumber?: string;
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
    type: 'ingreso' | 'gasto' | 'mejora';
    id: number;
  }; // Link to Ingreso/Gasto/Mejora record
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

  // PR5: documentación asociada al movement (mismo esquema que TreasuryEvent)
  facturaId?: number;
  facturaNoAplica?: boolean;
  justificanteId?: number;
  justificanteNoAplica?: boolean;

  // PR5-HOTFIX v2: categoría canónica + sub-tipo + metadatos de traspaso
  // (mismo esquema que TreasuryEvent para propagación 1:1).
  categoryKey?: string;
  subtypeKey?: string;
  transferMetadata?: {
    targetAccountId: number;
    pairEventId?: number;
    esAmortizacionParcial?: boolean;
  };

  createdAt: string;
  updatedAt: string;
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
  // GAP-3: Clasificación histórica
  año?: number;                          // Ejercicio fiscal del evento
  mes?: number;                          // Mes (1-12) si el dato es mensual
  certeza?: 'declarado' | 'calculado' | 'atlas_nativo' | 'estimado' | 'manual';
  fuenteHistorica?: 'xml_aeat' | 'pdf_aeat' | 'print_aeat' | 'atlas_nativo' | 'manual';
  ejercicioFiscalOrigen?: number;        // Año de la declaración de la que viene
  generadoPor?: 'historicalTreasuryService' | 'treasurySyncService' | 'user';
  actualizadoPorDeclaracion?: boolean;   // true si fue ajustado al importar XML
  // GAP-3: Vinculación adicional
  inmuebleId?: number;
  contratoId?: number;
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
  // PR3: unified treasury architecture — ámbito + categoría
  ambito?: 'PERSONAL' | 'INMUEBLE';
  categoryLabel?: string;         // e.g. "Reparación inmueble" | "Mejora inmueble" | "Mobiliario inmueble" | "Gasto recurrente" | etc.
  // PR5-HOTFIX v2: identificador canónico del catálogo de categorías
  // (src/services/categoryCatalog.ts). Reemplaza el uso ambiguo de
  // `categoryLabel` en toda la UI nueva. `categoryLabel` se mantiene por
  // compatibilidad con datos previos.
  categoryKey?: string;
  // Sub-tipo para categorías con variantes (p. ej. Suministro → luz/agua/gas/internet).
  subtypeKey?: string;
  // PR5-HOTFIX v2: metadatos de traspaso entre cuentas propias (dos events
  // espejo ligados por `pairEventId`; `targetAccountId` identifica la otra cuenta).
  transferMetadata?: {
    targetAccountId: number;
    pairEventId?: number;
    esAmortizacionParcial?: boolean;
  };
  counterparty?: string;          // NIF proveedor / pagador (legacy)
  // PR5-HOTFIX v3: proveedor estructurado en 3 campos (se rellenan con OCR).
  providerName?: string;
  providerNif?: string;
  invoiceNumber?: string;
  notes?: string;
  // PR3: tras puntear ("executed"), apunta al movement generado
  executedMovementId?: number;
  executedAt?: string;
  // PR5: documentación asociada al evento
  facturaId?: number;              // documentId del Inbox (factura / recibo del proveedor)
  facturaNoAplica?: boolean;
  justificanteId?: number;         // documentId del Inbox (justificante bancario / cargo)
  justificanteNoAplica?: boolean;
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
  /**
   * V60 (TAREA 7 sub-tarea 1): historial de aplicaciones de la regla,
   * absorbido del store eliminado `learningLogs` (sub-tarea 5). Cap de
   * 50 entradas por regla en orden FIFO (las más antiguas se descartan
   * cuando se inserta la entrada 51+). Mantenido sin PII (no se guarda
   * descripción real del movimiento, sólo metadatos de la acción).
   */
  history?: HistoryEntry[];
}

/**
 * V60 (TAREA 7 sub-tarea 1): entrada de historial para
 * `MovementLearningRule.history[]`. Una por aplicación / creación / backfill
 * de la regla. Sin PII.
 */
export interface HistoryEntry {
  action: 'CREATE_RULE' | 'APPLY_RULE' | 'BACKFILL';
  movimientoId?: number;
  ts: string; // ISO timestamp
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

export type EstadoEjercicio = 'vivo' | 'en_curso' | 'pendiente_cierre' | 'cerrado' | 'declarado' | 'prescrito';
export type OrigenEjercicio = 'calculado' | 'importado' | 'mixto';

export interface EjercicioFiscal {
  año?: number;                   // compat legacy
  ejercicio: number;              // modelo fundacional
  estado: EstadoEjercicio;        // vivo/en_curso → cerrado → declarado
  origen?: OrigenEjercicio;       // de dónde vienen los datos
  fechaCierre?: string;           // ISO date when closed
  fechaRevisionFinal?: string;    // ISO date when final review was completed
  fechaDeclaracion?: string;      // ISO date when declared
  snapshotId?: number;            // FK → snapshotsDeclaracion.id
  resultadoEjercicioId?: number;  // FK → resultadosEjercicio.id (snapshot canónico)
  calculoAtlas?: DeclaracionIRPF;
  calculoAtlasFecha?: string;
  declaracionAeat?: DeclaracionIRPF;
  declaracionAeatFecha?: string;
  declaracionAeatPdfRef?: string;
  declaracionAeatOrigen?: OrigenDeclaracion;

  // GAP-3: Validación al comparar calculoAtlas con declaracionAeat
  validacionDeclaracion?: {
    fechaValidacion: string;
    diferenciaIngresos: number;        // declarado - atlas
    diferenciaGastos: number;
    diferenciaCuota: number;
    hayDiferencias: boolean;
    decisionUsuario: 'actualizar' | 'mantener' | 'revision_parcial' | 'pendiente';
    fechaDecision?: string;
    // SIN campo motivo — ATLAS no pregunta el por qué
  };

  // GAP-3: Metadatos del cierre ATLAS
  cierreAtlasMetadata?: {
    fechaCierre: string;
    fuenteDatos: ('xml_aeat' | 'pdf_aeat' | 'print_aeat' | 'atlas_nativo' | 'manual')[];
    confirmadoPorUsuario: boolean;
    fechaConfirmacion?: string;
    gastosPersonalesEstimados: number;   // €/mes estimados
    gastosPersonalesAjustadosPorUsuario: boolean;
    totalIngresos: number;
    totalGastos: number;
    cashflowNeto: number;
  };

  casillasRaw?: Record<string, number | string>;
  arrastresRecibidos?: ArrastresEjercicio;
  arrastresGenerados?: ArrastresEjercicio;
  declaracionInmuebles?: DeclaracionInmueble[];
  cerradoAt?: string;
  declaradoAt?: string;
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

// V63 (TAREA 7 sub-tarea 4): el alias `DocumentoFiscalRecord` (que mapeaba
// a registros del store eliminado `documentosFiscales`) se ha retirado;
// los documentos fiscales viven ahora en el store `documents` con
// `metadata.tipo='fiscal'`.


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

export interface PerdidaPatrimonialAhorro {
  id?: number;
  ejercicioOrigen: number;
  ejercicioCaducidad: number;
  importeOriginal: number;
  importeAplicado: number;
  importePendiente: number;
  tipoOrigen: 'crypto' | 'inmueble' | 'importado' | 'manual' | 'mixto';
  estado: 'pendiente' | 'aplicado_parcial' | 'aplicado_total' | 'caducado';
  aplicaciones: Array<{
    ejercicioDestino: number;
    importe: number;
    fecha: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface ArrastreIRPF {
  id?: number;
  ejercicioOrigen: number;         // Año en que se generó
  tipo: TipoArrastre;
  importeOriginal: number;         // Importe generado
  importePendiente: number;        // Importe aún no aplicado
  ejercicioCaducidad?: number;     // Año en que caduca (undefined/missing = sin caducidad)
  inmuebleId?: number;             // FK → properties.id (si aplica, e.g. exceso 0105+0106)
  /**
   * V60 (TAREA 7): origen del arrastre.
   *  - 'aeat': importado de XML AEAT (default para registros V59 anteriores).
   *  - 'manual': introducido manualmente por el usuario (sustituye al store
   *    eliminado `arrastresManual` · ver sub-tarea 4).
   *  - 'calculado': generado por motor de cálculo (futuro).
   *
   * Backfill V60: registros pre-V60 reciben `origen='aeat'` durante la
   * migración. Campo opcional en TS para tolerar lecturas legacy en
   * código de migración.
   */
  origen?: 'manual' | 'aeat' | 'calculado';
  aplicaciones: {                  // Historial FIFO de consumos
    ejercicio: number;
    importe: number;
    fecha: string;                 // ISO date
  }[];
  estado: 'pendiente' | 'aplicado_parcial' | 'aplicado_total' | 'caducado';
  createdAt: string;
  updatedAt: string;
}

export interface EntidadEjercicio {
  ejercicio: number;
  rendimientosAtribuidos: number;
  retencionesAtribuidas: number;
  ingresosIntegros?: number;
  gastosDeducibles?: number;
  amortizacion?: number;
}

export interface EntidadAtribucionRentas {
  id?: number;
  nif: string;
  nombre: string;
  tipoEntidad: 'CB' | 'SC' | 'HY' | 'otra';
  porcentajeParticipacion: number;
  tipoRenta: 'capital_inmobiliario' | 'actividad_economica' | 'capital_mobiliario';
  ejercicios: EntidadEjercicio[];
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
    declaracionCompleta?: any;     // Snapshot completo de DeclaracionIRPF importada/cerrada
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

// H10: Mejora interface — DELETED in cleanup V4.3 (replaced by mejorasInmueble)

// H9: Fiscal Summary by Property and Year
export interface FiscalSummary {
  id?: number;
  propertyId: number;
  exerciseYear: number;
  // Ingresos (casilla 0102 AEAT)
  box0102?: number;           // Rendimiento íntegro del inmueble
  rendimientoNeto?: number;   // Neto después de gastos y amortización
  reduccionVivienda?: number; // Reducción por vivienda habitual (60%, 50%, etc.)
  rendimientoNetoReducido?: number; // Neto después de reducción
  gastosPendientesGenerados?: number; // Excedente de gastos → arrastre
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
  box0129?: number; // Mejoras realizadas en el ejercicio
  box0130?: number; // Base de amortización del inmueble
  box0131?: number; // Amortización del inmueble
  mejorasTotal: number; // Construction value increase
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
  category: 'repair' | 'mejora' | 'furniture' | 'tax' | 'utility' | 'management' | 'other';
  isMejora: boolean;
  mejoraBreakdown?: {
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
  proveedorNIF?: string;
  proveedorNombre?: string;
  // PR5-HOTFIX v3 · nº de factura recurrente (opcional; útil si el proveedor
  // usa un número de cuenta/contrato fijo en cada factura).
  invoiceNumber?: string;
  activo: boolean;
  // PR5-HOTFIX v2: identificador canónico del catálogo de categorías
  // (src/services/categoryCatalog.ts). Cuando `categoryKey === 'suministro_inmueble'`
  // se acompaña de `subtypeKey` (luz/agua/gas/internet).
  categoryKey?: string;
  subtypeKey?: string;
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

// ═══════════════════════════════════════════════
// MODELO FISCAL COORDINADOR — 4 REGÍMENES
// ═══════════════════════════════════════════════

export interface EjercicioFiscalCoord {
  año: number;  // keyPath — 2020, 2021, ..., 2026

  estado: 'en_curso' | 'pendiente' | 'declarado' | 'prescrito';

  // Fecha de prescripción (calculada: 30 jun del año+5)
  fechaPrescripcion?: string;

  // Fuente AEAT (solo si declarado o prescrito)
  aeat?: {
    snapshot: Record<string, number>;   // casillas: { '0435': 112096.62, ... }
    resumen: ResumenFiscal;
    pdfDocumentId?: string;
    fechaImportacion: string;
    fuenteImportacion?: 'xml' | 'pdf' | 'manual';
    declaracionCompleta?: DeclaracionCompleta; // Snapshot completo de la declaración importada
  };

  // Cálculo ATLAS (para pendiente/en_curso; también para comparativa en declarado)
  atlas?: {
    snapshot: Record<string, number>;
    resumen: ResumenFiscal;
    fechaCalculo: string;
    hashInputs: string;  // cache key
  };

  // Arrastres ENTRANTES (de año-1 → este año)
  arrastresIn: ArrastresEjercicioCoord;

  // Arrastres SALIENTES (de este año → año+1)
  arrastresOut?: ArrastresOutEjercicioCoord;

  // Inmuebles con actividad fiscal en este ejercicio
  inmuebleIds: number[];

  createdAt: string;
  updatedAt: string;
}

export interface ResumenFiscal {
  baseImponibleGeneral: number;    // casilla 0435
  baseImponibleAhorro: number;     // casilla 0460
  baseLiquidableGeneral: number;   // casilla 0505
  baseLiquidableAhorro: number;    // casilla 0510
  cuotaIntegra: number;            // total cuota íntegra
  cuotaIntegraEstatal: number;     // casilla 0545
  cuotaIntegraAutonomica: number;  // casilla 0546
  cuotaLiquidaEstatal: number;     // casilla 0570
  cuotaLiquidaAutonomica: number;  // casilla 0571
  resultado: number;               // casilla 0695/0670, negativo = a devolver
}

export interface ArrastresEjercicioCoord {
  fuente: 'aeat' | 'atlas' | 'manual' | 'ninguno';
  gastosPendientes: ArrastreGasto[];
  perdidasPatrimoniales: ArrastrePerdida[];
  amortizacionesAcumuladas: AmortizacionAcumulada[];
  deduccionesPendientes: DeduccionPendiente[];
}

export interface ArrastresOutEjercicioCoord {
  fuente: 'aeat' | 'atlas';
  gastosPendientes: ArrastreGasto[];
  perdidasPatrimoniales: ArrastrePerdida[];
  amortizacionesAcumuladas: AmortizacionAcumulada[];
  deduccionesPendientes: DeduccionPendiente[];
}

export interface ArrastreGasto {
  inmuebleId: number;
  inmuebleAlias?: string;
  importePendiente: number;
  añoOrigen: number;
  // 0105/0106 = casilla de origen del gasto; 0108 = exceso que se arrastra
  // (C_INTGRCEF en XML AEAT) cuando los gastos > ingresos del inmueble.
  casilla: '0105' | '0106' | '0108';
}

export interface ArrastrePerdida {
  tipo: 'ahorro_general' | 'ahorro_renta_variable' | 'patrimonial';
  importePendiente: number;
  añoOrigen: number;
}

export interface AmortizacionAcumulada {
  inmuebleId: number;
  inmuebleAlias?: string;
  amortizacionAcumulada: number;
  baseAmortizacion: number;
}

export interface DeduccionPendiente {
  tipo: string;
  importePendiente: number;
  añoOrigen: number;
}

export interface VinculoAccesorio {
  id?: number;
  inmueblePrincipalId: number;
  inmuebleAccesorioId: number;
  ejercicio: number;
  fechaInicio: string;
  fechaFin?: string;
  estado: 'activo' | 'inactivo';
  origenCreacion: 'XML' | 'manual';
  createdAt: string;
  updatedAt: string;
}

interface AtlasHorizonDB {
  properties: Property;
  property_sales: PropertySale;
  // loan_settlements: ELIMINADO en V63 (sub-tarea 4) — destino prestamos.liquidacion · 0 registros en producción
  documents: Document;
  contracts: Contract;
  // NOTE: rentCalendar and rentPayments removed in V4.5 — migrated to rentaMensual
  // rentaMensual: ELIMINADO en V62 (sub-tarea 3) — deprecated V5.6 · 0 registros
  aeatCarryForwards: AEATCarryForward; // H5: Tax carryforwards
  propertyDays: PropertyDays; // H5: Rental/availability days
  propertyImprovements: PropertyImprovement; // H9-FISCAL: Property improvements for AEAT
  operacionesFiscales: OperacionFiscal; // Flujo fiscal unificado: operaciones deducibles por casilla
  proveedores: Proveedor; // V3.8: entidad única proveedor por NIF
  // operacionesProveedor: ELIMINADO en V62 (sub-tarea 3) — cache desnormalizada de gastosInmueble + proveedores · 15 registros
  // kpiConfigurations: ELIMINADO en V62 (sub-tarea 3) — sustituido por keyval['kpiConfig_*'] · 0 registros
  accounts: Account; // H8: Treasury accounts
  movements: Movement; // H8: Bank movements
  importBatches: ImportBatch; // H8: CSV import tracking
  treasuryEvents: TreasuryEvent; // H9: Treasury forecasting
  // treasuryRecommendations: ELIMINADO en V62 (sub-tarea 3) — derivable runtime · 0 registros
  fiscalSummaries: FiscalSummary; // H9: Fiscal summaries by property/year
  gastos: Gasto; // H10: Treasury expense records
  presupuestos: Presupuesto; // H9: New budget system per specification
  presupuestoLineas: PresupuestoLinea; // H9: New budget lines per specification
  // matchingConfiguration: ELIMINADO en V63 (sub-tarea 4) — destino keyval['matchingConfig'] · 0 registros en producción
  reconciliationAuditLogs: ReconciliationAuditLog; // V1.1: Audit logs for reconciliation actions
  movementLearningRules: MovementLearningRule; // V1.1: Learning rules for automatic classification
  learningLogs: LearningLog; // V1.1: Learning audit log without PII
  inversiones: PosicionInversion; // V1.3: Investment positions
  // patrimonioSnapshots: ELIMINADO en V62 (sub-tarea 3) — derivable de valoraciones_historicas · 1 registro
  personalData: PersonalData; // V1.2: Personal data
  personalModuleConfig: PersonalModuleConfig; // V1.2: Personal module configuration
  // nominas: ELIMINADO en V63 (sub-tarea 4 · deuda sub-tarea 2) — datos ya copiados a `ingresos` con tipo='nomina' en V61
  /**
   * V61 (TAREA 7 sub-tarea 2): nuevo store unificado de ingresos personales.
   *
   * Unifica `nominas`, `autonomos` y `pensiones` bajo una unión discriminada
   * por `tipo`. La migración V60→V61 copia los registros de `nominas` (con
   * `tipo='nomina'`) preservando id. V63 (sub-tarea 4) absorbe `autonomos`
   * (con `tipo='autonomo'`) y `pensiones` (con `tipo='pension'`)
   * reasignando ids vía autoincrement (los stores legacy se eliminan tras
   * la copia, incluyendo `nominas` cuyo borrado quedó pendiente desde
   * sub-tarea 2).
   *
   * Índices: `personalDataId`, `tipo`, `fechaActualizacion`.
   *
   * Nota TS: en este módulo se importa con alias `IngresoPersonal` para no
   * colisionar con la interfaz local `Ingreso` (H10 · Treasury income).
   */
  ingresos: IngresoPersonal;
  // autonomos: ELIMINADO en V63 (sub-tarea 4) — destino ingresos.tipo='autonomo'
  planesPensionInversion: PlanPensionInversion; // V1.2: Pension and investment plans
  traspasosPlanes: TraspasoPlan; // V5.2: Traspasos entre planes de pensiones
  // otrosIngresos: ELIMINADO en V63 (sub-tarea 4-bis) — destino ingresos.tipo='otro' (+metadata.otro)
  // pensiones: ELIMINADO en V63 (sub-tarea 4) — destino ingresos.tipo='pension'
  // patronGastosPersonales: ELIMINADO en V62 (sub-tarea 3) — futuro compromisosRecurrentes · 7 registros
  // gastosPersonalesReal: ELIMINADO en V62 (sub-tarea 3) — futuro movements + treasuryEvents · 0 registros
  prestamos: any; // Financiacion: Loan records · V63 (sub-tarea 4): campo `liquidacion` absorbe los settlements del store eliminado `loan_settlements`.
  /**
   * Monthly valuation: Historical valuations per asset.
   *
   * V60 (TAREA 7 sub-tarea 1): este store absorbe las consultas mensuales
   * que antes requerían el store separado `valoraciones_mensuales`
   * (eliminado en sub-tarea 3). Para listar valoraciones de un mes
   * concreto, usar el índice compuesto existente `tipo-activo-fecha`
   * combinado con `IDBKeyRange.bound` sobre `fecha_valoracion`
   * (`YYYY-MM-01` ≤ fecha ≤ `YYYY-MM-31`). Para snapshot mensual del
   * patrimonio total, agregar runtime sobre los registros del rango.
   */
  valoraciones_historicas: any;
  // valoraciones_mensuales: ELIMINADO en V62 (sub-tarea 3) — derivable de valoraciones_historicas · 115 registros
  /**
   * General key-value store for application configuration.
   *
   * V60 (TAREA 7 sub-tarea 1): claves estándar reservadas para destinos
   * de stores eliminados:
   *   - `'configFiscal'`           ← destino de `configuracion_fiscal`
   *                                  (eliminado en sub-tarea 3).
   *   - `'matchingConfig'`         ← destino de `matchingConfiguration`
   *                                  (eliminado en sub-tarea 4 · V63).
   *   - `'kpiConfig_horizon'`,
   *     `'kpiConfig_pulse'`        ← destino de `kpiConfigurations`
   *                                  (eliminado en sub-tarea 3, una clave
   *                                  por id de configuración previa).
   *
   * Resto de claves: `'feature_*'`, `'preferences_*'`, etc. (libres).
   */
  keyval: any;
  // ⚠ DEPRECATED (V5.4): objetivos_financieros fue migrado a 'escenarios' · el store fue eliminado en la migración V5.4
  // Se mantiene en la interfaz TypeScript únicamente para que el código de migración compile.
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
  }; // V3.2 → V5.5 MIGRATED to 'escenarios'
  // opexRules: ELIMINADO en V62 (sub-tarea 3) — ya migrado a compromisosRecurrentes en TAREA 2 · 0 registros
  // configuracion_fiscal: ELIMINADO en V62 (sub-tarea 3) — sin destino · defaults runtime · 1 registro
  // ejerciciosFiscales: ELIMINADO en V62 (sub-tarea 3) — sustituido por ejerciciosFiscalesCoord · 1 registro
  // documentosFiscales: ELIMINADO en V63 (sub-tarea 4) — destino documents.metadata.tipo='fiscal' · 0 registros en producción
  // arrastresManual: ELIMINADO en V63 (sub-tarea 4) — destino arrastresIRPF.origen='manual' · 0 registros en producción
  resultadosEjercicio: ResultadoEjercicio; // V2.9: Immutable yearly fiscal snapshots
  arrastresIRPF: ArrastreIRPF; // V2.7: IRPF carry-forwards cross-year
  perdidasPatrimonialesAhorro: PerdidaPatrimonialAhorro; // V3.4: pérdidas ahorro unificadas
  snapshotsDeclaracion: SnapshotDeclaracion; // V2.7: Frozen declaration snapshots
  entidadesAtribucion: EntidadAtribucionRentas; // V3.4: entidades en atribución de rentas
  ejerciciosFiscalesCoord: EjercicioFiscalCoord; // V3.7: Modelo fiscal coordinador (4 regímenes)
  vinculosAccesorio: VinculoAccesorio; // V3.9: Vínculos temporales accesorio (parking/trastero) por ejercicio
  // ─── ATLAS Personal v1.1 (V5.3) ────────────────────────────────────────
  compromisosRecurrentes: CompromisoRecurrente; // V5.3: catálogo universal de compromisos (unifica opexRules + personal · G-01)
  viviendaHabitual: ViviendaHabitual;           // V5.3: ficha vivienda habitual del hogar · genera derivados (sección 6)
  // ─── Mi Plan v3 (V5.4–V5.7) ─────────────────────────────────────────────
  escenarios: Escenario;     // V5.4: singleton escenario libertad activo (renombrado de objetivos_financieros)
  objetivos: Objetivo;       // V5.5: lista de objetivos (acumular · amortizar · comprar · reducir)
  fondos_ahorro: FondoAhorro; // V5.6: fondos de ahorro con etiquetas de propósito
  retos: Reto;               // V5.7: retos mensuales (1 activo por mes)
}
let dbPromise: Promise<IDBPDatabase<AtlasHorizonDB>>;

/**
 * Stash de datos del store viejo `objetivos_financieros` leídos ANTES del
 * upgrade a V59. Si la migración V5.9 elimina el store en el upgrade
 * callback, estos datos se usan POST-upgrade para mergear los KPI macro
 * en `escenarios` sin pérdida.
 */
let v59MergePayload: Record<string, unknown> | null = null;

/**
 * Pre-upgrade hook: si la DB está actualmente en una versión < 59 y aún
 * tiene `objetivos_financieros`, leemos su singleton y lo guardamos en
 * `v59MergePayload`. Esta lectura ocurre en una transacción readonly
 * normal antes de invocar `openDB(..., 59, ...)`, así que no compite con
 * la versionchange transaction.
 *
 * Si la DB no existe (deploy nuevo), salimos sin tocar nada — abrir
 * sin versión dispararía un upgrade implícito a v1 que entraría en
 * conflicto con el `openDB(..., 59, ...)` posterior.
 */
const stashOldObjetivosFinancieros = async (): Promise<void> => {
  if (typeof indexedDB === 'undefined') return;

  // Detectar si la DB existe usando indexedDB.databases() (Chrome/FF/Edge).
  // Si la API no está disponible, asumimos que existe y procedemos con el
  // open(); la lógica posterior maneja el caso "no había datos viejos".
  let dbExists = true;
  if (typeof (indexedDB as any).databases === 'function') {
    try {
      const list: Array<{ name?: string; version?: number }> =
        await (indexedDB as any).databases();
      dbExists = list.some((entry) => entry.name === DB_NAME);
    } catch {
      // Si databases() falla, asumimos que existe.
      dbExists = true;
    }
  }

  if (!dbExists) {
    return;
  }

  await new Promise<void>((resolve) => {
    let resolved = false;
    let triggeredUpgrade = false;
    const req = indexedDB.open(DB_NAME);

    const safeResolve = () => {
      if (resolved) return;
      resolved = true;
      resolve();
    };

    req.onsuccess = () => {
      if (resolved) return;
      const db = req.result;
      // Si entramos por upgrade implícito (DB recién creada), no leemos
      // nada y cerramos.
      if (triggeredUpgrade) {
        db.close();
        safeResolve();
        return;
      }
      const v = db.version;
      const hasOld = Array.from(db.objectStoreNames).includes('objetivos_financieros');
      if (hasOld && v < 59) {
        try {
          const tx = db.transaction(['objetivos_financieros'], 'readonly');
          const store = tx.objectStore('objetivos_financieros');
          const getReq = store.get(1);
          getReq.onsuccess = () => {
            v59MergePayload = (getReq.result as Record<string, unknown> | undefined) ?? null;
            db.close();
            safeResolve();
          };
          getReq.onerror = () => {
            db.close();
            safeResolve();
          };
        } catch {
          db.close();
          safeResolve();
        }
      } else {
        db.close();
        safeResolve();
      }
    };
    req.onerror = () => safeResolve();
    req.onupgradeneeded = () => {
      // La DB no existía; el open la creó vacía a version 1.
      // Marcamos para que onsuccess cierre sin leer.
      triggeredUpgrade = true;
    };
    req.onblocked = () => safeResolve();
  });
};

export const initDB = async () => {
  if (!dbPromise) {
    // Stash de KPI macros antes de disparar la migración a V59. Sólo
    // hace trabajo real si la DB está en una versión < 59 y aún tiene
    // el store viejo `objetivos_financieros`.
    await stashOldObjetivosFinancieros();

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

        // loan_settlements: ELIMINADO en V63 (sub-tarea 4) — destino prestamos.liquidacion · 0 registros

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

        // H5: expensesH5, reforms, reformLineItems — DELETED in V4.2

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

        // propertyImprovements, operacionesFiscales, mejorasActivo, mobiliarioActivo — DELETED in V4.2

        // V3.8: Proveedores store (unique entity per NIF)
        if (!db.objectStoreNames.contains('proveedores')) {
          db.createObjectStore('proveedores', { keyPath: 'nif' });
        }

        // operacionesProveedor: store removed in V62 (sub-tarea 3)

        // V4.0: gastosInmueble — store unificado de gastos por inmueble
        if (!db.objectStoreNames.contains('gastosInmueble')) {
          const gastosStore = db.createObjectStore('gastosInmueble', { keyPath: 'id', autoIncrement: true });
          gastosStore.createIndex('inmuebleId', 'inmuebleId', { unique: false });
          gastosStore.createIndex('ejercicio', 'ejercicio', { unique: false });
          gastosStore.createIndex('inmueble-ejercicio', ['inmuebleId', 'ejercicio'], { unique: false });
          gastosStore.createIndex('casillaAEAT', 'casillaAEAT', { unique: false });
          gastosStore.createIndex('origen', 'origen', { unique: false });
          gastosStore.createIndex('estado', 'estado', { unique: false });
          gastosStore.createIndex('origen-origenId', ['origen', 'origenId'], { unique: false });
          // PR3 · índices para revert eficiente (treasuryConfirmationService)
          ensureIndex(gastosStore, 'movimientoId', 'movimientoId', { unique: false });
          ensureIndex(gastosStore, 'treasuryEventId', 'treasuryEventId', { unique: false });
        } else {
          const gastosStore = transaction.objectStore('gastosInmueble');
          ensureIndex(gastosStore, 'movimientoId', 'movimientoId', { unique: false });
          ensureIndex(gastosStore, 'treasuryEventId', 'treasuryEventId', { unique: false });
        }

        // V4.0: mejorasInmueble — mejoras/ampliaciones/reparaciones por inmueble
        if (!db.objectStoreNames.contains('mejorasInmueble')) {
          const mejorasStore = db.createObjectStore('mejorasInmueble', { keyPath: 'id', autoIncrement: true });
          mejorasStore.createIndex('inmuebleId', 'inmuebleId', { unique: false });
          mejorasStore.createIndex('ejercicio', 'ejercicio', { unique: false });
          mejorasStore.createIndex('inmueble-ejercicio', ['inmuebleId', 'ejercicio'], { unique: false });
          ensureIndex(mejorasStore, 'movimientoId', 'movimientoId', { unique: false });
          ensureIndex(mejorasStore, 'treasuryEventId', 'treasuryEventId', { unique: false });
        } else {
          const mejorasStore = transaction.objectStore('mejorasInmueble');
          ensureIndex(mejorasStore, 'movimientoId', 'movimientoId', { unique: false });
          ensureIndex(mejorasStore, 'treasuryEventId', 'treasuryEventId', { unique: false });
        }

        // V4.0: mueblesInmueble — mobiliario amortizable por inmueble
        if (!db.objectStoreNames.contains('mueblesInmueble')) {
          const mueblesStore = db.createObjectStore('mueblesInmueble', { keyPath: 'id', autoIncrement: true });
          mueblesStore.createIndex('inmuebleId', 'inmuebleId', { unique: false });
          mueblesStore.createIndex('ejercicio', 'ejercicio', { unique: false });
          mueblesStore.createIndex('inmueble-ejercicio', ['inmuebleId', 'ejercicio'], { unique: false });
          ensureIndex(mueblesStore, 'movimientoId', 'movimientoId', { unique: false });
          ensureIndex(mueblesStore, 'treasuryEventId', 'treasuryEventId', { unique: false });
        } else {
          const mueblesStore = transaction.objectStore('mueblesInmueble');
          ensureIndex(mueblesStore, 'movimientoId', 'movimientoId', { unique: false });
          ensureIndex(mueblesStore, 'treasuryEventId', 'treasuryEventId', { unique: false });
        }

        // V4.2+: Delete legacy stores — all runtime references removed
        {
          const storesToDelete = [
            'fiscalSummaries',
            'operacionesFiscales',
            'gastos',
            'propertyImprovements',
            'mejorasActivo',
            'mobiliarioActivo',
            'expensesH5',
            'reforms',
            'reformLineItems',
            'capex',
            'gastosRecurrentes',
            'gastosPuntuales',
          ];
          for (const store of storesToDelete) {
            if (db.objectStoreNames.contains(store)) {
              db.deleteObjectStore(store);
            }
          }
        }

        // NOTE: rentCalendar and rentPayments stores removed in V4.5 — migrated to rentaMensual
        // rentaMensual: store removed in V62 (sub-tarea 3)
        // kpiConfigurations: store removed in V62 (sub-tarea 3)

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
          // GAP-3: Índices para cashflow histórico
          ensureIndex(treasuryEventsStore, 'año', 'año', { unique: false });
          ensureIndex(treasuryEventsStore, 'generadoPor', 'generadoPor', { unique: false });
          ensureIndex(treasuryEventsStore, 'certeza', 'certeza', { unique: false });
          // PR3: índices para ámbito + inmueble (unified treasury architecture)
          ensureIndex(treasuryEventsStore, 'ambito', 'ambito', { unique: false });
          ensureIndex(treasuryEventsStore, 'inmuebleId', 'inmuebleId', { unique: false });
        } else {
          // GAP-3: Añadir índices históricos a bases de datos existentes
          const treasuryEventsStore = transaction.objectStore('treasuryEvents');
          ensureIndex(treasuryEventsStore, 'año', 'año', { unique: false });
          ensureIndex(treasuryEventsStore, 'generadoPor', 'generadoPor', { unique: false });
          ensureIndex(treasuryEventsStore, 'certeza', 'certeza', { unique: false });
          // PR3: índices para ámbito + inmueble
          ensureIndex(treasuryEventsStore, 'ambito', 'ambito', { unique: false });
          ensureIndex(treasuryEventsStore, 'inmuebleId', 'inmuebleId', { unique: false });
        }

        // treasuryRecommendations: store removed in V62 (sub-tarea 3)

        // fiscalSummaries — DELETED in V4.2

        // gastos (treasury) — DELETED in V4.2

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

        // V4.7: importLogs store removed — orphan (no reads/writes)
        if (oldVersion < 47 && db.objectStoreNames.contains('importLogs')) {
          db.deleteObjectStore('importLogs');
        }

        // matchingConfiguration: ELIMINADO en V63 (sub-tarea 4) — destino keyval['matchingConfig'] · 0 registros

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

        // nominas: ELIMINADO en V63 (sub-tarea 4 · deuda sub-tarea 2) — datos en `ingresos` con tipo='nomina'

        // V61 (TAREA 7 sub-tarea 2): store unificado `ingresos`. Para DBs
        // frescas se crea aquí; para DBs existentes se crea + se rellena en
        // el bloque `if (oldVersion < 61)` más abajo.
        if (!db.objectStoreNames.contains('ingresos')) {
          const ingresosStore = db.createObjectStore('ingresos', { keyPath: 'id', autoIncrement: true });
          ingresosStore.createIndex('personalDataId', 'personalDataId', { unique: false });
          ingresosStore.createIndex('tipo', 'tipo', { unique: false });
          ingresosStore.createIndex('fechaActualizacion', 'fechaActualizacion', { unique: false });
        }

        // autonomos: ELIMINADO en V63 (sub-tarea 4) — destino ingresos.tipo='autonomo'

        if (!db.objectStoreNames.contains('planesPensionInversion')) {
          const planesStore = db.createObjectStore('planesPensionInversion', { keyPath: 'id', autoIncrement: true });
          planesStore.createIndex('personalDataId', 'personalDataId', { unique: false });
          planesStore.createIndex('tipo', 'tipo', { unique: false });
          planesStore.createIndex('titularidad', 'titularidad', { unique: false });
          planesStore.createIndex('esHistorico', 'esHistorico', { unique: false });
          planesStore.createIndex('fechaActualizacion', 'fechaActualizacion', { unique: false });
        }

        // V5.2: Traspasos entre planes de pensiones
        if (!db.objectStoreNames.contains('traspasosPlanes')) {
          const traspasosStore = db.createObjectStore('traspasosPlanes', { keyPath: 'id', autoIncrement: true });
          traspasosStore.createIndex('personalDataId', 'personalDataId', { unique: false });
          traspasosStore.createIndex('planOrigenId', 'planOrigenId', { unique: false });
          traspasosStore.createIndex('planDestinoId', 'planDestinoId', { unique: false });
          traspasosStore.createIndex('fecha', 'fecha', { unique: false });
        }

        // otrosIngresos: ELIMINADO en V63 (sub-tarea 4-bis) — destino ingresos.tipo='otro' + metadata.otro

        // V1.3: Inversiones (Investment positions) store
        if (!db.objectStoreNames.contains('inversiones')) {
          const inversionesStore = db.createObjectStore('inversiones', { keyPath: 'id', autoIncrement: true });
          inversionesStore.createIndex('tipo', 'tipo', { unique: false });
          inversionesStore.createIndex('activo', 'activo', { unique: false });
          inversionesStore.createIndex('entidad', 'entidad', { unique: false });
        }

        // patrimonioSnapshots: store removed in V62 (sub-tarea 3)

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

        // valoraciones_mensuales: store removed in V62 (sub-tarea 3)
        // opexRules: store removed in V62 (sub-tarea 3)

        // pensiones: ELIMINADO en V63 (sub-tarea 4) — destino ingresos.tipo='pension'

        // configuracion_fiscal: store removed in V62 (sub-tarea 3)
        // ejerciciosFiscales: store removed in V62 (sub-tarea 3)

        // documentosFiscales: ELIMINADO en V63 (sub-tarea 4) — destino documents.metadata.tipo='fiscal'
        // arrastresManual: ELIMINADO en V63 (sub-tarea 4) — destino arrastresIRPF.origen='manual'

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

        if (!db.objectStoreNames.contains('perdidasPatrimonialesAhorro')) {
          const perdidasStore = db.createObjectStore('perdidasPatrimonialesAhorro', { keyPath: 'id', autoIncrement: true });
          perdidasStore.createIndex('ejercicioOrigen', 'ejercicioOrigen', { unique: false });
          perdidasStore.createIndex('estado', 'estado', { unique: false });
          perdidasStore.createIndex('ejercicioCaducidad', 'ejercicioCaducidad', { unique: false });
        }

        // V2.7: Snapshots de Declaración store (frozen IRPF declaration data)
        if (!db.objectStoreNames.contains('snapshotsDeclaracion')) {
          const snapshotsStore = db.createObjectStore('snapshotsDeclaracion', { keyPath: 'id', autoIncrement: true });
          snapshotsStore.createIndex('ejercicio', 'ejercicio', { unique: false });
          snapshotsStore.createIndex('origen', 'origen', { unique: false });
          snapshotsStore.createIndex('fechaSnapshot', 'fechaSnapshot', { unique: false });
        }

        if (!db.objectStoreNames.contains('entidadesAtribucion')) {
          const entidadesStore = db.createObjectStore('entidadesAtribucion', { keyPath: 'id', autoIncrement: true });
          entidadesStore.createIndex('nif', 'nif', { unique: false });
          entidadesStore.createIndex('tipoRenta', 'tipoRenta', { unique: false });
        }


        // V3.7: Ejercicios Fiscales Coordinador store (4 regímenes)
        if (!db.objectStoreNames.contains('ejerciciosFiscalesCoord')) {
          const coordStore = db.createObjectStore('ejerciciosFiscalesCoord', { keyPath: 'año' });
          coordStore.createIndex('estado', 'estado');
        }

        // V3.9: Vínculos accesorio (parking/trastero) por ejercicio
        if (!db.objectStoreNames.contains('vinculosAccesorio')) {
          const vinculosStore = db.createObjectStore('vinculosAccesorio', { keyPath: 'id', autoIncrement: true });
          vinculosStore.createIndex('inmueblePrincipalId', 'inmueblePrincipalId', { unique: false });
          vinculosStore.createIndex('inmuebleAccesorioId', 'inmuebleAccesorioId', { unique: false });
          vinculosStore.createIndex('principal-accesorio-ejercicio', ['inmueblePrincipalId', 'inmuebleAccesorioId', 'ejercicio'], { unique: true });
        }

        // V2.8: Allow multiple snapshots per ejercicio (force snapshots)
        if (db.objectStoreNames.contains('snapshotsDeclaracion')) {
          const snapshotsStore = transaction.objectStore('snapshotsDeclaracion');
          if (snapshotsStore.indexNames.contains('ejercicio')) {
            snapshotsStore.deleteIndex('ejercicio');
          }
          snapshotsStore.createIndex('ejercicio', 'ejercicio', { unique: false });
        }

        // ── V4.3: Personal Module Architecture ─────────────────────────────────
        // patronGastosPersonales: store removed in V62 (sub-tarea 3)
        // gastosPersonalesReal: store removed in V62 (sub-tarea 3)

        // 3. V4.3 migration personalExpenses → patronGastosPersonales — REMOVED in V4.4
        //    personalExpenses store is deleted in LIMPIEZA V44 below.

        // ═══════════════════════════════════════════════════
        // LIMPIEZA V44 — Eliminación de stores obsoletos
        //
        // NOTA: el antiguo store legacy `ingresos` (eliminado aquí desde V44)
        // se REUTILIZA como store principal a partir de V61 (TAREA 7
        // sub-tarea 2 · rename `nominas → ingresos` con unión discriminada
        // `Ingreso`). Por eso ya NO se incluye en esta lista: cualquier DB
        // que pasase por V44 ya lo eliminó hace años, y la creación V61 está
        // a salvo del barrido.
        // ═══════════════════════════════════════════════════
        const STORES_OBSOLETOS = [
          'capex',
          'gastosRecurrentes',
          'gastosPuntuales',
          'expenses',
          'mejorasActivo',
          'mobiliarioActivo',
          'personalExpenses',
          'movimientosPersonales',
          'budgetLines',
          'budgets',
        ];

        for (const store of STORES_OBSOLETOS) {
          if (db.objectStoreNames.contains(store)) {
            db.deleteObjectStore(store);
          }
        }

        // ═══════════════════════════════════════════════════
        // LIMPIEZA V45 — Eliminación de stores rentCalendar y rentPayments (migrados a rentaMensual)
        // ═══════════════════════════════════════════════════
        const STORES_LEGACY_RENTAS = ['rentCalendar', 'rentPayments'];
        for (const store of STORES_LEGACY_RENTAS) {
          if (db.objectStoreNames.contains(store)) {
            db.deleteObjectStore(store);
          }
        }

        // ═══════════════════════════════════════════════════
        // V4.8 — Cuenta remunerada: campos opcionales en accounts
        // Sin cambios estructurales — los campos esRemunerada y
        // remuneracion son opcionales y no requieren migración.
        // ═══════════════════════════════════════════════════

        // ═══════════════════════════════════════════════════
        // V5.3 — ATLAS Personal v1.1 · modelo de datos exhaustivo
        //   1. compromisosRecurrentes (decisión G-01) · catálogo único
        //      con discriminador `ambito` (personal | inmueble).
        //      Migración: copia los registros existentes de `opexRules`
        //      conservando `ambito='inmueble'` y su `inmuebleId`.
        //      `opexRules` se mantiene en lectura por ahora para no romper
        //      la UI legacy de Inmuebles · futuras PRs deprecarán.
        //   2. viviendaHabitual · ficha única que genera eventos derivados
        //      directamente en `treasuryEvents` (no via compromiso).
        // ═══════════════════════════════════════════════════
        if (!db.objectStoreNames.contains('compromisosRecurrentes')) {
          const compromisosStore = db.createObjectStore('compromisosRecurrentes', {
            keyPath: 'id',
            autoIncrement: true,
          });
          ensureIndex(compromisosStore, 'ambito', 'ambito', { unique: false });
          ensureIndex(compromisosStore, 'personalDataId', 'personalDataId', { unique: false });
          ensureIndex(compromisosStore, 'inmuebleId', 'inmuebleId', { unique: false });
          ensureIndex(compromisosStore, 'tipo', 'tipo', { unique: false });
          ensureIndex(compromisosStore, 'categoria', 'categoria', { unique: false });
          ensureIndex(compromisosStore, 'cuentaCargo', 'cuentaCargo', { unique: false });
          ensureIndex(compromisosStore, 'estado', 'estado', { unique: false });
          ensureIndex(compromisosStore, 'fechaInicio', 'fechaInicio', { unique: false });
        }

        if (!db.objectStoreNames.contains('viviendaHabitual')) {
          const viviendaStore = db.createObjectStore('viviendaHabitual', {
            keyPath: 'id',
            autoIncrement: true,
          });
          ensureIndex(viviendaStore, 'personalDataId', 'personalDataId', { unique: false });
          ensureIndex(viviendaStore, 'activa', 'activa', { unique: false });
          ensureIndex(viviendaStore, 'vigenciaDesde', 'vigenciaDesde', { unique: false });
        }

        // Migración V5.3 · opexRules → compromisosRecurrentes (ambito='inmueble')
        // Se ejecuta solo en la transición desde una versión < 53 y solo si
        // ambos stores están disponibles dentro de la transacción de upgrade.
        if (
          oldVersion < 53 &&
          db.objectStoreNames.contains('opexRules') &&
          db.objectStoreNames.contains('compromisosRecurrentes')
        ) {
          const opexStore = transaction.objectStore('opexRules');
          const targetStore = transaction.objectStore('compromisosRecurrentes');

          opexStore.openCursor().then(async function migrate(cursor) {
            while (cursor) {
              const opex = cursor.value as OpexRule;
              const ahora = new Date().toISOString();

              // Mapea OpexFrequency → PatronRecurrente (best-effort)
              let patron: any;
              if (opex.frecuencia === 'mensual') {
                patron = { tipo: 'mensualDiaFijo', dia: opex.diaCobro ?? 1 };
              } else if (opex.frecuencia === 'meses_especificos' && opex.mesesCobro?.length) {
                patron = {
                  tipo: 'anualMesesConcretos',
                  mesesPago: opex.mesesCobro,
                  diaPago: opex.diaCobro ?? 5,
                };
              } else if (opex.frecuencia === 'trimestral') {
                patron = {
                  tipo: 'cadaNMeses',
                  cadaNMeses: 3,
                  mesAncla: opex.mesInicio ?? 1,
                  dia: opex.diaCobro ?? 5,
                };
              } else if (opex.frecuencia === 'semestral') {
                patron = {
                  tipo: 'cadaNMeses',
                  cadaNMeses: 6,
                  mesAncla: opex.mesInicio ?? 1,
                  dia: opex.diaCobro ?? 5,
                };
              } else if (opex.frecuencia === 'anual') {
                patron = {
                  tipo: 'anualMesesConcretos',
                  mesesPago: [opex.mesInicio ?? 1],
                  diaPago: opex.diaCobro ?? 5,
                };
              } else {
                patron = { tipo: 'mensualDiaFijo', dia: opex.diaCobro ?? 1 };
              }

              // Mapea importe (asymmetric → porPago · resto → fijo)
              let importe: any;
              if (opex.asymmetricPayments?.length) {
                const importesPorPago: Record<number, number> = {};
                for (const p of opex.asymmetricPayments) {
                  importesPorPago[p.mes] = p.importe;
                }
                importe = { modo: 'porPago', importesPorPago };
              } else {
                importe = { modo: 'fijo', importe: opex.importeEstimado };
              }

              const compromiso: CompromisoRecurrente = {
                ambito: 'inmueble',
                inmuebleId: opex.propertyId,
                alias: opex.concepto,
                tipo: 'otros',
                subtipo: opex.subtypeKey,
                proveedor: {
                  nombre: opex.proveedorNombre || 'Sin proveedor',
                  nif: opex.proveedorNIF,
                  referencia: opex.invoiceNumber,
                },
                patron,
                importe,
                cuentaCargo: opex.accountId ?? 0,
                conceptoBancario: opex.proveedorNombre || opex.concepto,
                metodoPago: 'domiciliacion',
                categoria: 'inmueble.opex',
                bolsaPresupuesto: 'inmueble',
                responsable: 'titular',
                fechaInicio: opex.createdAt || ahora,
                estado: opex.activo ? 'activo' : 'pausado',
                derivadoDe: { fuente: 'opexRule', refId: opex.id, bloqueado: false },
                createdAt: opex.createdAt || ahora,
                updatedAt: ahora,
              };

              try {
                await targetStore.add(compromiso);
              } catch (err) {
                console.warn('[DB V5.3] migración opexRule → compromisoRecurrente falló para id=', opex.id, err);
              }

              cursor = await cursor.continue();
            }
          }).catch((err) => {
            console.warn('[DB V5.3] migración opexRules → compromisosRecurrentes interrumpida:', err);
          });
        }

        // ═══════════════════════════════════════════════════
        // V5.4 — Cierre G-01: copia registros NUEVOS de opexRules →
        //   compromisosRecurrentes (idempotente: salta los que ya tienen
        //   derivadoDe.refId = opex.id). Ejecutado solo al subir desde < 54.
        //   No elimina opexRules — queda deprecated hasta V5.5.
        // ═══════════════════════════════════════════════════
        if (
          oldVersion < 54 &&
          db.objectStoreNames.contains('opexRules') &&
          db.objectStoreNames.contains('compromisosRecurrentes')
        ) {
          const opexStore54 = transaction.objectStore('opexRules');
          const targetStore54 = transaction.objectStore('compromisosRecurrentes');

          const OPEX_CAT_MAP: Record<string, string> = {
            comunidad: 'inmueble.comunidad',
            impuesto: 'inmueble.ibi',
            seguro: 'inmueble.seguros',
            suministro: 'inmueble.suministros',
            gestion: 'inmueble.gestionAlquiler',
            servicio: 'inmueble.opex',
          };
          const OPEX_CAT_TO_TIPO: Record<string, string> = {
            comunidad: 'comunidad',
            impuesto: 'impuesto',
            seguro: 'seguro',
            suministro: 'suministro',
            gestion: 'otros',
            servicio: 'otros',
          };

          targetStore54.getAll().then(async (existentes: any[]) => {
            const existingRefs = new Set<number>(
              existentes
                .filter((c: any) => c.derivadoDe?.fuente === 'opexRule' && c.derivadoDe?.refId != null)
                .map((c: any) => c.derivadoDe.refId as number)
            );

            let cursor54 = await opexStore54.openCursor();
            while (cursor54) {
              const opex = cursor54.value as OpexRule;
              if (opex.id != null && !existingRefs.has(opex.id)) {
                const ahora = new Date().toISOString();
                let patron: any;
                if (opex.frecuencia === 'mensual') {
                  patron = { tipo: 'mensualDiaFijo', dia: opex.diaCobro ?? 1 };
                } else if (opex.frecuencia === 'meses_especificos' && opex.mesesCobro?.length) {
                  patron = { tipo: 'anualMesesConcretos', mesesPago: opex.mesesCobro, diaPago: opex.diaCobro ?? 5 };
                } else if (opex.frecuencia === 'trimestral') {
                  patron = { tipo: 'cadaNMeses', cadaNMeses: 3, mesAncla: opex.mesInicio ?? 1, dia: opex.diaCobro ?? 5 };
                } else if (opex.frecuencia === 'semestral') {
                  patron = { tipo: 'cadaNMeses', cadaNMeses: 6, mesAncla: opex.mesInicio ?? 1, dia: opex.diaCobro ?? 5 };
                } else if (opex.frecuencia === 'anual') {
                  patron = { tipo: 'anualMesesConcretos', mesesPago: [opex.mesInicio ?? 1], diaPago: opex.diaCobro ?? 5 };
                } else {
                  patron = { tipo: 'mensualDiaFijo', dia: opex.diaCobro ?? 1 };
                }
                let importe: any;
                if (opex.asymmetricPayments?.length) {
                  const iP: Record<number, number> = {};
                  for (const p of opex.asymmetricPayments) { iP[p.mes] = p.importe; }
                  importe = { modo: 'porPago', importesPorPago: iP };
                } else {
                  importe = { modo: 'fijo', importe: opex.importeEstimado };
                }
                const compromiso54: any = {
                  ambito: 'inmueble',
                  inmuebleId: opex.propertyId,
                  alias: opex.concepto,
                  tipo: OPEX_CAT_TO_TIPO[opex.categoria] ?? 'otros',
                  subtipo: opex.subtypeKey,
                  proveedor: { nombre: opex.proveedorNombre || 'Sin proveedor', nif: opex.proveedorNIF, referencia: opex.invoiceNumber },
                  patron,
                  importe,
                  cuentaCargo: opex.accountId ?? 0,
                  conceptoBancario: opex.proveedorNombre || opex.concepto,
                  metodoPago: 'domiciliacion',
                  categoria: OPEX_CAT_MAP[opex.categoria] ?? 'inmueble.opex',
                  bolsaPresupuesto: 'inmueble',
                  responsable: 'titular',
                  fechaInicio: opex.createdAt || ahora,
                  estado: opex.activo ? 'activo' : 'pausado',
                  derivadoDe: { fuente: 'opexRule', refId: opex.id, bloqueado: false },
                  notas: JSON.stringify({ _opexCategoria: opex.categoria, _opexCasillaAEAT: opex.casillaAEAT }),
                  createdAt: opex.createdAt || ahora,
                  updatedAt: ahora,
                };
                try {
                  await targetStore54.add(compromiso54);
                  existingRefs.add(opex.id);
                } catch (err) {
                  console.warn('[DB V5.4] migración opexRule → compromisoRecurrente falló para id=', opex.id, err);
                }
              }
              cursor54 = await cursor54.continue();
            }
          }).catch((err) => {
            console.warn('[DB V5.4] migración V5.4 opexRules → compromisosRecurrentes interrumpida:', err);
          });
        }

        // ═══════════════════════════════════════════════════
        // V5.5 — Mi Plan v3 · escenarios (singleton)
        //   Renombra objetivos_financieros → escenarios.
        //   Preserva los 7 campos KPI existentes.
        //   Añade: modoVivienda · gastosVidaLibertadMensual · estrategia · hitos[].
        //   El store objetivos_financieros se elimina tras la copia.
        // ═══════════════════════════════════════════════════
        if (oldVersion < 55) {
          if (!db.objectStoreNames.contains('escenarios')) {
            db.createObjectStore('escenarios', { keyPath: 'id' });
          }

          const defaultEscenario = {
            id: 1,
            modoVivienda: 'alquiler',
            gastosVidaLibertadMensual: 2500,
            estrategia: 'hibrido',
            hitos: [],
            rentaPasivaObjetivo: 3000,
            patrimonioNetoObjetivo: 600000,
            cajaMinima: 10000,
            dtiMaximo: 35,
            ltvMaximo: 50,
            yieldMinimaCartera: 8,
            tasaAhorroMinima: 15,
            updatedAt: new Date().toISOString(),
          };

          if (db.objectStoreNames.contains('objetivos_financieros')) {
            // Copiar usando raw IDB event handlers para garantizar que la
            // versionchange transaction permanece activa durante el delete.
            const rawGetReq = (transaction as unknown as IDBTransaction)
              .objectStore('objetivos_financieros')
              .get(1);

            rawGetReq.onsuccess = () => {
              const now = new Date().toISOString();
              const old = rawGetReq.result as Record<string, unknown> | undefined;
              const nuevo = {
                ...defaultEscenario,
                rentaPasivaObjetivo:
                  typeof old?.rentaPasivaObjetivo === 'number'
                    ? old.rentaPasivaObjetivo
                    : defaultEscenario.rentaPasivaObjetivo,
                patrimonioNetoObjetivo:
                  typeof old?.patrimonioNetoObjetivo === 'number'
                    ? old.patrimonioNetoObjetivo
                    : defaultEscenario.patrimonioNetoObjetivo,
                cajaMinima:
                  typeof old?.cajaMinima === 'number'
                    ? old.cajaMinima
                    : defaultEscenario.cajaMinima,
                dtiMaximo:
                  typeof old?.dtiMaximo === 'number'
                    ? old.dtiMaximo
                    : defaultEscenario.dtiMaximo,
                ltvMaximo:
                  typeof old?.ltvMaximo === 'number'
                    ? old.ltvMaximo
                    : defaultEscenario.ltvMaximo,
                yieldMinimaCartera:
                  typeof old?.yieldMinimaCartera === 'number'
                    ? old.yieldMinimaCartera
                    : defaultEscenario.yieldMinimaCartera,
                tasaAhorroMinima:
                  typeof old?.tasaAhorroMinima === 'number'
                    ? old.tasaAhorroMinima
                    : defaultEscenario.tasaAhorroMinima,
                updatedAt: now,
              };
              (transaction as unknown as IDBTransaction).objectStore('escenarios').put(nuevo);
              // Eliminar store viejo (la versionchange transaction sigue activa en onsuccess)
              (db as unknown as IDBDatabase).deleteObjectStore('objetivos_financieros');
            };

            rawGetReq.onerror = () => {
              console.warn('[DB V5.5] No se pudo leer objetivos_financieros, usando defaults para escenarios');
              (transaction as unknown as IDBTransaction).objectStore('escenarios').put(defaultEscenario);
              (db as unknown as IDBDatabase).deleteObjectStore('objetivos_financieros');
            };
          } else {
            // Instalación nueva (sin objetivos_financieros): crear singleton con defaults
            transaction.objectStore('escenarios').put(defaultEscenario as unknown as Escenario);
          }
        }

        // ═══════════════════════════════════════════════════
        // V5.6 — Mi Plan v3 · objetivos (lista)
        //   Store nuevo para los 4 tipos de objetivo:
        //   acumular · amortizar · comprar · reducir.
        // ═══════════════════════════════════════════════════
        if (oldVersion < 56) {
          if (!db.objectStoreNames.contains('objetivos')) {
            const objetivosStore = db.createObjectStore('objetivos', { keyPath: 'id' });
            objetivosStore.createIndex('tipo', 'tipo', { unique: false });
            objetivosStore.createIndex('estado', 'estado', { unique: false });
            objetivosStore.createIndex('fondoId', 'fondoId', { unique: false });
            objetivosStore.createIndex('prestamoId', 'prestamoId', { unique: false });
          }
        }

        // ═══════════════════════════════════════════════════
        // V5.7 — Mi Plan v3 · fondos_ahorro
        //   Store nuevo para etiquetas de propósito sobre euros de tesorería.
        //   6 tipos: colchon · compra · reforma · impuestos · capricho · custom.
        // ═══════════════════════════════════════════════════
        if (oldVersion < 57) {
          if (!db.objectStoreNames.contains('fondos_ahorro')) {
            const fondosStore = db.createObjectStore('fondos_ahorro', { keyPath: 'id' });
            fondosStore.createIndex('tipo', 'tipo', { unique: false });
            fondosStore.createIndex('activo', 'activo', { unique: false });
          }
        }

        // ═══════════════════════════════════════════════════
        // V5.8 — Mi Plan v3 · retos
        //   Store nuevo para retos mensuales.
        //   El índice 'mes' es UNIQUE: fuerza 1 reto por mes.
        // ═══════════════════════════════════════════════════
        if (oldVersion < 58) {
          if (!db.objectStoreNames.contains('retos')) {
            const retosStore = db.createObjectStore('retos', { keyPath: 'id' });
            retosStore.createIndex('mes', 'mes', { unique: true });
            retosStore.createIndex('estado', 'estado', { unique: false });
            retosStore.createIndex('tipo', 'tipo', { unique: false });
          }
        }

        // ═══════════════════════════════════════════════════
        // V5.9 — Cierre forzoso de migración V5.5
        //   La migración V5.5 dejó el store `objetivos_financieros` vivo en
        //   producción porque sus deleteObjectStore dependían de onsuccess
        //   anidados que no completaban antes del commit del versionchange
        //   en algunos navegadores.
        //
        //   V5.9 hace todo síncronamente dentro del upgrade callback:
        //     1. Lee el singleton viejo vía cursor (síncrono dentro de
        //        un cursor.openCursor().onsuccess pre-commit).
        //     2. Calcula el merge defensivo de los KPI macro.
        //     3. Planifica el put sobre escenarios.
        //     4. Llama db.deleteObjectStore SÍNCRONAMENTE en el mismo
        //        callback synchronous antes de que el upgrade retorne.
        //
        //   Estrategia: usamos `getAll()` que devuelve todos los registros
        //   en un solo request, y dentro de su onsuccess (que dispara
        //   ANTES del commit porque es la única request pendiente y
        //   ejecutamos sincrónicamente put + deleteObjectStore) cerramos
        //   la migración.
        //
        //   Como respaldo: si por alguna razón el getAll no completa antes
        //   del commit, registramos un fallback que ejecuta el delete en
        //   una segunda apertura de la DB (no hay alternativa, pero al
        //   menos la limpieza queda asegurada).
        //
        //   Idempotente: si el store ya no existe, no hace nada.
        // ═══════════════════════════════════════════════════
        if (oldVersion < 59 && db.objectStoreNames.contains('objetivos_financieros')) {
          // En este punto `escenarios` SIEMPRE existe (creado en V5.5).
          // Garantía adicional por si alguna instancia llegó hasta aquí sin él.
          if (!db.objectStoreNames.contains('escenarios')) {
            db.createObjectStore('escenarios', { keyPath: 'id' });
          }

          // Estrategia: el merge defensivo de KPI macro lo hace V5.5 (que ya
          // se ejecutó si el usuario está actualizando desde una versión
          // <55) o lo hará `runV59PostMigration` POST-upgrade (que abre una
          // transacción normal readwrite sobre `escenarios` y `objetivos_financieros`).
          //
          // En el upgrade callback, lo único crítico es ELIMINAR el store
          // viejo. `deleteObjectStore` es síncrono y no requiere request,
          // así que se llama directamente y de forma determinista.
          //
          // ATENCIÓN: si `escenarios.id=1` no tiene KPI macro y el viejo
          // store sí los tenía, esos datos se preservarán por
          // `runV59PostMigration` justo después del upgrade.
          try {
            db.deleteObjectStore('objetivos_financieros');
          } catch (err) {
            console.warn('[DB V5.9] deleteObjectStore objetivos_financieros falló:', err);
          }
        }

        // ═══════════════════════════════════════════════════
        // V60 — TAREA 7 sub-tarea 1: Schema extensions on surviving stores
        //   Cambios NO destructivos · sólo añade campos opcionales,
        //   índices y backfill no rompedor sobre stores que SOBREVIVEN
        //   en V60. Las eliminaciones de los 19 stores se hacen en
        //   sub-tareas 3-8. El rename `nominas → ingresos` lo cubre
        //   sub-tarea 2 (bloque V61 más abajo).
        //
        //   Stores afectados:
        //     1. arrastresIRPF       · añadir índice 'origen' + backfill
        //                              de 'aeat' para registros existentes.
        //     2. documents           · sólo TS (unión metadata.tipo
        //                              ampliada) · sin cambio runtime.
        //     3. prestamos           · sólo TS (campo opcional
        //                              `liquidacion`) · sin cambio runtime.
        //     4. contracts           · sólo TS (campo opcional
        //                              `historicoRentas[]`) · sin cambio
        //                              runtime.
        //     5. movementLearningRules · sólo TS (campo opcional
        //                              `history[]`) · sin cambio runtime.
        //     6. accounts            · sólo JSDoc sobre `balance`.
        //     7. keyval              · sólo JSDoc sobre claves estándar.
        //     8. valoraciones_historicas · sólo JSDoc · usa índice
        //                              compuesto existente para queries
        //                              mensuales.
        //
        //   Contrato: cualquier registro pre-V60 sigue siendo legible con
        //   el nuevo schema (todos los campos nuevos son opcionales).
        // ═══════════════════════════════════════════════════
        if (oldVersion < 60) {
          // 1. arrastresIRPF · índice 'origen' + backfill 'aeat'
          if (db.objectStoreNames.contains('arrastresIRPF')) {
            const arrastresStore = transaction.objectStore('arrastresIRPF');
            ensureIndex(arrastresStore, 'origen', 'origen', { unique: false });

            // Backfill: cada registro pre-V60 sin `origen` recibe 'aeat'.
            // El `transaction` que entrega idb es un IDBPTransaction · sus
            // cursores se consumen vía promesas (no IDBRequest.onsuccess).
            // Iteramos con while + await cursor.continue() · mismo patrón
            // que la migración V5.4 (opexRules → compromisosRecurrentes).
            arrastresStore.openCursor().then(async function backfillArrastres(cursor) {
              while (cursor) {
                const value = cursor.value as { origen?: string };
                if (!value.origen) {
                  await cursor.update({ ...value, origen: 'aeat' });
                }
                cursor = await cursor.continue();
              }
            }).catch((err) => {
              console.warn('[DB V60] backfill arrastresIRPF.origen falló:', err);
            });
          }

          // 2-8. Resto de stores: cambios sólo en TS · IDB es schema-less
          // por registro y trata los nuevos campos opcionales como
          // `undefined` al leer registros pre-V60. No requieren acción
          // en runtime de migración.
        }

        // ═══════════════════════════════════════════════════
        // V61 — TAREA 7 sub-tarea 2: rename `nominas → ingresos`
        //   Crea el store unificado `ingresos` (unión discriminada
        //   `Ingreso = IngresoNomina | IngresoAutonomo | IngresoPension`)
        //   y copia los registros existentes de `nominas` añadiendo
        //   `tipo='nomina'`. Cambio NO destructivo: el store `nominas`
        //   se mantiene intacto · los consumidores siguen usándolo hasta
        //   sub-tarea 6 (cambio de consumidores). `autonomos` y
        //   `pensiones` se absorberán en sub-tareas posteriores con su
        //   propio mapeo de campos a la unión `Ingreso`.
        //
        //   Idempotencia:
        //   - El bloque de creación de stores ya garantiza que `ingresos`
        //     existe antes de entrar aquí.
        //   - El backfill sólo añade registros si `ingresos` está vacío,
        //     evitando duplicados si la migración se ejecutase dos veces
        //     (p.ej. tras una recuperación de error).
        // ═══════════════════════════════════════════════════
        if (oldVersion < 61) {
          if (
            db.objectStoreNames.contains('ingresos') &&
            db.objectStoreNames.contains('nominas')
          ) {
            const ingresosStore = transaction.objectStore('ingresos');
            const nominasStore = transaction.objectStore('nominas');

            // Sólo rellenamos `ingresos` si está vacío; protege ante
            // re-ejecuciones del upgrade y evita pisar registros ya
            // migrados manualmente.
            ingresosStore.count().then(async (count) => {
              if (count > 0) return;
              // Iteramos `nominas` con cursor promise-based (mismo patrón
              // que la migración V60 backfill arrastresIRPF y la V5.4
              // opexRules → compromisosRecurrentes). Para cada registro
              // añadimos `tipo='nomina'` y lo escribimos en `ingresos`
              // preservando el id original.
              let cursor = await nominasStore.openCursor();
              while (cursor) {
                const value = cursor.value as Record<string, unknown>;
                const ingresoNomina = { ...value, tipo: 'nomina' as const };
                // `put` con la key explícita preserva el id original,
                // permitiendo correlacionar registros de `nominas` y
                // `ingresos` durante la fase de transición (sub-tareas
                // 2–6). Usamos un cast porque la unión `Ingreso` se
                // valida estructuralmente en TS pero `put` admite el
                // shape al runtime sin ambigüedad.
                await ingresosStore.put(ingresoNomina as unknown as IngresoPersonal);
                cursor = await cursor.continue();
              }
            }).catch((err) => {
              console.warn('[DB V61] copia nominas → ingresos falló:', err);
            });
          }
        }

        // ═══════════════════════════════════════════════════════════════════════
        // V62 — TAREA 7 sub-tarea 3: eliminar 11 stores duplicados/fósiles V1
        //   ⚠ DESTRUCTIVO: estrategia wipe + reimport · datos NO productivos.
        //
        //   Stores eliminados (con razón):
        //     1. kpiConfigurations     · 0 reg · sustituido por keyval['kpiConfig_*']
        //     2. configuracion_fiscal  · 1 reg · sin destino · defaults runtime
        //     3. treasuryRecommendations · 0 reg · derivable runtime
        //     4. valoraciones_mensuales  · 115 reg · derivable de valoraciones_historicas
        //     5. patrimonioSnapshots   · 1 reg · derivable de valoraciones_historicas
        //     6. operacionesProveedor  · 15 reg · cache desnormalizada de
        //                                gastosInmueble + proveedores
        //     7. patronGastosPersonales · 7 reg · futuro compromisosRecurrentes
        //     8. gastosPersonalesReal  · 0 reg · futuro movements + treasuryEvents
        //     9. opexRules             · 0 reg · ya migrado en TAREA 2
        //    10. rentaMensual          · 0 reg · deprecado en BUG-07
        //    11. ejerciciosFiscales    · 1 reg · sustituido por ejerciciosFiscalesCoord
        //
        //   Idempotente: el guard `objectStoreNames.contains(name)` permite
        //   re-ejecuciones tras error y DBs frescas que nunca tuvieron el store.
        // ═══════════════════════════════════════════════════════════════════════
        if (oldVersion < 62) {
          const storesToDelete = [
            'kpiConfigurations',
            'configuracion_fiscal',
            'treasuryRecommendations',
            'valoraciones_mensuales',
            'patrimonioSnapshots',
            'operacionesProveedor',
            'patronGastosPersonales',
            'gastosPersonalesReal',
            'opexRules',
            'rentaMensual',
            'ejerciciosFiscales',
          ];
          for (const store of storesToDelete) {
            if (db.objectStoreNames.contains(store)) {
              db.deleteObjectStore(store);
            }
          }
        }

        // ═══════════════════════════════════════════════════════════════════════
        // V63 — TAREA 7 sub-tarea 4 (+ 4-bis): eliminar 8 stores huérfanos
        //   fusionados en sus destinos. Cada store con datos se migra primero
        //   (lectura `getAll` + `add`/`put` en destino) y a continuación se
        //   borra con `deleteObjectStore`. La migración corre en una IIFE
        //   async cuyo Promise se devuelve desde el callback `upgrade` para
        //   que `idb` espere su finalización antes de cerrar la transacción
        //   versionchange (necesario porque `deleteObjectStore` debe ocurrir
        //   DESPUÉS de leer todos los registros del store legacy).
        //
        //   Mapeo (8 stores → destinos):
        //     1. nominas              · 0 reg → ya en `ingresos.tipo='nomina'`
        //                                (deuda sub-tarea 2 · sólo deleteObjectStore)
        //     2. autonomos            → `ingresos.tipo='autonomo'`
        //     3. pensiones            → `ingresos.tipo='pension'`
        //     4. otrosIngresos        → `ingresos.tipo='otro'` + metadata.otro
        //     5. arrastresManual      → `arrastresIRPF.origen='manual'`
        //                                (mapeo de tipo legacy)
        //     6. documentosFiscales   → `documents.metadata.tipo='fiscal'`
        //     7. loan_settlements     → `prestamos.liquidacion[]`
        //                                (array de settlements por préstamo)
        //     8. matchingConfiguration → `keyval['matchingConfig']`
        //
        //   Idempotente: el guard `objectStoreNames.contains(name)` permite
        //   re-ejecuciones tras error y DBs frescas que nunca tuvieron el
        //   store. La copia descarta `id` (autoIncrement reasigna) excepto
        //   para destinos con keyPath persistente.
        // ═══════════════════════════════════════════════════════════════════════
        if (oldVersion < 63) {
          return (async () => {
            // 2. autonomos → ingresos
            if (
              db.objectStoreNames.contains('autonomos') &&
              db.objectStoreNames.contains('ingresos')
            ) {
              try {
                const src = (transaction as any).objectStore('autonomos');
                const dst = transaction.objectStore('ingresos');
                const records = await src.getAll();
                for (const rec of records) {
                  const { id, ...rest } = rec as Record<string, unknown>;
                  void id;
                  await dst.add({ ...rest, tipo: 'autonomo' } as any);
                }
              } catch (err) {
                console.warn('[DB V63] copia autonomos→ingresos falló:', err);
              }
            }

            // 3. pensiones → ingresos
            if (
              db.objectStoreNames.contains('pensiones') &&
              db.objectStoreNames.contains('ingresos')
            ) {
              try {
                const src = (transaction as any).objectStore('pensiones');
                const dst = transaction.objectStore('ingresos');
                const records = await src.getAll();
                for (const rec of records) {
                  const { id, ...rest } = rec as Record<string, unknown>;
                  void id;
                  await dst.add({ ...rest, tipo: 'pension' } as any);
                }
              } catch (err) {
                console.warn('[DB V63] copia pensiones→ingresos falló:', err);
              }
            }

            // 4. otrosIngresos → ingresos.tipo='otro' (+ metadata.otro)
            if (
              db.objectStoreNames.contains('otrosIngresos') &&
              db.objectStoreNames.contains('ingresos')
            ) {
              try {
                const src = (transaction as any).objectStore('otrosIngresos');
                const dst = transaction.objectStore('ingresos');
                const records = await src.getAll();
                for (const rec of records) {
                  const { id, ...rest } = rec as Record<string, unknown>;
                  void id;
                  // Best-effort mapping legacy `OtrosIngresos.tipo` → `OtroIngresoMetadata.subtipo`.
                  // El set canónico V63 no se solapa con el legacy, así que
                  // todos quedan como 'otro' con `concepto` igual al `nombre`
                  // legacy y `fecha` la `fechaCreacion`.
                  const metadataOtro = {
                    subtipo: 'otro' as const,
                    concepto: String((rest as any).nombre ?? ''),
                    fecha: String(
                      (rest as any).fechaInicio
                        ?? (rest as any).fechaCreacion
                        ?? new Date().toISOString()
                    ),
                  };
                  await dst.add({
                    ...rest,
                    tipo: 'otro',
                    metadata: { otro: metadataOtro },
                  } as any);
                }
              } catch (err) {
                console.warn('[DB V63] copia otrosIngresos→ingresos falló:', err);
              }
            }

            // 5. arrastresManual → arrastresIRPF.origen='manual'
            if (
              db.objectStoreNames.contains('arrastresManual') &&
              db.objectStoreNames.contains('arrastresIRPF')
            ) {
              try {
                const src = (transaction as any).objectStore('arrastresManual');
                const dst = transaction.objectStore('arrastresIRPF');
                const records = await src.getAll();
                const tipoMap: Record<string, string> = {
                  gastos_0105_0106: 'exceso_gastos_0105_0106',
                  perdidas_ahorro: 'perdidas_patrimoniales_ahorro',
                  perdidas_general: 'perdidas_patrimoniales_general',
                };
                for (const rec of records) {
                  const r = rec as Record<string, unknown>;
                  const legacyTipo = String(r.tipo ?? '');
                  const importe = Number(r.importe ?? 0);
                  const ejercicioOrigen = Number(r.ejercicioOrigen ?? new Date().getFullYear());
                  const inmuebleIdRaw = r.inmuebleId;
                  const createdAt = String(r.createdAt ?? new Date().toISOString());
                  const inmuebleIdNum =
                    typeof inmuebleIdRaw === 'number'
                      ? inmuebleIdRaw
                      : typeof inmuebleIdRaw === 'string' && inmuebleIdRaw.length > 0 && !Number.isNaN(Number(inmuebleIdRaw))
                        ? Number(inmuebleIdRaw)
                        : undefined;
                  const arrastre: Record<string, unknown> = {
                    ejercicioOrigen,
                    tipo: tipoMap[legacyTipo] ?? 'otros',
                    importeOriginal: importe,
                    importePendiente: importe,
                    origen: 'manual',
                    aplicaciones: [],
                    estado: 'pendiente',
                    createdAt,
                    updatedAt: createdAt,
                  };
                  if (inmuebleIdNum != null) arrastre.inmuebleId = inmuebleIdNum;
                  await dst.add(arrastre as any);
                }
              } catch (err) {
                console.warn('[DB V63] copia arrastresManual→arrastresIRPF falló:', err);
              }
            }

            // 6. documentosFiscales → documents.metadata.tipo='fiscal'
            if (
              db.objectStoreNames.contains('documentosFiscales') &&
              db.objectStoreNames.contains('documents')
            ) {
              try {
                const src = (transaction as any).objectStore('documentosFiscales');
                const dst = transaction.objectStore('documents');
                const records = await src.getAll();
                for (const rec of records) {
                  const r = rec as Record<string, unknown>;
                  const fechaSubida = String(r.fechaSubida ?? r.fechaDocumento ?? new Date().toISOString());
                  const docToAdd: Record<string, unknown> = {
                    type: 'fiscal',
                    filename: String(r.archivoNombre ?? `doc_fiscal_${r.id ?? ''}`),
                    uploadDate: fechaSubida,
                    metadata: {
                      tipo: 'fiscal',
                      ejercicio: r.ejercicio,
                      conceptoFiscal: r.concepto,
                      inmuebleId:
                        typeof r.inmuebleId === 'string' && !Number.isNaN(Number(r.inmuebleId))
                          ? Number(r.inmuebleId)
                          : r.inmuebleId,
                      financialData: r.importe != null ? { amount: Number(r.importe) } : undefined,
                      provider: r.proveedorNombre,
                      proveedorNif: r.proveedorNif,
                      notas: r.descripcion,
                      archivoRef: r.archivoRef,
                      archivoTipo: r.archivoTipo,
                      fechaDocumento: r.fechaDocumento,
                    },
                  };
                  await dst.add(docToAdd as any);
                }
              } catch (err) {
                console.warn('[DB V63] copia documentosFiscales→documents falló:', err);
              }
            }

            // 7. loan_settlements → prestamos.liquidacion[]
            if (
              db.objectStoreNames.contains('loan_settlements') &&
              db.objectStoreNames.contains('prestamos')
            ) {
              try {
                const src = (transaction as any).objectStore('loan_settlements');
                const dst = transaction.objectStore('prestamos');
                const records = (await src.getAll()) as Array<Record<string, unknown>>;
                // Agrupar settlements por loanId
                const byLoan: Map<string, Array<Record<string, unknown>>> = new Map();
                for (const rec of records) {
                  const loanId = String(rec.loanId ?? '');
                  if (!loanId) continue;
                  const list = byLoan.get(loanId) ?? [];
                  list.push(rec);
                  byLoan.set(loanId, list);
                }
                // Adjuntar al prestamo correspondiente
                for (const [loanId, settlements] of byLoan.entries()) {
                  const prestamo = (await dst.get(loanId)) as Record<string, unknown> | undefined;
                  if (!prestamo) continue;
                  const existing = Array.isArray(prestamo.liquidacion) ? prestamo.liquidacion : [];
                  await dst.put({
                    ...prestamo,
                    liquidacion: [...(existing as unknown[]), ...settlements],
                  } as any);
                }
              } catch (err) {
                console.warn('[DB V63] copia loan_settlements→prestamos.liquidacion falló:', err);
              }
            }

            // 8. matchingConfiguration → keyval['matchingConfig']
            if (
              db.objectStoreNames.contains('matchingConfiguration') &&
              db.objectStoreNames.contains('keyval')
            ) {
              try {
                const src = (transaction as any).objectStore('matchingConfiguration');
                const dst = transaction.objectStore('keyval');
                const records = (await src.getAll()) as Array<Record<string, unknown>>;
                if (records.length > 0) {
                  // Sólo se preserva la configuración más reciente (ordenada
                  // por createdAt desc, fallback al último). Coincide con la
                  // semántica previa de `getMatchingConfiguration` que
                  // devolvía `configs[0]`.
                  const latest = records.slice().sort((a, b) => {
                    const ca = String(a.createdAt ?? '');
                    const cb = String(b.createdAt ?? '');
                    return cb.localeCompare(ca);
                  })[0];
                  if (latest) {
                    const { id, ...rest } = latest;
                    void id;
                    await dst.put(rest as any, 'matchingConfig');
                  }
                }
              } catch (err) {
                console.warn('[DB V63] copia matchingConfiguration→keyval falló:', err);
              }
            }

            // Eliminar los 8 stores legacy (idempotente)
            const storesToDeleteV63 = [
              'nominas',
              'autonomos',
              'pensiones',
              'otrosIngresos',
              'arrastresManual',
              'documentosFiscales',
              'loan_settlements',
              'matchingConfiguration',
            ];
            for (const store of storesToDeleteV63) {
              if (db.objectStoreNames.contains(store)) {
                db.deleteObjectStore(store);
              }
            }
          })();
        }
      },
      blocked() {
        console.warn('[DB] Upgrade blocked by another connection. Recarga las otras pestañas de ATLAS para completar la migración.');
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

    // Post-upgrade hook: si stashOldObjetivosFinancieros guardó datos
    // antes del upgrade, los mergeamos en `escenarios` ahora que la DB
    // está en V59 (con objetivos_financieros ya eliminado).
    // Esta lectura/escritura usa una transacción readwrite normal
    // sobre `escenarios`.
    dbPromise = dbPromise.then(async (db) => {
      if (v59MergePayload) {
        const stashed = v59MergePayload;
        v59MergePayload = null;
        try {
          const tx = db.transaction(['escenarios'], 'readwrite');
          const store = tx.objectStore('escenarios');
          const existing = (await store.get(1)) as Record<string, unknown> | undefined;
          const now = new Date().toISOString();
          const baseDefaults = {
            id: 1,
            modoVivienda: 'alquiler',
            gastosVidaLibertadMensual: 2500,
            estrategia: 'hibrido',
            hitos: [] as unknown[],
            rentaPasivaObjetivo: 3000,
            patrimonioNetoObjetivo: 600000,
            cajaMinima: 10000,
            dtiMaximo: 35,
            ltvMaximo: 50,
            yieldMinimaCartera: 8,
            tasaAhorroMinima: 15,
          };
          const macro = (
            key:
              | 'rentaPasivaObjetivo'
              | 'patrimonioNetoObjetivo'
              | 'cajaMinima'
              | 'dtiMaximo'
              | 'ltvMaximo'
              | 'yieldMinimaCartera'
              | 'tasaAhorroMinima',
          ): number => {
            if (existing && typeof existing[key] === 'number') return existing[key] as number;
            if (typeof stashed[key] === 'number') return stashed[key] as number;
            return baseDefaults[key];
          };
          const merged = existing
            ? {
                ...baseDefaults,
                ...existing,
                rentaPasivaObjetivo: macro('rentaPasivaObjetivo'),
                patrimonioNetoObjetivo: macro('patrimonioNetoObjetivo'),
                cajaMinima: macro('cajaMinima'),
                dtiMaximo: macro('dtiMaximo'),
                ltvMaximo: macro('ltvMaximo'),
                yieldMinimaCartera: macro('yieldMinimaCartera'),
                tasaAhorroMinima: macro('tasaAhorroMinima'),
                id: 1,
                updatedAt: now,
              }
            : {
                ...baseDefaults,
                rentaPasivaObjetivo: macro('rentaPasivaObjetivo'),
                patrimonioNetoObjetivo: macro('patrimonioNetoObjetivo'),
                cajaMinima: macro('cajaMinima'),
                dtiMaximo: macro('dtiMaximo'),
                ltvMaximo: macro('ltvMaximo'),
                yieldMinimaCartera: macro('yieldMinimaCartera'),
                tasaAhorroMinima: macro('tasaAhorroMinima'),
                updatedAt: now,
              };
          await store.put(merged as unknown as Escenario);
          await tx.done;
        } catch (err) {
          console.warn('[DB V5.9 post-upgrade] merge a escenarios falló:', err);
        }
      }
      return db;
    });
  }
  return dbPromise;
};

/**
 * Migración de datos: fusiona registros duplicados en planesPensionInversion.
 * Cada plan de pensiones debe ser UN único registro con historialAportaciones por año.
 * Los registros antiguos con formato "NOMBRE (YYYY)" se fusionan en uno sin año en el nombre.
 */
export const migrarPlanesDuplicados = async (): Promise<void> => {
  try {
    const db = await initDB();
    const planes = await db.getAll('planesPensionInversion');

    // Solo operar sobre planes de pensiones, no sobre inversiones del mismo store
    const planesPension = planes.filter((p) => p.tipo === 'plan-pensiones');

    // Agrupar por empresa: NIF si existe, o nombre base sin "(YYYY)"
    const grupos: Record<string, typeof planesPension> = {};
    for (const plan of planesPension) {
      const key =
        plan.empresaNif ??
        (typeof plan.nombre === 'string' ? plan.nombre.replace(/\s*\(\d{4}\)\s*/, '').trim() : 'unknown');
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(plan);
    }

    for (const grupo of Object.values(grupos)) {
      if (grupo.length <= 1) continue;

      // El principal es el de menor id (más antiguo)
      grupo.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
      const principal = grupo[0];
      if (!principal.historialAportaciones) principal.historialAportaciones = {};

      for (const plan of grupo) {
        // Fusionar historialAportaciones existente si el registro ya tenía uno
        if (plan.historialAportaciones) {
          for (const [yearKey, entry] of Object.entries(plan.historialAportaciones)) {
            if (!principal.historialAportaciones[yearKey]) {
              principal.historialAportaciones[yearKey] = entry as {
                titular: number; empresa: number; total: number; fuente: 'xml_aeat' | 'manual' | 'atlas_nativo';
              };
            }
          }
        } else {
          // Registro legacy sin historial: extraer año del nombre si lo tiene
          const yearMatch = typeof plan.nombre === 'string' ? plan.nombre.match(/\((\d{4})\)/) : null;
          const año = yearMatch ? parseInt(yearMatch[1]) : null;
          if (año && !principal.historialAportaciones[año]) {
            principal.historialAportaciones[año] = {
              titular: 0,
              empresa: 0,
              total: plan.aportacionesRealizadas ?? 0,
              fuente: 'xml_aeat',
            };
          }
        }
      }

      // Recalcular acumulado desde el historial fusionado
      const entradas = Object.values(principal.historialAportaciones) as Array<{ total: number }>;
      principal.aportacionesRealizadas = entradas.length > 0
        ? entradas.reduce((sum, a) => sum + a.total, 0)
        : principal.aportacionesRealizadas;

      // Limpiar año del nombre base si lo tenía
      if (typeof principal.nombre === 'string') {
        principal.nombre = principal.nombre.replace(/\s*\(\d{4}\)\s*/, '').trim();
      }
      principal.fechaActualizacion = new Date().toISOString();

      await db.put('planesPensionInversion', principal);

      // Borrar duplicados (todos menos el principal)
      for (const plan of grupo.slice(1)) {
        if (plan.id != null) await db.delete('planesPensionInversion', plan.id);
      }
    }
  } catch (err) {
    console.warn('[ATLAS] migrarPlanesDuplicados: error en migración de planes duplicados:', err);
  }
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

    // Get all store names dynamically
    const storeNames = Array.from(db.objectStoreNames);

    // Dynamic import of JSZip to reduce main bundle size
    const JSZip = (await import('jszip')).default;

    // Create a new ZIP file
    const zip = new JSZip();

    // Serialize all stores, stripping Blobs (they go to the documents/ folder)
    const storesData: Record<string, unknown[]> = {};
    const documentsFolder = zip.folder('documents');

    for (const storeName of storeNames) {
      try {
        const records = await db.getAll(storeName as any);
        if (storeName === 'documents') {
          // Strip blob content; store files separately
          const meta: unknown[] = [];
          for (const doc of records as any[]) {
            if (doc.content instanceof Blob) {
              const extension = (doc.filename ?? '').split('.').pop() || 'bin';
              const safeFilename = `${doc.id}.${extension}`;
              if (documentsFolder) {
                documentsFolder.file(safeFilename, doc.content);
                documentsFolder.file(`${doc.id}.meta.json`, JSON.stringify({
                  originalFilename: doc.filename,
                  type: doc.type,
                  uploadDate: doc.uploadDate,
                  metadata: doc.metadata,
                }, null, 2));
              }
              meta.push({ ...doc, content: null });
            } else {
              meta.push(doc);
            }
          }
          storesData[storeName] = meta;
        } else {
          storesData[storeName] = records;
        }
      } catch (err) {
        console.warn(`[exportSnapshot] Error reading store "${storeName}":`, err);
        storesData[storeName] = [];
      }
    }

    // Main data JSON — V2 format (full-stores snapshot)
    const dataObj = {
      metadata: {
        dbVersion: DB_VERSION,
        exportDate: new Date().toISOString(),
        version: '2.0',
        app: 'ATLAS-Horizon-Pulse',
        stores: storeNames,
      },
      stores: storesData,
      // V1 compat fields (kept for backward compatibility with older importSnapshot)
      properties: storesData['properties'] ?? [],
      contracts: storesData['contracts'] ?? [],
      documents: storesData['documents'] ?? [],
    };

    // Add the main data file
    zip.file('atlas-data.json', JSON.stringify(dataObj, null, 2));

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

    // Detect format: V2 (stores map) or V1 (legacy)
    const isV2 = data.stores && typeof data.stores === 'object';
    const availableStoreNames = Array.from(db.objectStoreNames) as string[];

    if (isV2) {
      // ── V2: full-stores snapshot ─────────────────────────────────────────
      const storesToRestore = Object.keys(data.stores).filter(
        (s) => availableStoreNames.includes(s)
      );

      // Process stores in batches of 6 to avoid overwhelming IndexedDB
      // (IndexedDB transactions are limited in concurrent object stores per browser;
      // 6 is a safe value tested with Chrome/Firefox/Safari without hitting limits)
      const BATCH_SIZE = 6;
      for (let i = 0; i < storesToRestore.length; i += BATCH_SIZE) {
        const batch = storesToRestore.slice(i, i + BATCH_SIZE);
        const tx = db.transaction(batch as any[], 'readwrite');

        if (mode === 'replace') {
          await Promise.all(batch.map((s) => tx.objectStore(s as any).clear()));
        }

        for (const storeName of batch) {
          const records = (data.stores[storeName] as any[]) ?? [];

          if (storeName === 'documents') {
            // Restore document blobs from ZIP
            const documentsFolder = zipContent.folder('documents');
            for (const document of records) {
              let documentBlob: Blob | null = null;
              if (documentsFolder && document.id) {
                const extension = (document.filename as string || '').split('.').pop() || 'bin';
                const documentFile = documentsFolder.file(`${document.id}.${extension}`);
                if (documentFile) {
                  const fileData = await documentFile.async('blob');
                  documentBlob = new Blob([fileData], { type: document.type });
                }
              }
              const docToImport = {
                ...document,
                content: documentBlob || document.content || new Blob([''], { type: 'text/plain' }),
              };
              if (mode === 'merge' && document.id) {
                await tx.objectStore(storeName as any).put(docToImport);
              } else {
                const { id: _id, ...docWithoutId } = docToImport;
                try { await tx.objectStore(storeName as any).add(docWithoutId); } catch { /* dup, skip */ }
              }
            }
          } else {
            for (const record of records) {
              if (mode === 'merge' && record.id != null) {
                try { await tx.objectStore(storeName as any).put(record); } catch { /* dup, skip */ }
              } else {
                const { id: _id, ...recordWithoutId } = record;
                try { await tx.objectStore(storeName as any).add(recordWithoutId); } catch { /* dup, skip */ }
              }
            }
          }
        }
        await tx.done;
      }
    } else {
      // ── V1 legacy: only properties, documents, contracts ────────────────
      if (!data.properties || !data.documents || !data.contracts) {
        throw new Error('Archivo de snapshot inválido: estructura de datos incorrecta');
      }

      const tx = db.transaction(['properties', 'documents', 'contracts'], 'readwrite');

      if (mode === 'replace') {
        await Promise.all([
          tx.objectStore('properties').clear(),
          tx.objectStore('documents').clear(),
          tx.objectStore('contracts').clear(),
        ]);
      }

      for (const property of data.properties) {
        if (mode === 'merge' && property.id) {
          await tx.objectStore('properties').put(property);
        } else {
          const { id, ...propertyWithoutId } = property;
          await tx.objectStore('properties').add(propertyWithoutId);
        }
      }

      for (const contract of data.contracts) {
        if (mode === 'merge' && contract.id) {
          await tx.objectStore('contracts').put(contract);
        } else {
          const { id, ...contractWithoutId } = contract;
          await tx.objectStore('contracts').add(contractWithoutId);
        }
      }

      const documentsFolder = zipContent.folder('documents');
      for (const document of data.documents) {
        let documentBlob: Blob | null = null;

        if (documentsFolder && document.id) {
          const extension = document.filename.split('.').pop() || 'bin';
          const documentFile = documentsFolder.file(`${document.id}.${extension}`);

          if (documentFile) {
            const fileData = await documentFile.async('blob');
            documentBlob = new Blob([fileData], { type: document.type });
          }
        }

        const docToImport = {
          ...document,
          content: documentBlob || new Blob([''], { type: 'text/plain' }),
        };

        if (mode === 'merge' && document.id) {
          await tx.objectStore('documents').put(docToImport);
        } else {
          const { id, ...docWithoutId } = docToImport;
          await tx.objectStore('documents').add(docWithoutId);
        }
      }

      await tx.done;
    }

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

/**
 * Versión JSON ligera del snapshot — útil para inspección manual y para el
 * helper expuesto en `window.atlasDB`. Itera dinámicamente sobre TODOS los
 * stores reales presentes en la DB (no hardcodeada) y serializa los blobs
 * de `documents` como base64 in-memory.
 *
 * Para backups completos con ficheros adjuntos, seguir usando exportSnapshot
 * (formato ZIP).
 */
export const exportSnapshotJSON = async (): Promise<{
  metadata: {
    dbName: string;
    dbVersion: number;
    exportedAt: string;
    storeCount: number;
    stores: string[];
  };
  stores: Record<string, unknown[]>;
}> => {
  const db = await initDB();
  const storeNames = Array.from(db.objectStoreNames) as string[];
  const stores: Record<string, unknown[]> = {};

  for (const storeName of storeNames) {
    try {
      const records = await db.getAll(storeName as any);
      // Strip Blob content (incompatible con JSON puro)
      stores[storeName] = (records as any[]).map((r) => {
        if (r && r.content instanceof Blob) {
          return { ...r, content: null, _blobStripped: true };
        }
        return r;
      });
    } catch (err) {
      console.warn(`[exportSnapshotJSON] Error reading store "${storeName}":`, err);
      stores[storeName] = [];
    }
  }

  return {
    metadata: {
      dbName: DB_NAME,
      dbVersion: db.version,
      exportedAt: new Date().toISOString(),
      storeCount: storeNames.length,
      stores: storeNames,
    },
    stores,
  };
};

/**
 * Helper de consola: expone `window.atlasDB` con las funciones de snapshot
 * para que Jose pueda ejecutar `await window.atlasDB.exportSnapshot()` y
 * `await window.atlasDB.exportSnapshotJSON()` desde DevTools.
 *
 * Idempotente y sin coste runtime: simplemente asigna referencias.
 */
const exposeAtlasDBHandle = (): void => {
  if (typeof window === 'undefined') return;
  try {
    (window as any).atlasDB = {
      exportSnapshot,
      exportSnapshotJSON,
      importSnapshot,
      resetAllData: () => resetAllData(),
      getDBVersion: async () => {
        const db = await initDB();
        return db.version;
      },
      listStores: async () => {
        const db = await initDB();
        return Array.from(db.objectStoreNames);
      },
    };
  } catch (err) {
    console.warn('[atlasDB] No se pudo exponer window.atlasDB:', err);
  }
};

// Auto-exposure: el handle queda disponible apenas se importa este módulo.
exposeAtlasDBHandle();

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

export type {
  PersonalData,
} from '../types/personal';

export type {
  ArrastreAmortizacion,
  ArrastreGastoInmueble,
  ArrastrePerdidasAhorro,
  ArrastresEjercicio,
  ConceptoFiscalVinculable,
  DeclaracionActividad,
  DeclaracionBasesYCuotas,
  DeclaracionCapitalMobiliario,
  DeclaracionGananciasPerdidas,
  DeclaracionIRPF,
  DeclaracionInmueble,
  DeclaracionPlanPensiones,
  DeclaracionTrabajo,
  DocumentoFiscal,
  EjercicioFiscal as FiscalEjercicioDomain,
  EstadoEjercicio as FiscalEstadoEjercicio,
  InformeCoberturaDocumental,
  LineaCoberturaDocumental,
  OrigenDeclaracion,
  PerdidasPendientes,
  TipoDocumentoFiscal,
} from '../types/fiscal';
