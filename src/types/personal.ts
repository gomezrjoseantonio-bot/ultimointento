// Personal V1 Module Types
// Types for the comprehensive personal finance management system

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
}

export interface Autonomo {
  id?: number;
  personalDataId: number;
  nombre: string;
  titular?: string; // Name of the owner of this activity (titular or cónyuge)
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

// Calculation Results Types
export interface PlanPensionInversion {
  id?: number;
  personalDataId: number;
  nombre: string;
  tipo: 'plan-pensiones' | 'inversion' | 'fondo-indexado' | 'acciones' | 'otros';
  aportacionesRealizadas: number;
  unidades?: number;
  valorCompra: number;
  valorActual: number;
  titularidad: 'yo' | 'pareja' | 'ambos';
  aportacionPeriodica?: AportacionPeriodica;
  esHistorico: boolean; // true for historical investments without periodic contributions
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
  fechaFin?: string;
  fechaCreacion: string;
  fechaActualizacion: string;
}

// Calculation Results Types
export interface CalculoNominaResult {
  netoMensual: number;                   // Promedio mensual del líquido
  distribuccionMensual: DistribucionMensualResult[];
  totalAnualNeto: number;
  totalAnualBruto: number;               // bruto base + variables + bonus
  totalAnualEspecie: number;
  totalAnualPP: number;                  // empresa + empleado
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
  otrasDeduciones: number;
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