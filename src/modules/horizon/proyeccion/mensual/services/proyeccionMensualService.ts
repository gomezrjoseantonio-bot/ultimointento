// src/modules/horizon/proyeccion/mensual/services/proyeccionMensualService.ts
// ATLAS HORIZON: Monthly financial projection calculation engine

import { initDB, OpexRule, Contract } from '../../../../../services/db';
import { nominaService } from '../../../../../services/nominaService';
import { autonomoService } from '../../../../../services/autonomoService';
import { pensionService } from '../../../../../services/pensionService';
import { otrosIngresosService } from '../../../../../services/otrosIngresosService';
import { personalDataService } from '../../../../../services/personalDataService';
import { getAllContracts } from '../../../../../services/contractService';
import { inmuebleService } from '../../../../../services/inmuebleService';
import { prestamosService } from '../../../../../services/prestamosService';
import { inversionesService } from '../../../../../services/inversionesService';
import { gastosPersonalesService } from '../../../../../services/gastosPersonalesService';
import { personalExpensesService } from '../../../../../services/personalExpensesService';
import { GastoRecurrente, PersonalExpense, OtrosIngresos, FuenteIngreso, GastoRecurrenteActividad } from '../../../../../types/personal';
import { ValoracionHistorica } from '../../../../../types/valoraciones';
import { PeriodoPago } from '../../../../../types/prestamos';
import { InversionRendimientoPeriodico, PagoRendimiento } from '../../../../../types/inversiones-extended';
import { MonthlyProjectionRow, ProyeccionAnual, DrillDownItem } from '../types/proyeccionMensual';
import {
  calculateOpexForMonth,
  calculateOpexBreakdownForMonth,
  calculateGastosPersonalesForMonth,
  calculatePersonalExpensesForMonth,
} from './forecastEngine';

const PROJECTION_YEARS = 20;
const START_YEAR = new Date().getFullYear();

/**
 * Calculate simplified IRPF based on Spanish 2024 tax brackets (marginal rate applied monthly)
 */
function calculateMonthlyIRPF(monthlyIncome: number): number {
  const annualIncome = monthlyIncome * 12;
  let rate: number;

  if (annualIncome <= 12450) rate = 0.19;
  else if (annualIncome <= 20200) rate = 0.24;
  else if (annualIncome <= 35200) rate = 0.30;
  else if (annualIncome <= 60000) rate = 0.37;
  else rate = 0.45;

  return monthlyIncome * rate;
}

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
  /** Active personal recurring expenses */
  gastosRecurrentes: GastoRecurrente[];
  /** Active OPEX-style personal expenses */
  personalExpenses: PersonalExpense[];

  // Historical valuations index for real patrimonio calculation (pre-built for performance)
  valoracionIndex: ValoracionIndex;
  inmuebleInitialValues: AssetInitialValue[];    // fallback: purchase price
  inversionInitialValues: AssetInitialValue[];   // fallback: valor_actual

  // Investment periodic return payments (pagos_generados from cuenta_remunerada, prestamo_p2p, deposito_plazo)
  pagosRendimiento: PagoRendimiento[];

  // Scalars
  pensionNetaMensual: number;
  /** Individual otros-ingresos items – monthly amount computed per-month to respect fechaFin */
  otrosIngresosItems: OtrosIngresos[];
  valorPlanesPension: number;
  cajaInicial: number;
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
  let serviciosFreelanceNoIrpf = 0; // Portion without IRPF at source — used for IRPF base
  let gastosAutonomo = 0;
  const autonomoDrillDown: DrillDownItem[] = [];
  const gastosAutonomoDrillDown: DrillDownItem[] = [];

  for (const a of baseData.autonomosData) {
    let ingresosEsteMes = 0;
    let ingresosNoIrpfEsteMes = 0;

    if (a.fuentesIngreso.length > 0) {
      for (const f of a.fuentesIngreso) {
        const appliesToMonth = !f.meses || f.meses.length === 0 || f.meses.includes(month1to12);
        if (appliesToMonth) {
          ingresosEsteMes += f.importeEstimado;
          if (!f.aplIrpf) {
            ingresosNoIrpfEsteMes += f.importeEstimado;
          }
        }
      }
    } else {
      // Old-model fallback: flat monthly average; assume no IRPF retention
      ingresosEsteMes = a.ingresosAnualesFallback / 12;
      ingresosNoIrpfEsteMes = ingresosEsteMes;
    }

    serviciosFreelance += ingresosEsteMes;
    serviciosFreelanceNoIrpf += ingresosNoIrpfEsteMes;
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
  const dividendosInversiones = baseData.pagosRendimiento
    .filter(p => p.fecha_pago.startsWith(monthStr))
    .reduce((sum, p) => sum + p.importe_neto, 0);

  // E. Otros ingresos: exact monthly amount based on frequency — respect actual months, not flat division
  const otrosIngresosMensual = baseData.otrosIngresosItems.reduce((sum, otro) => {
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

  // E. Personal expenses: use forecastEngine for frequency-aware GastoRecurrente calculation — flat
  const gastosPersonales =
    calculateGastosPersonalesForMonth(baseData.gastosRecurrentes, month1to12) +
    calculatePersonalExpensesForMonth(baseData.personalExpenses, month1to12);

  // IRPF devengado: only on income NOT withheld at source.
  // Exclude nomina (withheld by employer). Include rentasAlquiler.
  // For serviciosFreelance, only include income where aplIrpf is false.
  const baseIrpf = serviciosFreelanceNoIrpf + rentasAlquiler + otrosIngresosMensual;
  // IRPF devengado for informational purposes only.
  // IRPF payment is forced to 0 until the dedicated tax module is implemented.
  const irpfDevengado = calculateMonthlyIRPF(baseIrpf);
  const irpfAPagar = 0; // TODO: remove when tax module is ready

  const totalGastos =
    gastosOperativos +
    gastosPersonales +
    gastosAutonomo +
    irpfAPagar;

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
  const flujoCajaMes = totalIngresos - totalGastos - totalFinanciacion;
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
  const otrasInversiones = sumAssetValuesForMonth(
    baseData.valoracionIndex,
    'inversion',
    baseData.inversionInitialValues,
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
      irpfDevengado,
      irpfAPagar,
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

  // Personal data
  const personalData = await personalDataService.getPersonalData();
  const personalDataId = personalData?.id ?? 1;

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

    // Load all OpexRules for use by forecastEngine functions
    opexRules = await db.getAll('opexRules');
  } catch {
    // No property/contract data available
  }

  // Investment values
  let valorPlanesPension = 0;
  const inversionInitialValues: AssetInitialValue[] = [];
  const pagosRendimiento: PagoRendimiento[] = [];
  try {
    const inversiones = await inversionesService.getPosiciones();
    for (const inv of inversiones) {
      if (inv.tipo === 'plan_pensiones' || inv.tipo === 'plan_empleo') {
        valorPlanesPension += inv.valor_actual;
      } else {
        // Non-pension investments use historical valuations; valor_actual is the fallback
        inversionInitialValues.push({ id: inv.id, initialValue: inv.valor_actual });
      }
      // Collect periodic return payments (cuenta_remunerada, prestamo_p2p, deposito_plazo)
      if (['cuenta_remunerada', 'prestamo_p2p', 'deposito_plazo'].includes(inv.tipo)) {
        const extInv = inv as unknown as InversionRendimientoPeriodico;
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

  // Cash balance from bank accounts
  let cajaInicial = 0;
  try {
    const accounts = await db.getAll('accounts');
    cajaInicial = accounts
      .filter(
        (a: { status: string; activa: boolean; balance?: number }) =>
          a.status === 'ACTIVE' || a.activa,
      )
      .reduce(
        (sum: number, a: { balance?: number }) => sum + (a.balance ?? 0),
        0,
      );
  } catch {
    // No account data available
  }

  // ── E. GASTOS PERSONALES ─────────────────────────────────────────────────
  // Load via gastosPersonalesService (used by forecastEngine functions)
  let gastosRecurrentes: GastoRecurrente[] = [];
  try {
    gastosRecurrentes = await gastosPersonalesService.getGastosRecurrentesActivos(personalDataId);
  } catch {
    // No personal gastos data available
  }

  // Load OPEX-style PersonalExpense records (new model with advanced frequency fields)
  let personalExpenses: PersonalExpense[] = [];
  try {
    const allPersonalExpenses = await personalExpensesService.getExpenses(personalDataId);
    personalExpenses = allPersonalExpenses.filter(e => e.activo);
  } catch {
    // No PersonalExpense data available
  }

  return {
    nominaNetaMensual,
    rentaMensualPorMes,
    nominaDrillDown,
    rentaDrillDown,
    autonomosData,
    pensionDrillDown,
    opexRules,
    propertyAliasMap,
    gastosRecurrentes,
    personalExpenses,
    valoracionIndex,
    inmuebleInitialValues,
    inversionInitialValues,
    pagosRendimiento,
    pensionNetaMensual,
    otrosIngresosItems,
    valorPlanesPension,
    cajaInicial,
  };
}

/**
 * Load loan data for amortization calculations
 */
async function loadDeudaState(): Promise<DeudaState> {
  const loans: LoanInfo[] = [];

  try {
    const prestamos = await prestamosService.getAllPrestamos();
    for (const p of prestamos) {
      const plan = await prestamosService.getPaymentPlan(p.id);
      loans.push({
        principalInicial: p.principalInicial,
        isHipoteca: p.inmuebleId !== 'standalone', // standalone = personal loan; otherwise mortgage
        concepto: p.nombre ?? 'Hipoteca/Préstamo',
        periodos: plan?.periodos ?? [],
      });
    }
  } catch {
    // No loan data available
  }

  return { loans };
}

/**
 * Generate 20-year monthly financial projection
 */
export async function generateProyeccionMensual(): Promise<ProyeccionAnual[]> {
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

  return proyecciones;
}
