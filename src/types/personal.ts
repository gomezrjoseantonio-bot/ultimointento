// Personal V1 Module Types
// Types for the comprehensive personal finance management system
//
// ATLAS Personal v1.1 (sección 1.2) introduce dos stores nuevos cuyos tipos
// viven en módulos dedicados para mantener este archivo legible:
//   - `compromisosRecurrentes` → src/types/compromisosRecurrentes.ts
//   - `viviendaHabitual`       → src/types/viviendaHabitual.ts
// Re-exportamos para que los consumidores existentes mantengan un único
// punto de import.

export * from './compromisosRecurrentes';
export * from './viviendaHabitual';

export type EmploymentStatus = 'employed' | 'self_employed' | 'retired' | 'unemployed';
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
export type HousingType = 'rent' | 'ownership_with_mortgage' | 'ownership_without_mortgage' | 'living_with_parents';
export type NivelDiscapacidad = 'ninguna' | 'hasta33' | 'entre33y65' | 'mas65';
export type TipoTributacion = 'individual' | 'conjunta';

export interface Descendiente {
  id: string;
  fechaNacimiento: string; // ISO date
  discapacidad: NivelDiscapacidad;
}

export interface Ascendiente {
  id: string;
  edad: number;
  convive: boolean;
  discapacidad: NivelDiscapacidad;
}

export interface PersonalData {
  id?: number;
  nombre: string;
  apellidos: string;
  dni: string;
  direccion: string;
  situacionPersonal: 'soltero' | 'casado' | 'pareja-hecho' | 'divorciado';
  situacionLaboral: SituacionLaboral[];
  situacionLaboralConyugue?: SituacionLaboral[];
  // Extended profile fields for dynamic module personalisation
  employmentStatus?: EmploymentStatus;
  maritalStatus?: MaritalStatus;
  spouseName?: string;
  housingType?: HousingType;
  hasVehicle?: boolean;
  hasChildren?: boolean | number;
  comunidadAutonoma?: string;
  // IRPF personal minimums
  descendientes?: Descendiente[];
  ascendientes?: Ascendiente[];
  discapacidad?: NivelDiscapacidad;
  tributacion?: TipoTributacion;
  fechaNacimiento?: string; // ISO date or dd/mm/yyyy from XML
  fechaCreacion: string;
  fechaActualizacion: string;
}

export type SituacionLaboral = 'asalariado' | 'autonomo' | 'desempleado' | 'jubilado';

// Nómina (Salary) Types
export interface Nomina {
  id?: number;
  personalDataId: number;

  // ── IDENTIDAD ──────────────────────────────────────────────
  titular: 'yo' | 'pareja';
  nombre: string;

  // ── ANTIGÜEDAD ─────────────────────────────────────────────
  fechaAntiguedad: string;               // ISO date — inicio en la empresa
  fechaAntiguedadReconocida?: string;    // ISO date — si reconocen otra fecha anterior

  // ── QUÉ COBRO: RETRIBUCIÓN DINERARIA ──────────────────────
  salarioBrutoAnual: number;
  distribucion: {
    tipo: 'doce' | 'catorce' | 'personalizado';
    meses: number;
  };
  variables: Variable[];
  bonus: Bonus[];

  // ── QUÉ COBRO: RETRIBUCIÓN EN ESPECIE ─────────────────────
  beneficiosSociales: BeneficioSocial[];

  // ── DATOS FISCALES ADICIONALES (OPCIONAL) ─────────────────
  retribucionEspecieAnual?: number;
  aportacionEmpresaPlanPensionesAnual?: number;

  // ── QUÉ ME QUITAN: RETENCIÓN ──────────────────────────────
  retencion: RetencionNomina;

  // ── QUÉ ME QUITAN: PLAN PENSIONES ─────────────────────────
  planPensiones?: PlanPensionesNomina;

  // ── QUÉ ME QUITAN: OTRAS DEDUCCIONES ──────────────────────
  deduccionesAdicionales: DeduccionNomina[];

  // ── DÓNDE COBRO ────────────────────────────────────────────
  cuentaAbono: number;

  // ── CUÁNDO COBRO ───────────────────────────────────────────
  reglaCobroDia: ReglaDia;

  // ── ESTADO ─────────────────────────────────────────────────
  activa: boolean;
  fechaCreacion: string;
  fechaActualizacion: string;

  // ─── ATLAS Personal v1.1 · ampliaciones (sección 5) ───────────────────────
  // Campos opcionales · capturan una nómina española real para reproducir
  // y proyectar futuras (15-17 eventos/año por nómina activa).
  empresa?: NominaEmpresa;
  contrato?: NominaContrato;
  cuentaCobroIBAN?: NominaCuentaCobro; // IBAN + concepto bancario para conciliación
  irpfDetalle?: NominaIRPFDetalle;
  pagasExtra?: NominaPagasExtra; // mesesExtra + importe paga extra (G-06)
  variableObjetivo?: NominaVariableObjetivo; // proyección al 100% (G-02)
  bonusObjetivo?: NominaBonusObjetivo; // proyección al 100% (G-02)
  cuotaSolidaridadMensual?: number; // G-04 · usuario lo rellena al alta (alias de retencion.cuotaSolidaridadMensual)
  // Última nómina importada (PDF/CSV) · útil para validar el cálculo
  ultimaNominaImportada?: {
    mes: string; // YYYY-MM
    pdfDocumentoId?: string;
    irpfAcumuladoEjercicio?: number;
  };
}

// ── Sub-objetos de la ampliación v1.1 ───────────────────────────────────────

export interface NominaEmpresa {
  nombre: string;          // "Orange España S.A.U."
  cif: string;             // "A82009812"
  centroTrabajo?: string;  // "La Finca Ed.05"
  centroCoste?: string;    // "MP1000"
}

export interface NominaContrato {
  tipo: 'indefinidoCompleta' | 'indefinidoParcial' | 'temporal' | 'practicas' | 'formacion';
  fechaAlta: string;       // ISO date · antigüedad
  grupoCotizacion: string; // "01"
  grupoProfesional?: string;
  posicion?: string;
  area?: string;
  horasJornada: number;    // 160 · 168 · 40
}

export interface NominaCuentaCobro {
  iban: string;            // ES61 0049 0052 6322 1041 2715
  diaAbono: number | 'ultimoHabil';
  conceptoBancario: string; // "NOMINA ORANGE ESPAÑA SAU"
}

export interface NominaIRPFDetalle {
  retencionAnualEstimada?: number;
  retencionMensualMedia?: number;
  irpfAcumuladoEjercicio?: number;
}

export interface NominaPagasExtra {
  mesesExtra: number[];    // ej. [6, 12]
  // Si se omite el importe · ATLAS lo calcula como (salarioBrutoAnual / numeroPagas)
  importePorPagaExtra?: number; // bruto
}

export interface NominaVariableObjetivo {
  objetivoAnual: number;        // bruto · se proyecta al 100% (G-02)
  pagaderoEnMeses: number[];    // ej. [3] · variable Q4 cobrado en marzo
  // No hay factorRealizacion · proyectamos íntegro y reconciliamos
}

export interface NominaBonusObjetivo {
  importeAnual: number;
  pagaderoEnMes: number; // 1=enero
}

export interface RetencionNomina {
  irpfPorcentaje: number;
  ss: {
    baseCotizacionMensual: number;       // Editable, pre-rellenado con tope del año
    contingenciasComunes: number;        // % editable, default 4.70
    desempleo: number;                   // % editable, default 1.55
    formacionProfesional: number;        // % editable, default 0.10
    mei?: number;                        // % editable, default 0.13 (2025) / 0.15 (2026)
    overrideManual: boolean;             // true si usuario ajustó manualmente
  };
  cuotaSolidaridadMensual?: number;      // Importe fijo editable
}

export interface PlanPensionesNomina {
  aportacionEmpresa: {
    tipo: 'porcentaje' | 'importe';
    valor: number;                       // % o €/mes
    salarioBaseObjetivo?: number;        // Solo si tipo='porcentaje'
  };
  aportacionEmpleado: {
    tipo: 'porcentaje' | 'importe';
    valor: number;                       // % o €/mes — SE DESCUENTA del líquido
    salarioBaseObjetivo?: number;
  };
  productoDestinoId?: number;            // → PosicionInversion.id
  productoDestinoNombre?: string;        // Nombre para mostrar
}

export interface BeneficioSocial {
  id: string;
  concepto: string;
  tipo: 'seguro-vida' | 'seguro-medico' | 'cheque-guarderia'
      | 'gasolina' | 'vehiculo-empresa' | 'telefono' | 'formacion'
      | 'conciliacion' | 'otro';
  importeMensual: number;
  incrementaBaseIRPF: boolean;           // true excepto cheque guardería (exento)
}

export interface DeduccionNomina {
  id: string;
  concepto: string;
  importeMensual: number;
  esRecurrente: boolean;
  mes?: number;                          // Si puntual, en qué mes
}

export interface Variable {
  id?: string;
  nombre: string;
  tipo: 'porcentaje' | 'importe';
  valor: number; // Percentage or annual amount
  distribucionMeses: DistribucionMes[];
}

export interface DistribucionMes {
  mes: number; // 1-12
  porcentaje: number; // Percentage of the variable for this month
}

export interface Bonus {
  id?: string;
  descripcion: string;
  importe: number;
  mes: number; // 1-12
}

export interface ReglaDia {
  tipo: 'fijo' | 'ultimo-habil' | 'n-esimo-habil';
  dia?: number; // 1-31 for fijo
  posicion?: number; // For n-esimo-habil (penultimo=-2, antepenultimo=-3, etc)
}

// Autónomo (Self-Employed) Types
export interface FuenteIngreso {
  id?: string;
  nombre: string; // Income concept name
  importeEstimado: number; // Amount per occurrence
  meses: number[]; // Months of impact (1=Jan..12=Dec); all 12 means monthly
  diaCobro?: number; // Day of month when this concept is collected (1-31)
  frecuencia?: 'mensual' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'; // Legacy – kept for backward compatibility
  aplIrpf?: boolean; // Whether IRPF is retained by client on this income
  aplIva?: boolean; // Whether IVA applies to this income
}

export interface GastoRecurrenteActividad {
  id?: string;
  descripcion: string;
  importe: number; // Amount per occurrence
  categoria: string;
  meses?: number[]; // Months of impact (1=Jan..12=Dec); undefined/empty means monthly (all 12)
  diaPago?: number; // Day of month when this concept is paid (1-31)
}

export type TipoActividadAutonomo = 'A03' | 'A05';
export type ModalidadActividadAutonomo = 'simplificada' | 'normal';

export interface Autonomo {
  id?: number;
  personalDataId: number;
  nombre: string;
  titular?: string; // Name of the owner of this activity (titular or cónyuge)
  tipoActividad?: TipoActividadAutonomo;
  epigrafeIAE?: string;
  descripcionActividad?: string;
  modalidad?: ModalidadActividadAutonomo;
  cuotaAutonomosCompartida?: boolean; // Marks the activity that carries the shared RETA quota
  ingresosFacturados: IngresosAutonomo[];
  gastosDeducibles: GastoDeducible[];
  fuentesIngreso?: FuenteIngreso[]; // Income concepts with temporality
  gastosRecurrentesActividad?: GastoRecurrenteActividad[]; // Expense concepts with temporality
  cuotaAutonomos: number; // Monthly fee (Seguridad Social)
  irpfRetencionPorcentaje?: number; // % IRPF retention on invoices (e.g. 7 or 15)
  ivaMedioPorcentaje?: number; // % average IVA applied to invoices (e.g. 21)
  cuentaCobro: number; // ID of the bank account for collecting income
  cuentaPago: number; // ID of the bank account for paying expenses
  reglaCobroDia: ReglaDia; // Rules for collection day
  reglaPagoDia: ReglaDia; // Rules for payment day
  activo: boolean;
  fechaCreacion: string;
  fechaActualizacion: string;
}

export interface IngresosAutonomo {
  id?: string;
  descripcion: string;
  importe: number;
  conIva: boolean;
  tipoIva?: number; // If conIva is true
  fecha: string;
  numeroFactura?: string;
  cliente?: string;
}

export interface GastoDeducible {
  id?: string;
  descripcion: string;
  importe: number;
  categoria: string;
  fecha: string;
  proveedor?: string;
  numeroFactura?: string;
  porcentajeDeducible: number; // 0-100, percentage that is deductible
}

// Pension Income Types
export type TipoPension = 'jubilacion' | 'viudedad' | 'incapacidad' | 'orfandad';

export interface PensionIngreso {
  id?: number;
  personalDataId: number;
  titular: 'yo' | 'pareja';
  tipoPension: TipoPension;
  pensionBrutaAnual: number;
  numeroPagas: 12 | 14;
  irpfPorcentaje: number;
  activa: boolean;
  fechaCreacion: string;
  fechaActualizacion: string;
}

export interface CalculoPensionResult {
  netoMensual: number;
  netoAnual: number;
  retencionAnual: number;
}

// ─── ATLAS V61 · TAREA 7 sub-tarea 2 · `nominas → ingresos` rename ──────────
//
// Unión discriminada que unifica las tres fuentes de ingreso personal
// (`nominas`, `autonomos`, `pensiones`) en un único store `ingresos`. El
// discriminante `tipo` separa cada variante, preservando la forma exacta de
// los tipos legacy `Nomina`, `Autonomo` y `PensionIngreso` para que la
// migración V60→V61 sea no destructiva (sólo añade `tipo='nomina'` a los
// registros existentes copiados desde `nominas`).
//
// Sub-tarea 2 (este PR) sólo crea el store y copia `nominas → ingresos` con
// `tipo='nomina'`. Los registros de `autonomos` y `pensiones` se absorberán
// en sub-tareas posteriores (mapeo de campos a esta unión + migración de
// datos). Los consumidores siguen leyendo de `nominas`/`autonomos`/`pensiones`
// hasta sub-tarea 6, momento en que se redirigen al nuevo store.
export type IngresoNomina = Nomina & { tipo: 'nomina' };
export type IngresoAutonomo = Autonomo & { tipo: 'autonomo' };
export type IngresoPension = PensionIngreso & { tipo: 'pension' };

/**
 * V63 (TAREA 7 sub-tarea 4-bis): metadata específica del subtipo `otro` de
 * ingresos. Se almacena bajo `IngresoOtro.metadata.otro` para no colisionar
 * con futuros sub-tipos de metadatos (`metadata.nomina`, `metadata.autonomo`,
 * etc., reservados).
 *
 * Subtipos canónicos (decisión sub-tarea 4-bis):
 *   - 'premio'        · premios, sorteos
 *   - 'indemnizacion' · indemnizaciones laborales/aseguradoras
 *   - 'beca'          · becas, ayudas formativas
 *   - 'regalo'        · donaciones recibidas
 *   - 'otro'          · catch-all (default migración V63 desde
 *                       `otrosIngresos.tipo` legacy = 'prestacion-desempleo'
 *                       | 'subsidio-ayuda' | 'pension-alimenticia' |
 *                       'devolucion-deuda' | 'otro').
 *
 * `concepto` y `fecha` son obligatorios para trazabilidad fiscal. `casillaAEAT`
 * es opcional (se rellena cuando el ingreso debe declararse en una casilla
 * concreta del IRPF, e.g. ganancias patrimoniales no derivadas de
 * transmisiones).
 */
export interface OtroIngresoMetadata {
  subtipo: 'premio' | 'indemnizacion' | 'beca' | 'regalo' | 'otro';
  concepto: string;
  fecha: string;
  casillaAEAT?: string;
}

/**
 * V63 (TAREA 7 sub-tarea 4-bis): variante del store unificado `ingresos`
 * para registros del store eliminado `otrosIngresos`. Preserva la forma
 * legacy `OtrosIngresos` (consumidores siguen usándola vía
 * `otrosIngresosService` que actúa como adaptador) y añade `metadata.otro`
 * con los nuevos subtipos canónicos.
 */
export type IngresoOtro = OtrosIngresos & {
  tipo: 'otro';
  metadata?: { otro?: OtroIngresoMetadata };
};

export type Ingreso = IngresoNomina | IngresoAutonomo | IngresoPension | IngresoOtro;

// Calculation Results Types
export interface PlanPensionInversion {
  id?: number;
  personalDataId: number;
  nombre: string;
  tipo: 'plan-pensiones' | 'inversion' | 'fondo-indexado' | 'acciones' | 'otros';
  entidad?: string;                    // entidad gestora (Orange, VidaCaixa...)
  fechaApertura?: string;              // cuándo se abrió el plan
  aportacionesRealizadas: number;      // total acumulado (compatibilidad)
  unidades?: number;
  valorCompra: number;
  valorActual: number;
  titularidad: 'yo' | 'pareja' | 'ambos';
  aportacionPeriodica?: AportacionPeriodica;
  esHistorico: boolean; // true for historical investments without periodic contributions

  // historial de aportaciones por año o mes
  // Clave: 'YYYY' para granularidad anual o 'YYYY-MM' para mensual
  historialAportaciones?: Record<string, {
    titular: number;      // aportación del titular en el periodo
    empresa: number;      // aportación de la empresa en el periodo
    total: number;        // titular + empresa
    fuente: 'xml_aeat' | 'manual' | 'atlas_nativo' | 'traspaso_entrada' | 'traspaso_salida';
  }>;

  // vinculación a nómina y empresa
  nominaVinculadaId?: number;
  empresaNif?: string;
  empresaNombre?: string;

  fechaCreacion: string;
  fechaActualizacion: string;
}

export interface AportacionPeriodica {
  importe: number;
  frecuencia: 'mensual' | 'trimestral' | 'semestral' | 'anual';
  cuentaAbono: number;
  reglasDia: ReglaDia;
  activa: boolean;
}

// Stores donde puede vivir un plan de pensiones. Existen dos legacy:
//   - `planesPensionInversion` (store dedicado en Personal → Planes)
//   - `inversiones` con `tipo='plan_pensiones' | 'plan-pensiones' | 'plan_empleo'`
export type PlanStore = 'planesPensionInversion' | 'inversiones';

// Traspaso de planes de pensiones (movimiento patrimonial sin tributación —
// art. 8.8 LRPFP). No computa como aportación deducible ni como rescate.
// El evento se guarda como entidad propia para mantener trazabilidad del
// recorrido del dinero entre planes: el histórico de valoraciones sigue
// ligado al plan donde ocurrió (activo_id en valoraciones_historicas).
export interface TraspasoPlan {
  id?: number;
  personalDataId: number;
  planOrigenId: number;
  planDestinoId: number;
  // Store de origen / destino — necesarios para desambiguar, ya que los IDs
  // son auto-increment independientes por store y pueden colisionar.
  planOrigenStore?: PlanStore;
  planDestinoStore?: PlanStore;
  // Snapshot de nombre/entidad al momento del traspaso para no perder
  // trazabilidad si el plan origen/destino se elimina más adelante.
  planOrigenNombre: string;
  planOrigenEntidad?: string;
  planDestinoNombre: string;
  planDestinoEntidad?: string;
  fecha: string;       // YYYY-MM-DD
  importe: number;     // importe bruto traspasado en €
  esTotal: boolean;    // true si el traspaso fue por el saldo completo del origen
  unidadesTraspasadas?: number;
  notas?: string;
  fechaCreacion: string;
}

// Other Income Types
export interface OtrosIngresos {
  id?: number;
  personalDataId: number;
  nombre: string;
  tipo: 'prestacion-desempleo' | 'subsidio-ayuda' | 'pension-alimenticia' | 'devolucion-deuda' | 'otro';
  importe: number;
  frecuencia: 'mensual' | 'trimestral' | 'semestral' | 'anual' | 'unico';
  titularidad: 'yo' | 'pareja' | 'ambos';
  cuentaCobro: number;
  reglasDia: ReglaDia;
  activo: boolean;
  fechaInicio?: string;
  fechaFin?: string;
  fechaCreacion: string;
  fechaActualizacion: string;
}

// Calculation Results Types
export interface CalculoNominaResult {
  netoMensual: number;                   // Promedio mensual del líquido
  distribucionMensual: DistribucionMensualResult[];
  totalAnualNeto: number;
  totalAnualBruto: number;               // bruto base + variables + bonus
  totalAnualEspecie: number;
  totalAnualPP: number;                  // empresa + empleado
  totalAnualPPEmpleado: number;          // aportación empleado al plan pensiones
  totalAnualPPEmpresa: number;           // aportación empresa al plan pensiones
}

export interface DistribucionMensualResult {
  mes: number;
  salarioBase: number;
  pagaExtra: number;
  variables: number;
  bonus: number;
  totalDevengado: number;
  especie: number;
  // Deducciones
  ssTotal: number;
  irpfImporte: number;
  ppEmpleado: number;
  otrasDeducciones: number;
  totalDeducciones: number;
  netoTotal: number;                     // = totalDevengado - totalDeducciones
  // Plan pensiones al producto (NO pasa por cuenta)
  ppTotalAlProducto: number;             // empresa + empleado → va al producto financiero
}

export interface CalculoAutonomoResult {
  resultadoNetoMensual: number;
  ingresosBrutos: number;
  gastos: number;
  cuotaAutonomos: number;
  resultadoAnual: number;
}

// Integration Types for Treasury and Projections
export interface MovimientoPersonal {
  id?: string;
  tipo: 'nomina' | 'autonomo' | 'pension-inversion' | 'otros-ingresos';
  origenId: number; // ID of the source (nomina, autonomo, etc.)
  fecha: string;
  importe: number;
  descripcion: string;
  cuenta: number;
  categoria: string;
  subcategoria: string;
  esRecurrente: boolean;
  fiscalData?: {
    esDeclarable: boolean;
    tipoRenta: 'trabajo' | 'capital' | 'actividad-economica';
    retencion?: number;
  };
}

// Personal Module Configuration
export interface PersonalModuleConfig {
  personalDataId: number;
  seccionesActivas: {
    nomina: boolean;
    autonomo: boolean;
    pensionesInversiones: boolean;
    otrosIngresos: boolean;
  };
  integracionTesoreria: boolean;
  integracionProyecciones: boolean;
  integracionFiscalidad: boolean;
  fechaActualizacion: string;
}

// Categorías de gastos personales
export type CategoriaGasto = 
  | 'vivienda'      // Hipoteca, alquiler, comunidad
  | 'suministros'   // Luz, agua, gas, internet
  | 'transporte'    // Coche, transporte público
  | 'seguros'       // Todos los seguros
  | 'suscripciones' // Netflix, Spotify, gimnasio
  | 'salud'         // Seguro médico, farmacia
  | 'educacion'     // Cursos, colegios
  | 'otros';

// Gasto recurrente (mensual, trimestral, etc.)
export interface GastoRecurrente {
  id?: number;
  personalDataId: number;
  nombre: string;
  importe: number;
  frecuencia: 'mensual' | 'bimestral' | 'trimestral' | 'semestral' | 'anual' | 'meses_especificos';
  categoria: CategoriaGasto;
  cuentaPago?: number;           // ID cuenta bancaria (opcional)
  diaCobro: number;              // Día del mes (1-31)
  mesesCobro?: number[];         // [1,7] para Enero y Julio si es meses_especificos
  fechaInicio: string;
  fechaFin?: string;             // Opcional, para gastos temporales
  activo: boolean;
  notas?: string;
  fechaCreacion: string;
  fechaActualizacion: string;
}

// Gasto puntual (único)
export interface GastoPuntual {
  id?: number;
  personalDataId: number;
  descripcion: string;
  importe: number;
  fecha: string;
  categoria: CategoriaGasto;
  cuentaPago?: number;
  notas?: string;
  fechaCreacion: string;
}

// Resumen mensual calculado
export interface ResumenPersonalMensual {
  mes: number;
  anio: number;
  ingresos: {
    nomina: number;
    autonomo: number;
    otros: number;
    total: number;
  };
  gastos: {
    recurrentes: number;
    puntuales: number;
    total: number;
  };
  ahorro: number;
  variacionMesAnterior: number;  // % cambio vs mes anterior
}

// ============================================================================
// Personal Expenses (OPEX-style recurring expenses for personal finance)
// ============================================================================

export type PersonalExpenseCategory =
  | 'vivienda'
  | 'alimentacion'
  | 'transporte'
  | 'ocio'
  | 'salud'
  | 'seguros'
  | 'educacion'
  | 'otros';

export type PersonalExpenseFrequency =
  | 'semanal'
  | 'mensual'
  | 'bimestral'
  | 'trimestral'
  | 'semestral'
  | 'anual'
  | 'meses_especificos';

export type PersonalExpenseEstacionalidad = 'plana' | 'invierno' | 'verano';


export interface AsymmetricPaymentPersonal {
  mes: number;
  importe: number;
}

export interface PersonalExpense {
  id?: number;
  personalDataId: number;
  concepto: string;
  categoria: PersonalExpenseCategory;
  importe: number;
  frecuencia: PersonalExpenseFrequency;
  diaPago?: number;
  mesesCobro?: number[];
  diaDeLaSemana?: number; // 0=Lunes … 6=Domingo, para frecuencia semanal
  mesInicio?: number; // 1-12, mes de inicio para frecuencias periódicas
  asymmetricPayments?: AsymmetricPaymentPersonal[];
  estacionalidad?: PersonalExpenseEstacionalidad;
  accountId?: number;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// PatronGastoPersonal — Renamed from PersonalExpense
// Defines the expected spending pattern. Source for forecastEngine.
// Does NOT contain real/confirmed data — only the pattern.
// ============================================================================

export interface PatronGastoPersonal {
  id?: number;
  personalDataId: number;
  concepto: string;
  categoria: PersonalExpenseCategory;
  importe: number;                    // importeEstimado — expected amount per occurrence
  frecuencia: PersonalExpenseFrequency;
  diaPago?: number;
  mesesCobro?: number[];
  diaDeLaSemana?: number;
  mesInicio?: number;
  asymmetricPayments?: AsymmetricPaymentPersonal[];
  estacionalidad?: PersonalExpenseEstacionalidad;
  accountId?: number;                 // cuentaCargoId — expected account
  origen: 'perfil' | 'manual';       // suggested by profile or created by user
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

