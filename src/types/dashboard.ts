/**
 * Dashboard Type Definitions
 * 
 * Complete type system for the refactored ATLAS Horizon Dashboard
 * Following the requirements from the refactoring specification
 */

export interface PatrimonioData {
  total: number;
  variacionMes: number;
  variacionPorcentaje: number;
  fechaCalculo: string;
  desglose: {
    inmuebles: number;
    inversiones: number;
    cuentas: number;
    deuda: number;
  };
}

export interface FlujosCaja {
  trabajo: {
    netoMensual: number;
    netoHoy?: number;
    pendienteMes?: number;
    tendencia: 'up' | 'down' | 'stable';
    variacionPorcentaje: number;
  };
  inmuebles: {
    cashflow: number;
    cashflowHoy?: number;
    pendienteMes?: number;
    ocupacion: number;
    vacantes?: Array<{
      propertyId?: number;
      propertyAlias: string;
      unidadLabel: string;
    }>;
    tendencia: 'up' | 'down' | 'stable';
  };
  inversiones: {
    rendimientoMes: number;
    dividendosMes: number;
    totalHoy?: number;
    pendienteMes?: number;
    tendencia: 'up' | 'down' | 'stable';
  };
}

export interface SaludFinanciera {
  liquidezHoy: number;
  gastoMedioMensual: number;
  colchonMeses: number;
  estado: 'ok' | 'warning' | 'critical';
  proyeccion30d: {
    estimado: number;
    ingresos: number;
    gastos: number;
  };
}

export interface Alerta {
  id: string;
  tipo: 'cobro' | 'contrato' | 'pago' | 'documento' | 'hipoteca' | 'ipc';
  titulo: string;
  descripcion: string;
  urgencia: 'alta' | 'media';
  diasVencimiento: number;
  importe?: number;
  link: string;
}

export interface DashboardData {
  patrimonio: PatrimonioData;
  flujos: FlujosCaja;
  salud: SaludFinanciera;
  alertas: Alerta[];
  ultimaActualizacion: string;
}
