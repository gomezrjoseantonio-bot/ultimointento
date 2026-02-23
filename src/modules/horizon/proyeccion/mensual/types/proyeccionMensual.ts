// src/modules/horizon/proyeccion/mensual/types/proyeccionMensual.ts
// ATLAS HORIZON: Monthly financial projection types

export interface OpexDetalleItem {
  propertyId: number;
  propertyAlias: string;
  concepto: string;
  importe: number;
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
  };

  financiacion: {
    cuotasHipotecas: number;
    cuotasPrestamos: number;
    amortizacionCapital: number;
    total: number;
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
