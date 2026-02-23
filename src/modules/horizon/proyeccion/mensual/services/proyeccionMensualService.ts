// src/modules/horizon/proyeccion/mensual/services/proyeccionMensualService.ts
// ATLAS HORIZON: Monthly financial projection calculation engine

import { initDB, OpexRule, Contract } from '../../../../../services/db';
import { nominaService } from '../../../../../services/nominaService';
import { autonomoService } from '../../../../../services/autonomoService';
import { personalDataService } from '../../../../../services/personalDataService';
import { getAllContracts } from '../../../../../services/contractService';
import { inmuebleService } from '../../../../../services/inmuebleService';
import { prestamosService } from '../../../../../services/prestamosService';
import { inversionesService } from '../../../../../services/inversionesService';
import { gastosPersonalesService } from '../../../../../services/gastosPersonalesService';
import { GastoRecurrente } from '../../../../../types/personal';
import { MonthlyProjectionRow, ProyeccionAnual, DrillDownItem } from '../types/proyeccionMensual';
import {
  calculateOpexForMonth,
  calculateOpexBreakdownForMonth,
  calculateGastosPersonalesForMonth,
} from './forecastEngine';

// Fixed growth assumptions for Phase 1
const FIXED_ASSUMPTIONS = {
  rentGrowth: 0.02,           // 2% IPC annual
  salaryGrowth: 0.02,         // 2% annual
  expenseInflation: 0.02,     // 2% annual
  propertyAppreciation: 0.02, // 2% annual
  vacancyRate: 0.0,           // 0% (100% occupancy)
  investmentReturn: 0.04,     // 4% annual (Phase 1: fixed estimate for non-pension investments)
  dividendYield: 0.02,        // 2% annual dividend yield on non-pension investments (Phase 1 estimate)
};

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

/**
 * IRPF is paid quarterly (months 3, 6, 9, 0 = April, July, October, January)
 */
function calculateIRPFPayment(monthIndex: number, annualDevengado: number): number {
  if ([3, 6, 9, 0].includes(monthIndex % 12)) {
    return annualDevengado / 4;
  }
  return 0;
}

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
function calculateLoanPayment(
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
  principalInicial: number;
  annualRate: number;
  plazoMesesTotal: number;
  isHipoteca: boolean; // true = mortgage, false = personal loan
  concepto: string;    // loan description for drilldown
}

interface DeudaState {
  loans: LoanInfo[];
}

interface BaseData {
  // Monthly arrays for base year (index 0 = January, 11 = December)
  nominaNetaMensual: number[];  // Exact net per month from calculateSalary()
  rentaMensualPorMes: number[]; // Rental income per month (contract date-filtered)

  // DrillDown arrays (12 entries, one per month)
  nominaDrillDown: DrillDownItem[][];
  rentaDrillDown: DrillDownItem[][];

  // Passed to forecastEngine functions
  /** All OpexRules across all properties */
  opexRules: OpexRule[];
  /** Maps property numeric ID → alias for drill-down labels */
  propertyAliasMap: Map<number, string>;
  /** Active personal recurring expenses */
  gastosRecurrentes: GastoRecurrente[];

  // Scalars
  freelanceMensual: number;
  gastosAutonomoMensual: number;
  seguridadSocialMensual: number;
  otrosIngresosMensual: number;
  valorInmuebles: number;
  valorPlanesPension: number;
  valorOtrasInversiones: number;
  cajaInicial: number;
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
  const yearsElapsed = absoluteMonthIndex / 12;
  const growthFactor = Math.pow(1 + FIXED_ASSUMPTIONS.salaryGrowth, yearsElapsed);
  const rentGrowthFactor = Math.pow(1 + FIXED_ASSUMPTIONS.rentGrowth, yearsElapsed);
  const expenseGrowthFactor = Math.pow(1 + FIXED_ASSUMPTIONS.expenseInflation, yearsElapsed);

  // Format month string "YYYY-MM"
  const monthStr = `${year}-${String(month1to12).padStart(2, '0')}`;

  // ── INGRESOS ──────────────────────────────────────────────────────────────
  // A. Nóminas: use actual monthly distribution from calculateSalary(), scaled by growth
  const nomina = baseData.nominaNetaMensual[monthOfYear] * growthFactor;

  const serviciosFreelance = baseData.freelanceMensual * growthFactor;

  // B. Rentas: flat within each year, grow only at year boundaries (no monthly IPC drip)
  const rentYearIndex = Math.floor(absoluteMonthIndex / 12);
  const rentGrowthFactorFlat = Math.pow(1 + FIXED_ASSUMPTIONS.rentGrowth, rentYearIndex);
  const rentasAlquiler = baseData.rentaMensualPorMes[monthOfYear] * rentGrowthFactorFlat;

  // Dividends grow with investment portfolio value appreciation
  const investmentGrowthFactor = Math.pow(
    1 + FIXED_ASSUMPTIONS.investmentReturn,
    yearsElapsed,
  );
  const dividendosInversiones =
    (baseData.valorOtrasInversiones * investmentGrowthFactor *
      FIXED_ASSUMPTIONS.dividendYield) /
    12;
  const otrosIngresosMensual = baseData.otrosIngresosMensual * growthFactor;
  const totalIngresos =
    nomina +
    serviciosFreelance +
    rentasAlquiler +
    dividendosInversiones +
    otrosIngresosMensual;

  // ── GASTOS ────────────────────────────────────────────────────────────────
  // C. OPEX: use forecastEngine for frequency-aware OpexRule calculation
  const baseGastosOperativos = calculateOpexForMonth(baseData.opexRules, month1to12);
  const gastosOperativos = baseGastosOperativos * expenseGrowthFactor;

  // Per-property/concept breakdown scaled by the same growth factor
  const opexDesglose = calculateOpexBreakdownForMonth(
    baseData.opexRules,
    month1to12,
    baseData.propertyAliasMap,
  ).map(item => ({ ...item, importe: item.importe * expenseGrowthFactor }));

  // E. Personal expenses: use forecastEngine for frequency-aware GastoRecurrente calculation
  const baseGastosPersonales = calculateGastosPersonalesForMonth(
    baseData.gastosRecurrentes,
    month1to12,
  );
  const gastosPersonales = baseGastosPersonales * expenseGrowthFactor;

  const gastosAutonomo =
    baseData.gastosAutonomoMensual *
    expenseGrowthFactor;

  const baseIrpf =
    nomina + serviciosFreelance + rentasAlquiler + otrosIngresosMensual;
  // IRPF devengado for informational purposes only.
  // IRPF payment is forced to 0 until the dedicated tax module is implemented.
  const irpfDevengado = calculateMonthlyIRPF(baseIrpf);
  const irpfAPagar = 0; // TODO: remove when tax module is ready

  const seguridadSocial = baseData.seguridadSocialMensual * growthFactor;

  const totalGastos =
    gastosOperativos +
    gastosPersonales +
    gastosAutonomo +
    irpfAPagar +
    seguridadSocial;

  // ── FINANCIACIÓN ──────────────────────────────────────────────────────────
  let cuotasHipotecas = 0;
  let cuotasPrestamos = 0;
  let amortizacionCapital = 0;
  const prestamosDrillDown: DrillDownItem[] = [];

  for (const loan of deudaState.loans) {
    const { cuota, amortizacion } = calculateLoanPayment(
      loan.principalInicial,
      loan.annualRate,
      loan.plazoMesesTotal,
      absoluteMonthIndex,
    );
    if (cuota > 0) {
      prestamosDrillDown.push({ concepto: loan.concepto, importe: cuota });
    }
    if (loan.isHipoteca) {
      cuotasHipotecas += cuota;
    } else {
      cuotasPrestamos += cuota;
    }
    amortizacionCapital += amortizacion;
  }

  const totalFinanciacion = cuotasHipotecas + cuotasPrestamos;

  // ── TESORERÍA ─────────────────────────────────────────────────────────────
  const flujoCajaMes = totalIngresos - totalGastos - totalFinanciacion;
  const cajaFinal = cajaAnterior + flujoCajaMes;

  // ── PATRIMONIO ────────────────────────────────────────────────────────────
  // Property values appreciate annually
  const inmuebles =
    baseData.valorInmuebles *
    Math.pow(1 + FIXED_ASSUMPTIONS.propertyAppreciation, yearsElapsed);

  // Remaining debt = initial debt minus cumulative amortization
  let deudaInmuebles = 0;
  let deudaPersonal = 0;
  for (const loan of deudaState.loans) {
    const outstanding = calculateOutstandingPrincipal(
      loan.principalInicial,
      loan.annualRate,
      loan.plazoMesesTotal,
      absoluteMonthIndex,
    );
    if (loan.isHipoteca) {
      deudaInmuebles += outstanding;
    } else {
      deudaPersonal += outstanding;
    }
  }
  const deudaTotal = deudaInmuebles + deudaPersonal;

  const planesPension =
    baseData.valorPlanesPension * investmentGrowthFactor;
  const otrasInversiones =
    baseData.valorOtrasInversiones * investmentGrowthFactor;

  const activos = cajaFinal + inmuebles + planesPension + otrasInversiones;
  const patrimonioNeto = activos - deudaTotal;

  // DrillDown: scale base-year arrays by growth factors for display
  const scaledNominaDrillDown = baseData.nominaDrillDown[monthOfYear].map(item => ({
    ...item,
    importe: item.importe * growthFactor,
  }));
  const scaledRentaDrillDown = baseData.rentaDrillDown[monthOfYear].map(item => ({
    ...item,
    importe: item.importe * rentGrowthFactor,
  }));

  return {
    month: monthStr,
    ingresos: {
      nomina,
      serviciosFreelance,
      rentasAlquiler,
      dividendosInversiones,
      otrosIngresos: otrosIngresosMensual,
      total: totalIngresos,
      drillDown: {
        nomina: scaledNominaDrillDown,
        rentasAlquiler: scaledRentaDrillDown,
      },
    },
    gastos: {
      gastosOperativos,
      opexDesglose,
      gastosPersonales,
      gastosAutonomo,
      irpfDevengado,
      irpfAPagar,
      seguridadSocial,
      total: totalGastos,
      drillDown: {
        gastosOperativos: opexDesglose.map(item => ({
          concepto: item.concepto,
          importe: item.importe,
          fuente: item.propertyAlias,
        })),
      },
    },
    financiacion: {
      cuotasHipotecas,
      cuotasPrestamos,
      amortizacionCapital,
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
  let seguridadSocialMensual = 0;

  try {
    const nominas = await nominaService.getNominas(personalDataId);
    const nominasActivas = nominas.filter(n => n.activa);
    for (const nomina of nominasActivas) {
      const calculo = nominaService.calculateSalary(nomina);

      for (const mesData of calculo.distribuccionMensual) {
        const idx = mesData.mes - 1; // 0-indexed
        nominaNetaMensual[idx] += mesData.netoTotal;
        nominaDrillDown[idx].push({
          concepto: nomina.nombre ?? 'Nómina',
          importe: mesData.netoTotal,
          fuente: nomina.nombre,
        });
      }
    }
    // SS contribution: monthly average = annual bruto * SS% / 12
    seguridadSocialMensual = nominasActivas.reduce((sum, n) => {
      const ss = n.retencion?.cotizacionSS ?? 6.35;
      return sum + (n.salarioBrutoAnual / 12) * (ss / 100);
    }, 0);
  } catch {
    // No nomina data available
  }

  // ── Autónomo ──────────────────────────────────────────────────────────────
  let freelanceMensual = 0;
  let gastosAutonomoMensual = 0;
  try {
    const autonomos = await autonomoService.getAutonomos(personalDataId);
    const autonomoActivo = autonomos.find(a => a.activo);
    if (autonomoActivo) {
      const ingresosAnuales = autonomoActivo.ingresosFacturados.reduce(
        (sum, i) => sum + i.importe,
        0,
      );
      freelanceMensual = ingresosAnuales / 12;
      const gastosAnuales = autonomoActivo.gastosDeducibles.reduce(
        (sum, g) => sum + g.importe,
        0,
      );
      gastosAutonomoMensual = gastosAnuales / 12;
      seguridadSocialMensual += autonomoActivo.cuotaAutonomos;
    }
  } catch {
    // No autonomo data available
  }

  // ── B. INMUEBLES - INGRESOS (RENTAS) ──────────────────────────────────────
  // Filter by contract active date range for each month of the projection year
  const rentaMensualPorMes: number[] = new Array(12).fill(0);
  const rentaDrillDown: DrillDownItem[][] = Array.from({ length: 12 }, () => []);

  // ── C. INMUEBLES - OPEX + property values ─────────────────────────────────
  let valorInmuebles = 0;
  let opexRules: OpexRule[] = [];
  const propertyAliasMap = new Map<number, string>();

  try {
    const [contracts, inmuebles] = await Promise.all([
      getAllContracts(),
      inmuebleService.getAll(),
    ]);

    // Build a property alias lookup and total value from all active properties
    for (const inm of inmuebles) {
      if (inm.id) {
        const numId = parseInt(inm.id, 10);
        if (!isNaN(numId)) propertyAliasMap.set(numId, inm.alias);
      }
    }
    const activeProperties = inmuebles.filter(p => p.estado === 'ACTIVO');
    valorInmuebles = activeProperties.reduce(
      (sum, p) => sum + (p.compra?.precio_compra ?? 0),
      0,
    );

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
  let valorOtrasInversiones = 0;
  try {
    const inversiones = await inversionesService.getPosiciones();
    for (const inv of inversiones) {
      if (inv.tipo === 'plan_pensiones' || inv.tipo === 'plan_empleo') {
        valorPlanesPension += inv.valor_actual;
      } else {
        valorOtrasInversiones += inv.valor_actual;
      }
    }
  } catch {
    // No investment data available
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

  return {
    nominaNetaMensual,
    rentaMensualPorMes,
    nominaDrillDown,
    rentaDrillDown,
    opexRules,
    propertyAliasMap,
    gastosRecurrentes,
    freelanceMensual,
    gastosAutonomoMensual,
    seguridadSocialMensual,
    otrosIngresosMensual: 0,
    valorInmuebles,
    valorPlanesPension,
    valorOtrasInversiones,
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
      // Rates stored as percentage (e.g. 3.2 = 3.2%); divide by 100 for decimal usage
      const annualRatePct =
        p.tipo === 'FIJO'
          ? (p.tipoNominalAnualFijo ?? 0)
          : p.tipo === 'VARIABLE'
            ? (p.valorIndiceActual ?? 0) + (p.diferencial ?? 0)
            : (p.tipoNominalAnualMixtoFijo ?? p.tipoNominalAnualFijo ?? 0);

      loans.push({
        principalInicial: p.principalInicial,
        annualRate: annualRatePct / 100,
        plazoMesesTotal: p.plazoMesesTotal,
        isHipoteca: true, // Prestamo from inmuebles is always a mortgage
        concepto: p.nombre ?? 'Hipoteca/Préstamo',
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
