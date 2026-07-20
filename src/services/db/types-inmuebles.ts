// Frente C · troceo de db.ts · tipos de dominio (types-inmuebles).
// Extraídos literalmente. Referencias cruzadas a otros dominios se
// importan del barril ./types (import de tipos · ciclo permitido en TS).

import type { AEATFiscalType, AEATBox } from './types-contratos';
import type { TipoActivo } from '../../types/tipoActivo';


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
