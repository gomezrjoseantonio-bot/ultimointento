// ATLAS HORIZON: Motor de cálculo IRPF
// Nivel 1: Cálculo IRPF progresivo con todas las fuentes de ingreso

import { initDB } from './db';
import { personalDataService } from './personalDataService';
import { calculateCarryForwards, calculateFiscalSummary } from './fiscalSummaryService';
import { nominaService } from './nominaService';
import { conciliarEjercicioFiscal, FiscalConciliationResult } from './fiscalConciliationService';
import { PropertyDisposalTaxResult } from './propertyDisposalTaxService';
import { getRendimientosAtribuidosEjercicio } from './entidadAtribucionService';
import { ejecutarCompensacionAhorro } from './compensacionAhorroService';
import type { CompensacionAhorroResult } from './compensacionAhorroService';

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

export const CONSTANTES_IRPF = {
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
  maxAportacionPPEmpresa: 8500,
  maxAportacionPPTotal: 10000,
  maxCompensacionRCMconPerdidas: 0.25,
  aniosCompensacionPerdidas: 4,
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface RendimientosTrabajo {
  salarioBrutoAnual: number;      // Dinerario: base + variables + bonus (from calculateSalary)
  especieAnual: number;           // Retribución en especie que tributa
  cotizacionSS: number;
  irpfRetenido: number;
  rendimientoNeto: number;        // bruto + especie - SS - gastos generales
  ppEmpleado: number;             // Aportación empleado PP (limitada a 1.500€)
  ppEmpresa: number;              // Aportación empresa PP (limitada a 8.500€)
  ppTotalReduccion: number;       // Total reducción PP (limitada a 10.000€)
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
  reduccionHabitual: number; // Reducción por arrendamiento de vivienda aplicada sobre el rendimiento neto positivo
  rendimientoNetoAlquiler: number; // Rendimiento neto del alquiler ANTES de reducción
  rendimientoNetoReducido: number; // Rendimiento neto del alquiler DESPUÉS de reducción
  porcentajeReduccionHabitual: number;
  esHabitual: boolean;
  // Imputación por días vacíos (integrada cuando hay ocupación parcial)
  imputacionRenta: number;
  // Total: rendimientoNetoReducido + imputacionRenta
  rendimientoNeto: number;
  // AEAT art. 23 LIRPF limit tracking for 0105+0106
  gastosFinanciacionYReparacion?: number; // Original 0105+0106 (prorated)
  limiteAplicado?: number;               // min(financingRepairs, ingresosIntegros)
  excesoArrastrable?: number;            // max(0, financingRepairs - ingresosIntegros)
  arrastresAplicados?: number;           // Carryforwards applied from previous years
  accesoriosIncluidos?: { id: number; alias: string; amortizacion: number; gastos: number }[];
  conciliacion?: { estimado: number; real: number | null; fuente: import('./fiscalConciliationService').FiscalDataSource };
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
  capitalMobiliarioGeneral?: {
    total: number;
    retenciones: number;
    detalle: RendimientoCapitalMobiliarioDetalle[];
  };
  total: number;
}

export interface RendimientoCapitalMobiliarioDetalle {
  concepto: string;
  importe: number;
  retencion: number;
  pagador?: string;
  nifPagador?: string;
  integraEnBaseGeneral: boolean;
  casilla?: string;
}

export interface RendimientosCapitalMobiliario {
  intereses: number;
  dividendos: number;
  retenciones: number;
  total: number;
  detalle?: RendimientoCapitalMobiliarioDetalle[];
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
  ventasInmuebles?: PropertyDisposalTaxResult[];
  compensacionAhorro?: CompensacionAhorroResult;
  baseGeneral: BaseGeneral;
  baseAhorro: BaseAhorro;
  reducciones: {
    ppEmpleado: number;
    ppEmpresa: number;
    ppIndividual: number;
    planPensiones: number;
    total: number;
  };
  minimoPersonal: MinimosPersonales;
  liquidacion: Liquidacion;
  retenciones: Retenciones;
  resultado: number; // positivo = a pagar, negativo = a devolver
  tipoEfectivo: number; // cuota líquida / base imponible total
  conciliacion?: FiscalConciliationResult; // Solo presente si se pidió conciliación
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

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calcularReduccionArrendamientoVivienda(
  rendimientoNetoAlquiler: number,
  porcentajeReduccion: number,
): {
  reduccionHabitual: number;
  rendimientoNetoReducido: number;
  porcentajeNormalizado: number;
} {
  const porcentajeNormalizado = porcentajeReduccion > 1
    ? porcentajeReduccion / 100
    : porcentajeReduccion;

  if (rendimientoNetoAlquiler <= 0 || porcentajeNormalizado <= 0) {
    return {
      reduccionHabitual: 0,
      rendimientoNetoReducido: round2(rendimientoNetoAlquiler),
      porcentajeNormalizado: round2(porcentajeNormalizado * 100) / 100,
    };
  }

  const reduccionHabitual = round2(rendimientoNetoAlquiler * porcentajeNormalizado);
  return {
    reduccionHabitual,
    rendimientoNetoReducido: round2(rendimientoNetoAlquiler - reduccionHabitual),
    porcentajeNormalizado: round2(porcentajeNormalizado * 100) / 100,
  };
}

function edadDesde(fechaNacimiento: string, ejercicio: number): number {
  const nacimiento = new Date(fechaNacimiento);
  return ejercicio - nacimiento.getFullYear();
}

// ─── Recopilación datos trabajo ───────────────────────────────────────────────

async function recopilarDatosTrabajo(ejercicio: number): Promise<RendimientosTrabajo | null> {
  try {
    const activas = await nominaService.getAllActiveNominas();
    if (activas.length === 0) return null;

    let totalBruto = 0;
    let totalEspecie = 0;
    let totalCotizacionSS = 0;
    let totalIRPFRetenido = 0;
    let totalPPEmpleado = 0;
    let totalPPEmpresa = 0;

    for (const activa of activas) {
      // Use the calculation engine for accurate totals
      const calculo = nominaService.calculateSalary(activa);

      totalBruto += calculo.totalAnualBruto;
      totalEspecie += calculo.totalAnualEspecie;

      // Sum SS and IRPF from monthly distribution (accurate per-month calculation)
      totalCotizacionSS += calculo.distribucionMensual.reduce((s, m) => s + m.ssTotal, 0);
      totalIRPFRetenido += calculo.distribucionMensual.reduce((s, m) => s + m.irpfImporte, 0);

      // PP contributions
      if (activa.planPensiones) {
        const ppEmpresa = activa.planPensiones.aportacionEmpresa;

        // Employee PP: always sum from payroll engine monthly distribution
        totalPPEmpleado += calculo.distribucionMensual.reduce(
          (s, m) => s + (m.ppEmpleado ?? 0),
          0,
        );

        // Employer PP: prefer deriving from payroll engine output
        const totalPPEmpresaFromDistribucion = calculo.distribucionMensual.reduce(
          (s, m) => {
            const totalProducto = (m as any).ppTotalAlProducto;
            const ppEmpleadoMes = m.ppEmpleado ?? 0;
            if (typeof totalProducto === 'number') {
              const ppEmpresaMes = Math.max(0, totalProducto - ppEmpleadoMes);
              return s + ppEmpresaMes;
            }
            return s;
          },
          0,
        );

        if (totalPPEmpresaFromDistribucion > 0) {
          // Use engine-derived employer PP if available
          totalPPEmpresa += totalPPEmpresaFromDistribucion;
        } else if (ppEmpresa?.tipo && ppEmpresa.valor != null) {
          // Fallback: calculate annual employer PP from plan definition
          const ppEmpresaAnual =
            ppEmpresa.tipo === 'porcentaje'
              ? round2((calculo.totalAnualBruto * ppEmpresa.valor) / 100)
              : round2(ppEmpresa.valor * 12);
          totalPPEmpresa += ppEmpresaAnual;
        }
      }
    }

    // Apply PP limits (art. 52 LIRPF)
    const ppEmpleadoLimitado = Math.min(totalPPEmpleado, CONSTANTES_IRPF.maxAportacionPP);
    const ppEmpresaLimitado = Math.min(totalPPEmpresa, CONSTANTES_IRPF.maxAportacionPPEmpresa);
    const ppTotalReduccion = Math.min(ppEmpleadoLimitado + ppEmpresaLimitado, CONSTANTES_IRPF.maxAportacionPPTotal);

    // Rendimiento neto: bruto + especie - SS - gastos generales
    // PP reduction is applied as a separate reduction in the declaration, NOT subtracted from bruto
    const baseIRPF = round2(totalBruto + totalEspecie);
    const rendimientoNeto = round2(baseIRPF - totalCotizacionSS - CONSTANTES_IRPF.gastosGeneralesTrabajo);

    return {
      salarioBrutoAnual: round2(totalBruto),
      especieAnual: round2(totalEspecie),
      cotizacionSS: round2(totalCotizacionSS),
      irpfRetenido: round2(totalIRPFRetenido),
      rendimientoNeto,
      ppEmpleado: round2(ppEmpleadoLimitado),
      ppEmpresa: round2(ppEmpresaLimitado),
      ppTotalReduccion: round2(ppTotalReduccion),
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

/**
 * Separates a list of active properties into:
 * - `propertiesToProcess`: main properties + orphan accessories (those whose mainPropertyId
 *   does not reference any active main property)
 * - `accessoryProperties`: all properties flagged as accessories
 * - `linkedAccessoryIds`: Set of IDs of accessories that ARE properly linked to an active main property
 *
 * Exported for testability.
 */
export function separarAccesorios(activeProperties: any[]): {
  propertiesToProcess: any[];
  accessoryProperties: any[];
  linkedAccessoryIds: Set<number>;
} {
  const mainPropertyIds = new Set(
    activeProperties
      .filter((p: any) => !p.fiscalData?.isAccessory)
      .map((p: any) => p.id)
  );
  const accessoryProperties = activeProperties.filter(
    (p: any) => p.fiscalData?.isAccessory === true
  );
  const linkedAccessoryIds = new Set<number>(
    accessoryProperties
      .filter((a: any) => a.fiscalData?.mainPropertyId != null && mainPropertyIds.has(a.fiscalData.mainPropertyId))
      .map((a: any) => a.id as number)
  );
  const propertiesToProcess = activeProperties.filter(
    (p: any) => !linkedAccessoryIds.has(p.id)
  );
  return { propertiesToProcess, accessoryProperties, linkedAccessoryIds };
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

  const activeProperties = properties.filter((p: any) => p.state === 'activo');

  // Separate main properties from accessories using the exported helper
  const { propertiesToProcess, accessoryProperties, linkedAccessoryIds } = separarAccesorios(activeProperties);

  for (const prop of propertiesToProcess) {

    // Find contracts for this property in the exercise year
    const propContracts = contracts.filter((c: any) => {
      if ((c.inmuebleId ?? c.propertyId) !== prop.id) return false;
      const inicio = new Date(c.fechaInicio ?? c.startDate);
      const fin = new Date(c.fechaFin ?? c.endDate ?? `${ejercicio}-12-31`);
      return inicio.getFullYear() <= ejercicio && fin.getFullYear() >= ejercicio;
    });

    // Determine rental days.
    // If user explicitly overrode occupancy (manualOverride), trust propertyDays.
    // Otherwise prefer live contracts to avoid stale auto-generated 0 days values.
    let diasAlquilado = 0;
    let diasEnObras = 0;
    try {
      const pdList = await db.getAllFromIndex('propertyDays', 'property-year', [prop.id!, ejercicio]);
      const pd = pdList?.[0];
      const diasDesdeContratos = calcularDiasAlquiladoDesdeContratos(propContracts, ejercicio, diasTotal);
      if (pd) {
        const diasRentedPropertyDays = pd.daysRented ?? 0;
        const shouldUsePropertyDays = Boolean(pd.manualOverride);
        diasAlquilado = shouldUsePropertyDays ? diasRentedPropertyDays : diasDesdeContratos;
        const diasObrasFromDb = pd.daysUnderRenovation ?? 0;
        diasEnObras = Math.max(0, Math.min(diasTotal - diasAlquilado, diasObrasFromDb));
      } else {
        diasAlquilado = diasDesdeContratos;
      }
    } catch {
      diasAlquilado = calcularDiasAlquiladoDesdeContratos(propContracts, ejercicio, diasTotal);
    }

    const diasVacio = Math.max(0, diasTotal - diasAlquilado - diasEnObras);

    if (diasAlquilado > 0) {
      // Property is rented (fully or partially)
      let ingresosIntegros = 0;
      let esHabitual = false;
      let tieneReduccion = false;
      let porcentajeReduccionHabitual = 0;

      for (const contract of propContracts) {
        const renta = contract.rentaMensual ?? 0;
        const inicio = new Date(contract.fechaInicio ?? contract.startDate);
        const fin = new Date(contract.fechaFin ?? contract.endDate ?? `${ejercicio}-12-31`);
        const mesInicio = inicio.getFullYear() < ejercicio ? 1 : inicio.getMonth() + 1;
        const mesFin = fin.getFullYear() > ejercicio ? 12 : fin.getMonth() + 1;
        const meses = Math.max(0, mesFin - mesInicio + 1);
        ingresosIntegros += renta * meses;

        const contractReductionActive = Boolean(
          (contract as any).reduccion?.activa
          ?? (contract as any).reduction?.active
          ?? (contract as any).tieneReduccion
          ?? false
        );
        const contractReductionPercent = Number(
          (contract as any).reduccion?.porcentaje
          ?? (contract as any).reduction?.percentage
          ?? (contract as any).porcentajeReduccion
          ?? (contract as any).pctReduccion
          ?? 0
        );

        if (contract.modalidad === 'habitual') {
          esHabitual = true;
          tieneReduccion = true;
          if (contractReductionPercent > 0) porcentajeReduccionHabitual = contractReductionPercent;
        } else if (contractReductionActive) {
          tieneReduccion = true;
          if (contractReductionPercent > 0) porcentajeReduccionHabitual = contractReductionPercent;
        }
      }

      if (!tieneReduccion) {
        const propertyReductionActive = Boolean(
          (prop as any).fiscalData?.tiene_reduccion
          ?? (prop as any).fiscalData?.tieneReduccion
          ?? (prop as any).fiscalData?.reduccionArrendamientoActiva
          ?? false
        );
        const propertyReductionPercent = Number(
          (prop as any).fiscalData?.porcentaje_reduccion
          ?? (prop as any).fiscalData?.porcentajeReduccion
          ?? (prop as any).fiscalData?.pctReduccion
          ?? 0
        );

        if (propertyReductionActive || propertyReductionPercent > 0) {
          tieneReduccion = true;
          porcentajeReduccionHabitual = propertyReductionPercent;
        }
      }

      if (tieneReduccion && porcentajeReduccionHabitual <= 0) {
        porcentajeReduccionHabitual = esHabitual ? CONSTANTES_IRPF.reduccionViviendaHabitual : 0;
      }


      // Get fiscal summary and prorate expenses by rental days ratio
      let gastosDeducibles = 0;
      let amortizacion = 0;
      let gastosFinanciacionYReparacion = 0;
      let limiteAplicado = 0;
      let excesoArrastrable = 0;
      let arrastresAplicados = 0;
      const ratio = diasAlquilado / diasTotal;
      try {
        const summary = await calculateFiscalSummary(prop.id!, ejercicio);

        // AEAT art. 23 LIRPF: financing + repairs cannot exceed ingresos íntegros
        const financingAndRepairsRaw = ((summary.box0105 ?? 0) + (summary.box0106 ?? 0)) * ratio;
        const otherExpenses = ((summary.box0109 ?? 0) + (summary.box0112 ?? 0) +
          (summary.box0113 ?? 0) + (summary.box0114 ?? 0) +
          (summary.box0115 ?? 0) + (summary.box0117 ?? 0)) * ratio;

        const limitedFinancingRepairs = Math.min(financingAndRepairsRaw, ingresosIntegros);

        // Apply carryforwards from previous years (FIFO, oldest first)
        // Note: remainingAmount tracking is managed dynamically by calculateCarryForwards()
        // which recomputes available amounts from fiscal summaries each time it is called.
        const carryForwards = await calculateCarryForwards(prop.id!, ejercicio);
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

      // Sum amortization and expenses from linked accessories
      const accesorios = accessoryProperties.filter(
        (a: any) => a.fiscalData?.mainPropertyId === prop.id && linkedAccessoryIds.has(a.id)
      );
      const accesoriosIncluidos: { id: number; alias: string; amortizacion: number; gastos: number }[] = [];
      for (const acc of accesorios) {
        let accAmortizacion = 0;
        let accGastos = 0;
        try {
          const accSummary = await calculateFiscalSummary(acc.id!, ejercicio);
          accAmortizacion = round2((accSummary.annualDepreciation ?? 0) * ratio);
          accGastos = round2(
            ((accSummary.box0105 ?? 0) + (accSummary.box0106 ?? 0) + (accSummary.box0109 ?? 0) +
             (accSummary.box0112 ?? 0) + (accSummary.box0113 ?? 0) + (accSummary.box0114 ?? 0) +
             (accSummary.box0115 ?? 0) + (accSummary.box0117 ?? 0)) * ratio
          );
        } catch {
          if (acc.fiscalData?.accessoryData) {
            accAmortizacion = round2(acc.fiscalData.accessoryData.constructionCadastralValue * 0.03 * ratio);
          }
        }
        amortizacion = round2(amortizacion + accAmortizacion);
        gastosDeducibles = round2(gastosDeducibles + accGastos);
        accesoriosIncluidos.push({ id: acc.id!, alias: acc.alias, amortizacion: accAmortizacion, gastos: accGastos });
      }

      const rendimientoNetoAlquiler = round2(ingresosIntegros - gastosDeducibles - amortizacion);
      const { reduccionHabitual, rendimientoNetoReducido, porcentajeNormalizado } = tieneReduccion
        ? calcularReduccionArrendamientoVivienda(rendimientoNetoAlquiler, porcentajeReduccionHabitual)
        : {
            reduccionHabitual: 0,
            rendimientoNetoReducido: rendimientoNetoAlquiler,
            porcentajeNormalizado: 0,
          };

      // Imputación for vacant days (integrated into this property's rendimiento)
      const valorCatastral = prop.fiscalData?.cadastralValue ?? prop.aeatAmortization?.cadastralValue ?? 0;
      // Add accessory cadastral values for combined imputación
      const accesoriosCombinados = accessoryProperties.filter(
        (a: any) => a.fiscalData?.mainPropertyId === prop.id && linkedAccessoryIds.has(a.id)
      );
      const valorCatastralTotal = round2(
        valorCatastral +
        accesoriosCombinados.reduce((sum: number, a: any) =>
          sum + (a.fiscalData?.cadastralValue ?? a.fiscalData?.accessoryData?.cadastralValue ?? 0), 0)
      );
      let imputacionRenta = 0;
      if (diasVacio > 0 && valorCatastralTotal > 0) {
        const revisado = (prop as any).fiscalidad?.catastro_revisado_post_1994 ?? false;
        const porcentajeImputacion = revisado
          ? CONSTANTES_IRPF.imputacionRentasRevisado
          : CONSTANTES_IRPF.imputacionRentasNoRevisado;
        imputacionRenta = round2(valorCatastralTotal * porcentajeImputacion * (diasVacio / diasTotal));
      }

      const accesoriosIncluidosData = accesoriosIncluidos.length > 0 ? accesoriosIncluidos : undefined;

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
        rendimientoNetoReducido,
        porcentajeReduccionHabitual: porcentajeNormalizado,
        esHabitual,
        imputacionRenta,
        rendimientoNeto: round2(rendimientoNetoReducido + imputacionRenta),
        gastosFinanciacionYReparacion,
        limiteAplicado,
        excesoArrastrable,
        arrastresAplicados,
        accesoriosIncluidos: accesoriosIncluidosData,
      });
    } else {
      // Property is fully vacant — imputación de rentas only
      const valorCatastral = prop.fiscalData?.cadastralValue ?? prop.aeatAmortization?.cadastralValue ?? 0;
      // Add accessory cadastral values for combined imputación
      const accesoriosCombinados = accessoryProperties.filter(
        (a: any) => a.fiscalData?.mainPropertyId === prop.id && linkedAccessoryIds.has(a.id)
      );
      const valorCatastralTotal = round2(
        valorCatastral +
        accesoriosCombinados.reduce((sum: number, a: any) =>
          sum + (a.fiscalData?.cadastralValue ?? a.fiscalData?.accessoryData?.cadastralValue ?? 0), 0)
      );
      if (valorCatastralTotal > 0) {
        const revisado = (prop as any).fiscalidad?.catastro_revisado_post_1994 ?? false;
        const porcentajeImputacion = revisado
          ? CONSTANTES_IRPF.imputacionRentasRevisado
          : CONSTANTES_IRPF.imputacionRentasNoRevisado;
        const imputacion = round2(valorCatastralTotal * porcentajeImputacion * (diasVacio / diasTotal));

        imputaciones.push({
          inmuebleId: prop.id!,
          alias: prop.alias,
          valorCatastral: valorCatastralTotal,
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

async function recopilarDatosInversiones(ejercicio: number): Promise<{
  rcm: RendimientosCapitalMobiliario;
  capitalMobiliarioBaseGeneral: {
    total: number;
    retenciones: number;
    detalle: RendimientoCapitalMobiliarioDetalle[];
  };
  gyp: GananciasPerdidasPatrimoniales;
  aportacionPensiones: number;
  ventasInmuebles: PropertyDisposalTaxResult[];
}> {
  const db = await initDB();
  const posiciones = await db.getAll('inversiones');

  let interesesAhorro = 0;
  let dividendosAhorro = 0;
  let retencionesCapitalMobiliarioAhorro = 0;
  let totalCapitalMobiliarioGeneral = 0;
  let retencionesCapitalMobiliarioGeneral = 0;
  let aportacionPensiones = 0;
  const detalleAhorro: RendimientoCapitalMobiliarioDetalle[] = [];
  const detalleBaseGeneral: RendimientoCapitalMobiliarioDetalle[] = [];

  const esDelEjercicio = (fecha?: string) => {
    if (!fecha) return false;
    const d = new Date(fecha);
    return !Number.isNaN(d.getTime()) && d.getFullYear() === ejercicio;
  };

  const clasificarCapitalMobiliario = (
    input: {
      integracionFiscal?: unknown;
      integraEnBaseGeneral?: unknown;
      casilla?: unknown;
    },
    contexto: { notas: string; nombreEntidad: string },
  ): boolean => {
    if (input.integracionFiscal === 'general') return true;
    if (input.integracionFiscal === 'ahorro') return false;
    if (input.integraEnBaseGeneral === true) return true;
    if (input.integraEnBaseGeneral === false) return false;

    const casilla = String(input.casilla ?? '').padStart(4, '0');
    if (['0046', '0047', '0048', '0050', '0051'].includes(casilla)) return true;
    if (contexto.notas.includes('otro rendimiento big')) return true;
    if (contexto.notas.includes('base general')) return true;
    if (contexto.nombreEntidad.includes('unihouser')) return true;
    return false;
  };

  const registrarDetalleCapitalMobiliario = (
    detalle: RendimientoCapitalMobiliarioDetalle,
    tipoPosicion: string,
  ) => {
    if (detalle.integraEnBaseGeneral) {
      totalCapitalMobiliarioGeneral = round2(totalCapitalMobiliarioGeneral + detalle.importe);
      retencionesCapitalMobiliarioGeneral = round2(retencionesCapitalMobiliarioGeneral + detalle.retencion);
      detalleBaseGeneral.push(detalle);
      return;
    }

    if (tipoPosicion === 'accion' || tipoPosicion === 'etf' || tipoPosicion === 'reit') {
      dividendosAhorro = round2(dividendosAhorro + detalle.importe);
    } else {
      interesesAhorro = round2(interesesAhorro + detalle.importe);
    }
    retencionesCapitalMobiliarioAhorro = round2(retencionesCapitalMobiliarioAhorro + detalle.retencion);
    detalleAhorro.push(detalle);
  };

  for (const p of posiciones) {
    if (!p.activo) continue;

    const pAny = p as any;
    const notas = String(pAny?.notas ?? '').toLowerCase();
    const nombreEntidad = `${String(pAny?.nombre ?? '')} ${String(pAny?.entidad ?? '')}`.toLowerCase();

    const pagosGenerados = Array.isArray(pAny?.rendimiento?.pagos_generados)
      ? pAny.rendimiento.pagos_generados
      : [];
    for (const pago of pagosGenerados) {
      if (!esDelEjercicio(pago?.fecha_pago)) continue;
      const bruto = Number(pago?.importe_bruto) || 0;
      const retencion = Number(pago?.retencion_fiscal) || 0;
      registrarDetalleCapitalMobiliario({
        concepto: `Rendimiento ${p.nombre}`,
        importe: round2(bruto),
        retencion: round2(retencion),
        pagador: p.entidad,
        integraEnBaseGeneral: clasificarCapitalMobiliario({
          integracionFiscal: pago?.integracion_fiscal ?? pAny?.rendimiento?.integracion_fiscal,
          integraEnBaseGeneral: pago?.integra_en_base_general ?? pAny?.rendimiento?.integra_en_base_general,
          casilla: pago?.casilla_irpf ?? pAny?.rendimiento?.casilla_irpf,
        }, { notas, nombreEntidad }),
        casilla: pago?.casilla_irpf ?? pAny?.rendimiento?.casilla_irpf,
      }, p.tipo);
    }

    if (Array.isArray(pAny?.dividendos?.dividendos_recibidos)) {
      for (const div of pAny.dividendos.dividendos_recibidos) {
        if (!esDelEjercicio(div?.fecha_pago)) continue;
        const bruto = Number(div?.importe_bruto) || 0;
        const retencion = Number(div?.retencion_fiscal) || 0;
        registrarDetalleCapitalMobiliario({
          concepto: `Dividendo ${p.nombre}`,
          importe: round2(bruto),
          retencion: round2(retencion),
          pagador: p.entidad,
          integraEnBaseGeneral: clasificarCapitalMobiliario({
            integracionFiscal: div?.integracion_fiscal ?? pAny?.dividendos?.integracion_fiscal,
            integraEnBaseGeneral: div?.integra_en_base_general ?? pAny?.dividendos?.integra_en_base_general,
            casilla: div?.casilla_irpf ?? pAny?.dividendos?.casilla_irpf,
          }, { notas, nombreEntidad }),
          casilla: div?.casilla_irpf ?? pAny?.dividendos?.casilla_irpf,
        }, p.tipo);
      }
    } else {
      const divLegacy = Number(pAny?.dividendos);
      if (Number.isFinite(divLegacy) && divLegacy > 0) {
        registrarDetalleCapitalMobiliario({
          concepto: `Dividendo ${p.nombre}`,
          importe: round2(divLegacy),
          retencion: 0,
          pagador: p.entidad,
          integraEnBaseGeneral: clasificarCapitalMobiliario({
            integracionFiscal: pAny?.dividendos_integracion_fiscal,
            integraEnBaseGeneral: pAny?.dividendos_integra_en_base_general,
            casilla: pAny?.dividendos_casilla_irpf,
          }, { notas, nombreEntidad }),
          casilla: pAny?.dividendos_casilla_irpf,
        }, p.tipo);
      }
    }

    if (p.tipo === 'plan_pensiones') {
      aportacionPensiones += p.total_aportado ?? 0;
    }
  }

  const retenciones = round2(
    retencionesCapitalMobiliarioAhorro > 0
      ? retencionesCapitalMobiliarioAhorro
      : (interesesAhorro + dividendosAhorro) * CONSTANTES_IRPF.retencionCapitalMobiliario
  );

  return {
    rcm: {
      intereses: round2(interesesAhorro),
      dividendos: round2(dividendosAhorro),
      retenciones,
      total: round2(interesesAhorro + dividendosAhorro),
      detalle: detalleAhorro,
    },
    capitalMobiliarioBaseGeneral: {
      total: round2(totalCapitalMobiliarioGeneral),
      retenciones: round2(retencionesCapitalMobiliarioGeneral),
      detalle: detalleBaseGeneral,
    },
    gyp: {
      plusvalias: 0,
      minusvalias: 0,
      minusvaliasPendientes: 0,
      compensado: 0,
    },
    aportacionPensiones: round2(Math.min(aportacionPensiones, CONSTANTES_IRPF.maxAportacionPP)),
    ventasInmuebles: [],
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

export async function calcularDeclaracionIRPF(
  ejercicio: number,
  opciones?: { usarConciliacion?: boolean }
): Promise<DeclaracionIRPF> {
  // PASO 1: Recopilar datos
  const [trabajo, autonomo, { inmuebles, imputaciones }, {
    rcm,
    capitalMobiliarioBaseGeneral,
    aportacionPensiones,
  }, atribuidos] =
    await Promise.all([
      recopilarDatosTrabajo(ejercicio),
      recopilarDatosAutonomo(ejercicio),
      recopilarDatosInmuebles(ejercicio),
      recopilarDatosInversiones(ejercicio),
      getRendimientosAtribuidosEjercicio(ejercicio),
    ]);

  // PASO 1b (opcional): Conciliación fiscal
  let conciliacionResult: FiscalConciliationResult | undefined;
  if (opciones?.usarConciliacion) {
    try {
      conciliacionResult = await conciliarEjercicioFiscal(ejercicio);

      // Enriquecer RendimientoInmueble con datos conciliados de ingresos alquiler
      for (const inmueble of inmuebles) {
        const realAlquiler = conciliacionResult.lineas
          .filter(l => l.categoria === 'ingresos_alquiler' && l.sourceId === inmueble.inmuebleId && l.real !== null)
          .reduce((s, l) => s + l.real!, 0);
        const hayReal = conciliacionResult.lineas.some(
          l => l.categoria === 'ingresos_alquiler' && l.sourceId === inmueble.inmuebleId && l.real !== null
        );

        inmueble.conciliacion = {
          estimado: inmueble.ingresosIntegros,
          real: hayReal ? round2(realAlquiler) : null,
          fuente: hayReal ? 'real' : 'estimado',
        };

        // Si hay datos reales, usar el importe real para ingresosIntegros
        if (hayReal && realAlquiler > 0) {
          inmueble.ingresosIntegros = round2(realAlquiler);
        }
      }

      // Ajustar salarioBrutoAnual con datos reales de nómina si hay
      if (trabajo) {
        const realNomina = conciliacionResult.lineas
          .filter(l => l.categoria === 'nomina' && l.real !== null)
          .reduce((s, l) => s + l.real!, 0);
        const hayRealNomina = conciliacionResult.lineas.some(l => l.categoria === 'nomina' && l.real !== null);
        if (hayRealNomina && realNomina > 0) {
          trabajo.salarioBrutoAnual = round2(realNomina);
        }
      }
    } catch {
      // conciliation failed: continue with estimated data
    }
  }

  // PASO 2: Base General
  const rendimientoTrabajo = trabajo?.rendimientoNeto ?? 0;
  const rendimientoAutonomoAtribuido = round2(atribuidos.actividadEconomica.total ?? 0);
  const rendimientoAutonomo = round2((autonomo?.rendimientoNeto ?? 0) + rendimientoAutonomoAtribuido);
  const rendimientoCapitalInmobiliarioAtribuido = round2(atribuidos.capitalInmobiliario.total ?? 0);
  const rendimientoInmueblesDirectos = inmuebles.reduce((s, i) => s + i.rendimientoNeto, 0);
  const rendimientoInmuebles = round2(rendimientoInmueblesDirectos + rendimientoCapitalInmobiliarioAtribuido);
  const totalImputaciones = imputaciones.reduce((s, i) => s + i.imputacion, 0);
  const totalCapitalMobiliarioGeneral = round2(capitalMobiliarioBaseGeneral?.total ?? 0);

  if (rendimientoCapitalInmobiliarioAtribuido > 0) {
    inmuebles.push({
      inmuebleId: -1,
      alias: `Entidades en atribución (${atribuidos.capitalInmobiliario.detalle.length})`,
      diasAlquilado: 365,
      diasVacio: 0,
      diasEnObras: 0,
      diasTotal: 365,
      ingresosIntegros: rendimientoCapitalInmobiliarioAtribuido,
      gastosDeducibles: 0,
      amortizacion: 0,
      reduccionHabitual: 0,
      rendimientoNetoAlquiler: rendimientoCapitalInmobiliarioAtribuido,
      rendimientoNetoReducido: rendimientoCapitalInmobiliarioAtribuido,
      porcentajeReduccionHabitual: 0,
      esHabitual: false,
      imputacionRenta: 0,
      rendimientoNeto: rendimientoCapitalInmobiliarioAtribuido,
      gastosFinanciacionYReparacion: 0,
      limiteAplicado: 0,
      excesoArrastrable: 0,
      arrastresAplicados: 0,
    });
  }

  const rendimientosAutonomo = autonomo
    ? {
        ...autonomo,
        ingresos: round2(autonomo.ingresos + rendimientoAutonomoAtribuido),
        rendimientoNeto: round2(autonomo.rendimientoNeto + rendimientoAutonomoAtribuido),
      }
    : rendimientoAutonomoAtribuido > 0
      ? {
          ingresos: rendimientoAutonomoAtribuido,
          gastos: 0,
          cuotaSS: 0,
          rendimientoNeto: rendimientoAutonomoAtribuido,
          pagosFraccionadosM130: 0,
        }
      : autonomo;

  const totalBaseGeneral = round2(
    rendimientoTrabajo
    + rendimientoAutonomo
    + rendimientoInmuebles
    + totalImputaciones
    + totalCapitalMobiliarioGeneral
  );

  const baseGeneral: BaseGeneral = {
    rendimientosTrabajo: trabajo,
    rendimientosAutonomo: rendimientosAutonomo,
    rendimientosInmuebles: inmuebles,
    imputacionRentas: imputaciones,
    ...(totalCapitalMobiliarioGeneral > 0 ? { capitalMobiliarioGeneral: capitalMobiliarioBaseGeneral } : {}),
    total: totalBaseGeneral,
  };

  // PASO 3: Base del Ahorro
  const capitalMobiliarioAtribuidoAhorro = round2(atribuidos.capitalMobiliario.total ?? 0);
  const retencionesCapitalMobiliarioAtribuidoAhorro = round2(atribuidos.capitalMobiliario.retenciones ?? 0);
  const baseAhorroCapitalMobiliario: RendimientosCapitalMobiliario = {
    intereses: rcm.intereses,
    dividendos: round2(rcm.dividendos + capitalMobiliarioAtribuidoAhorro),
    retenciones: round2(rcm.retenciones + retencionesCapitalMobiliarioAtribuidoAhorro),
    total: round2(rcm.total + capitalMobiliarioAtribuidoAhorro),
    detalle: [
      ...(rcm.detalle ?? []),
      ...atribuidos.capitalMobiliario.detalle.map((detalle) => ({
        concepto: `Entidad atribuida · ${detalle.entidad}`,
        importe: detalle.importe,
        retencion: detalle.retencion,
        pagador: detalle.entidad,
        integraEnBaseGeneral: false,
      })),
    ],
  };
  const compensacionAhorro = await ejecutarCompensacionAhorro(
    ejercicio,
    Math.max(0, baseAhorroCapitalMobiliario.total),
  );

  const gyp: GananciasPerdidasPatrimoniales = {
    plusvalias: round2(
      compensacionAhorro.fuentes.inmuebles.plusvalias + compensacionAhorro.fuentes.inversiones.plusvalias,
    ),
    minusvalias: round2(
      compensacionAhorro.fuentes.inmuebles.minusvalias + compensacionAhorro.fuentes.inversiones.minusvalias,
    ),
    minusvaliasPendientes: round2(
      compensacionAhorro.perdidasPendientesDespues.reduce((sum, item) => sum + item.importePendiente, 0),
    ),
    compensado: round2(compensacionAhorro.saldoNetoTrasCompensar),
  };

  const totalBaseAhorro = round2(baseAhorroCapitalMobiliario.total + gyp.compensado);
  const baseAhorro: BaseAhorro = {
    capitalMobiliario: baseAhorroCapitalMobiliario,
    gananciasYPerdidas: gyp,
    total: totalBaseAhorro,
  };

  // PASO 4: Reducciones
  // PP from trabajo (already limited per Art. 52 LIRPF)
  const ppTrabajo = trabajo?.ppTotalReduccion ?? 0;
  // PP from inversiones (planes de pensiones individuales), capped by remaining headroom
  const ppIndividualCapped = Math.max(0, Math.min(aportacionPensiones, CONSTANTES_IRPF.maxAportacionPPTotal - ppTrabajo));
  // Total PP reduction (combined limit 10.000€)
  const totalPP = round2(ppTrabajo + ppIndividualCapped);

  const reducciones = {
    ppEmpleado: trabajo?.ppEmpleado ?? 0,
    ppEmpresa: trabajo?.ppEmpresa ?? 0,
    ppIndividual: ppIndividualCapped,
    planPensiones: totalPP,
    total: totalPP,
  };

  // PASO 5: Mínimos personales
  const minimoPersonal = await calcularMinimosPersonales(ejercicio);

  // PASO 6: Liquidación
  const baseImponibleGeneral = round2(Math.max(0, totalBaseGeneral - reducciones.total));
  const baseImponibleAhorro = round2(Math.max(0, baseAhorro.total));

  const cuotaBaseGeneral = calcularCuotaPorTramos(baseImponibleGeneral, TRAMOS_BASE_GENERAL);
  const cuotaBaseAhorro = calcularCuotaPorTramos(baseImponibleAhorro, TRAMOS_BASE_AHORRO);
  const cuotaMinimosBaseGeneral = calcularCuotaPorTramos(
    Math.min(minimoPersonal.total, baseImponibleGeneral),
    TRAMOS_BASE_GENERAL
  );
  const cuotaIntegra = round2((cuotaBaseGeneral - cuotaMinimosBaseGeneral) + cuotaBaseAhorro);
  const deduccionesDobleImposicion = baseAhorroCapitalMobiliario.retenciones; // Solo retenciones integradas en base del ahorro
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
  const retencionM130 = round2(rendimientosAutonomo?.pagosFraccionadosM130 ?? 0);
  const retencionCapMob = round2(baseAhorroCapitalMobiliario.retenciones + (capitalMobiliarioBaseGeneral?.retenciones ?? 0));
  const retencionesAtribuidasNoCapitalMob = round2(
    (atribuidos.capitalInmobiliario.retenciones ?? 0)
    + (atribuidos.actividadEconomica.retenciones ?? 0)
  );
  const totalRetenciones = round2(retencionTrabajo + retencionM130 + retencionCapMob + retencionesAtribuidasNoCapitalMob);

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
    ...(compensacionAhorro.fuentes.inmuebles.detalle.length > 0 ? { ventasInmuebles: compensacionAhorro.fuentes.inmuebles.detalle } : {}),
    compensacionAhorro,
    ...(conciliacionResult !== undefined ? { conciliacion: conciliacionResult } : {}),
  };
}
