// ATLAS HORIZON: Motor de cálculo IRPF
// Nivel 1: Cálculo IRPF progresivo con todas las fuentes de ingreso

import { initDB } from './db';
import { personalDataService } from './personalDataService';
import { calculateFiscalSummary, calculateCarryForwards } from './fiscalSummaryService';

// ─── Constantes fiscales 2025/2026 ───────────────────────────────────────────

const TRAMOS_BASE_GENERAL = [
  { hasta: 12450, tipo: 0.19 },
  { hasta: 20200, tipo: 0.24 },
  { hasta: 35200, tipo: 0.30 },
  { hasta: 60000, tipo: 0.37 },
  { hasta: 300000, tipo: 0.45 },
  { hasta: Infinity, tipo: 0.47 },
];

const TRAMOS_BASE_AHORRO = [
  { hasta: 6000, tipo: 0.19 },
  { hasta: 50000, tipo: 0.21 },
  { hasta: 200000, tipo: 0.23 },
  { hasta: 300000, tipo: 0.27 },
  { hasta: Infinity, tipo: 0.28 },
];

const CONSTANTES_IRPF = {
  minimoContribuyente: 5550,
  minimoMayor65: 1150,
  minimoMayor75: 1400,
  minimoDescendientes: [0, 2400, 2700, 4000, 4500] as number[],
  minimoDescendienteMenor3: 2800,
  minimoAscendienteMayor65: 1150,
  minimoAscendienteMayor75: 1400,
  gastosGeneralesTrabajo: 2000,
  tipoRetencionAutonomo: 0.15,
  tipoPagoFraccionado: 0.20,
  reduccionViviendaHabitual: 0.60,
  imputacionRentasRevisado: 0.011,
  imputacionRentasNoRevisado: 0.02,
  retencionCapitalMobiliario: 0.19,
  maxAportacionPP: 1500,
  maxCompensacionRCMconPerdidas: 0.25,
  aniosCompensacionPerdidas: 4,
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface RendimientosTrabajo {
  salarioBrutoAnual: number;
  cotizacionSS: number;
  irpfRetenido: number;
  rendimientoNeto: number; // bruto - SS - gastos generales
}

export interface RendimientosAutonomo {
  ingresos: number;
  gastos: number;
  cuotaSS: number;
  rendimientoNeto: number;
  pagosFraccionadosM130: number;
}

export interface RendimientoInmueble {
  inmuebleId: number;
  alias: string;
  // Días de ocupación
  diasAlquilado: number;
  diasVacio: number;        // a disposición del titular
  diasEnObras: number;      // sin imputación ni rendimiento
  diasTotal: number;        // 365 o 366
  // Rendimiento por alquiler (prorrateado a días alquilados)
  ingresosIntegros: number;
  gastosDeducibles: number;
  amortizacion: number;
  reduccionHabitual: number; // 60% si modalidad habitual
  rendimientoNetoAlquiler: number;
  esHabitual: boolean;
  // Imputación por días vacíos (integrada cuando hay ocupación parcial)
  imputacionRenta: number;
  // Total: rendimientoNetoAlquiler + imputacionRenta
  rendimientoNeto: number;
  // AEAT art. 23 LIRPF limit tracking for 0105+0106
  gastosFinanciacionYReparacion: number; // Original 0105+0106 (prorated)
  limiteAplicado: number;               // min(financingRepairs, ingresosIntegros)
  excesoArrastrable: number;            // max(0, financingRepairs - ingresosIntegros)
  arrastresAplicados: number;           // Carryforwards applied from previous years
}

export interface ImputacionRenta {
  inmuebleId: number;
  alias: string;
  valorCatastral: number;
  porcentajeImputacion: number; // 1.1% o 2%
  diasVacio: number;
  imputacion: number;
}

export interface BaseGeneral {
  rendimientosTrabajo: RendimientosTrabajo | null;
  rendimientosAutonomo: RendimientosAutonomo | null;
  rendimientosInmuebles: RendimientoInmueble[];
  imputacionRentas: ImputacionRenta[];
  total: number;
}

export interface RendimientosCapitalMobiliario {
  intereses: number;
  dividendos: number;
  retenciones: number;
  total: number;
}

export interface GananciasPerdidasPatrimoniales {
  plusvalias: number;
  minusvalias: number;
  minusvaliasPendientes: number;
  compensado: number; // plusvalias - minusvalias - compensacion
}

export interface BaseAhorro {
  capitalMobiliario: RendimientosCapitalMobiliario;
  gananciasYPerdidas: GananciasPerdidasPatrimoniales;
  total: number;
}

export interface MinimosPersonales {
  contribuyente: number;
  descendientes: number;
  ascendientes: number;
  discapacidad: number;
  total: number;
}

export interface Liquidacion {
  baseImponibleGeneral: number;
  baseImponibleAhorro: number;
  cuotaBaseGeneral: number;
  cuotaBaseAhorro: number;
  cuotaMinimosBaseGeneral: number;
  cuotaIntegra: number;
  deduccionesDobleImposicion: number;
  cuotaLiquida: number;
}

export interface Retenciones {
  trabajo: number;
  autonomoM130: number;
  capitalMobiliario: number;
  total: number;
}

export interface DeclaracionIRPF {
  ejercicio: number;
  baseGeneral: BaseGeneral;
  baseAhorro: BaseAhorro;
  reducciones: {
    planPensiones: number;
    total: number;
  };
  minimoPersonal: MinimosPersonales;
  liquidacion: Liquidacion;
  retenciones: Retenciones;
  resultado: number; // positivo = a pagar, negativo = a devolver
  tipoEfectivo: number; // cuota líquida / base imponible total
}

// ─── Función de cálculo progresivo ───────────────────────────────────────────

export function calcularCuotaPorTramos(
  base: number,
  tramos: { hasta: number; tipo: number }[]
): number {
  if (base <= 0) return 0;
  let cuota = 0;
  let baseRestante = base;
  let limiteAnterior = 0;
  for (const tramo of tramos) {
    const anchoTramo = tramo.hasta - limiteAnterior;
    const baseEnTramo = Math.min(baseRestante, anchoTramo);
    cuota += baseEnTramo * tramo.tipo;
    baseRestante -= baseEnTramo;
    limiteAnterior = tramo.hasta;
    if (baseRestante <= 0) break;
  }
  return Math.round(cuota * 100) / 100;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function edadDesde(fechaNacimiento: string, ejercicio: number): number {
  const nacimiento = new Date(fechaNacimiento);
  return ejercicio - nacimiento.getFullYear();
}

// ─── Recopilación datos trabajo ───────────────────────────────────────────────

async function recopilarDatosTrabajo(ejercicio: number): Promise<RendimientosTrabajo | null> {
  try {
    const db = await initDB();
    const allNominas = await db.getAll('nominas');
    const activas = allNominas.filter((n: any) => n.activa);
    if (activas.length === 0) return null;

    let totalBruto = 0;
    let totalCotizacionSS = 0;
    let totalIRPFRetenido = 0;

    for (const activa of activas) {
      const bruto = activa.salarioBrutoAnual ?? 0;

      // Sum taxable benefits in kind (especie) that increment IRPF base
      const especieAnual = (activa.beneficiosSociales ?? [])
        .filter((b: any) => b.incrementaBaseIRPF)
        .reduce((sum: number, b: any) => sum + (b.importeMensual ?? 0) * 12, 0);
      totalBruto += bruto + especieAnual;

      // Support both old format { cotizacionSS: % } and new format { ss: { ... } }
      let cotizacionSS: number;
      if (activa.retencion?.ss) {
        const ss = activa.retencion.ss;
        const baseCot = Math.min(ss.baseCotizacionMensual ?? 4909.50, bruto / 12);
        const pct = ((ss.contingenciasComunes ?? 4.70) + (ss.desempleo ?? 1.55) + (ss.formacionProfesional ?? 0.10) + (ss.mei ?? 0.13)) / 100;
        cotizacionSS = round2(baseCot * pct * 12 + ((activa.retencion.cuotaSolidaridadMensual ?? 0) * 12));
      } else {
        const porcentajeSS = activa.retencion?.cotizacionSS ?? 6.35;
        cotizacionSS = round2(bruto * (porcentajeSS / 100));
      }
      totalCotizacionSS += cotizacionSS;

      const irpfPorcentaje = activa.retencion?.irpfPorcentaje ?? 0;
      totalIRPFRetenido += round2(bruto * (irpfPorcentaje / 100));

      // Deduct PP employee contributions (capped at legal limit of 1500€/year)
      const ppEmpleadoAnual = (() => {
        if (!activa.planPensiones) return 0;
        const emp = activa.planPensiones.aportacionEmpleado;
        if (emp.tipo === 'porcentaje') return round2(bruto * emp.valor / 100);
        return round2(emp.valor * 12);
      })();
      const ppReduccion = Math.min(ppEmpleadoAnual, CONSTANTES_IRPF.maxAportacionPP);
      totalBruto -= ppReduccion;
    }

    const rendimientoNeto = round2(totalBruto - totalCotizacionSS - CONSTANTES_IRPF.gastosGeneralesTrabajo);

    return {
      salarioBrutoAnual: round2(totalBruto),
      cotizacionSS: round2(totalCotizacionSS),
      irpfRetenido: round2(totalIRPFRetenido),
      rendimientoNeto,
    };
  } catch {
    return null;
  }
}

// ─── Recopilación datos autónomo ──────────────────────────────────────────────

async function recopilarDatosAutonomo(ejercicio: number): Promise<RendimientosAutonomo | null> {
  try {
    const db = await initDB();
    const allAutonomos = await db.getAll('autonomos');
    const activo = allAutonomos.find((a: any) => a.activo);
    if (!activo) return null;

    // Ingresos anuales desde fuentesIngreso
    const ingresos = (activo.fuentesIngreso ?? []).reduce((sum: number, f: any) => {
      const meses = Array.isArray(f.meses) ? f.meses.length : 12;
      return sum + (f.importeEstimado ?? 0) * meses;
    }, 0);

    // Gastos anuales desde gastosRecurrentesActividad
    const gastos = (activo.gastosRecurrentesActividad ?? []).reduce((sum: number, g: any) => {
      const meses = Array.isArray(g.meses) && g.meses.length > 0 ? g.meses.length : 12;
      return sum + (g.importe ?? 0) * meses;
    }, 0);

    const cuotaSS = round2((activo.cuotaAutonomos ?? 0) * 12);
    const rendimientoNeto = round2(ingresos - gastos - cuotaSS);
    // M130: 20% del rendimiento neto acumulado por trimestre (simplificado)
    const pagosFraccionadosM130 = round2(Math.max(0, rendimientoNeto) * CONSTANTES_IRPF.tipoPagoFraccionado);

    return { ingresos: round2(ingresos), gastos: round2(gastos), cuotaSS, rendimientoNeto, pagosFraccionadosM130 };
  } catch {
    return null;
  }
}

// ─── Recopilación datos inmuebles ─────────────────────────────────────────────

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function calcularDiasAnio(ejercicio: number): number {
  return new Date(ejercicio, 1, 29).getDate() === 29 ? 366 : 365;
}

export function calcularDiasAlquiladoDesdeContratos(
  propContracts: any[],
  ejercicio: number,
  diasTotal: number
): number {
  const yearStart = new Date(ejercicio, 0, 1);
  const yearEnd = new Date(ejercicio, 11, 31);
  let totalDays = 0;
  for (const c of propContracts) {
    const inicio = new Date(c.fechaInicio ?? c.startDate);
    const fin = new Date(c.fechaFin ?? c.endDate ?? `${ejercicio}-12-31`);
    const effectiveStart = inicio > yearStart ? inicio : yearStart;
    const effectiveEnd = fin < yearEnd ? fin : yearEnd;
    if (effectiveStart <= effectiveEnd) {
      const days = Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / MS_PER_DAY) + 1;
      totalDays += days;
    }
  }
  return Math.min(totalDays, diasTotal);
}

async function recopilarDatosInmuebles(ejercicio: number): Promise<{
  inmuebles: RendimientoInmueble[];
  imputaciones: ImputacionRenta[];
}> {
  const db = await initDB();
  const properties = await db.getAll('properties');
  const contracts = await db.getAll('contracts');

  const inmuebles: RendimientoInmueble[] = [];
  const imputaciones: ImputacionRenta[] = [];
  const diasTotal = calcularDiasAnio(ejercicio);

  for (const prop of properties) {
    if (prop.state !== 'activo') continue;

    // Find contracts for this property in the exercise year
    const propContracts = contracts.filter((c: any) => {
      if ((c.inmuebleId ?? c.propertyId) !== prop.id) return false;
      const inicio = new Date(c.fechaInicio ?? c.startDate);
      const fin = new Date(c.fechaFin ?? c.endDate ?? `${ejercicio}-12-31`);
      return inicio.getFullYear() <= ejercicio && fin.getFullYear() >= ejercicio;
    });

    // Determine rental days: check propertyDays store first, then fall back to contracts
    let diasAlquilado = 0;
    try {
      const pdList = await db.getAllFromIndex('propertyDays', 'property-year', [prop.id!, ejercicio]);
      const pd = pdList?.[0];
      if (pd) {
        diasAlquilado = pd.daysRented ?? 0;
      } else {
        diasAlquilado = calcularDiasAlquiladoDesdeContratos(propContracts, ejercicio, diasTotal);
      }
    } catch {
      diasAlquilado = calcularDiasAlquiladoDesdeContratos(propContracts, ejercicio, diasTotal);
    }

    const diasEnObras = 0;
    const diasVacio = Math.max(0, diasTotal - diasAlquilado - diasEnObras);

    if (diasAlquilado > 0) {
      // Property is rented (fully or partially)
      let ingresosIntegros = 0;
      let esHabitual = false;

      for (const contract of propContracts) {
        const renta = contract.rentaMensual ?? 0;
        const inicio = new Date(contract.fechaInicio ?? contract.startDate);
        const fin = new Date(contract.fechaFin ?? contract.endDate ?? `${ejercicio}-12-31`);
        const mesInicio = inicio.getFullYear() < ejercicio ? 1 : inicio.getMonth() + 1;
        const mesFin = fin.getFullYear() > ejercicio ? 12 : fin.getMonth() + 1;
        const meses = Math.max(0, mesFin - mesInicio + 1);
        ingresosIntegros += renta * meses;
        if (contract.modalidad === 'habitual') esHabitual = true;
      }

      // Get fiscal summary and prorate expenses by rental days ratio
      let gastosDeducibles = 0;
      let amortizacion = 0;
      let gastosFinanciacionYReparacion = 0;
      let limiteAplicado = 0;
      let excesoArrastrable = 0;
      let arrastresAplicados = 0;
      try {
        const summary = await calculateFiscalSummary(prop.id!, ejercicio);
        const ratio = diasAlquilado / diasTotal;

        // AEAT art. 23 LIRPF: financing + repairs cannot exceed ingresos íntegros
        const financingAndRepairsRaw = ((summary.box0105 ?? 0) + (summary.box0106 ?? 0)) * ratio;
        const otherExpenses = ((summary.box0109 ?? 0) + (summary.box0112 ?? 0) +
          (summary.box0113 ?? 0) + (summary.box0114 ?? 0) +
          (summary.box0115 ?? 0) + (summary.box0117 ?? 0)) * ratio;

        const limitedFinancingRepairs = Math.min(financingAndRepairsRaw, ingresosIntegros);

        // Apply carryforwards from previous years (FIFO, oldest first)
        // Note: remainingAmount tracking is managed dynamically by calculateCarryForwards()
        // which recomputes available amounts from fiscal summaries each time it is called.
        const carryForwards = await calculateCarryForwards(prop.id!);
        const availableForCarryforward = Math.max(0, ingresosIntegros - limitedFinancingRepairs);
        let cfApplied = 0;
        for (const cf of carryForwards) {
          if (availableForCarryforward - cfApplied <= 0) break;
          const canApply = Math.min(cf.remainingAmount, availableForCarryforward - cfApplied);
          cfApplied = round2(cfApplied + canApply);
        }

        gastosDeducibles = round2(limitedFinancingRepairs + cfApplied + otherExpenses);
        amortizacion = round2((summary.annualDepreciation ?? 0) * ratio);
        gastosFinanciacionYReparacion = round2(financingAndRepairsRaw);
        limiteAplicado = round2(limitedFinancingRepairs);
        excesoArrastrable = round2(Math.max(0, financingAndRepairsRaw - limitedFinancingRepairs));
        arrastresAplicados = round2(cfApplied);
      } catch {
        // ignore
      }

      const rendimientoBruto = round2(ingresosIntegros - gastosDeducibles - amortizacion);
      const reduccionHabitual = esHabitual ? round2(rendimientoBruto * CONSTANTES_IRPF.reduccionViviendaHabitual) : 0;
      const rendimientoNetoAlquiler = round2(rendimientoBruto - reduccionHabitual);

      // Imputación for vacant days (integrated into this property's rendimiento)
      const valorCatastral = prop.fiscalData?.cadastralValue ?? prop.aeatAmortization?.cadastralValue ?? 0;
      let imputacionRenta = 0;
      if (diasVacio > 0 && valorCatastral > 0) {
        const revisado = (prop as any).fiscalidad?.catastro_revisado_post_1994 ?? false;
        const porcentajeImputacion = revisado
          ? CONSTANTES_IRPF.imputacionRentasRevisado
          : CONSTANTES_IRPF.imputacionRentasNoRevisado;
        imputacionRenta = round2(valorCatastral * porcentajeImputacion * (diasVacio / diasTotal));
      }

      inmuebles.push({
        inmuebleId: prop.id!,
        alias: prop.alias,
        diasAlquilado,
        diasVacio,
        diasEnObras,
        diasTotal,
        ingresosIntegros: round2(ingresosIntegros),
        gastosDeducibles,
        amortizacion,
        reduccionHabitual,
        rendimientoNetoAlquiler,
        esHabitual,
        imputacionRenta,
        rendimientoNeto: round2(rendimientoNetoAlquiler + imputacionRenta),
        gastosFinanciacionYReparacion,
        limiteAplicado,
        excesoArrastrable,
        arrastresAplicados,
      });
    } else {
      // Property is fully vacant — imputación de rentas only
      const valorCatastral = prop.fiscalData?.cadastralValue ?? prop.aeatAmortization?.cadastralValue ?? 0;
      if (valorCatastral > 0) {
        const revisado = (prop as any).fiscalidad?.catastro_revisado_post_1994 ?? false;
        const porcentajeImputacion = revisado
          ? CONSTANTES_IRPF.imputacionRentasRevisado
          : CONSTANTES_IRPF.imputacionRentasNoRevisado;
        const imputacion = round2(valorCatastral * porcentajeImputacion * (diasVacio / diasTotal));

        imputaciones.push({
          inmuebleId: prop.id!,
          alias: prop.alias,
          valorCatastral,
          porcentajeImputacion,
          diasVacio,
          imputacion,
        });
      }
    }
  }

  return { inmuebles, imputaciones };
}

// ─── Recopilación datos inversiones ──────────────────────────────────────────

async function recopilarDatosInversiones(): Promise<{
  rcm: RendimientosCapitalMobiliario;
  gyp: GananciasPerdidasPatrimoniales;
  aportacionPensiones: number;
}> {
  const db = await initDB();
  const posiciones = await db.getAll('inversiones');

  let intereses = 0;
  let dividendos = 0;
  let plusvalias = 0;
  let minusvalias = 0;
  let aportacionPensiones = 0;

  for (const p of posiciones) {
    if (!p.activo) continue;
    // Dividendos/rendimientos
    if (p.dividendos) dividendos += p.dividendos;
    // Plusvalías/minusvalías de aportaciones de tipo reembolso con ganancia
    const aports: any[] = p.aportaciones ?? [];
    for (const a of aports) {
      if (a.tipo === 'reembolso') {
        const coste = ((p.total_aportado ?? 0) / ((p.valor_actual + a.importe) || 1)) * a.importe;
        const ganancia = a.importe - coste;
        if (ganancia > 0) plusvalias += ganancia;
        else minusvalias += Math.abs(ganancia);
      }
    }
    // Planes de pensiones
    if (p.tipo === 'plan-pensiones') {
      aportacionPensiones += p.total_aportado ?? 0;
    }
  }

  const retenciones = round2((intereses + dividendos) * CONSTANTES_IRPF.retencionCapitalMobiliario);
  const compensado = round2(Math.max(0, plusvalias - minusvalias));

  return {
    rcm: {
      intereses: round2(intereses),
      dividendos: round2(dividendos),
      retenciones,
      total: round2(intereses + dividendos),
    },
    gyp: {
      plusvalias: round2(plusvalias),
      minusvalias: round2(minusvalias),
      minusvaliasPendientes: 0,
      compensado,
    },
    aportacionPensiones: round2(Math.min(aportacionPensiones, CONSTANTES_IRPF.maxAportacionPP)),
  };
}

// ─── Cálculo mínimos personales ───────────────────────────────────────────────

async function calcularMinimosPersonales(ejercicio: number): Promise<MinimosPersonales> {
  const personalData = await personalDataService.getPersonalData();
  let contribuyente = CONSTANTES_IRPF.minimoContribuyente;

  // Age extras (use birth year estimation from name/dni not available, skip age bonuses)
  // TODO: add birthdate to PersonalData if needed

  // Descendientes
  let minimoDescendientes = 0;
  const descendientes = personalData?.descendientes ?? [];
  for (let i = 0; i < descendientes.length; i++) {
    const idx = Math.min(i + 1, 4);
    minimoDescendientes += CONSTANTES_IRPF.minimoDescendientes[idx] ?? CONSTANTES_IRPF.minimoDescendientes[4];
    // Extra if under 3
    const edad = edadDesde(descendientes[i].fechaNacimiento, ejercicio);
    if (edad < 3) minimoDescendientes += CONSTANTES_IRPF.minimoDescendienteMenor3;
  }

  // Ascendientes
  let minimoAscendientes = 0;
  for (const asc of personalData?.ascendientes ?? []) {
    if (asc.convive && asc.edad >= 65) {
      minimoAscendientes += CONSTANTES_IRPF.minimoAscendienteMayor65;
      if (asc.edad >= 75) minimoAscendientes += CONSTANTES_IRPF.minimoAscendienteMayor75;
    }
  }

  // Discapacidad
  let minimoDiscapacidad = 0;
  const discapacidad = personalData?.discapacidad ?? 'ninguna';
  if (discapacidad === 'hasta33') minimoDiscapacidad = 3000;
  else if (discapacidad === 'entre33y65') minimoDiscapacidad = 9000;
  else if (discapacidad === 'mas65') minimoDiscapacidad = 12000;

  return {
    contribuyente: round2(contribuyente),
    descendientes: round2(minimoDescendientes),
    ascendientes: round2(minimoAscendientes),
    discapacidad: round2(minimoDiscapacidad),
    total: round2(contribuyente + minimoDescendientes + minimoAscendientes + minimoDiscapacidad),
  };
}

// ─── Función principal ────────────────────────────────────────────────────────

export async function calcularDeclaracionIRPF(ejercicio: number): Promise<DeclaracionIRPF> {
  // PASO 1: Recopilar datos
  const [trabajo, autonomo, { inmuebles, imputaciones }, { rcm, gyp, aportacionPensiones }] =
    await Promise.all([
      recopilarDatosTrabajo(ejercicio),
      recopilarDatosAutonomo(ejercicio),
      recopilarDatosInmuebles(ejercicio),
      recopilarDatosInversiones(),
    ]);

  // PASO 2: Base General
  const rendimientoTrabajo = trabajo?.rendimientoNeto ?? 0;
  const rendimientoAutonomo = autonomo?.rendimientoNeto ?? 0;
  const rendimientoInmuebles = inmuebles.reduce((s, i) => s + i.rendimientoNeto, 0);
  const totalImputaciones = imputaciones.reduce((s, i) => s + i.imputacion, 0);
  const totalBaseGeneral = round2(rendimientoTrabajo + rendimientoAutonomo + rendimientoInmuebles + totalImputaciones);

  const baseGeneral: BaseGeneral = {
    rendimientosTrabajo: trabajo,
    rendimientosAutonomo: autonomo,
    rendimientosInmuebles: inmuebles,
    imputacionRentas: imputaciones,
    total: totalBaseGeneral,
  };

  // PASO 3: Base del Ahorro
  const totalBaseAhorro = round2(rcm.total + gyp.compensado);
  const baseAhorro: BaseAhorro = {
    capitalMobiliario: rcm,
    gananciasYPerdidas: gyp,
    total: totalBaseAhorro,
  };

  // PASO 4: Reducciones
  const reducciones = {
    planPensiones: aportacionPensiones,
    total: aportacionPensiones,
  };

  // PASO 5: Mínimos personales
  const minimoPersonal = await calcularMinimosPersonales(ejercicio);

  // PASO 6: Liquidación
  const baseImponibleGeneral = round2(Math.max(0, totalBaseGeneral - reducciones.total));
  const baseImponibleAhorro = round2(Math.max(0, totalBaseAhorro));

  const cuotaBaseGeneral = calcularCuotaPorTramos(baseImponibleGeneral, TRAMOS_BASE_GENERAL);
  const cuotaBaseAhorro = calcularCuotaPorTramos(baseImponibleAhorro, TRAMOS_BASE_AHORRO);
  const cuotaMinimosBaseGeneral = calcularCuotaPorTramos(
    Math.min(minimoPersonal.total, baseImponibleGeneral),
    TRAMOS_BASE_GENERAL
  );
  const cuotaIntegra = round2((cuotaBaseGeneral - cuotaMinimosBaseGeneral) + cuotaBaseAhorro);
  const deduccionesDobleImposicion = rcm.retenciones; // Retenciones origen capital mobiliario
  const cuotaLiquida = round2(Math.max(0, cuotaIntegra - deduccionesDobleImposicion));

  const liquidacion: Liquidacion = {
    baseImponibleGeneral,
    baseImponibleAhorro,
    cuotaBaseGeneral,
    cuotaBaseAhorro,
    cuotaMinimosBaseGeneral,
    cuotaIntegra,
    deduccionesDobleImposicion,
    cuotaLiquida,
  };

  // PASO 7: Retenciones
  const retencionTrabajo = round2(trabajo?.irpfRetenido ?? 0);
  const retencionM130 = round2(autonomo?.pagosFraccionadosM130 ?? 0);
  const retencionCapMob = round2(rcm.retenciones);
  const totalRetenciones = round2(retencionTrabajo + retencionM130 + retencionCapMob);

  const retenciones: Retenciones = {
    trabajo: retencionTrabajo,
    autonomoM130: retencionM130,
    capitalMobiliario: retencionCapMob,
    total: totalRetenciones,
  };

  // PASO 8: Resultado
  const resultado = round2(cuotaLiquida - totalRetenciones);
  const totalBase = round2(baseImponibleGeneral + baseImponibleAhorro);
  const tipoEfectivo = totalBase > 0 ? round2((cuotaLiquida / totalBase) * 100) : 0;

  return {
    ejercicio,
    baseGeneral,
    baseAhorro,
    reducciones,
    minimoPersonal,
    liquidacion,
    retenciones,
    resultado,
    tipoEfectivo,
  };
}
