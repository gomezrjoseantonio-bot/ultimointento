// src/modules/horizon/proyeccion/mensual/types/proyeccionMensual.ts
// ATLAS HORIZON: Monthly financial projection types

import { OpexDetalleItem } from '../services/forecastEngine';
export type { OpexDetalleItem };

/** Single item in a drill-down breakdown, explaining a component of a total. */
export interface DrillDownItem {
  concepto: string;
  importe: number;
  fuente?: string; // e.g. property alias, nomina name, category
}

export interface MonthlyProjectionRow {
  month: string; // "2026-01"

  ingresos: {
    nomina: number;
    serviciosFreelance: number;
    rentasAlquiler: number;
    dividendosInversiones: number;
    otrosIngresos: number;
    total: number;
    drillDown?: {
      nomina?: DrillDownItem[];
      rentasAlquiler?: DrillDownItem[];
    };
  };

  gastos: {
    gastosOperativos: number;
    /** Per-property/concept breakdown for drill-down (populated by forecastEngine) */
    opexDesglose: OpexDetalleItem[];
    gastosPersonales: number;
    gastosAutonomo: number;
    irpfDevengado: number;
    irpfAPagar: number;
    seguridadSocial: number;
    total: number;
    drillDown?: {
      gastosOperativos?: DrillDownItem[];
      gastosPersonales?: DrillDownItem[];
    };
  };

  financiacion: {
    cuotasHipotecas: number;
    cuotasPrestamos: number;
    amortizacionCapital: number;
    total: number;
    drillDown?: {
      prestamos?: DrillDownItem[];
    };
  };

  tesoreria: {
    flujoCajaMes: number;
    cajaInicial: number;
    cajaFinal: number;
  };

  patrimonio: {
    caja: number;
    inmuebles: number;
    planesPension: number;
    otrasInversiones: number;
    deudaInmuebles: number;
    deudaPersonal: number;
    deudaTotal: number;
    patrimonioNeto: number;
  };
}

export interface ProyeccionAnual {
  year: number;
  months: MonthlyProjectionRow[]; // 12 months
  totalesAnuales: {
    ingresosTotales: number;
    gastosTotales: number;
    financiacionTotal: number;
    flujoNetoAnual: number;
    patrimonioNetoFinal: number;
  };
}

export interface ProyeccionMensualState {
  proyecciones: ProyeccionAnual[];
  loading: boolean;
  error: string | null;
}
