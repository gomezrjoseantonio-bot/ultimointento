// Frente C · troceo de db.ts · tipos de dominio (types-movimientos).
// Extraídos literalmente. Referencias cruzadas a otros dominios se
// importan del barril ./types (import de tipos · ciclo permitido en TS).

import type { ArrastresEjercicio, DeclaracionInmueble, DeclaracionIRPF, OrigenDeclaracion } from '../../types/fiscal';
import type { BolsaPresupuesto } from '../../types/compromisosRecurrentes';

export type MovementStatus = 'pendiente' | 'parcial' | 'conciliado' | 'no-documentado';
export type TransactionState = 'pending' | 'reconciled' | 'ignored'; // New field for treasury_transactions

// H10 · ReconciliationStatus (`estado_conciliacion`): ELIMINADO en V81 (TAREA CC · Bloque B.1).
// Campo redundante que solo codificaba el booleano "conciliado". Fuente única de conciliación:
// `unifiedStatus === 'conciliado'` (modelo unificado ATLAS HORIZON, escrito por todos los flujos).

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
  // estado_conciliacion: ELIMINADO en V81 (TAREA CC · Bloque B.1) — la conciliación
  // se lee de `unifiedStatus === 'conciliado'` (campo único). Migración de datos post-open.
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
  // V81 (TAREA CC · Bloque B.4): bolsa 50/30/20 copiada desde el CompromisoRecurrente
  // que generó el evento · permite agrupar el gasto real por necesidades/deseos/ahorro.
  bolsaPresupuesto?: BolsaPresupuesto;
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
