// src/modules/horizon/proyeccion/mensual/services/proyeccionMensualService.ts
// ATLAS HORIZON: Monthly financial projection calculation engine

import { initDB } from '../../../../../services/db';
import { nominaService } from '../../../../../services/nominaService';
import { autonomoService } from '../../../../../services/autonomoService';
import { personalDataService } from '../../../../../services/personalDataService';
import { getAllContracts } from '../../../../../services/contractService';
import { inmuebleService } from '../../../../../services/inmuebleService';
import { prestamosService } from '../../../../../services/prestamosService';
import { inversionesService } from '../../../../../services/inversionesService';
import { MonthlyProjectionRow, ProyeccionAnual } from '../types/proyeccionMensual';

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
  const yearsElapsed = absoluteMonthIndex / 12;
  const growthFactor = Math.pow(1 + FIXED_ASSUMPTIONS.salaryGrowth, yearsElapsed);

  // Format month string "YYYY-MM"
  const monthStr = `${year}-${String(monthOfYear + 1).padStart(2, '0')}`;

  // ── INGRESOS ──────────────────────────────────────────────────────────────
  const nomina = baseData.nominaNeta * growthFactor;
  const serviciosFreelance = baseData.freelanceMensual * growthFactor;
  const rentasAlquiler =
    baseData.rentaMensual *
    Math.pow(1 + FIXED_ASSUMPTIONS.rentGrowth, yearsElapsed);
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
  const gastosOperativos =
    baseData.gastosOperativosMensual *
    Math.pow(1 + FIXED_ASSUMPTIONS.expenseInflation, yearsElapsed);
  const gastosPersonales =
    baseData.gastosPersonalesMensual *
    Math.pow(1 + FIXED_ASSUMPTIONS.expenseInflation, yearsElapsed);
  const gastosAutonomo =
    baseData.gastosAutonomoMensual *
    Math.pow(1 + FIXED_ASSUMPTIONS.expenseInflation, yearsElapsed);

  const baseIrpf =
    nomina + serviciosFreelance + rentasAlquiler + otrosIngresosMensual;
  const irpfDevengado = calculateMonthlyIRPF(baseIrpf);

  // Accumulate annual IRPF devengado to spread into quarterly payments
  // (simplified: use monthly devengado * 3 as quarterly installment)
  const irpfAPagar = calculateIRPFPayment(monthOfYear, irpfDevengado * 12);

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

  for (const loan of deudaState.loans) {
    const { cuota, amortizacion } = calculateLoanPayment(
      loan.principalInicial,
      loan.annualRate,
      loan.plazoMesesTotal,
      absoluteMonthIndex,
    );
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

  return {
    month: monthStr,
    ingresos: {
      nomina,
      serviciosFreelance,
      rentasAlquiler,
      dividendosInversiones,
      otrosIngresos: otrosIngresosMensual,
      total: totalIngresos,
    },
    gastos: {
      gastosOperativos,
      gastosPersonales,
      gastosAutonomo,
      irpfDevengado,
      irpfAPagar,
      seguridadSocial,
      total: totalGastos,
    },
    financiacion: {
      cuotasHipotecas,
      cuotasPrestamos,
      amortizacionCapital,
      total: totalFinanciacion,
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

interface LoanInfo {
  principalInicial: number;
  annualRate: number;
  plazoMesesTotal: number;
  isHipoteca: boolean; // true = mortgage, false = personal loan
}

interface DeudaState {
  loans: LoanInfo[];
}

interface BaseData {
  nominaNeta: number;
  freelanceMensual: number;
  rentaMensual: number;
  otrosIngresosMensual: number;
  gastosOperativosMensual: number;
  gastosPersonalesMensual: number;
  gastosAutonomoMensual: number;
  seguridadSocialMensual: number;
  valorInmuebles: number;
  valorPlanesPension: number;
  valorOtrasInversiones: number;
  cajaInicial: number;
}

/**
 * Load and aggregate all base financial data from the database
 */
async function loadBaseData(): Promise<BaseData> {
  const db = await initDB();

  // Personal data
  const personalData = await personalDataService.getPersonalData();
  const personalDataId = personalData?.id ?? 1;

  // Nómina
  let nominaNeta = 0;
  let seguridadSocialMensual = 0;
  try {
    const nominas = await nominaService.getNominas(personalDataId);
    const nominaActiva = nominas.find(n => n.activa);
    if (nominaActiva) {
      const brutoMensual =
        nominaActiva.salarioBrutoAnual / nominaActiva.distribucion.meses;
      const retencionIRPF =
        brutoMensual * (nominaActiva.retencion.irpfPorcentaje / 100);
      const retencionSS =
        brutoMensual * (nominaActiva.retencion.cotizacionSS / 100);
      nominaNeta = brutoMensual - retencionIRPF - retencionSS;
      seguridadSocialMensual = retencionSS;
    }
  } catch {
    // No nomina data available
  }

  // Autónomo
  let freelanceMensual = 0;
  let gastosAutonomoMensual = 0;
  let cuotaAutonomosMensual = 0;
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
      cuotaAutonomosMensual = autonomoActivo.cuotaAutonomos;
      seguridadSocialMensual += cuotaAutonomosMensual;
    }
  } catch {
    // No autonomo data available
  }

  // Rental income from active contracts
  let rentaMensual = 0;
  try {
    const contracts = await getAllContracts();
    rentaMensual = contracts
      .filter(c => c.estadoContrato === 'activo')
      .reduce((sum, c) => sum + (c.rentaMensual || 0), 0);
  } catch {
    // No contracts data available
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

  // Property values
  let valorInmuebles = 0;
  let gastosOperativosMensual = 0;
  try {
    const inmuebles = await inmuebleService.getAll();
    const active = inmuebles.filter(p => p.estado === 'ACTIVO');
    valorInmuebles = active.reduce(
      (sum, p) => sum + (p.compra?.precio_compra ?? 0),
      0,
    );
    // Estimate operating expenses: IBI ~0.5% annually + ~0.5% for insurance/community
    gastosOperativosMensual = (valorInmuebles * 0.01) / 12;
  } catch {
    // No property data available
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

  // Personal recurring expenses
  let gastosPersonalesMensual = 0;
  try {
    const allGastos = await db.getAll('gastos');
    gastosPersonalesMensual = allGastos
      .filter(
        (g: { destino?: string; importe?: number }) =>
          g.destino === 'personal',
      )
      .reduce(
        (sum: number, g: { importe?: number }) => sum + (g.importe ?? 0),
        0,
      );
  } catch {
    // Gastos data not available, use 0
  }

  return {
    nominaNeta,
    freelanceMensual,
    rentaMensual,
    otrosIngresosMensual: 0,
    gastosOperativosMensual,
    gastosPersonalesMensual,
    gastosAutonomoMensual,
    seguridadSocialMensual,
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
      const annualRate =
        p.tipo === 'FIJO'
          ? (p.tipoNominalAnualFijo ?? 0)
          : p.tipo === 'VARIABLE'
            ? (p.valorIndiceActual ?? 0) + (p.diferencial ?? 0)
            : (p.tipoNominalAnualMixtoFijo ?? p.tipoNominalAnualFijo ?? 0);

      loans.push({
        principalInicial: p.principalInicial,
        annualRate,
        plazoMesesTotal: p.plazoMesesTotal,
        isHipoteca: true, // Prestamo from inmuebles is always a mortgage
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
