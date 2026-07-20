// Frente C · troceo de db.ts (mover-no-reescribir).
// Tipos de dominio del esquema Atlas (los 45 stores y sus tipos de apoyo),
// extraídos LITERALMENTE de db.ts. Sin dependencia de db.ts (unidireccional:
// db.ts importa estos tipos para la interfaz AtlasHorizonDB y los re-exporta).
// NOTA: este fichero se subdividirá por dominio en el siguiente paso del troceo.

import type { DeclaracionCompleta } from '../../types/declaracionCompleta';
import type { TipoActivo } from '../../types/tipoActivo';
import type { Prestamo } from '../../types/prestamos';
import type {
  ArrastresEjercicio,
  DeclaracionInmueble,
  DeclaracionIRPF,
  OrigenDeclaracion,
} from '../../types/fiscal';

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
  // Estructura de compra (onboarding día 0 · hueco 5.1 · V79) · PRESENTE puro.
  // Campo raíz nuevo (decisión Jose) · NO se anida en `aeatAmortization` (objeto
  // fiscal del pasado · §1) para no fabricar datos AEAT. El precio/gastos viven
  // en `acquisitionCosts`; aquí solo lo que el usuario puso y lo que financió.
  estructuraCompra?: {
    aportacionPropia?: number;  // lo que el usuario puso de su bolsillo
    importeFinanciado?: number; // lo financiado (préstamo)
    prestamoVinculadoId?: string; // FK a Prestamo.id (uuid · string · decisión Jose D1)
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
    /**
     * Ubicación LEGACY de la base/amortización anual del inmueble. La canónica
     * es `aeatAmortization.baseAmortizacion` / `.amortizacionAnualInmueble`;
     * datos antiguos las guardaron aquí. Los consumidores leen
     * `aeatAmortization ?? fiscalData` (patrón fiscal v2 ·
     * amortizacionAcumuladaService.ts:80-82). Se declaran para no necesitar
     * `as any` al leer el fallback.
     */
    baseAmortizacion?: number;
    amortizacionAnualInmueble?: number;
  };
  /** T29 · tipología del activo · default 'piso' efectivo si undefined (registros pre-T29) */
  tipoActivo?: TipoActivo;
  /**
   * V77 · wizard import XML V2 (pilar 1) · subtipo de vivienda que `tipoActivo` no captura.
   * `tipoActivo` resuelve el eje activo/accesorio (piso/parking/trastero/local/otro); este campo
   * refina la tipología edificatoria de la vivienda. Opcional · el wizard del paso 2 sugiere 'piso'.
   */
  subtipoVivienda?: 'piso' | 'casa' | 'chalet' | 'estudio' | 'edificio' | 'otro';
  /** T29 · foto principal del inmueble · base64 data URL · max 500KB tras compresión · undefined si no hay */
  foto?: string;
  /** S-WIZARD-INMUEBLE-V4 · base ITP/AJD desde Ley 11/2021 · auto-rellena con `acquisitionCosts.price` salvo edición manual */
  valorReferencia?: number;
  /** S-WIZARD-INMUEBLE-V4 · anexos físicos · sólo si comparten RC con el piso (si tienen RC propia se dan de alta como inmueble separado) */
  anexos?: {
    tieneParking: boolean;
    tieneTrastero: boolean;
    /** V77 · wizard import XML V2 (pilar 1) · nº de plazas de parking integradas sin RC propia. Sustituye al uso booleano puro cuando se conoce el número. */
    plazasParking?: number;
  };
  /** S-WIZARD-INMUEBLE-V4 · uso fiscal del inmueble · `vendido` no entra (flujo aparte) */
  usoTipo?:
    | 'larga_estancia'
    | 'temporada'
    | 'turistico'
    | 'mixto'
    | 'vivienda_habitual'
    | 'disponible';
  /** S-WIZARD-INMUEBLE-V4 · alquiler por habitaciones (sólo Piso · usos larga/temporada/turístico/mixto) */
  alquilerPorHabitaciones?: {
    activo: boolean;
    numeroHabitaciones?: number;
  };
  /**
   * V77 · wizard import XML V2 (pilar 1) · bloque de explotación · sólo los conceptos que NO existen
   * ya en el modelo. El resto se mapea sobre campos existentes:
   *   · modoExplotacion (piso_completo/por_habitaciones) → `alquilerPorHabitaciones.activo`
   *   · tipoAlquilerDominante (larga/temporada/vacacional/mixto) → `usoTipo`
   *   · esAlquilable → derivable de `usoTipo` (≠ 'vivienda_habitual'/'disponible')
   * Opcional · inmuebles pre-V77 quedan con el bloque undefined.
   */
  explotacion?: {
    estadoOperativo?: 'operativo' | 'en_reforma' | 'vacante' | 'uso_propio';
    unidadesArrendables?: number;
  };
  /**
   * V78 · refactor modelo alquileres v3 · campo PERSISTIDO que decide el ruteo del
   * wizard de import XML AEAT (Camino 1 · Contract identificado · vs Camino 2 · Bote anual).
   * Reemplaza la derivación transitoria que sólo vivía en el wizard (`useInmueblesDetectados`).
   * Migración V77→V78 lo deriva del legacy `alquilerPorHabitaciones.activo`
   * (true → 'por_habitaciones' · false/undefined → 'piso_completo'). El valor 'mixto'
   * sólo se asigna manualmente o por derivación del XML al importar (no se infiere del boolean).
   */
  modoExplotacion?: 'piso_completo' | 'por_habitaciones' | 'mixto';
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
  /**
   * V77 · wizard import XML V2 (pilar 3) · placeholder creado desde el XML sin
   * nombre conocido. La UI muestra badge "sin nombre" y el usuario lo completa
   * después desde el detalle del gasto. Sin índice · no requiere bump adicional.
   */
  sinNombre?: boolean;
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

/**
 * Pieza 8: candidato de vinculación documento → operación declarada
 * (`mejorasActivo` / `mobiliarioActivo`). Es la forma REAL que persiste en
 * `documents.metadata.matchCandidates` — la produce `findCandidates`
 * (documentMatchingService) y la consume `InboxV3ExtractedPanel` vía
 * `.tipoGasto`. La definición canónica vive aquí (capa de esquema);
 * `documentMatchingService` la reexporta como `CandidatoMatch`.
 */
export interface MatchCandidate {
  id: number;
  /** Store de origen de la operación candidata. */
  tipo: 'mejoraActivo' | 'mobiliarioActivo';
  inmuebleId: number;
  inmuebleAlias: string;
  ejercicio: number;
  importe: number;
  /** Tipo de gasto: 'mejora' | 'ampliacion' | 'reparacion' | 'mobiliario'. */
  tipoGasto: string;
  descripcion: string;
  proveedorNIF: string;
  proveedorNombre?: string;
  alreadyLinked: boolean;
  score: number;
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
    // Pieza 8: Document → operation matching (forma canónica: MatchCandidate)
    matchCandidates?: MatchCandidate[];
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
  /** Denormalized alias del inmueble vinculado (para display sin join). */
  inmuebleAlias?: string;
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
  sourceType: 'document' | 'contract' | 'manual' | 'ingreso' | 'gasto' | 'opex_rule' | 'gasto_recurrente' | 'personal_expense' | 'nomina' | 'contrato' | 'prestamo' | 'hipoteca' | 'autonomo' | 'autonomo_ingreso' | 'autonomo_gasto' | 'autonomo_cuota' | 'autonomo_gasto_legacy' | 'otros_ingresos' | 'inversion_compra' | 'inversion_aportacion' | 'inversion_rendimiento' | 'inversion_dividendo' | 'inversion_liquidacion' | 'irpf_prevision';
  // Document/Contract ID (número) o clave compuesta (string · p.ej. autonomo:
  // `${autonomoId}-cuota`). `isDuplicate`/`insertEvent` ya asumían number|string.
  sourceId?: number | string;
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
  /** Denormalized alias del inmueble vinculado (para display sin join). */
  inmuebleAlias?: string;
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
  /**
   * PR-C1 · sub-clasificador de gastos personales reutilizando el
   * vocabulario de `compromisosRecurrentes.tipoFamilia`. Opcional.
   * Valores convencionales: 'vivienda' | 'suministros' | 'dia_a_dia' |
   * 'suscripciones' | 'seguros_cuotas' | 'otros' | 'tributos' |
   * 'comunidad' | 'seguros' | 'gestion' | 'reparacion'.
   */
  tipoFamilia?: string;
  /**
   * PR-C1 · marca de gasto/ingreso esporádico introducido manualmente
   * por el cliente desde el modal de alta. Default `true` cuando
   * `sourceType='manual'` y NO se vincula explícitamente a un compromiso
   * recurrente. Permite a C2/C3 distinguir esporádico vs. real-de-patrón.
   */
  isEsporadico?: boolean;
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

// reconciliationAuditLogs: ELIMINADO en V64 (sub-tarea 5) — deuda técnica · nadie lee · 0 registros en producción
// ReconciliationAuditLog: interfaz eliminada con el store

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
  // T16-cleanup · B-TAREA8-MINIS sub-tarea 1: campo `history?: HistoryEntry[]`
  // eliminado del tipo. Sin escritor productivo (solo migración V64 histórica
  // que usa `Record<string, unknown>`) y sin reader. Los registros antiguos
  // conservan los datos en IndexedDB; quedan ignorados al no estar tipados.
  // Bump de DB_VERSION para purgar el campo queda fuera de scope.
}

// learningLogs: ELIMINADO en V64 (sub-tarea 5) — absorbido en movementLearningRules.history[] · max 50 FIFO
// LearningLog: interfaz eliminada con el store
// HistoryEntry: interfaz eliminada en B-TAREA8-MINIS sub-tarea 1 (T16-cleanup)

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
  // S-FISCAL-FIXES Fix 1 · arrastres entrantes y aplicación del tope N4
  box0103?: number; // Arrastres entrantes disponibles
  box0104?: number; // Arrastres entrantes aplicados este ejercicio
  box0107?: number; // Intereses+reparación aplicados (con tope)
  box0108?: number; // Exceso intereses+reparación arrastrable
  // S-FISCAL-FIXES Fix 3 · imputación renta a disposición
  box0089?: number; // Imputación renta días a disposición
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

  // 'cerrado': el ejercicio tiene cierre ATLAS confirmado (ver cierreAtlasMetadata).
  estado: 'en_curso' | 'pendiente' | 'declarado' | 'prescrito' | 'cerrado';

  // Fecha (ISO) en que se marcó 'declarado' tras importar el XML AEAT.
  declaradoAt?: string;

  // GAP-3: metadatos del cierre ATLAS (forma canónica · ver comentario db.ts:~1529).
  cierreAtlasMetadata?: {
    fechaCierre: string;
    fuenteDatos: ('xml_aeat' | 'pdf_aeat' | 'print_aeat' | 'atlas_nativo' | 'manual')[];
    confirmadoPorUsuario: boolean;
    fechaConfirmacion?: string;
    gastosPersonalesEstimados: number;
    gastosPersonalesAjustadosPorUsuario: boolean;
    totalIngresos: number;
    totalGastos: number;
    cashflowNeto: number;
  };

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

// V71 · SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 1 hueco 4
export interface DeudaFiscal {
  id?: number;
  modelo: '100' | '303' | '130' | '184';
  ejercicio: number;
  periodo: '1T' | '2T' | '3T' | '4T' | 'anual';
  principal: number;
  recargoTipo:
    | 'voluntario'
    | 'ejecutivo_5'
    | 'ejecutivo_10'
    | 'ejecutivo_15'
    | 'apremio_20'
    | 'embargo';
  recargoImporte: number;
  interesesDemora?: number;
  total: number;
  estado: 'voluntario' | 'ejecutivo' | 'apremio' | 'embargo' | 'pagada' | 'aplazada';
  notificada?: string;
  ventanaPlazo?: string;
  claveLiquidacion?: string;
  documentIds?: number[];
  pagadaEl?: string;
  notas?: string;
  createdAt: string;
  updatedAt: string;
}
