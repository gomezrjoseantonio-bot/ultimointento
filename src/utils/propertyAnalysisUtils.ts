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
      return `Tu ROI fiscal neto (${roiFiscalNeto.toFixed(2)}%) supera el coste de oportunidad (${roiAlternativo.toFixed(2)}%). Este activo trabaja bien.`;
    case 'REVISAR':
      return `Tu ROI fiscal neto (${roiFiscalNeto.toFixed(2)}%) está en el umbral de rentabilidad esperada. Valora mejoras o refinanciación.`;
    case 'VENDER':
      const capitalText = capitalNetoFinal 
        ? ` Liberar ${formatEuro(capitalNetoFinal)} puede mejorar tu posición.`
        : '';
      return `Tu ROI fiscal neto (${roiFiscalNeto.toFixed(2)}%) está por debajo del coste de oportunidad (${roiAlternativo.toFixed(2)}%).${capitalText}`;
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
