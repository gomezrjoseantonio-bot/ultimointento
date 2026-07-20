// Frente C · troceo de db.ts · tipos de dominio (types-fiscal).
// Extraídos literalmente. Referencias cruzadas a otros dominios se
// importan del barril ./types (import de tipos · ciclo permitido en TS).

import type { AEATFiscalType } from './types-contratos';
import type { DeclaracionCompleta } from '../../types/declaracionCompleta';

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
