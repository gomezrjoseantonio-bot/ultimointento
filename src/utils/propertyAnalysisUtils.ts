// Utility functions for Property Analysis calculations

import {
  OperationalPerformance,
  FinancialProfitability,
  FiscalROI,
  SaleSimulation,
  RecommendationStatus,
  AnalysisConfig,
  DEFAULT_ANALYSIS_CONFIG,
} from '../types/propertyAnalysis';
import type { Contract, Ingreso, Property } from '../services/db';
import type { Prestamo } from '../types/prestamos';
import type { ValoracionHistorica } from '../types/valoraciones';

export interface PropertyAnalysisInputs {
  ingresosMensuales: number;
  gastosOperativos: number;
  cuotaHipoteca: number;
  valorActualActivo: number;
  deudaPendiente: number;
  precioTotalCompra: number;
  noi: number;
  amortizacionAnual: number;
  revalorizacionAnual: number;
  precioVenta: number;
  comisionVenta: number;
  comisionCancelacion: number;
  itpOIva: number;
  reformaTotal: number;
  gastosCompra: number;
  interesesFuturosEvitados: number;
}

export interface PropertyAnalysisInputBuildResult {
  inputs: PropertyAnalysisInputs;
  missingFields: string[];
  warnings: string[];
}

interface BuildParams {
  property: Property;
  contracts: Contract[];
  ingresos: Ingreso[];
  gastosOperativosOverride?: number;
  prestamos: Prestamo[];
  valoraciones: ValoracionHistorica[];
}

interface LoanAllocation {
  loan: Prestamo;
  allocationFactor: number; // 0..1
}

/**
 * Calculate operational performance metrics
 */
export function calculateOperationalPerformance(
  ingresosMensuales: number,
  gastosOperativos: number,
  cuotaHipoteca: number
): OperationalPerformance {
  const cashflowNetoMensual = ingresosMensuales - gastosOperativos - cuotaHipoteca;
  const cashflowAnual = cashflowNetoMensual * 12;

  return {
    ingresosMensuales,
    gastosOperativos,
    cuotaHipoteca,
    cashflowNetoMensual,
    cashflowAnual,
  };
}

/**
 * Calculate financial profitability metrics
 */
export function calculateFinancialProfitability(
  valorActualActivo: number,
  deudaPendiente: number,
  precioTotalCompra: number,
  ingresosAnuales: number,
  noi: number, // Net Operating Income
  cashflowAnual: number,
  amortizacionAnual: number,
  revalorizacionAnual: number
): FinancialProfitability {
  const equityActual = valorActualActivo - deudaPendiente;
  const rentabilidadBruta = precioTotalCompra > 0 
    ? (ingresosAnuales / precioTotalCompra) * 100 
    : 0;
  const rentabilidadNeta = precioTotalCompra > 0 
    ? (noi / precioTotalCompra) * 100 
    : 0;
  const roiEquityReal = equityActual > 0 
    ? (cashflowAnual / equityActual) * 100 
    : 0;
  const roiTotal = equityActual > 0 
    ? ((cashflowAnual + amortizacionAnual + revalorizacionAnual) / equityActual) * 100 
    : 0;

  return {
    valorActualActivo,
    deudaPendiente,
    equityActual,
    rentabilidadBruta,
    rentabilidadNeta,
    roiEquityReal,
    roiTotal,
  };
}

/**
 * Calculate fiscal ROI metrics
 */
export function calculateFiscalROI(
  cashflowAnual: number,
  equityActual: number,
  config: AnalysisConfig = DEFAULT_ANALYSIS_CONFIG
): FiscalROI {
  const impuestoRentas = cashflowAnual * config.tipoMarginalIRPF;
  const cashflowNetoTrasImpuestos = cashflowAnual - impuestoRentas;
  const roiFiscalNeto = equityActual > 0 
    ? (cashflowNetoTrasImpuestos / equityActual) * 100 
    : 0;
  const roiAlternativo = config.roiAlternativo * 100;
  const roiDiferencial = roiFiscalNeto - roiAlternativo;

  // Determine automatic recommendation
  let conclusion: RecommendationStatus;
  if (roiFiscalNeto >= roiAlternativo) {
    conclusion = 'MANTENER';
  } else if (Math.abs(roiDiferencial) <= 1) {
    conclusion = 'REVISAR';
  } else {
    conclusion = 'VENDER';
  }

  return {
    impuestoRentas,
    cashflowNetoTrasImpuestos,
    roiFiscalNeto,
    roiAlternativo,
    roiDiferencial,
    conclusion,
  };
}

/**
 * Calculate sale simulation metrics
 */
export function calculateSaleSimulation(
  precioVenta: number,
  comisionVenta: number,
  deudaPendiente: number,
  comisionCancelacion: number,
  precioCompra: number,
  itpOIva: number,
  reformaTotal: number,
  gastosCompra: number,
  config: AnalysisConfig = DEFAULT_ANALYSIS_CONFIG
): SaleSimulation {
  const impuestos3Pct = precioVenta * config.impuestosVenta;
  const capitalLiberable = precioVenta - comisionVenta - impuestos3Pct - deudaPendiente - comisionCancelacion;
  const plusvaliaEstimada = precioVenta - (precioCompra + itpOIva + reformaTotal + gastosCompra);
  const irpf26Pct = plusvaliaEstimada > 0 ? plusvaliaEstimada * config.irpfPlusvalia : 0;
  const capitalNetoFinal = capitalLiberable - irpf26Pct;

  // Simplified future interest calculation (would need actual mortgage data)
  // For now, we'll use a rough estimate
  const interesesFuturosEvitados = 0; // Will be calculated based on actual mortgage data

  return {
    precioVenta,
    comisionVenta,
    impuestos3Pct,
    deudaPendiente,
    comisionCancelacion,
    capitalLiberable,
    plusvaliaEstimada,
    irpf26Pct,
    capitalNetoFinal,
    interesesFuturosEvitados,
  };
}

export function buildPropertyAnalysisInputs({
  property,
  contracts,
  ingresos,
  gastosOperativosOverride,
  prestamos,
  valoraciones,
}: BuildParams): PropertyAnalysisInputBuildResult {
  const missingFields: string[] = [];
  const warnings: string[] = [];
  const propertyId = property.id;
  const safePropertyId = propertyId ?? -1;

  const activeContracts = contracts.filter(
    (contract) => contract.inmuebleId === safePropertyId && contract.estadoContrato === 'activo'
  );

  const ingresosFromContracts = activeContracts.reduce((sum, contract) => sum + (contract.rentaMensual || 0), 0);
  const propertyIngresos = ingresos.filter(
    (ingreso) => ingreso.destino === 'inmueble_id' && ingreso.destino_id === safePropertyId
  );
  const ingresosMensualesByRecords = getMonthlyAverage(propertyIngresos, 'fecha_prevista_cobro', 'importe');
  const ingresosMensuales = ingresosFromContracts > 0 ? ingresosFromContracts : ingresosMensualesByRecords;

  if (ingresosMensuales <= 0) {
    missingFields.push('ingresos mensuales');
  }

  const gastosOperativos = gastosOperativosOverride ?? 0;
  if (gastosOperativos <= 0) {
    missingFields.push('gastos operativos');
  }

  const propertyLoanAllocations = prestamos.reduce<LoanAllocation[]>((acc, prestamo) => {
    if (prestamo.ambito !== 'INMUEBLE' || !prestamo.activo) {
      return acc;
    }

    if (prestamo.finalidad === 'PERSONAL') {
      return acc;
    }

    const allocations = prestamo.afectacionesInmueble || [];
    if (allocations.length > 0) {
      const directAllocation = allocations.find((allocation) => {
        const linkedId = String(allocation.inmuebleId || '').trim();
        if (!linkedId) {
          return false;
        }

        const numericLinkedId = Number(linkedId);
        if (!Number.isNaN(numericLinkedId) && numericLinkedId === safePropertyId) {
          return true;
        }

        return property.globalAlias !== undefined && linkedId === property.globalAlias;
      });

      if (!directAllocation) {
        return acc;
      }

      const rawFactor = (directAllocation.porcentaje || 0) / 100;
      const allocationFactor = Math.max(0, Math.min(1, rawFactor));
      if (allocationFactor <= 0) {
        return acc;
      }

      acc.push({ loan: prestamo, allocationFactor });
      return acc;
    }

    const linkedId = String((prestamo as Prestamo & { propertyId?: string | number }).inmuebleId ?? (prestamo as Prestamo & { propertyId?: string | number }).propertyId ?? '').trim();
    if (!linkedId) {
      return acc;
    }

    const numericLinkedId = Number(linkedId);
    if (!Number.isNaN(numericLinkedId) && numericLinkedId === safePropertyId) {
      acc.push({ loan: prestamo, allocationFactor: 1 });
      return acc;
    }

    if (property.globalAlias !== undefined && linkedId === property.globalAlias) {
      acc.push({ loan: prestamo, allocationFactor: 1 });
    }

    return acc;
  }, []);

  const propertyPrestamos = propertyLoanAllocations.map((entry) => entry.loan);

  const deudaPendiente = propertyLoanAllocations.reduce(
    (sum, entry) => sum + (entry.loan.principalVivo || 0) * entry.allocationFactor,
    0
  );

  const prestamosConSaldoInvalido = propertyPrestamos.filter(
    (prestamo) => prestamo.principalVivo === null || prestamo.principalVivo === undefined || Number.isNaN(Number(prestamo.principalVivo))
  );
  if (prestamosConSaldoInvalido.length > 0) {
    warnings.push('No se ha podido obtener el saldo pendiente de una o más hipotecas.');
  }

  const prestamosConCuotaIncalculable = propertyPrestamos.filter(
    (prestamo) => !prestamo.fechaFirma || !prestamo.plazoMesesTotal || prestamo.plazoMesesTotal <= 0
  );
  if (prestamosConCuotaIncalculable.length > 0) {
    warnings.push('No se ha podido calcular la cuota mensual de una o más hipotecas por datos incompletos.');
  }

  const cuotaHipoteca = propertyLoanAllocations.reduce((sum, entry) => {
    const prestamo = entry.loan;
    if (!prestamo.fechaFirma || !prestamo.plazoMesesTotal || prestamo.plazoMesesTotal <= 0) {
      return sum;
    }
    const monthsElapsed = getMonthsDifference(prestamo.fechaFirma, new Date());
    const monthsRemaining = Math.max(1, prestamo.plazoMesesTotal - monthsElapsed);
    const annualRate = getAnnualRate(prestamo);
    const cuotaCompleta = calculateFrenchPayment(prestamo.principalVivo || 0, annualRate, monthsRemaining);
    return sum + cuotaCompleta * entry.allocationFactor;
  }, 0);

  const comisionCancelacion = propertyLoanAllocations.reduce((sum, entry) => {
    const commissionRate = entry.loan.comisionCancelacionTotal || 0;
    return sum + (entry.loan.principalVivo || 0) * commissionRate * entry.allocationFactor;
  }, 0);

  const interesesFuturosEvitados = propertyLoanAllocations.reduce((sum, entry) => {
    const prestamo = entry.loan;
    const annualRate = getAnnualRate(prestamo) / 100;
    const monthsElapsed = getMonthsDifference(prestamo.fechaFirma, new Date());
    const monthsRemaining = Math.max(1, (prestamo.plazoMesesTotal || 0) - monthsElapsed);
    return sum + calculateFutureInterestAvoided(prestamo.principalVivo || 0, annualRate, monthsRemaining) * entry.allocationFactor;
  }, 0);

  const propertyValoraciones = valoraciones
    .filter((valoracion) => valoracion.tipo_activo === 'inmueble' && valoracion.activo_id === safePropertyId)
    .sort((a, b) => b.fecha_valoracion.localeCompare(a.fecha_valoracion));
  const valorActualActivo = propertyValoraciones[0]?.valor || 0;
  if (valorActualActivo <= 0) {
    missingFields.push('valoración actual del activo');
  }

  const previousValuation = propertyValoraciones[1]?.valor;
  const revalorizacionAnual = previousValuation ? valorActualActivo - previousValuation : 0;

  const acquisitionCosts = property.acquisitionCosts;
  const itpOIva = acquisitionCosts.itp || acquisitionCosts.iva || 0;
  const gastosCompraFijos =
    (acquisitionCosts.notary || 0) +
    (acquisitionCosts.registry || 0) +
    (acquisitionCosts.management || 0) +
    (acquisitionCosts.psi || 0) +
    (acquisitionCosts.realEstate || 0);
  const gastosCompraOtros = (acquisitionCosts.other || []).reduce((sum, item) => sum + (item.amount || 0), 0);
  const gastosCompra = gastosCompraFijos + gastosCompraOtros;
  const precioTotalCompra = (acquisitionCosts.price || 0) + itpOIva + gastosCompra;

  if (precioTotalCompra <= 0) {
    missingFields.push('precio total de compra');
  }

  const ingresosAnuales = ingresosMensuales * 12;
  const gastosAnuales = gastosOperativos * 12;
  const noi = ingresosAnuales - gastosAnuales;

  const annualInterest = propertyPrestamos.reduce((sum, prestamo) => {
    const annualRate = getAnnualRate(prestamo) / 100;
    return sum + (prestamo.principalVivo || 0) * annualRate;
  }, 0);
  const amortizacionAnual = Math.max(0, cuotaHipoteca * 12 - annualInterest);

  return {
    inputs: {
      ingresosMensuales,
      gastosOperativos,
      cuotaHipoteca,
      valorActualActivo,
      deudaPendiente,
      precioTotalCompra,
      noi,
      amortizacionAnual,
      revalorizacionAnual,
      precioVenta: valorActualActivo,
      comisionVenta: 0,
      comisionCancelacion,
      itpOIva,
      reformaTotal: 0,
      gastosCompra,
      interesesFuturosEvitados,
    },
    missingFields,
    warnings,
  };
}

/**
 * Get recommendation text based on fiscal ROI
 */
export function getRecommendationText(
  conclusion: RecommendationStatus,
  roiFiscalNeto: number,
  roiAlternativo: number,
  capitalNetoFinal?: number
): string {
  switch (conclusion) {
    case 'MANTENER':
      return `Tu ROI fiscal neto (${formatPercentagePoint(roiFiscalNeto)}) supera el coste de oportunidad (${formatPercentagePoint(roiAlternativo)}). Este activo trabaja bien.`;
    case 'REVISAR':
      return `Tu ROI fiscal neto (${formatPercentagePoint(roiFiscalNeto)}) está en el umbral de rentabilidad esperada. Valora mejoras o refinanciación.`;
    case 'VENDER':
      const capitalText = capitalNetoFinal 
        ? ` Liberar ${formatEuro(capitalNetoFinal)} puede mejorar tu posición.`
        : '';
      return `Tu ROI fiscal neto (${formatPercentagePoint(roiFiscalNeto)}) está por debajo del coste de oportunidad (${formatPercentagePoint(roiAlternativo)}).${capitalText}`;
    default:
      return '';
  }
}

/**
 * Get traffic light color based on recommendation
 */
export function getTrafficLightColor(conclusion: RecommendationStatus): string {
  switch (conclusion) {
    case 'MANTENER':
      return 'var(--ok)'; // Green - Success
    case 'REVISAR':
      return 'var(--text-gray)'; // Gray - Neutral
    case 'VENDER':
      return 'var(--error)'; // Red - Error
    default:
      return 'var(--text-gray)';
  }
}

/**
 * Get traffic light emoji based on recommendation
 */
export function getTrafficLightEmoji(conclusion: RecommendationStatus): string {
  switch (conclusion) {
    case 'MANTENER':
      return '🟢';
    case 'REVISAR':
      return '⚪';
    case 'VENDER':
      return '🔴';
    default:
      return '⚪';
  }
}

/**
 * Format currency as Euro
 */
function formatEuro(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercentagePoint(value: number): string {
  return `${new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

/**
 * Calculate future interest avoided (simplified)
 * In a real scenario, this would need actual mortgage amortization table
 */
export function calculateFutureInterestAvoided(
  deudaPendiente: number,
  interestRate: number,
  remainingMonths: number
): number {
  // Simplified calculation: average interest over remaining period
  // Real calculation would require full amortization table
  const averageDebt = deudaPendiente / 2;
  const monthlyRate = interestRate / 12;
  const totalInterest = averageDebt * monthlyRate * remainingMonths;
  return totalInterest;
}

function getMonthlyAverage<T extends Record<string, any>>(
  entries: T[],
  dateField: keyof T,
  amountField: keyof T
): number {
  if (entries.length === 0) return 0;

  const recentEntries = [...entries]
    .filter((entry) => Boolean(entry[dateField]))
    .sort((a, b) => String(b[dateField]).localeCompare(String(a[dateField])))
    .slice(0, 12);

  if (recentEntries.length === 0) return 0;

  const total = recentEntries.reduce((sum, entry) => sum + Number(entry[amountField] || 0), 0);
  return total / Math.min(12, recentEntries.length);
}

function getAnnualRate(prestamo: Prestamo): number {
  if (prestamo.tipo === 'FIJO') {
    return prestamo.tipoNominalAnualFijo || 0;
  }
  if (prestamo.tipo === 'MIXTO') {
    return prestamo.tipoNominalAnualMixtoFijo || 0;
  }
  return normalizeRateToPercentage((prestamo.valorIndiceActual || 0) + (prestamo.diferencial || 0));
}

function normalizeRateToPercentage(rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) return 0;

  // Se aceptan dos formatos de entrada:
  // - decimal (0.037 => 3.7%)
  // - porcentaje directo (3.7 => 3.7%)
  return rate <= 1 ? rate * 100 : rate;
}

function getMonthsDifference(startDateIso: string, endDate: Date): number {
  const startDate = new Date(startDateIso);
  return (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
}

function calculateFrenchPayment(principal: number, annualRate: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  if (annualRate === 0) return principal / months;
  const monthlyRate = annualRate / 100 / 12;
  const payment = principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months));
  return Number.isFinite(payment) ? payment : 0;
}
