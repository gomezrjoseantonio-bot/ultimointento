import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// ─── HELPER ──────────────────────────────────────────────────────────
export const n = (v: unknown): number => {
  const num = Number(v);
  return isNaN(num) ? 0 : num;
};

// ─── INTERFACES ───────────────────────────────────────────────────────

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

export interface GastoArrastre {
  ejercicio: number;
  pendienteInicio: number;
  aplicado: number;
  pendienteFuturo: number;
}

export interface Inmueble {
  id: string;
  refCatastral: string;
  direccion: string;
  pctPropiedad: number;
  tipo: 'arrendado' | 'disposicion' | 'mixto';
  // adquisición
  fechaAdquisicion: string;
  importeAdquisicion: number;
  gastosTributos: number;
  mejoras: number;
  valorCatastral: number;
  valorCatastralConstruccion: number;
  // uso
  diasArrendados: number;
  diasDisposicion: number;
  valorCatastralRevisado: boolean;
  // ingresos
  ingresosIntegros: number;
  // gastos
  interesesFinanciacion: number;
  gastosReparacion: number;
  gastosComunidad: number;
  serviciosPersonales: number;
  suministros: number;
  seguro: number;
  tributosRecargos: number;
  amortizacionMuebles: number;
  // arrastre
  arrastres: GastoArrastre[];
  // reducción vivienda
  tieneReduccion: boolean;
  pctReduccion: number;
  // calculados (se rellenan por el motor)
  pctConstruccion: number;
  baseAmortizacion: number;
  amortizacionInmueble: number;
  limiteInteresesReparacion: number;
  excesoReparacion: number;
  rentaImputada: number;
  rendimientoNeto: number;
  rendimientoNetoReducido: number;
}

export interface ActividadEconomica {
  id: string;
  codigoActividad: string;
  epigafreIAE: string;
  ingresosExplotacion: number;
  seguridadSocialTitular: number;
  serviciosProfesionales: number;
  otrosGastos: number;
  retencion: number;
  // calculados
  provisionSimplificada: number;
  rendimientoNeto: number;
}

export interface GananciaPatrimonial {
  id: string;
  tipo: 'inmueble' | 'fondos' | 'cripto' | 'otra_bg' | 'otra_ba';
  base: 'general' | 'ahorro';
  descripcion: string;
  valorTransmision: number;
  valorAdquisicion: number;
  resultado: number;
}

export interface SaldoNegativoBIA {
  ejercicio: number;
  pendienteInicio: number;
  aplicado: number;
  pendienteFuturo: number;
}

export interface PrevisionSocial {
  aportacionTrabajador: number;
  contribucionEmpresarial: number;
  importeAplicado: number;
}

export interface TaxState {
  ejercicio: number;
  workIncome: WorkIncome;
  capitalMobiliario: CapitalMobiliario;
  inmuebles: Inmueble[];
  actividades: ActividadEconomica[];
  ganancias: GananciaPatrimonial[];
  saldosNegativosBIA: SaldoNegativoBIA[];
  previsionSocial: PrevisionSocial;
  // derivados
  baseImponibleGeneral: number;
  baseImponibleAhorro: number;
  baseLiquidableGeneral: number;
  baseLiquidableAhorro: number;
  cuotaIntegra: number;
  cuotaLiquida: number;
  totalRetenciones: number;
  cuotaDiferencial: number;
}

// ─── TARIFAS IRPF ─────────────────────────────────────────────────────

function aplicarTarifa(base: number, tramos: { hasta: number; tipo: number }[]): number {
  let cuota = 0;
  let anterior = 0;
  for (const tramo of tramos) {
    if (base <= anterior) break;
    const baseTramo = Math.min(base - anterior, tramo.hasta - anterior);
    cuota += baseTramo * tramo.tipo;
    anterior = tramo.hasta;
  }
  return cuota;
}

export function calcCuotaEstatal(base: number): number {
  return aplicarTarifa(base, [
    { hasta: 12450,   tipo: 0.095 },
    { hasta: 20200,   tipo: 0.12  },
    { hasta: 35200,   tipo: 0.15  },
    { hasta: 60000,   tipo: 0.185 },
    { hasta: 300000,  tipo: 0.225 },
    { hasta: Infinity, tipo: 0.245 },
  ]);
}

export function calcCuotaAutonomica(base: number): number {
  // Escala Madrid — ajustar si el usuario reside en otra CCAA
  return aplicarTarifa(base, [
    { hasta: 12450,   tipo: 0.0905 },
    { hasta: 17707,   tipo: 0.129  },
    { hasta: 33007,   tipo: 0.1415 },
    { hasta: 53407,   tipo: 0.176  },
    { hasta: Infinity, tipo: 0.205 },
  ]);
}

export function calcCuotaAhorro(base: number): number {
  // Tipo ahorro = estatal + autonómica (50/50), tarifa 2024
  const tarifaAhorro = [
    { hasta: 6000,    tipo: 0.19 },
    { hasta: 50000,   tipo: 0.21 },
    { hasta: 200000,  tipo: 0.23 },
    { hasta: 300000,  tipo: 0.27 },
    { hasta: Infinity, tipo: 0.28 },
  ];
  return aplicarTarifa(base, tarifaAhorro);
}

// ─── MOTOR DE CÁLCULO ─────────────────────────────────────────────────

function calcInmueble(i: Inmueble, diasEjercicio: number): Partial<Inmueble> {
  const pctConstr = n(i.valorCatastral) > 0
    ? n(i.valorCatastralConstruccion) / n(i.valorCatastral)
    : 0;
  const costeAdq = n(i.importeAdquisicion) + n(i.gastosTributos) + n(i.mejoras);
  const baseAmort = Math.max(n(i.valorCatastralConstruccion), costeAdq * pctConstr);
  const amortInmueble = diasEjercicio > 0
    ? baseAmort * 0.03 * (n(i.diasArrendados) / diasEjercicio)
    : 0;

  const limiteIR = Math.min(
    n(i.interesesFinanciacion) + n(i.gastosReparacion),
    n(i.ingresosIntegros)
  );
  const excesoRep = Math.max(
    0,
    n(i.interesesFinanciacion) + n(i.gastosReparacion) - n(i.ingresosIntegros)
  );

  const arrastresAplicados = (i.arrastres ?? []).reduce(
    (acc, a) => acc + n(a.aplicado), 0
  );

  const gastosTotal = limiteIR + arrastresAplicados
    + n(i.gastosComunidad) + n(i.serviciosPersonales)
    + n(i.suministros) + n(i.seguro) + n(i.tributosRecargos)
    + amortInmueble + n(i.amortizacionMuebles);

  const rentaImp = n(i.diasDisposicion) > 0
    ? n(i.valorCatastral) * (i.valorCatastralRevisado ? 0.011 : 0.02)
      * (n(i.diasDisposicion) / diasEjercicio)
    : 0;

  const rdtoNeto = n(i.ingresosIntegros) - gastosTotal;
  const reduccion = i.tieneReduccion && rdtoNeto > 0
    ? rdtoNeto * (n(i.pctReduccion) / 100)
    : 0;
  const rdtoReducido = rdtoNeto - reduccion;

  return {
    pctConstruccion: pctConstr * 100,
    baseAmortizacion: baseAmort,
    amortizacionInmueble: amortInmueble,
    limiteInteresesReparacion: limiteIR,
    excesoReparacion: excesoRep,
    rentaImputada: rentaImp,
    rendimientoNeto: rdtoNeto,
    rendimientoNetoReducido: rdtoReducido,
  };
}

function calcActividad(a: ActividadEconomica): Partial<ActividadEconomica> {
  const gastos = n(a.seguridadSocialTitular) + n(a.serviciosProfesionales) + n(a.otrosGastos);
  const diferencia = Math.max(0, n(a.ingresosExplotacion) - gastos);
  const provision = diferencia * 0.05;
  return {
    provisionSimplificada: provision,
    rendimientoNeto: diferencia - provision,
  };
}

function recalcular(state: TaxState): void {
  const anio = n(state.ejercicio);
  const bisiesto = anio % 4 === 0 && (anio % 100 !== 0 || anio % 400 === 0);
  const diasEjercicio = bisiesto ? 366 : 365;

  // Inmuebles
  state.inmuebles = state.inmuebles.map(i => ({
    ...i,
    ...calcInmueble(i, diasEjercicio),
  }));

  // Actividades
  state.actividades = state.actividades.map(a => ({
    ...a,
    ...calcActividad(a),
  }));

  // Rendimiento trabajo
  const rdtoTrabajo = n(state.workIncome.dinerarias)
    + n(state.workIncome.especieValoracion)
    + n(state.workIncome.contribucionEmpresarialPP)
    - n(state.workIncome.cotizacionSS)
    - n(state.workIncome.otrosGastosDeducibles);

  // Suma inmuebles
  const sumaRdtoInmuebles = state.inmuebles.reduce(
    (acc, i) => acc + n(i.rendimientoNetoReducido), 0
  );
  const sumaImputacion = state.inmuebles.reduce(
    (acc, i) => acc + n(i.rentaImputada), 0
  );

  // Actividades
  const sumaActividades = state.actividades.reduce(
    (acc, a) => acc + n(a.rendimientoNeto), 0
  );

  // Capital mobiliario
  const rdtoCapMob = n(state.capitalMobiliario.interesesCuentasDepositos)
    + n(state.capitalMobiliario.otrosRendimientos);

  // G/P patrimoniales
  const saldoBIG = state.ganancias
    .filter(g => g.base === 'general')
    .reduce((acc, g) => acc + n(g.resultado), 0);

  const saldoBIABruto = state.ganancias
    .filter(g => g.base === 'ahorro')
    .reduce((acc, g) => acc + n(g.resultado), 0);

  const compensacionBIA = saldoBIABruto > 0
    ? Math.min(
        saldoBIABruto * 0.25,
        state.saldosNegativosBIA.reduce((acc, s) => acc + n(s.aplicado), 0)
      )
    : 0;
  const saldoBIA = saldoBIABruto - compensacionBIA;

  // Bases imponibles
  state.baseImponibleGeneral = rdtoTrabajo + sumaRdtoInmuebles + sumaImputacion
    + sumaActividades + saldoBIG;
  state.baseImponibleAhorro = Math.max(0, rdtoCapMob + saldoBIA);

  // Reducciones
  const reduccionPP = n(state.previsionSocial.importeAplicado);
  state.baseLiquidableGeneral = Math.max(0, state.baseImponibleGeneral - reduccionPP);
  state.baseLiquidableAhorro = state.baseImponibleAhorro;

  // Cuotas con mínimo personal (5.550 € estatal / 5.956,65 € Madrid)
  const minimoEstatal = 5550;
  const minimoAutonomico = 5956.65;
  const cuotaMinimoEstatal = calcCuotaEstatal(minimoEstatal);
  const cuotaMinimoAutonomico = calcCuotaAutonomica(minimoAutonomico);

  const cuotaGeneral =
    Math.max(0, calcCuotaEstatal(state.baseLiquidableGeneral) - cuotaMinimoEstatal) +
    Math.max(0, calcCuotaAutonomica(state.baseLiquidableGeneral) - cuotaMinimoAutonomico);
  const cuotaAhorro = calcCuotaAhorro(state.baseLiquidableAhorro);

  state.cuotaIntegra = cuotaGeneral + cuotaAhorro;
  state.cuotaLiquida = state.cuotaIntegra; // sin deducciones adicionales por ahora

  // Retenciones
  state.totalRetenciones = n(state.workIncome.retencion)
    + n(state.capitalMobiliario.retencion)
    + state.actividades.reduce((acc, a) => acc + n(a.retencion), 0);

  state.cuotaDiferencial = state.cuotaLiquida - state.totalRetenciones;
}

// ─── ESTADO INICIAL ────────────────────────────────────────────────────

const emptyWorkIncome: WorkIncome = {
  dinerarias: 0,
  especieValoracion: 0,
  especieIngresoACuenta: 0,
  contribucionEmpresarialPP: 0,
  cotizacionSS: 0,
  otrosGastosDeducibles: 2000,
  retencion: 0,
};

const emptyCapitalMobiliario: CapitalMobiliario = {
  interesesCuentasDepositos: 0,
  otrosRendimientos: 0,
  retencion: 0,
};

const emptyPrevisionSocial: PrevisionSocial = {
  aportacionTrabajador: 0,
  contribucionEmpresarial: 0,
  importeAplicado: 0,
};

const currentYear = new Date().getFullYear();

const initialState: TaxState = {
  ejercicio: currentYear - 1,
  workIncome: emptyWorkIncome,
  capitalMobiliario: emptyCapitalMobiliario,
  inmuebles: [],
  actividades: [],
  ganancias: [],
  saldosNegativosBIA: [],
  previsionSocial: emptyPrevisionSocial,
  baseImponibleGeneral: 0,
  baseImponibleAhorro: 0,
  baseLiquidableGeneral: 0,
  baseLiquidableAhorro: 0,
  cuotaIntegra: 0,
  cuotaLiquida: 0,
  totalRetenciones: 0,
  cuotaDiferencial: 0,
};

// ─── SLICE ─────────────────────────────────────────────────────────────

const taxSlice = createSlice({
  name: 'tax',
  initialState,
  reducers: {
    setEjercicio(state, action: PayloadAction<number>) {
      state.ejercicio = action.payload;
      recalcular(state);
    },
    updateWorkIncome(state, action: PayloadAction<Partial<WorkIncome>>) {
      Object.assign(state.workIncome, action.payload);
      recalcular(state);
    },
    updateCapitalMobiliario(state, action: PayloadAction<Partial<CapitalMobiliario>>) {
      Object.assign(state.capitalMobiliario, action.payload);
      recalcular(state);
    },
    updatePrevisionSocial(state, action: PayloadAction<Partial<PrevisionSocial>>) {
      Object.assign(state.previsionSocial, action.payload);
      recalcular(state);
    },
    addInmueble(state) {
      const newInmueble: Inmueble = {
        id: Date.now().toString(),
        refCatastral: '',
        direccion: 'Nuevo inmueble',
        pctPropiedad: 100,
        tipo: 'arrendado',
        fechaAdquisicion: '',
        importeAdquisicion: 0,
        gastosTributos: 0,
        mejoras: 0,
        valorCatastral: 0,
        valorCatastralConstruccion: 0,
        diasArrendados: 365,
        diasDisposicion: 0,
        valorCatastralRevisado: false,
        ingresosIntegros: 0,
        interesesFinanciacion: 0,
        gastosReparacion: 0,
        gastosComunidad: 0,
        serviciosPersonales: 0,
        suministros: 0,
        seguro: 0,
        tributosRecargos: 0,
        amortizacionMuebles: 0,
        arrastres: [],
        tieneReduccion: false,
        pctReduccion: 50,
        pctConstruccion: 0,
        baseAmortizacion: 0,
        amortizacionInmueble: 0,
        limiteInteresesReparacion: 0,
        excesoReparacion: 0,
        rentaImputada: 0,
        rendimientoNeto: 0,
        rendimientoNetoReducido: 0,
      };
      state.inmuebles.push(newInmueble);
      recalcular(state);
    },
    updateInmueble(state, action: PayloadAction<{ id: string; data: Partial<Inmueble> }>) {
      const idx = state.inmuebles.findIndex(i => i.id === action.payload.id);
      if (idx >= 0) {
        Object.assign(state.inmuebles[idx], action.payload.data);
        recalcular(state);
      }
    },
    removeInmueble(state, action: PayloadAction<string>) {
      state.inmuebles = state.inmuebles.filter(i => i.id !== action.payload);
      recalcular(state);
    },
    addActividad(state) {
      state.actividades.push({
        id: Date.now().toString(),
        codigoActividad: '',
        epigafreIAE: '',
        ingresosExplotacion: 0,
        seguridadSocialTitular: 0,
        serviciosProfesionales: 0,
        otrosGastos: 0,
        retencion: 0,
        provisionSimplificada: 0,
        rendimientoNeto: 0,
      });
      recalcular(state);
    },
    updateActividad(state, action: PayloadAction<{ id: string; data: Partial<ActividadEconomica> }>) {
      const idx = state.actividades.findIndex(a => a.id === action.payload.id);
      if (idx >= 0) {
        Object.assign(state.actividades[idx], action.payload.data);
        recalcular(state);
      }
    },
    removeActividad(state, action: PayloadAction<string>) {
      state.actividades = state.actividades.filter(a => a.id !== action.payload);
      recalcular(state);
    },
    addGanancia(state) {
      state.ganancias.push({
        id: Date.now().toString(),
        tipo: 'cripto',
        base: 'ahorro',
        descripcion: '',
        valorTransmision: 0,
        valorAdquisicion: 0,
        resultado: 0,
      });
    },
    updateGanancia(state, action: PayloadAction<{ id: string; data: Partial<GananciaPatrimonial> }>) {
      const idx = state.ganancias.findIndex(g => g.id === action.payload.id);
      if (idx >= 0) {
        Object.assign(state.ganancias[idx], action.payload.data);
        // calcular resultado
        const g = state.ganancias[idx];
        g.resultado = n(g.valorTransmision) - n(g.valorAdquisicion);
        recalcular(state);
      }
    },
    removeGanancia(state, action: PayloadAction<string>) {
      state.ganancias = state.ganancias.filter(g => g.id !== action.payload);
      recalcular(state);
    },
  },
});

export const {
  setEjercicio,
  updateWorkIncome,
  updateCapitalMobiliario,
  updatePrevisionSocial,
  addInmueble,
  updateInmueble,
  removeInmueble,
  addActividad,
  updateActividad,
  removeActividad,
  addGanancia,
  updateGanancia,
  removeGanancia,
} = taxSlice.actions;

export default taxSlice.reducer;
