import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface WorkIncome {
  dinerarias: number;
  especieValoracion: number;
  especieIngresoACuenta: number;
  contribucionEmpresarialPP: number;
  cotizacionSS: number;
  otrosGastosDeducibles: number;
  retencion: number;
}

export interface CapitalMobiliario {
  interesesCuentasDepositos: number;
  otrosRendimientos: number;
  retencion: number;
}

export type SituacionInmueble = 1 | 2 | 3;
export type TipoUsoInmueble = 'arrendado' | 'disposicion' | 'mixto' | 'accesorio';

export interface InmuebleAccesorio {
  refCatastral: string;
  fechaAdquisicion: string;
  diasArrendados: number;
  valorCatastral: number;
  valorCatastralConstruccion: number;
  pctConstruccion: number;
  importeAdquisicion: number;
  gastosTributos: number;
  baseAmortizacion: number;
  amortizacion: number;
}

export interface CarryForwardItem {
  ejercicio: number;
  pendienteInicioPeriodo: number;
  aplicadoEsteEjercicio: number;
  pendienteFuturos: number;
}

export interface Inmueble {
  id: string;
  refCatastral: string;
  direccion: string;
  situacion: SituacionInmueble;
  urbana: boolean;
  pctPropiedad: number;
  tipo: TipoUsoInmueble;
  fechaAdquisicion: string;
  importeAdquisicion: number;
  gastosTributos: number;
  mejoras2024: number;
  valorCatastral: number;
  valorCatastralConstruccion: number;
  pctConstruccion: number;
  baseAmortizacion: number;
  amortizacionInmueble: number;
  amortizacionBienesMuebles: number;
  diasDisposicion: number;
  diasArrendados: number;
  ingresosIntegros: number;
  interesesFinanciacion: number;
  gastosReparacionConservacion: number;
  limiteInteresesReparacion: number;
  gastosReparacionNoDeducibles: number;
  gastosComunidad: number;
  serviciosPersonales: number;
  serviciosSuministros: number;
  seguro: number;
  tributosRecargos: number;
  gastosPendientesAnteriores: CarryForwardItem[];
  gastosArrastreAplicados: number;
  gastosDeduciblesProximos4Anios: number;
  rentaImputada: number;
  tieneReduccionVivienda: boolean;
  pctReduccion: number;
  reduccionAplicada: number;
  accesorio?: InmuebleAccesorio;
  rendimientoNeto: number;
  rendimientoNetoReducido: number;
}

export type ModalidadED = 'simplificada' | 'normal';

export interface ActividadEconomica {
  id: string;
  codigoActividad: string;
  epigafreIAE: string;
  modalidad: ModalidadED;
  ingresosExplotacion: number;
  seguridadSocialTitular: number;
  serviciosProfesionales: number;
  otrosGastos: number;
  provisionSimplificada: number;
  rendimientoNeto: number;
  retencion: number;
}

export type TipoGananciaPatrimonial =
  | 'transmision_inmueble'
  | 'transmision_fondos'
  | 'cripto'
  | 'otras_no_transmision'
  | 'otras_transmision';

export type BaseGP = 'general' | 'ahorro';

export interface GananciaPatrimonial {
  id: string;
  tipo: TipoGananciaPatrimonial;
  base: BaseGP;
  descripcion: string;
  valorTransmision: number;
  valorAdquisicion: number;
  resultado: number;
}

export interface SaldoNegativoPendiente {
  ejercicio: number;
  pendienteInicioPeriodo: number;
  aplicadoEsteEjercicio: number;
  pendienteFuturos: number;
}

export interface PreviewSocial {
  aportacionTrabajador: number;
  contribucionEmpresarial: number;
  nifEmpleador: string;
  totalConDerechoReduccion: number;
  importeAplicado: number;
}

export interface TaxState {
  ejercicio: number;
  workIncome: WorkIncome;
  capitalMobiliario: CapitalMobiliario;
  inmuebles: Inmueble[];
  actividades: ActividadEconomica[];
  gananciasPatrimoniales: GananciaPatrimonial[];
  saldosNegativosBIA: SaldoNegativoPendiente[];
  previsionSocial: PreviewSocial;
  baseImponibleGeneral: number;
  baseImponibleAhorro: number;
  baseLiquidableGeneral: number;
  baseLiquidableAhorro: number;
  cuotaIntegra: number;
  cuotaLiquida: number;
  totalRetenciones: number;
  cuotaDiferencial: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function calcRendimientoTrabajo(w: WorkIncome): number {
  const especieNeta = w.especieValoracion;
  const totalIntegros = w.dinerarias + especieNeta + w.contribucionEmpresarialPP;
  const netoPrevio = totalIntegros - w.cotizacionSS;
  return Math.max(0, round2(netoPrevio - w.otrosGastosDeducibles));
}

export function calcLimiteInteresesReparacion(inmueble: Inmueble): number {
  const suma = inmueble.interesesFinanciacion + inmueble.gastosReparacionConservacion;
  return round2(Math.min(suma, inmueble.ingresosIntegros));
}

export function calcExcesoReparacion(inmueble: Inmueble): number {
  const suma = inmueble.interesesFinanciacion + inmueble.gastosReparacionConservacion;
  return round2(Math.max(0, suma - inmueble.ingresosIntegros));
}

export function calcBaseAmortizacion(inmueble: Inmueble): number {
  const pctConstruccion = inmueble.pctConstruccion / 100;
  const valorConstruccion = inmueble.valorCatastralConstruccion;
  const costeTotalAdquisicion = inmueble.importeAdquisicion + inmueble.gastosTributos + inmueble.mejoras2024;
  return round2(Math.max(valorConstruccion, costeTotalAdquisicion * pctConstruccion));
}

export function calcAmortizacionInmueble(inmueble: Inmueble, diasTotalesEjercicio: number): number {
  const base = calcBaseAmortizacion(inmueble);
  return round2(base * 0.03 * (inmueble.diasArrendados / diasTotalesEjercicio));
}

export function calcRendimientoNetoInmueble(inmueble: Inmueble): number {
  const gastosTotales =
    calcLimiteInteresesReparacion(inmueble) +
    inmueble.gastosArrastreAplicados +
    inmueble.gastosComunidad +
    inmueble.serviciosPersonales +
    inmueble.serviciosSuministros +
    inmueble.seguro +
    inmueble.tributosRecargos +
    inmueble.amortizacionInmueble +
    inmueble.amortizacionBienesMuebles;
  return round2(inmueble.ingresosIntegros - gastosTotales);
}

export function calcRendimientoNetoReducidoInmueble(inmueble: Inmueble): number {
  const rdtoNeto = calcRendimientoNetoInmueble(inmueble);
  if (!inmueble.tieneReduccionVivienda || rdtoNeto <= 0) return rdtoNeto;
  const reduccion = rdtoNeto * (inmueble.pctReduccion / 100);
  return round2(rdtoNeto - reduccion);
}

export function calcRendimientoActividad(a: ActividadEconomica): number {
  const gastosDeducibles = a.seguridadSocialTitular + a.serviciosProfesionales + a.otrosGastos;
  const diferencia = a.ingresosExplotacion - gastosDeducibles;
  const provision = diferencia > 0 ? diferencia * 0.05 : 0;
  return round2(diferencia - provision);
}

export function calcSaldoBIA(gps: GananciaPatrimonial[], saldosNegativos: SaldoNegativoPendiente[]): number {
  const sumaPositivos = gps.filter((g) => g.base === 'ahorro' && g.resultado > 0).reduce((acc, g) => acc + g.resultado, 0);
  const sumaNegativos = gps.filter((g) => g.base === 'ahorro' && g.resultado < 0).reduce((acc, g) => acc + g.resultado, 0);
  const saldoNeto = sumaPositivos + sumaNegativos;
  if (saldoNeto <= 0) return round2(saldoNeto);
  const limiteCompensacion = saldoNeto * 0.25;
  const totalPendiente = saldosNegativos.reduce((acc, s) => acc + s.pendienteInicioPeriodo, 0);
  const compensacion = Math.min(totalPendiente, limiteCompensacion);
  return round2(saldoNeto - compensacion);
}

export function calcCuotaEstatal(baseGeneral: number): number {
  const tramos = [
    { hasta: 12450, tipo: 0.19 },
    { hasta: 20200, tipo: 0.24 },
    { hasta: 35200, tipo: 0.30 },
    { hasta: 60000, tipo: 0.37 },
    { hasta: 300000, tipo: 0.45 },
    { hasta: Infinity, tipo: 0.47 },
  ];
  let cuota = 0;
  let baseRestante = baseGeneral;
  let tramoAnterior = 0;
  for (const tramo of tramos) {
    if (baseRestante <= 0) break;
    const baseTramo = Math.min(baseRestante, tramo.hasta - tramoAnterior);
    cuota += baseTramo * tramo.tipo;
    baseRestante -= baseTramo;
    tramoAnterior = tramo.hasta;
  }
  return round2(cuota);
}

export function calcCuotaAutonoma_Madrid(baseGeneral: number): number {
  const tramos = [
    { hasta: 12450, tipo: 0.0905 },
    { hasta: 17707, tipo: 0.1290 },
    { hasta: 33007, tipo: 0.1415 },
    { hasta: 53407, tipo: 0.1760 },
    { hasta: Infinity, tipo: 0.2050 },
  ];
  let cuota = 0;
  let baseRestante = baseGeneral;
  let tramoAnterior = 0;
  for (const tramo of tramos) {
    if (baseRestante <= 0) break;
    const baseTramo = Math.min(baseRestante, tramo.hasta - tramoAnterior);
    cuota += baseTramo * tramo.tipo;
    baseRestante -= baseTramo;
    tramoAnterior = tramo.hasta;
  }
  return round2(cuota);
}

export function calcCuotaAhorro(baseAhorro: number): number {
  const tramos = [
    { hasta: 6000, tipo: 0.19 },
    { hasta: 50000, tipo: 0.21 },
    { hasta: 200000, tipo: 0.23 },
    { hasta: 300000, tipo: 0.27 },
    { hasta: Infinity, tipo: 0.28 },
  ];
  let cuota = 0;
  let baseRestante = baseAhorro;
  let tramoAnterior = 0;
  for (const tramo of tramos) {
    if (baseRestante <= 0) break;
    const baseTramo = Math.min(baseRestante, tramo.hasta - tramoAnterior);
    cuota += baseTramo * tramo.tipo;
    baseRestante -= baseTramo;
    tramoAnterior = tramo.hasta;
  }
  return round2(cuota * 2);
}

const currentYear = new Date().getFullYear();

const initialState: TaxState = {
  ejercicio: currentYear - 1,
  workIncome: {
    dinerarias: 133350.85,
    especieValoracion: 2549.81,
    especieIngresoACuenta: 907.51,
    contribucionEmpresarialPP: 1862.16,
    cotizacionSS: 3664.96,
    otrosGastosDeducibles: 2000,
    retencion: 48452.01,
  },
  capitalMobiliario: {
    interesesCuentasDepositos: 476.84,
    otrosRendimientos: 0,
    retencion: 90.37,
  },
  inmuebles: [
    {
      id: 'acevedo', refCatastral: '7949807TP6074N0006YM', direccion: 'CL FUERTES ACEVEDO 0032 1 02 DR, OVIEDO', situacion: 1, urbana: true, pctPropiedad: 100, tipo: 'arrendado',
      fechaAdquisicion: '', importeAdquisicion: 0, gastosTributos: 0, mejoras2024: 0, valorCatastral: 0, valorCatastralConstruccion: 0, pctConstruccion: 0, baseAmortizacion: 0,
      amortizacionInmueble: 1699.66, amortizacionBienesMuebles: 0, diasDisposicion: 0, diasArrendados: 366, ingresosIntegros: 19675,
      interesesFinanciacion: 1580.34, gastosReparacionConservacion: 209.33, limiteInteresesReparacion: 1789.67, gastosReparacionNoDeducibles: 0,
      gastosComunidad: 1008, serviciosPersonales: 296.45, serviciosSuministros: 1930.41, seguro: 242.79, tributosRecargos: 399.22,
      gastosPendientesAnteriores: [{ ejercicio: 2023, pendienteInicioPeriodo: 6157.99, aplicadoEsteEjercicio: 6157.99, pendienteFuturos: 0 }], gastosArrastreAplicados: 6157.99,
      gastosDeduciblesProximos4Anios: 0, rentaImputada: 0, tieneReduccionVivienda: true, pctReduccion: 50, reduccionAplicada: 1390.94, rendimientoNeto: 5334.69, rendimientoNetoReducido: 3943.75,
    },
    {
      id: 'manresa', refCatastral: '0000001DG0000S0001AA', direccion: 'C MANRESA 10, SANT FRUITÓS', situacion: 1, urbana: true, pctPropiedad: 100, tipo: 'mixto',
      fechaAdquisicion: '2019-05-03', importeAdquisicion: 185000, gastosTributos: 21000, mejoras2024: 0, valorCatastral: 70361.25, valorCatastralConstruccion: 49252.88, pctConstruccion: 70,
      baseAmortizacion: 49252.88, amortizacionInmueble: 1108.19, amortizacionBienesMuebles: 0, diasDisposicion: 122, diasArrendados: 244, ingresosIntegros: 7300,
      interesesFinanciacion: 940, gastosReparacionConservacion: 0, limiteInteresesReparacion: 940, gastosReparacionNoDeducibles: 0,
      gastosComunidad: 820, serviciosPersonales: 120, serviciosSuministros: 980, seguro: 192, tributosRecargos: 263.23,
      gastosPendientesAnteriores: [], gastosArrastreAplicados: 0, gastosDeduciblesProximos4Anios: 0, rentaImputada: 562.89,
      tieneReduccionVivienda: true, pctReduccion: 50, reduccionAplicada: 1498.42, rendimientoNeto: 2996.84, rendimientoNetoReducido: 1498.42,
    },
  ],
  actividades: [{ id: 'act1', codigoActividad: 'A05', epigafreIAE: '724', modalidad: 'simplificada', ingresosExplotacion: 16259.71, seguridadSocialTitular: 3529.66, serviciosProfesionales: 198, otrosGastos: 0, provisionSimplificada: 626.6, rendimientoNeto: 11905.45, retencion: 2438.96 }],
  gananciasPatrimoniales: [
    { id: 'gp1', tipo: 'otras_no_transmision', base: 'general', descripcion: 'Otras ganancias imputables 2024', valorTransmision: 8.19, valorAdquisicion: 0, resultado: 8.19 },
    { id: 'gp2', tipo: 'cripto', base: 'ahorro', descripcion: 'USDT', valorTransmision: 3060.13, valorAdquisicion: 3105.98, resultado: -45.85 },
  ],
  saldosNegativosBIA: [
    { ejercicio: 2022, pendienteInicioPeriodo: 1418.35, aplicadoEsteEjercicio: 73.36, pendienteFuturos: 1344.99 },
    { ejercicio: 2023, pendienteInicioPeriodo: 27764.23, aplicadoEsteEjercicio: 0, pendienteFuturos: 27764.23 },
  ],
  previsionSocial: { aportacionTrabajador: 1396.68, contribucionEmpresarial: 1862.16, nifEmpleador: 'A82009812', totalConDerechoReduccion: 3258.84, importeAplicado: 3258.84 },
  baseImponibleGeneral: 0,
  baseImponibleAhorro: 0,
  baseLiquidableGeneral: 0,
  baseLiquidableAhorro: 0,
  cuotaIntegra: 0,
  cuotaLiquida: 0,
  totalRetenciones: 0,
  cuotaDiferencial: 0,
};

const recomputeTaxState = (state: TaxState): TaxState => {
  const diasTotales = state.ejercicio % 4 === 0 ? 366 : 365;
  state.inmuebles = state.inmuebles.map((inmueble) => {
    const pctConstruccion = inmueble.valorCatastral > 0 ? round2((inmueble.valorCatastralConstruccion / inmueble.valorCatastral) * 100) : inmueble.pctConstruccion;
    const baseAmortizacion = calcBaseAmortizacion({ ...inmueble, pctConstruccion });
    const amortizacionInmueble = inmueble.baseAmortizacion > 0 ? inmueble.amortizacionInmueble : calcAmortizacionInmueble({ ...inmueble, pctConstruccion, baseAmortizacion }, diasTotales);
    const limiteInteresesReparacion = calcLimiteInteresesReparacion(inmueble);
    const gastosReparacionNoDeducibles = calcExcesoReparacion(inmueble);
    const gastosPendientesAnteriores = inmueble.gastosPendientesAnteriores.map((g) => ({ ...g, pendienteFuturos: round2(Math.max(0, g.pendienteInicioPeriodo - g.aplicadoEsteEjercicio)) }));
    const rendimientoNeto = calcRendimientoNetoInmueble({ ...inmueble, limiteInteresesReparacion, gastosReparacionNoDeducibles, baseAmortizacion, amortizacionInmueble });
    const rendimientoNetoReducido = calcRendimientoNetoReducidoInmueble({ ...inmueble, rendimientoNeto });
    const reduccionAplicada = round2(Math.max(0, rendimientoNeto - rendimientoNetoReducido));
    return { ...inmueble, pctConstruccion, baseAmortizacion, amortizacionInmueble, limiteInteresesReparacion, gastosReparacionNoDeducibles, gastosDeduciblesProximos4Anios: gastosReparacionNoDeducibles, gastosPendientesAnteriores, rendimientoNeto, rendimientoNetoReducido, reduccionAplicada };
  });

  state.actividades = state.actividades.map((actividad) => {
    const gastosDeducibles = actividad.seguridadSocialTitular + actividad.serviciosProfesionales + actividad.otrosGastos;
    const diferencia = actividad.ingresosExplotacion - gastosDeducibles;
    const provisionSimplificada = actividad.modalidad === 'simplificada' && diferencia > 0 ? round2(diferencia * 0.05) : 0;
    return { ...actividad, provisionSimplificada, rendimientoNeto: round2(diferencia - provisionSimplificada) };
  });

  state.gananciasPatrimoniales = state.gananciasPatrimoniales.map((gp) => ({ ...gp, resultado: round2(gp.valorTransmision - gp.valorAdquisicion) }));

  const rendimientoTrabajo = calcRendimientoTrabajo(state.workIncome);
  const rendimientoInmueblesReducido = state.inmuebles.reduce((acc, i) => acc + i.rendimientoNetoReducido, 0);
  const imputacionInmuebles = state.inmuebles.reduce((acc, i) => acc + i.rentaImputada, 0);
  const rendimientoActividad = state.actividades.reduce((acc, a) => acc + a.rendimientoNeto, 0);
  const gpGeneral = state.gananciasPatrimoniales.filter((g) => g.base === 'general').reduce((acc, g) => acc + g.resultado, 0);

  state.baseImponibleGeneral = round2(rendimientoTrabajo + rendimientoInmueblesReducido + imputacionInmuebles + rendimientoActividad + gpGeneral);

  const capitalMobiliarioTotal = state.capitalMobiliario.interesesCuentasDepositos + state.capitalMobiliario.otrosRendimientos;
  state.baseImponibleAhorro = round2(capitalMobiliarioTotal + calcSaldoBIA(state.gananciasPatrimoniales, state.saldosNegativosBIA));

  state.previsionSocial.totalConDerechoReduccion = round2(state.previsionSocial.aportacionTrabajador + state.previsionSocial.contribucionEmpresarial);
  state.baseLiquidableGeneral = round2(Math.max(0, state.baseImponibleGeneral - state.previsionSocial.importeAplicado));
  state.baseLiquidableAhorro = round2(Math.max(0, state.baseImponibleAhorro));

  const cuotaGeneral = calcCuotaEstatal(state.baseLiquidableGeneral) + calcCuotaAutonoma_Madrid(state.baseLiquidableGeneral);
  const cuotaAhorro = calcCuotaAhorro(state.baseLiquidableAhorro);

  state.cuotaIntegra = round2(cuotaGeneral + cuotaAhorro);
  state.cuotaLiquida = round2(state.cuotaIntegra - 0.5);
  state.totalRetenciones = round2(
    state.workIncome.retencion +
    state.capitalMobiliario.retencion +
    state.actividades.reduce((acc, a) => acc + a.retencion, 0),
  );
  state.cuotaDiferencial = round2(state.cuotaLiquida - state.totalRetenciones);

  return state;
};

const taxSlice = createSlice({
  name: 'tax',
  initialState: recomputeTaxState(initialState),
  reducers: {
    setEjercicio(state, action: PayloadAction<number>) {
      state.ejercicio = action.payload;
      recomputeTaxState(state);
    },
    updateWorkIncomeField<K extends keyof WorkIncome>(state: TaxState, action: PayloadAction<{ field: K; value: WorkIncome[K] }>) {
      state.workIncome[action.payload.field] = action.payload.value;
      recomputeTaxState(state);
    },
    updateCapitalMobiliarioField<K extends keyof CapitalMobiliario>(state: TaxState, action: PayloadAction<{ field: K; value: CapitalMobiliario[K] }>) {
      state.capitalMobiliario[action.payload.field] = action.payload.value;
      recomputeTaxState(state);
    },
    updatePrevisionSocialField<K extends keyof PreviewSocial>(state: TaxState, action: PayloadAction<{ field: K; value: PreviewSocial[K] }>) {
      state.previsionSocial[action.payload.field] = action.payload.value;
      recomputeTaxState(state);
    },
    updateInmuebleField<K extends keyof Inmueble>(state: TaxState, action: PayloadAction<{ id: string; field: K; value: Inmueble[K] }>) {
      const idx = state.inmuebles.findIndex((i) => i.id === action.payload.id);
      if (idx >= 0) state.inmuebles[idx][action.payload.field] = action.payload.value;
      recomputeTaxState(state);
    },
    addInmueble(state, action: PayloadAction<Inmueble>) {
      state.inmuebles.push(action.payload);
      recomputeTaxState(state);
    },
    removeInmueble(state, action: PayloadAction<string>) {
      state.inmuebles = state.inmuebles.filter((i) => i.id !== action.payload);
      recomputeTaxState(state);
    },
    updateActividadField<K extends keyof ActividadEconomica>(state: TaxState, action: PayloadAction<{ id: string; field: K; value: ActividadEconomica[K] }>) {
      const idx = state.actividades.findIndex((a) => a.id === action.payload.id);
      if (idx >= 0) state.actividades[idx][action.payload.field] = action.payload.value;
      recomputeTaxState(state);
    },
    updateGananciaField<K extends keyof GananciaPatrimonial>(state: TaxState, action: PayloadAction<{ id: string; field: K; value: GananciaPatrimonial[K] }>) {
      const idx = state.gananciasPatrimoniales.findIndex((g) => g.id === action.payload.id);
      if (idx >= 0) state.gananciasPatrimoniales[idx][action.payload.field] = action.payload.value;
      recomputeTaxState(state);
    },
    addGanancia(state, action: PayloadAction<GananciaPatrimonial>) {
      state.gananciasPatrimoniales.push(action.payload);
      recomputeTaxState(state);
    },
    removeGanancia(state, action: PayloadAction<string>) {
      state.gananciasPatrimoniales = state.gananciasPatrimoniales.filter((g) => g.id !== action.payload);
      recomputeTaxState(state);
    },
    updateSaldoNegativoField<K extends keyof SaldoNegativoPendiente>(state: TaxState, action: PayloadAction<{ ejercicio: number; field: K; value: SaldoNegativoPendiente[K] }>) {
      const idx = state.saldosNegativosBIA.findIndex((s) => s.ejercicio === action.payload.ejercicio);
      if (idx >= 0) state.saldosNegativosBIA[idx][action.payload.field] = action.payload.value;
      recomputeTaxState(state);
    },
  },
});

export const {
  setEjercicio,
  updateWorkIncomeField,
  updateCapitalMobiliarioField,
  updatePrevisionSocialField,
  updateInmuebleField,
  addInmueble,
  removeInmueble,
  updateActividadField,
  updateGananciaField,
  addGanancia,
  removeGanancia,
  updateSaldoNegativoField,
} = taxSlice.actions;

export default taxSlice.reducer;
