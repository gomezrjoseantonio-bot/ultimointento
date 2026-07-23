// src/modules/horizon/proyeccion/mensual/services/proyeccionMensualService.ts
// ATLAS HORIZON: Monthly financial projection calculation engine

import { Contract } from '../../../../../services/db';
import { nominaService } from '../../../../../services/nominaService';
import { calcularNetoMesNomina } from '../../../../../services/nominaCalculoService';
import { autonomoService } from '../../../../../services/autonomoService';
import { pensionService } from '../../../../../services/pensionService';
import { otrosIngresosService } from '../../../../../services/otrosIngresosService';
import { getFiscalContextSafe } from '../../../../../services/fiscalContextService';
import { getAllContracts } from '../../../../../services/contractService';
import { inmuebleService } from '../../../../../services/inmuebleService';
import { prestamosService } from '../../../../../services/prestamosService';
import { inversionesService } from '../../../../../services/inversionesService';
import { calculateTotalInitialCash } from '../../../../../services/accountBalanceService';
import { OtrosIngresos, FuenteIngreso, GastoRecurrenteActividad } from '../../../../../types/personal';
// V81 (TAREA CC · Bloque C): fuente única de gasto personal = compromisosRecurrentes.
import type { CompromisoRecurrente } from '../../../../../types/compromisosRecurrentes';
import { gastoPersonalCompromisoEnMes } from '../../../../personal/helpers';
import { ValoracionHistorica } from '../../../../../types/valoraciones';
import { PeriodoPago } from '../../../../../types/prestamos';
import { InversionRendimientoPeriodico, PagoRendimiento } from '../../../../../types/inversiones-extended';
import { PosicionInversion, PlanLiquidacion } from '../../../../../types/inversiones';
import {
  MonthlyProjectionRow,
  ProyeccionAnual,
  DrillDownItem,
  PuntoPatrimonioAnual,
} from '../types/proyeccionMensual';
import { calcularDeclaracionIRPF } from '../../../../../services/irpfCalculationService';
import { generarEventosFiscales, getConfiguracionFiscal } from '../../../../../services/fiscalPaymentsService';
import { valoracionesService } from '../../../../../services/valoracionesService';
import { buildOpexPorMes } from './opexCompromisosEngine';
import type { OpexMes } from './opexCompromisosEngine';
import {
  buildRentaPorMes,
  contratosSimuladosParaEjercicio,
} from './rentasContratosEngine';
import type { RentaMes } from './rentasContratosEngine';
import { listarCompromisos } from '../../../../../services/personal/compromisosRecurrentesService';
import { getSupuestosProyeccion } from '../../../../../services/escenariosService';
import type { SupuestosProyeccion } from '../../../../../types/supuestosProyeccion';

const PROJECTION_YEARS = 20;
const START_YEAR = new Date().getFullYear();

/** The projection always starts from the current calendar year (constant baseline). */
export const PROJECTION_START_YEAR = START_YEAR;

/**
 * Calculate outstanding principal at a given month using the French amortization method
 */
function calculateOutstandingPrincipal(
  principal: number,
  annualRate: number,
  totalMonths: number,
  elapsedMonths: number,
): number {
  if (elapsedMonths >= totalMonths) return 0;
  if (annualRate === 0) {
    return principal * (1 - elapsedMonths / totalMonths);
  }
  const r = annualRate / 12;
  const remaining = totalMonths - elapsedMonths;
  // Outstanding principal = PMT * (1 - (1+r)^-remaining) / r
  const pmt =
    (principal * r * Math.pow(1 + r, totalMonths)) /
    (Math.pow(1 + r, totalMonths) - 1);
  return (pmt * (1 - Math.pow(1 + r, -remaining))) / r;
}

/**
 * Calculate monthly loan payment (French amortization system)
 */
export function calculateLoanPayment(
  principal: number,
  annualRate: number,
  totalMonths: number,
  elapsedMonths: number,
): { cuota: number; amortizacion: number; intereses: number } {
  if (elapsedMonths >= totalMonths || principal <= 0) {
    return { cuota: 0, amortizacion: 0, intereses: 0 };
  }

  const r = annualRate / 12;

  let cuota: number;
  if (r === 0) {
    cuota = principal / totalMonths;
  } else {
    cuota =
      (principal * r * Math.pow(1 + r, totalMonths)) /
      (Math.pow(1 + r, totalMonths) - 1);
  }

  const outstandingPrincipal = calculateOutstandingPrincipal(
    principal,
    annualRate,
    totalMonths,
    elapsedMonths,
  );
  const intereses = outstandingPrincipal * r;
  const amortizacion = cuota - intereses;

  return { cuota, amortizacion: Math.max(0, amortizacion), intereses };
}

// B3 · el filtrado de contratos por mes vive en rentasContratosEngine
// (ciclo de vida completo: vencimiento · renovación · indexación).

interface LoanInfo {
  principalInicial: number; // fallback for months before first payment
  isHipoteca: boolean; // true = mortgage, false = personal loan
  concepto: string;    // loan description for drilldown
  periodos: PeriodoPago[]; // full amortization schedule
}

interface DeudaState {
  loans: LoanInfo[];
}

interface InvestmentProjectionData {
  id: number;
  tipo: PosicionInversion['tipo'];
  valorActual: number;
  rendimiento?: InversionRendimientoPeriodico['rendimiento'];
  planLiquidacion?: PlanLiquidacion;
}

function getLiquidationAmount(plan: PlanLiquidacion, valorActual: number): number {
  return plan.liquidacion_total ? valorActual : (plan.importe_estimado ?? valorActual);
}

function getInvestmentLiquidationMonth(inv: InvestmentProjectionData): string | undefined {
  const planLiq = inv.planLiquidacion;
  if (planLiq?.activo && planLiq.fecha_estimada) {
    return planLiq.fecha_estimada.substring(0, 7);
  }

  if (inv.tipo === 'deposito_plazo' && inv.rendimiento?.fecha_fin_rendimiento) {
    return inv.rendimiento.fecha_fin_rendimiento.substring(0, 7);
  }

  return undefined;
}

function getNetPeriodicReturnForMonth(inv: InvestmentProjectionData, month1to12: number): number {
  const rendimiento = inv.rendimiento;
  if (!rendimiento || rendimiento.reinvertir) return 0;
  if (!['cuenta_remunerada', 'prestamo_p2p', 'deposito_plazo'].includes(inv.tipo)) return 0;

  const isMonthly = rendimiento.frecuencia_pago === 'mensual';
  const mesesCobro = isMonthly
    ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    : (Array.isArray(rendimiento.meses_cobro) ? rendimiento.meses_cobro : []);

  if (!mesesCobro.includes(month1to12)) return 0;

  const pagosAnuales = isMonthly
    ? 12
    : Math.max(1, mesesCobro.length);
  const bruto = (inv.valorActual * (rendimiento.tasa_interes_anual / 100)) / pagosAnuales;
  const retencion = rendimiento.retencion_porcentaje ?? 19;
  return bruto * (1 - retencion / 100);
}

function getInvestmentInterestForMonth(
  monthStr: string,
  month1to12: number,
  inversiones: InvestmentProjectionData[],
): number {
  return inversiones.reduce((sum, inv) => {
    const rendimiento = inv.rendimiento;
    if (!rendimiento) return sum;

    const startMonth = rendimiento.fecha_inicio_rendimiento?.substring(0, 7);
    const endMonth = rendimiento.fecha_fin_rendimiento?.substring(0, 7);

    if (startMonth && monthStr < startMonth) return sum;
    if (endMonth && monthStr > endMonth) return sum;

    return sum + getNetPeriodicReturnForMonth(inv, month1to12);
  }, 0);
}

function getInvestmentLiquidationCashflowForMonth(
  monthStr: string,
  inversiones: InvestmentProjectionData[],
): number {
  return inversiones.reduce((sum, inv) => {
    const planLiq = inv.planLiquidacion;
    if (planLiq?.activo && planLiq.fecha_estimada?.startsWith(monthStr)) {
      return sum + getLiquidationAmount(planLiq, inv.valorActual);
    }

    const hasVencimientoPlan = planLiq?.activo && planLiq.tipo_liquidacion === 'vencimiento';
    if (!hasVencimientoPlan && inv.tipo === 'deposito_plazo' && inv.rendimiento?.fecha_fin_rendimiento?.startsWith(monthStr)) {
      return sum + inv.valorActual;
    }

    return sum;
  }, 0);
}

interface AssetInitialValue {
  id: number;
  initialValue: number;
  /** Nombre canónico para fallback de matching por nombre (T25.1). */
  nombre?: string;
}

interface AutonomoProjectionData {
  conceptoTitular: string;
  nombre: string;
  fuentesIngreso: FuenteIngreso[];
  gastosRecurrentesActividad: GastoRecurrenteActividad[];
  cuotaAutonomos: number;
  // Old-model fallbacks when arrays are empty
  ingresosAnualesFallback: number;
  gastosAnualesFallback: number;
}

interface BaseData {
  /** Supuestos de proyección efectivos (fuente única B1) · usados por las dinámicas B3. */
  supuestos: SupuestosProyeccion;

  /**
   * Nómina neta por año del horizonte · [yearIndex][mes0-11] (B3). Cada año
   * se recalcula con `calcularNetoMesNomina(nomina, mes, year)` — el historial
   * `vigenciaDesde` manda — y el % anual de B1 solo compone DESPUÉS del último
   * cambio registrado (ancla por nómina · B0.1).
   */
  nominaNetaPorAnio: number[][];
  nominaDrillDownPorAnio: DrillDownItem[][][];

  /**
   * Rentas por mes 'YYYY-MM' para el horizonte completo (B3) · contratos con
   * ciclo de vida: vencen, se renuevan (con vacancia) e indexan.
   */
  rentaPorMes: Map<string, RentaMes>;

  // Per-autonomo structured data (replaces flat freelanceMensual + gastosAutonomoMensual)
  autonomosData: AutonomoProjectionData[];

  // Flat drill-down arrays (same items every month, amounts are monthly equivalents)
  pensionDrillDown: DrillDownItem[];

  /**
   * OPEX de inmuebles por mes 'YYYY-MM' para el horizonte completo · expandido
   * desde compromisosRecurrentes por la vía directa con su variación (B2).
   */
  opexPorMes: Map<string, OpexMes>;
  /** Maps property numeric ID → alias for drill-down labels */
  propertyAliasMap: Map<number, string>;
  /** V81 (Bloque C): compromisos recurrentes ámbito personal · fuente única de gasto personal */
  compromisosPersonales: CompromisoRecurrente[];

  // Historical valuations index for real patrimonio calculation (pre-built for performance)
  valoracionIndex: ValoracionIndex;
  inmuebleInitialValues: AssetInitialValue[];    // fallback: purchase price
  inversionInitialValues: AssetInitialValue[];   // fallback: valor_actual

  // Investment periodic return payments (legacy pagos_generados support)
  pagosRendimiento: PagoRendimiento[];
  inversionesProyeccion: InvestmentProjectionData[];
  liquidationMonthByInvestmentId: Map<number, string>;

  // Scalars
  pensionNetaMensual: number;
  /** Individual otros-ingresos items – monthly amount computed per-month to respect fechaInicio/fechaFin */
  otrosIngresosItems: OtrosIngresos[];
  valorPlanesPension: number;
  cajaInicial: number;
  irpfForecastByMonth: Map<string, number>;
}

/**
 * Pre-built index for fast historical valuation lookup.
 * - byId: key = "tipo_activo|activo_id"
 * - byNombre: key = "tipo_activo|activo_nombre_normalizado" (T25.1 · fallback)
 * Cada bucket está ordenado asc por fecha para iteración "latest ≤ month".
 */
type ValoracionIndex = {
  byId: Map<string, ValoracionHistorica[]>;
  byNombre: Map<string, ValoracionHistorica[]>;
};

function buildValoracionIndex(history: ValoracionHistorica[]): ValoracionIndex {
  const byId = new Map<string, ValoracionHistorica[]>();
  const byNombre = new Map<string, ValoracionHistorica[]>();
  for (const v of history) {
    const keyId = `${v.tipo_activo}|${v.activo_id}`;
    const bucketId = byId.get(keyId);
    if (bucketId) bucketId.push(v); else byId.set(keyId, [v]);

    const nombreNorm = String(v.activo_nombre || '').toLowerCase().trim();
    if (nombreNorm) {
      const keyNombre = `${v.tipo_activo}|${nombreNorm}`;
      const bucketNombre = byNombre.get(keyNombre);
      if (bucketNombre) bucketNombre.push(v); else byNombre.set(keyNombre, [v]);
    }
  }
  const sortAsc = (bucket: ValoracionHistorica[]): void => {
    bucket.sort((a, b) => a.fecha_valoracion.localeCompare(b.fecha_valoracion));
  };
  byId.forEach(sortAsc);
  byNombre.forEach(sortAsc);
  return { byId, byNombre };
}

/**
 * Returns the last known valuation for an asset at or before a given month (YYYY-MM).
 * Tries by activo_id first, then by activo_nombre normalizado (T25.1).
 * Falls back to the provided initialValue if no historical record exists.
 */
function getLastValueForAsset(
  index: ValoracionIndex,
  tipo: 'inmueble' | 'inversion',
  activoId: number,
  atOrBeforeMonth: string,
  initialValue: number,
  nombre?: string,
): number {
  const buckets: ValoracionHistorica[][] = [];
  const byId = index.byId.get(`${tipo}|${activoId}`);
  if (byId) buckets.push(byId);
  const nombreNorm = String(nombre || '').toLowerCase().trim();
  if (nombreNorm) {
    const byNombre = index.byNombre.get(`${tipo}|${nombreNorm}`);
    if (byNombre) buckets.push(byNombre);
  }
  if (buckets.length === 0) return initialValue;
  let result = initialValue;
  let resultFecha = '';
  for (const bucket of buckets) {
    for (const v of bucket) {
      if (v.fecha_valoracion <= atOrBeforeMonth && v.fecha_valoracion >= resultFecha) {
        result = v.valor;
        resultFecha = v.fecha_valoracion;
      }
    }
  }
  return result;
}

/**
 * Returns the sum of last-known valuations for all assets of a given type at or before a given month.
 */
function sumAssetValuesForMonth(
  index: ValoracionIndex,
  tipo: 'inmueble' | 'inversion',
  assets: AssetInitialValue[],
  atOrBeforeMonth: string,
): number {
  return assets.reduce(
    (sum, asset) => sum + getLastValueForAsset(index, tipo, asset.id, atOrBeforeMonth, asset.initialValue, asset.nombre),
    0,
  );
}

async function loadIrpfForecastByMonth(
  contracts: Contract[],
  supuestos: SupuestosProyeccion,
): Promise<Map<string, number>> {
  const irpfForecastByMonth = new Map<string, number>();

  try {
    const config = await getConfiguracionFiscal();
    if (!config.incluir_prevision_irpf) {
      return irpfForecastByMonth;
    }

    const ejercicios = Array.from(
      { length: PROJECTION_YEARS },
      (_, index) => START_YEAR + index - 1,
    );

    // Only use conciliation (real data) for current and past years.
    // Future years have no real data, so conciliation just bypasses the cache needlessly.
    const currentYear = new Date().getFullYear();
    const eventosPorEjercicio = await Promise.all(
      ejercicios.map(async (ejercicio) => {
        try {
          const usarConciliacion = ejercicio <= currentYear;
          // B3 · coherencia fiscal-cashflow (B0.4 · opción a): los ejercicios
          // FUTUROS tributan sobre los MISMOS contratos que proyecta el
          // cashflow (renovados e indexados) en vez de sobre la DB cruda,
          // donde los contratos mueren al vencer. Pasado/presente: datos reales.
          const contratosOverride =
            ejercicio > currentYear
              ? contratosSimuladosParaEjercicio(contracts, supuestos, ejercicio, START_YEAR)
              : undefined;
          const declaracion = await calcularDeclaracionIRPF(ejercicio, {
            usarConciliacion,
            contratosOverride,
          });
          return await generarEventosFiscales(ejercicio, declaracion);
        } catch (error) {
          console.warn(`[proyeccionMensualService] No se pudo calcular el IRPF ${ejercicio}:`, error);
          return [];
        }
      }),
    );

    eventosPorEjercicio.flat().forEach(evento => {
      if (evento.sourceType !== 'irpf_declaracion') {
        return;
      }

      const monthKey = evento.fechaLimite.slice(0, 7);
      irpfForecastByMonth.set(
        monthKey,
        (irpfForecastByMonth.get(monthKey) ?? 0) + evento.importe,
      );
    });
  } catch (error) {
    console.warn('[proyeccionMensualService] No se pudo cargar la previsión anual de IRPF:', error);
  }

  return irpfForecastByMonth;
}

/**
 * Build a single monthly projection row for a given absolute month index
 */
function buildMonthRow(
  absoluteMonthIndex: number, // 0 = January of START_YEAR
  baseData: BaseData,
  deudaState: DeudaState,
  cajaAnterior: number,
): MonthlyProjectionRow {
  const yearIndex = Math.floor(absoluteMonthIndex / 12);
  const year = START_YEAR + yearIndex;
  const monthOfYear = absoluteMonthIndex % 12; // 0-11
  const month1to12 = monthOfYear + 1;
  // Format month string "YYYY-MM"
  const monthStr = `${year}-${String(month1to12).padStart(2, '0')}`;

  const { supuestos } = baseData;
  // Factores de dinámica anual (B3) · cada uno lee su supuesto de B1
  const factorSubidaAutonomo = Math.pow(1 + supuestos.subidaAutonomoPct / 100, yearIndex);
  const factorInflacionGastos = Math.pow(1 + supuestos.inflacionGastosPct / 100, yearIndex);
  const factorRevalorizacion = Math.pow(1 + supuestos.revalorizacionInmueblesPct / 100, yearIndex);

  // ── INGRESOS ──────────────────────────────────────────────────────────────
  // A. Nóminas (B3): distribución mensual recalculada por año — el historial
  // `vigenciaDesde` manda y el % de B1 compone tras el último cambio registrado
  const nomina = baseData.nominaNetaPorAnio[yearIndex][monthOfYear];

  // B. Autónomo income: exact per-month calculation using fuentesIngreso meses arrays
  let serviciosFreelance = 0;
  let gastosAutonomo = 0;
  const autonomoDrillDown: DrillDownItem[] = [];
  const gastosAutonomoDrillDown: DrillDownItem[] = [];

  for (const a of baseData.autonomosData) {
    let ingresosEsteMes = 0;
    if (a.fuentesIngreso.length > 0) {
      for (const f of a.fuentesIngreso) {
        const appliesToMonth = !f.meses || f.meses.length === 0 || f.meses.includes(month1to12);
        if (appliesToMonth) {
          ingresosEsteMes += f.importeEstimado;
        }
      }
    } else {
      // Old-model fallback: flat monthly average
      ingresosEsteMes = a.ingresosAnualesFallback / 12;
    }
    // B3 · subida anual de ingresos de actividad (supuesto B1 · B0.1 dos mandos)
    ingresosEsteMes *= factorSubidaAutonomo;

    serviciosFreelance += ingresosEsteMes;
    if (ingresosEsteMes > 0) {
      autonomoDrillDown.push({
        concepto: a.conceptoTitular,
        importe: ingresosEsteMes,
        fuente: a.nombre,
      });
    }

    let gastosEsteMes = 0;
    if (a.gastosRecurrentesActividad.length > 0) {
      for (const g of a.gastosRecurrentesActividad) {
        const appliesToMonth = !g.meses || g.meses.length === 0 || g.meses.includes(month1to12);
        if (appliesToMonth) {
          gastosEsteMes += g.importe;
        }
      }
    } else {
      // Old-model fallback: flat monthly average
      gastosEsteMes = a.gastosAnualesFallback / 12;
    }
    // CRITICAL: add cuotaAutonomos (Seguridad Social for self-employed) to activity expenses
    gastosEsteMes += a.cuotaAutonomos;
    // B3 · los gastos de actividad (incl. cuota) siguen la inflación de gastos de B1
    gastosEsteMes *= factorInflacionGastos;
    gastosAutonomo += gastosEsteMes;
    if (gastosEsteMes > 0) {
      gastosAutonomoDrillDown.push({
        concepto: a.conceptoTitular,
        importe: gastosEsteMes,
        fuente: a.nombre,
      });
    }
  }

  const pensiones = baseData.pensionNetaMensual;

  // C. Rentas (B3): ciclo de vida de contratos · vencen, se renuevan
  // (con vacancia) e indexan · precomputado en rentasContratosEngine
  const rentaMes = baseData.rentaPorMes.get(monthStr);
  const rentasAlquiler = rentaMes?.total ?? 0;

  // D. Intereses Inversiones: sum pagos_generados whose fecha_pago falls in the current month
  const dividendosGenerados = baseData.pagosRendimiento
    .filter(p => p.fecha_pago.startsWith(monthStr))
    .reduce((sum, p) => sum + p.importe_neto, 0);
  const dividendosCalculados = getInvestmentInterestForMonth(
    monthStr,
    month1to12,
    baseData.inversionesProyeccion,
  );
  const dividendosInversiones = Math.max(dividendosGenerados, dividendosCalculados);

  // E. Otros ingresos: exact monthly amount based on frequency — respect actual months, not flat division
  const otrosIngresosMensual = baseData.otrosIngresosItems.reduce((sum, otro) => {
    if (otro.fechaInicio && monthStr < otro.fechaInicio) return sum;
    if (otro.fechaFin && monthStr > otro.fechaFin) return sum;
    let mensual = 0;
    switch (otro.frecuencia) {
      case 'mensual': mensual = otro.importe; break;
      case 'trimestral': mensual = (month1to12 % 3 === 0) ? otro.importe : 0; break;
      case 'semestral': mensual = (month1to12 % 6 === 0) ? otro.importe : 0; break;
      case 'anual': mensual = (month1to12 === 12) ? otro.importe : 0; break;
    }
    return sum + mensual;
  }, 0);

  // Per-month drill-down for otros ingresos
  const otrosIngresosDrillDown: DrillDownItem[] = baseData.otrosIngresosItems
    .filter(otro => {
      if (otro.fechaInicio && monthStr < otro.fechaInicio) return false;
      if (otro.fechaFin && monthStr > otro.fechaFin) return false;
      switch (otro.frecuencia) {
        case 'mensual': return true;
        case 'trimestral': return month1to12 % 3 === 0;
        case 'semestral': return month1to12 % 6 === 0;
        case 'anual': return month1to12 === 12;
        default: return false;
      }
    })
    .map(otro => ({
      concepto: otro.nombre ?? otro.tipo,
      importe: otro.importe,
      fuente: otro.tipo,
    }));

  const totalIngresos =
    nomina +
    serviciosFreelance +
    pensiones +
    rentasAlquiler +
    dividendosInversiones +
    otrosIngresosMensual;

  // ── GASTOS ────────────────────────────────────────────────────────────────
  // C. OPEX (C-PROY-5 · B2): compromisos recurrentes de inmueble expandidos
  // por la vía directa (patrón + importe + variación / inflación B1) ·
  // precomputado en loadBaseData para todo el horizonte · lookup por mes
  const opexMes = baseData.opexPorMes.get(monthStr);
  const gastosOperativos = opexMes?.total ?? 0;
  const opexDesglose = opexMes?.desglose ?? [];

  // E. Gasto personal · V81 (Bloque C): FUENTE ÚNICA = compromisosRecurrentes ámbito
  // personal, con la misma función que Mi Plan (`gastoPersonalCompromisoEnMes`) → ambos
  // motores dan la misma cifra. Sigue la inflación de gastos de B1 (en el año base,
  // yearIndex 0, el factor es 1 · coincide exactamente con Mi Plan).
  const gastosPersonales =
    baseData.compromisosPersonales.reduce(
      (sum, c) => sum + gastoPersonalCompromisoEnMes(c, year, monthOfYear),
      0,
    ) * factorInflacionGastos;

  const irpf = baseData.irpfForecastByMonth.get(monthStr) ?? 0;

  const totalGastos =
    gastosOperativos +
    gastosPersonales +
    gastosAutonomo +
    irpf;

  // ── FINANCIACIÓN ──────────────────────────────────────────────────────────
  let cuotasHipotecas = 0;
  let cuotasPrestamos = 0;
  const prestamosDrillDown: DrillDownItem[] = [];

  for (const loan of deudaState.loans) {
    // Find the period whose fechaCargo falls in the current month
    const currentPeriodo = loan.periodos.find(p => p.fechaCargo.startsWith(monthStr));
    const cuota = currentPeriodo?.cuota ?? 0;
    if (cuota > 0) {
      prestamosDrillDown.push({ concepto: loan.concepto, importe: cuota });
    }
    if (loan.isHipoteca) {
      cuotasHipotecas += cuota;
    } else {
      cuotasPrestamos += cuota;
    }
  }

  const totalFinanciacion = cuotasHipotecas + cuotasPrestamos;

  // ── TESORERÍA ─────────────────────────────────────────────────────────────
  const liquidacionesInversiones = getInvestmentLiquidationCashflowForMonth(
    monthStr,
    baseData.inversionesProyeccion,
  );
  // B3 · rentabilidad del ahorro (supuesto B1): la caja positiva se remunera
  // mensualmente · el interés entra en el flujo del mes (cajaFinal =
  // cajaInicial + flujoCajaMes se mantiene como invariante)
  const interesAhorro =
    Math.max(0, cajaAnterior) * (supuestos.rentabilidadAhorroPct / 100 / 12);
  const flujoCajaMes =
    totalIngresos - totalGastos - totalFinanciacion + liquidacionesInversiones + interesAhorro;
  const cajaFinal = cajaAnterior + flujoCajaMes;

  // ── PATRIMONIO ────────────────────────────────────────────────────────────
  // Inmuebles (B3): última valoración conocida ≤ mes (fallback precio compra)
  // × revalorización anual compuesta de B1 desde el año base
  const inmuebles =
    sumAssetValuesForMonth(
      baseData.valoracionIndex,
      'inmueble',
      baseData.inmuebleInitialValues,
      monthStr,
    ) * factorRevalorizacion;

  // Remaining debt: use principalFinal from the amortization schedule.
  // For months before first payment, fall back to principalInicial.
  // For months after full repayment, principalFinal of the last period (≈ 0).
  let deudaInmuebles = 0;
  let deudaPersonal = 0;
  for (const loan of deudaState.loans) {
    const periodsUpToMonth = loan.periodos.filter(
      p => p.fechaCargo.substring(0, 7) <= monthStr,
    );
    const lastPeriod = periodsUpToMonth[periodsUpToMonth.length - 1];
    const outstanding = lastPeriod ? lastPeriod.principalFinal : loan.principalInicial;
    if (loan.isHipoteca) {
      deudaInmuebles += outstanding;
    } else {
      deudaPersonal += outstanding;
    }
  }
  const deudaTotal = deudaInmuebles + deudaPersonal;

  const planesPension = baseData.valorPlanesPension;
  // Otras inversiones: use last known historical valuation; fallback to valor_actual
  const inversionesActivas = baseData.inversionInitialValues.filter(asset => {
    const liquidationMonth = baseData.liquidationMonthByInvestmentId.get(asset.id);
    return !liquidationMonth || monthStr < liquidationMonth;
  });
  const otrasInversiones = sumAssetValuesForMonth(
    baseData.valoracionIndex,
    'inversion',
    inversionesActivas,
    monthStr,
  );

  const activos = cajaFinal + inmuebles + planesPension + otrasInversiones;
  const patrimonioNeto = activos - deudaTotal;

  // DrillDown (B3): arrays por año/mes coherentes con los importes dinámicos
  const scaledNominaDrillDown = baseData.nominaDrillDownPorAnio[yearIndex][monthOfYear];
  const scaledRentaDrillDown = rentaMes?.drillDown ?? [];

  return {
    month: monthStr,
    ingresos: {
      nomina,
      serviciosFreelance,
      pensiones,
      rentasAlquiler,
      dividendosInversiones,
      otrosIngresos: otrosIngresosMensual,
      total: totalIngresos,
      drillDown: {
        nomina: scaledNominaDrillDown,
        autonomos: autonomoDrillDown,
        pensiones: baseData.pensionDrillDown,
        rentasAlquiler: scaledRentaDrillDown,
        otrosIngresos: otrosIngresosDrillDown,
      },
    },
    gastos: {
      gastosOperativos,
      opexDesglose,
      gastosPersonales,
      gastosAutonomo,
      irpf,
      total: totalGastos,
      drillDown: {
        gastosOperativos: opexDesglose.map(item => ({
          concepto: item.concepto,
          importe: item.importe,
          fuente: item.propertyAlias,
        })),
        gastosAutonomo: gastosAutonomoDrillDown,
      },
    },
    financiacion: {
      cuotasHipotecas,
      cuotasPrestamos,
      total: totalFinanciacion,
      drillDown: {
        prestamos: prestamosDrillDown,
      },
    },
    tesoreria: {
      flujoCajaMes,
      cajaInicial: cajaAnterior,
      cajaFinal,
    },
    patrimonio: {
      caja: cajaFinal,
      inmuebles,
      planesPension,
      otrasInversiones,
      deudaInmuebles,
      deudaPersonal,
      deudaTotal,
      patrimonioNeto,
    },
  };
}

/**
 * Load and aggregate all base financial data from the database
 */
async function loadBaseData(): Promise<BaseData> {
  // Personal data · T14.4 · migrado a fiscalContextService gateway
  const ctx = await getFiscalContextSafe();
  const personalDataId = ctx?.personalDataId ?? 1;

  // Supuestos de proyección · fuente única B1 · una sola lectura para todas
  // las dinámicas (OPEX, rentas, salario, revalorización, ahorro).
  const supuestos = await getSupuestosProyeccion();

  // ── A. NÓMINAS (B3: por año del horizonte) ────────────────────────────────
  // ÚNICA FUENTE DE VERDAD (`calcularNetoMesNomina`) · misma cifra que
  // card/panel/wizard/Tesorería. Cada año se recalcula con su `year` real,
  // así el historial `vigenciaDesde` (subidas registradas con fecha) manda.
  // El % anual de B1 solo compone después del último cambio registrado.
  const nominaNetaPorAnio: number[][] = Array.from(
    { length: PROJECTION_YEARS },
    () => new Array(12).fill(0),
  );
  const nominaDrillDownPorAnio: DrillDownItem[][][] = Array.from(
    { length: PROJECTION_YEARS },
    () => Array.from({ length: 12 }, () => [] as DrillDownItem[]),
  );

  try {
    const nominas = await nominaService.getNominas(personalDataId);
    const nominasActivas = nominas.filter(n => n.activa);
    for (const nomina of nominasActivas) {
      // Ancla del % anual: año del último cambio registrado (o el año base)
      const aniosVigencia = (nomina.historial ?? [])
        .map((h) => new Date(h.vigenciaDesde).getFullYear())
        .filter((y) => !Number.isNaN(y));
      const anchorYear = Math.max(START_YEAR, ...(aniosVigencia.length ? aniosVigencia : [START_YEAR]));

      for (let yearIndex = 0; yearIndex < PROJECTION_YEARS; yearIndex++) {
        const anio = START_YEAR + yearIndex;
        const factor = Math.pow(
          1 + supuestos.subidaNominaPct / 100,
          Math.max(0, anio - anchorYear),
        );
        for (let mes = 1; mes <= 12; mes++) {
          const netoMes = calcularNetoMesNomina(nomina, mes, anio).netoMes * factor;
          const idx = mes - 1; // 0-indexed
          nominaNetaPorAnio[yearIndex][idx] += netoMes;
          nominaDrillDownPorAnio[yearIndex][idx].push({
            concepto: nomina.nombre ?? 'Nómina',
            importe: netoMes,
            fuente: nomina.nombre,
          });
        }
      }
    }
  } catch {
    // No nomina data available
  }

  // ── Autónomo ──────────────────────────────────────────────────────────────
  const autonomosData: AutonomoProjectionData[] = [];
  try {
    const autonomos = await autonomoService.getAutonomos(personalDataId);
    const autonomosActivos = autonomos.filter(a => a.activo);
    for (const autonomo of autonomosActivos) {
      const conceptoTitular = (autonomo.titular ?? autonomo.nombre ?? 'Autónomo').toUpperCase();

      // Old-model fallback values (used when fuentesIngreso / gastosRecurrentesActividad are empty)
      let ingresosAnualesFallback = 0;
      if ((autonomo.fuentesIngreso ?? []).length === 0) {
        ingresosAnualesFallback = autonomo.ingresosFacturados.reduce((sum, i) => sum + i.importe, 0);
      }
      let gastosAnualesFallback = 0;
      if ((autonomo.gastosRecurrentesActividad ?? []).length === 0) {
        gastosAnualesFallback = autonomo.gastosDeducibles.reduce((sum, g) => sum + g.importe, 0);
      }

      autonomosData.push({
        conceptoTitular,
        nombre: autonomo.nombre ?? 'Autónomo',
        fuentesIngreso: autonomo.fuentesIngreso ?? [],
        gastosRecurrentesActividad: autonomo.gastosRecurrentesActividad ?? [],
        cuotaAutonomos: autonomo.cuotaAutonomos,
        ingresosAnualesFallback,
        gastosAnualesFallback,
      });
    }
  } catch {
    // No autonomo data available
  }

  // ── Pensiones ─────────────────────────────────────────────────────────────
  let pensionNetaMensual = 0;
  const pensionDrillDown: DrillDownItem[] = [];
  try {
    const pensiones = await pensionService.getPensiones(personalDataId);
    const pensionesActivas = pensiones.filter(p => p.activa);
    for (const pension of pensionesActivas) {
      const { netoMensual } = pensionService.calculatePension(pension);
      pensionNetaMensual += netoMensual;
      pensionDrillDown.push({
        concepto: pension.tipoPension.charAt(0).toUpperCase() + pension.tipoPension.slice(1),
        importe: netoMensual,
        fuente: pension.titular,
      });
    }
  } catch {
    // No pension data available
  }

  // ── Otros Ingresos ────────────────────────────────────────────────────────
  let otrosIngresosItems: OtrosIngresos[] = [];
  try {
    const otrosIngresos = await otrosIngresosService.getOtrosIngresos(personalDataId);
    otrosIngresosItems = otrosIngresos.filter(o => o.activo && o.frecuencia !== 'unico');
  } catch {
    // No otrosIngresos data available
  }

  // ── B/C. INMUEBLES · contratos + alias + valores ──────────────────────────
  const propertyAliasMap = new Map<number, string>();
  const inmuebleInitialValues: AssetInitialValue[] = [];
  let allContracts: Contract[] = [];

  try {
    const [contracts, inmuebles] = await Promise.all([
      getAllContracts(),
      inmuebleService.getAll(),
    ]);
    allContracts = contracts;

    // Build a property alias lookup and collect purchase prices as fallback values
    for (const inm of inmuebles) {
      if (inm.id) {
        const numId = parseInt(inm.id, 10);
        if (!isNaN(numId)) {
          propertyAliasMap.set(numId, inm.alias);
          if (inm.estado === 'ACTIVO') {
            inmuebleInitialValues.push({
              id: numId,
              initialValue: inm.compra?.precio_compra ?? 0,
              nombre: inm.alias,
            });
          }
        }
      }
    }

  } catch {
    // No property/contract data available
  }

  // ── B. RENTAS (B3) · ciclo de vida de contratos en el horizonte completo:
  // vencen, se renuevan (con la vacancia de B1 como riesgo de re-alquiler) e
  // indexan (tasa del contrato o global de B1). Antes: array del año base
  // congelado los 20 años.
  const rentaPorMes = buildRentaPorMes(
    allContracts,
    supuestos,
    propertyAliasMap,
    START_YEAR,
    PROJECTION_YEARS,
  );

  // OPEX de inmuebles (C-PROY-5 · B2) · vía directa desde compromisosRecurrentes.
  // Cierra el agujero `opexRules = []` que dejó la migración V62: el motor
  // proyectaba gastos operativos 0 los 20 años. La inflación de gastos sale
  // del supuesto único (B1) y cada compromiso puede sobrescribirla con su
  // `variacion` (ipcAnual · aniversarioContrato · sinVariacion explícito).
  let opexPorMes: Map<string, OpexMes> = new Map();
  try {
    const compromisos = await listarCompromisos({ ambito: 'inmueble', soloActivos: true });
    opexPorMes = buildOpexPorMes(
      compromisos,
      supuestos.inflacionGastosPct,
      propertyAliasMap,
      START_YEAR,
      PROJECTION_YEARS,
    );
  } catch {
    // Sin compromisos disponibles · OPEX vacío
  }

  // Investment values
  let valorPlanesPension = 0;
  const inversionInitialValues: AssetInitialValue[] = [];
  const pagosRendimiento: PagoRendimiento[] = [];
  const inversionesProyeccion: InvestmentProjectionData[] = [];
  const liquidationMonthByInvestmentId = new Map<number, string>();
  try {
    // T-VALORACIONES PR7a' · cargar inversiones + mapas en paralelo. Prefer
    // valor del servicio nuevo (`valoracionesActivos`) sobre `inv.valor_actual`
    // legacy con fallback ordenado. Mismo patrón usado en `dashboardService`.
    const emptyMap = new Map<string, { valor: number; fecha_valoracion: string }>();
    const [inversiones, mapValoracionesInversion, mapValoracionesPlanes] = await Promise.all([
      inversionesService.getPosiciones(),
      valoracionesService.getMapValoracionesMasRecientes('inversion').catch(() => emptyMap),
      valoracionesService.getMapValoracionesMasRecientes('plan_pensiones').catch(() => emptyMap),
    ]);
    /** Resuelve el mejor valor disponible para una posición · servicio gana
     *  sobre `valor_actual` legacy con fallback. */
    const valorPosicion = (inv: PosicionInversion): number => {
      const esPlan = inv.tipo === 'plan_pensiones' || inv.tipo === 'plan_empleo';
      const mapa = esPlan ? mapValoracionesPlanes : mapValoracionesInversion;
      const match = mapa.get(String(inv.id));
      return match?.valor ?? inv.valor_actual ?? 0;
    };
    for (const inv of inversiones) {
      const invAny = inv as unknown as InversionRendimientoPeriodico & PosicionInversion;
      const valorEfectivo = valorPosicion(inv);
      if (inv.id != null) {
        const invProjection: InvestmentProjectionData = {
          id: inv.id,
          tipo: inv.tipo,
          valorActual: valorEfectivo,
          rendimiento: invAny.rendimiento,
          planLiquidacion: invAny.plan_liquidacion,
        };
        inversionesProyeccion.push(invProjection);

        const liquidationMonth = getInvestmentLiquidationMonth(invProjection);
        if (liquidationMonth) {
          liquidationMonthByInvestmentId.set(inv.id, liquidationMonth);
        }
      }
      if (inv.tipo === 'plan_pensiones' || inv.tipo === 'plan_empleo') {
        valorPlanesPension += valorEfectivo;
      } else {
        // Non-pension investments use historical valuations; el valor
        // efectivo (servicio o legacy) actúa como fallback inicial cuando
        // el índice de valoraciones no tiene entrada para una fecha futura.
        inversionInitialValues.push({ id: inv.id, initialValue: valorEfectivo, nombre: (inv as { nombre?: string }).nombre });
      }
      // Collect periodic return payments (cuenta_remunerada, prestamo_p2p, deposito_plazo)
      if (['cuenta_remunerada', 'prestamo_p2p', 'deposito_plazo'].includes(inv.tipo)) {
        const extInv = invAny as InversionRendimientoPeriodico;
        if (extInv.rendimiento?.pagos_generados?.length) {
          pagosRendimiento.push(...extInv.rendimiento.pagos_generados);
        }
      }
    }
  } catch {
    // No investment data available
  }

  // Historical valuations — build index for fast per-asset per-month lookups
  let valoracionIndex: ValoracionIndex = { byId: new Map(), byNombre: new Map() };
  try {
    // T24.1: acceso centralizado via valoracionesService
    const valoracionesHistoricas: ValoracionHistorica[] = await valoracionesService.getAllValoraciones();
    valoracionIndex = buildValoracionIndex(valoracionesHistoricas);
  } catch {
    // No valuation history available
  }

  // Cash opening balance from all active accounts at projection start.
  // Uses openingBalance/openingBalanceDate plus prior treasury movements/events.
  let cajaInicial = 0;
  try {
    cajaInicial = await calculateTotalInitialCash(`${START_YEAR}-01-01`);
  } catch {
    // No account data available
  }

  // ── E. GASTOS PERSONALES ─────────────────────────────────────────────────
  // V81 (TAREA CC · Bloque C): FUENTE ÚNICA = compromisosRecurrentes ámbito personal
  // (misma fuente que Mi Plan). Antes leía de `patronGastosPersonales` (store eliminado
  // en V62 · stub que devolvía []), por lo que el gasto personal de Horizon era siempre 0.
  let compromisosPersonales: CompromisoRecurrente[] = [];
  try {
    compromisosPersonales = await listarCompromisos({ ambito: 'personal', soloActivos: true });
  } catch {
    // Sin compromisos personales
  }

  const irpfForecastByMonth = await loadIrpfForecastByMonth(allContracts, supuestos);

  return {
    supuestos,
    nominaNetaPorAnio,
    nominaDrillDownPorAnio,
    rentaPorMes,
    autonomosData,
    pensionDrillDown,
    opexPorMes,
    propertyAliasMap,
    compromisosPersonales,
    valoracionIndex,
    inmuebleInitialValues,
    inversionInitialValues,
    pagosRendimiento,
    inversionesProyeccion,
    liquidationMonthByInvestmentId,
    pensionNetaMensual,
    otrosIngresosItems,
    valorPlanesPension,
    cajaInicial,
    irpfForecastByMonth,
  };
}

/**
 * Load loan data for amortization calculations
 */
async function loadDeudaState(): Promise<DeudaState> {
  const loans: LoanInfo[] = [];

  try {
    const prestamos = await prestamosService.getAllPrestamos();
    const plans = await Promise.all(prestamos.map(p => prestamosService.getPaymentPlan(p.id)));

    for (let i = 0; i < prestamos.length; i++) {
      const p = prestamos[i];
      const plan = plans[i];
      const isHipoteca = p.ambito
        ? p.ambito === 'INMUEBLE'
        : Boolean(p.inmuebleId && p.inmuebleId !== 'standalone');

      loans.push({
        principalInicial: p.principalInicial,
        isHipoteca,
        concepto: p.nombre ?? 'Hipoteca/Préstamo',
        periodos: plan?.periodos ?? [],
      });
    }
  } catch {
    // No loan data available
  }

  return { loans };
}

const PROYECCION_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes
let proyeccionCache: ProyeccionAnual[] | null = null;
let proyeccionCacheExpiresAt = 0;
let proyeccionPending: Promise<ProyeccionAnual[]> | null = null;

/**
 * Invalidate the projection cache so the next call to generateProyeccionMensual
 * recomputes from scratch. Call this after any CRUD operation that affects the projection.
 */
export function invalidateProyeccionCache(): void {
  proyeccionCache = null;
  proyeccionCacheExpiresAt = 0;
  proyeccionPending = null;
}

/**
 * B4 · Deriva la salida canónica (un punto por año · cierre a diciembre)
 * desde la proyección mensual. Pura · testable.
 */
export function derivarSeriePatrimonio(proyecciones: ProyeccionAnual[]): PuntoPatrimonioAnual[] {
  return proyecciones.map((anual) => {
    const dic = anual.months[anual.months.length - 1];
    const rentasAnuales = anual.months.reduce((s, m) => s + m.ingresos.rentasAlquiler, 0);
    const gastosOperativosAnuales = anual.months.reduce((s, m) => s + m.gastos.gastosOperativos, 0);
    return {
      año: anual.year,
      patrimonioNeto: dic.patrimonio.patrimonioNeto,
      activosTotales:
        dic.patrimonio.caja +
        dic.patrimonio.inmuebles +
        dic.patrimonio.planesPension +
        dic.patrimonio.otrasInversiones,
      caja: dic.patrimonio.caja,
      inmuebles: dic.patrimonio.inmuebles,
      inversiones: dic.patrimonio.planesPension + dic.patrimonio.otrasInversiones,
      deudaTotal: dic.patrimonio.deudaTotal,
      ingresosAnuales: anual.totalesAnuales.ingresosTotales,
      gastosAnuales: anual.totalesAnuales.gastosTotales,
      rentasAnuales,
      gastosOperativosAnuales,
      servicioDeudaAnual: anual.totalesAnuales.financiacionTotal,
      flujoNetoAnual: anual.totalesAnuales.flujoNetoAnual,
    };
  });
}

/**
 * B4 · LA salida que consumen las pantallas (héroe del Panel · Mi Plan ·
 * panel de KPIs). Comparte caché con `generateProyeccionMensual`.
 */
export async function getSeriePatrimonio(): Promise<PuntoPatrimonioAnual[]> {
  return derivarSeriePatrimonio(await generateProyeccionMensual());
}

/**
 * Generate 20-year monthly financial projection.
 * Results are cached at module level for 3 minutes; concurrent callers share a single in-flight Promise.
 */
export async function generateProyeccionMensual(): Promise<ProyeccionAnual[]> {
  if (proyeccionCache && Date.now() < proyeccionCacheExpiresAt) {
    return proyeccionCache;
  }

  if (proyeccionPending) {
    return proyeccionPending;
  }

  proyeccionPending = (async () => {
    const [baseData, deudaState] = await Promise.all([
      loadBaseData(),
      loadDeudaState(),
    ]);

    const proyecciones: ProyeccionAnual[] = [];
    let cajaAcumulada = baseData.cajaInicial;

    for (let yearIndex = 0; yearIndex < PROJECTION_YEARS; yearIndex++) {
      const year = START_YEAR + yearIndex;
      const months: MonthlyProjectionRow[] = [];

      for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
        const absoluteMonthIndex = yearIndex * 12 + monthIndex;
        const row = buildMonthRow(
          absoluteMonthIndex,
          baseData,
          deudaState,
          cajaAcumulada,
        );
        months.push(row);
        cajaAcumulada = row.tesoreria.cajaFinal;
      }

      // Annual totals
      const ingresosTotales = months.reduce(
        (s, m) => s + m.ingresos.total,
        0,
      );
      const gastosTotales = months.reduce((s, m) => s + m.gastos.total, 0);
      const financiacionTotal = months.reduce(
        (s, m) => s + m.financiacion.total,
        0,
      );
      const flujoNetoAnual = months.reduce(
        (s, m) => s + m.tesoreria.flujoCajaMes,
        0,
      );
      const patrimonioNetoFinal =
        months[months.length - 1].patrimonio.patrimonioNeto;
      proyecciones.push({
        year,
        months,
        totalesAnuales: {
          ingresosTotales,
          gastosTotales,
          financiacionTotal,
          flujoNetoAnual,
          patrimonioNetoFinal,
        },
      });
    }

    proyeccionCache = proyecciones;
    proyeccionCacheExpiresAt = Date.now() + PROYECCION_CACHE_TTL_MS;
    proyeccionPending = null;
    return proyecciones;
  })();

  return proyeccionPending;
}
