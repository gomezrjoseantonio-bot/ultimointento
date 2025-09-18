// Personal V1 Module Types
// Types for the comprehensive personal finance management system

export interface PersonalData {
  id?: number;
  nombre: string;
  apellidos: string;
  dni: string;
  direccion: string;
  situacionPersonal: 'soltero' | 'casado' | 'pareja-hecho' | 'divorciado';
  situacionLaboral: SituacionLaboral[];
  fechaCreacion: string;
  fechaActualizacion: string;
}

export type SituacionLaboral = 'asalariado' | 'autonomo' | 'desempleado' | 'jubilado';

// Nómina (Salary) Types
export interface Nomina {
  id?: number;
  personalDataId: number;
  nombre: string;
  salarioBrutoAnual: number;
  distribucion: {
    tipo: 'doce' | 'catorce' | 'personalizado';
    meses?: number; // For personalizado
  };
  variables: Variable[];
  bonus: Bonus[];
  cuentaAbono: number; // ID of the bank account
  reglaCobroDia: ReglaDia;
  activa: boolean;
  fechaCreacion: string;
  fechaActualizacion: string;
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
export interface Autonomo {
  id?: number;
  personalDataId: number;
  nombre: string;
  ingresosFacturados: IngresosAutonomo[];
  gastosDeducibles: GastoDeducible[];
  cuotaAutonomos: number; // Monthly fee
  cuentaOperaciones: number; // ID of the bank account
  frecuenciaCobroPago: FrecuenciaCobroPago;
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
  mes: number; // 1-12
}

export interface GastoDeducible {
  id?: string;
  descripcion: string;
  importe: number;
  categoria: string;
  fecha: string;
  mes: number; // 1-12
}

export interface FrecuenciaCobroPago {
  tipo: 'mensual' | 'trimestral' | 'semestral' | 'anual';
  reglasDia: ReglaDia;
}

// Investment & Pension Plans Types
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
  tipo: 'dividendos' | 'intereses' | 'fondos-indexados' | 'otros';
  importe: number;
  frecuencia: 'mensual' | 'trimestral' | 'semestral' | 'anual' | 'unico';
  titularidad: 'yo' | 'pareja' | 'ambos';
  cuentaCobro: number;
  reglasDia: ReglaDia;
  activo: boolean;
  fechaCreacion: string;
  fechaActualizacion: string;
}

// Calculation Results Types
export interface CalculoNominaResult {
  netoMensual: number;
  distribuccionMensual: DistribucionMensualResult[];
  totalAnualNeto: number;
}

export interface DistribucionMensualResult {
  mes: number;
  salarioBase: number;
  variables: number;
  bonus: number;
  netoTotal: number;
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