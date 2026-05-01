// src/modules/horizon/proyeccion/mensual/services/proyeccionMensualService.ts
// ATLAS HORIZON: Monthly financial projection calculation engine

import { initDB, OpexRule, Contract } from '../../../../../services/db';
import { nominaService } from '../../../../../services/nominaService';
import { autonomoService } from '../../../../../services/autonomoService';
import { pensionService } from '../../../../../services/pensionService';
import { otrosIngresosService } from '../../../../../services/otrosIngresosService';
import { getFiscalContextSafe } from '../../../../../services/fiscalContextService';
import { getAllContracts } from '../../../../../services/contractService';
import { inmuebleService } from '../../../../../services/inmuebleService';
import { prestamosService } from '../../../../../services/prestamosService';
import { inversionesService } from '../../../../../services/inversionesService';
import { personalExpensesService } from '../../../../../services/personalExpensesService';
import { calculateTotalInitialCash } from '../../../../../services/accountBalanceService';
import { PersonalExpense, OtrosIngresos, FuenteIngreso, GastoRecurrenteActividad } from '../../../../../types/personal';
import { ValoracionHistorica } from '../../../../../types/valoraciones';
import { PeriodoPago } from '../../../../../types/prestamos';
import { InversionRendimientoPeriodico, PagoRendimiento } from '../../../../../types/inversiones-extended';
import { PosicionInversion, PlanLiquidacion } from '../../../../../types/inversiones';
import { MonthlyProjectionRow, ProyeccionAnual, DrillDownItem } from '../types/proyeccionMensual';
import { calcularDeclaracionIRPF } from '../../../../../services/irpfCalculationService';
import { generarEventosFiscales, getConfiguracionFiscal } from '../../../../../services/fiscalPaymentsService';
import {
  calculateOpexForMonth,
  calculateOpexBreakdownForMonth,
  calculatePersonalExpensesForMonth,
} from './forecastEngine';

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

/**
 * Check whether a contract is active during a given year/month.
 * month is 0-indexed (0 = January).
 */
function isContractActiveInMonth(contract: Contract, year: number, month: number): boolean {
  if (contract.estadoContrato === 'rescindido' || contract.estadoContrato === 'finalizado') {
    return false;
  }
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const fechaInicio = new Date(contract.fechaInicio);
  const fechaFin = new Date(contract.fechaFin);
  return monthStart <= fechaFin && monthEnd >= fechaInicio;
}

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
  // Monthly arrays for base year (index 0 = January, 11 = December)
  nominaNetaMensual: number[];  // Exact net per month from calculateSalary()
  rentaMensualPorMes: number[]; // Rental income per month (contract date-filtered, flat)

  // DrillDown arrays (12 entries, one per month)
  nominaDrillDown: DrillDownItem[][];
  rentaDrillDown: DrillDownItem[][];

  // Per-autonomo structured data (replaces flat freelanceMensual + gastosAutonomoMensual)
  autonomosData: AutonomoProjectionData[];

  // Flat drill-down arrays (same items every month, amounts are monthly equivalents)
  pensionDrillDown: DrillDownItem[];

  // Passed to forecastEngine functions
  /** All OpexRules across all properties */
  opexRules: OpexRule[];
  /** Maps property numeric ID → alias for drill-down labels */
  propertyAliasMap: Map<number, string>;
  /** Active OPEX-style personal expenses */
  personalExpenses: PersonalExpense[];

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

/** Pre-built index for fast historical valuation lookup: key = "tipo_activo|activo_id" → sorted asc array */
type ValoracionIndex = Map<string, ValoracionHistorica[]>;

/**
 * Builds a lookup map from a flat list of historical valuations.
 * Each map key is "{tipo_activo}|{activo_id}" and the value is an array
 * sorted ascending by fecha_valoracion so binary search is possible.
 */
function buildValoracionIndex(history: ValoracionHistorica[]): ValoracionIndex {
  const index: ValoracionIndex = new Map();
  for (const v of history) {
    const key = `${v.tipo_activo}|${v.activo_id}`;
    const bucket = index.get(key);
    if (bucket) {
      bucket.push(v);
    } else {
      index.set(key, [v]);
    }
  }
  // Sort each bucket ascending so we can iterate from the end for "latest ≤ month"
  index.forEach(bucket => {
    bucket.sort((a: ValoracionHistorica, b: ValoracionHistorica) =>
      a.fecha_valoracion.localeCompare(b.fecha_valoracion),
    );
  });
  return index;
}

/**
 * Returns the last known valuation for an asset at or before a given month (YYYY-MM).
 * Falls back to the provided initialValue if no historical record exists.
 */
function getLastValueForAsset(
  index: ValoracionIndex,
  tipo: 'inmueble' | 'inversion',
  activoId: number,
  atOrBeforeMonth: string,
  initialValue: number,
): number {
  const bucket = index.get(`${tipo}|${activoId}`);
  if (!bucket) return initialValue;
  // Find the last entry with fecha_valoracion <= atOrBeforeMonth
  let result = initialValue;
  for (const v of bucket) {
    if (v.fecha_valoracion <= atOrBeforeMonth) result = v.valor;
    else break;
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
    (sum, asset) => sum + getLastValueForAsset(index, tipo, asset.id, atOrBeforeMonth, asset.initialValue),
    0,
  );
}

async function loadIrpfForecastByMonth(): Promise<Map<string, number>> {
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
          const declaracion = await calcularDeclaracionIRPF(ejercicio, { usarConciliacion });
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
  const year = START_YEAR + Math.floor(absoluteMonthIndex / 12);
  const monthOfYear = absoluteMonthIndex % 12; // 0-11
  const month1to12 = monthOfYear + 1;
  // Format month string "YYYY-MM"
  const monthStr = `${year}-${String(month1to12).padStart(2, '0')}`;

  // ── INGRESOS ──────────────────────────────────────────────────────────────
  // A. Nóminas: use actual monthly distribution from calculateSalary() — flat, no growth applied
  const nomina = baseData.nominaNetaMensual[monthOfYear];

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

  // C. Rentas: flat — no IPC applied. The contracted rent is what the tenant pays.
  const rentasAlquiler = baseData.rentaMensualPorMes[monthOfYear];

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
  // C. OPEX: use forecastEngine for frequency-aware OpexRule calculation — flat, no inflation applied
  const gastosOperativos = calculateOpexForMonth(baseData.opexRules, month1to12);

  // Per-property/concept breakdown — flat, no growth factor applied
  const opexDesglose = calculateOpexBreakdownForMonth(
    baseData.opexRules,
    month1to12,
    baseData.propertyAliasMap,
  );

  // E. Personal expenses
  const gastosPersonales =
    calculatePersonalExpensesForMonth(baseData.personalExpenses, month1to12);

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
  const flujoCajaMes = totalIngresos - totalGastos - totalFinanciacion + liquidacionesInversiones;
  const cajaFinal = cajaAnterior + flujoCajaMes;

  // ── PATRIMONIO ────────────────────────────────────────────────────────────
  // Inmuebles: use last known historical valuation at or before this month; fallback to purchase price
  const inmuebles = sumAssetValuesForMonth(
    baseData.valoracionIndex,
    'inmueble',
    baseData.inmuebleInitialValues,
    monthStr,
  );

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

  // DrillDown: flat base-year arrays — no growth scaling applied
  const scaledNominaDrillDown = baseData.nominaDrillDown[monthOfYear];
  // Rent drilldown is flat — no IPC growth applied
  const scaledRentaDrillDown = baseData.rentaDrillDown[monthOfYear];

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
  const db = await initDB();
  const year = START_YEAR;

  // Personal data · T14.4 · migrado a fiscalContextService gateway
  const ctx = await getFiscalContextSafe();
  const personalDataId = ctx?.personalDataId ?? 1;

  // ── A. NÓMINAS ────────────────────────────────────────────────────────────
  // Use calculateSalary() to get the exact monthly net distribution
  const nominaNetaMensual: number[] = new Array(12).fill(0);
  const nominaDrillDown: DrillDownItem[][] = Array.from({ length: 12 }, () => []);

  try {
    const nominas = await nominaService.getNominas(personalDataId);
    const nominasActivas = nominas.filter(n => n.activa);
    for (const nomina of nominasActivas) {
      const calculo = nominaService.calculateSalary(nomina);

      for (const mesData of calculo.distribucionMensual) {
        const idx = mesData.mes - 1; // 0-indexed
        nominaNetaMensual[idx] += mesData.netoTotal;
        nominaDrillDown[idx].push({
          concepto: nomina.nombre ?? 'Nómina',
          importe: mesData.netoTotal,
          fuente: nomina.nombre,
        });
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

  // ── B. INMUEBLES - INGRESOS (RENTAS) ──────────────────────────────────────
  // Filter by contract active date range for each month of the projection year
  const rentaMensualPorMes: number[] = new Array(12).fill(0);
  const rentaDrillDown: DrillDownItem[][] = Array.from({ length: 12 }, () => []);

  // ── C. INMUEBLES - OPEX + property values ─────────────────────────────────
  let opexRules: OpexRule[] = [];
  const propertyAliasMap = new Map<number, string>();
  const inmuebleInitialValues: AssetInitialValue[] = [];

  try {
    const [contracts, inmuebles] = await Promise.all([
      getAllContracts(),
      inmuebleService.getAll(),
    ]);

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
            });
          }
        }
      }
    }

    // Populate per-month rental income (date-range filtered)
    for (const contract of contracts) {
      for (let m = 0; m < 12; m++) {
        if (isContractActiveInMonth(contract, year, m)) {
          const renta = contract.rentaMensual ?? 0;
          rentaMensualPorMes[m] += renta;
          const propertyAlias = propertyAliasMap.get(contract.inmuebleId) ?? (contract.inmuebleId ? `Inmueble ${contract.inmuebleId}` : 'Inmueble');
          const inquilino = `${contract.inquilino?.nombre ?? ''} ${contract.inquilino?.apellidos ?? ''}`.trim();
          rentaDrillDown[m].push({
            concepto: inquilino || 'Inquilino',
            importe: renta,
            fuente: propertyAlias,
          });
        }
      }
    }

    // Load all OpexRules for use by forecastEngine functions (cached to avoid repeated DB reads)
    opexRules = []; // opexRules store eliminado en V62 — migrado a compromisosRecurrentes
  } catch {
    // No property/contract data available
  }

  // Investment values
  let valorPlanesPension = 0;
  const inversionInitialValues: AssetInitialValue[] = [];
  const pagosRendimiento: PagoRendimiento[] = [];
  const inversionesProyeccion: InvestmentProjectionData[] = [];
  const liquidationMonthByInvestmentId = new Map<number, string>();
  try {
    const inversiones = await inversionesService.getPosiciones();
    for (const inv of inversiones) {
      const invAny = inv as unknown as InversionRendimientoPeriodico & PosicionInversion;
      if (inv.id != null) {
        const invProjection: InvestmentProjectionData = {
          id: inv.id,
          tipo: inv.tipo,
          valorActual: inv.valor_actual,
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
        valorPlanesPension += inv.valor_actual;
      } else {
        // Non-pension investments use historical valuations; valor_actual is the fallback
        inversionInitialValues.push({ id: inv.id, initialValue: inv.valor_actual });
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
  let valoracionIndex: ValoracionIndex = new Map();
  try {
    const valoracionesHistoricas: ValoracionHistorica[] = await db.getAll('valoraciones_historicas');
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
  // Load PersonalExpense records (new model with advanced frequency fields)
  // All expenses come from personalExpenses (patronGastosPersonales)
  let personalExpenses: PersonalExpense[] = [];
  try {
    const allPersonalExpenses = await personalExpensesService.getExpenses(personalDataId);
    personalExpenses = allPersonalExpenses.filter(e => e.activo && e.importe > 0);
  } catch {
    // No PersonalExpense data available
  }

  const irpfForecastByMonth = await loadIrpfForecastByMonth();

  return {
    nominaNetaMensual,
    rentaMensualPorMes,
    nominaDrillDown,
    rentaDrillDown,
    autonomosData,
    pensionDrillDown,
    opexRules,
    propertyAliasMap,
    personalExpenses,
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
