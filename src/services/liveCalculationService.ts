// Live calculation service for FEIN validation and loan creation
// Provides real-time calculations without requiring a "Calculate" button

import { FEINData } from '../types/fein';
import { CalculoLive } from '../types/financiacion';

export class LiveCalculationService {
  /**
   * Calculate live loan metrics from FEIN data
   */
  static calculateFromFEIN(data: FEINData): CalculoLive | null {
    // Validate required fields
    if (!data.capitalInicial || !data.plazoAnos) {
      return null;
    }

    // Calculate base TIN
    let tinBase = data.tin || 0;
    
    // Apply bonifications if any
    const totalBonificaciones = data.bonificaciones?.reduce((sum, bonif) => {
      return sum + (bonif.descuento || 0);
    }, 0) || 0;

    const tinEfectivo = Math.max(0, tinBase - totalBonificaciones);
    
    // Calculate monthly payment using French system formula
    const capitalInicial = data.capitalInicial;
    const plazoMeses = (data.plazoAnos || 0) * 12 + (data.plazoMeses || 0);
    const tipoMensual = tinEfectivo / 100 / 12;
    
    let cuotaEstimada = 0;
    if (tipoMensual > 0 && plazoMeses > 0) {
      cuotaEstimada = capitalInicial * (tipoMensual * Math.pow(1 + tipoMensual, plazoMeses)) / 
                      (Math.pow(1 + tipoMensual, plazoMeses) - 1);
    } else if (plazoMeses > 0) {
      cuotaEstimada = capitalInicial / plazoMeses;
    }

    // Calculate approximate APR (TAE)
    // For simplicity, using TIN + commissions estimate
    let taeAproximada = tinEfectivo;
    if (data.comisionApertura || data.comisionAmortizacionParcial || data.comisionCancelacionTotal) {
      const comisionesAnuales = (data.comisionApertura || 0) / (data.plazoAnos || 1);
      taeAproximada += comisionesAnuales;
    }

    // Calculate savings from bonifications
    const ahorroMensual = totalBonificaciones > 0 ? 
      this.calculateMonthlySavings(capitalInicial, plazoMeses, tinBase, tinEfectivo) : 0;
    
    const ahorroAnual = ahorroMensual * 12;

    // Next review date (if variable/mixed)
    let proximaFechaRevision: string | undefined;
    if (data.tipo === 'VARIABLE' || data.tipo === 'MIXTO') {
      const reviewMonths = data.periodicidadRevision || 12;
      const nextReview = new Date();
      nextReview.setMonth(nextReview.getMonth() + reviewMonths);
      proximaFechaRevision = nextReview.toISOString().split('T')[0];
    }

    return {
      cuotaEstimada: Math.round(cuotaEstimada * 100) / 100,
      taeAproximada: Math.round(taeAproximada * 100) / 100,
      tinEfectivo: Math.round(tinEfectivo * 100) / 100,
      ahorroMensual: Math.round(ahorroMensual * 100) / 100,
      ahorroAnual: Math.round(ahorroAnual * 100) / 100,
      proximaFechaRevision
    };
  }

  /**
   * Calculate monthly savings from bonifications
   */
  private static calculateMonthlySavings(
    capital: number, 
    plazoMeses: number, 
    tinOriginal: number, 
    tinConBonificacion: number
  ): number {
    const tipoMensualOriginal = tinOriginal / 100 / 12;
    const tipoMensualBonificado = tinConBonificacion / 100 / 12;

    if (tipoMensualOriginal <= 0 || plazoMeses <= 0) return 0;

    const cuotaOriginal = capital * (tipoMensualOriginal * Math.pow(1 + tipoMensualOriginal, plazoMeses)) / 
                         (Math.pow(1 + tipoMensualOriginal, plazoMeses) - 1);

    const cuotaBonificada = capital * (tipoMensualBonificado * Math.pow(1 + tipoMensualBonificado, plazoMeses)) / 
                           (Math.pow(1 + tipoMensualBonificado, plazoMeses) - 1);

    return cuotaOriginal - cuotaBonificada;
  }

  /**
   * Validate loan data for completeness
   */
  static validateLoanData(data: FEINData): { isValid: boolean; missing: string[] } {
    const missing: string[] = [];

    if (!data.capitalInicial) missing.push('Capital inicial');
    if (!data.plazoAnos && !data.plazoMeses) missing.push('Plazo del préstamo');
    if (!data.tipo) missing.push('Tipo de préstamo');
    if (!data.tin && data.tipo !== 'VARIABLE') missing.push('TIN');

    // Variable/Mixed specific validations
    if (data.tipo === 'VARIABLE' || data.tipo === 'MIXTO') {
      if (!data.indice) missing.push('Índice de referencia');
      if (data.diferencial === undefined) missing.push('Diferencial');
    }

    // Mixed specific validations
    if (data.tipo === 'MIXTO') {
      if (!data.tramoFijoAnos) missing.push('Tramo fijo');
    }

    return {
      isValid: missing.length === 0,
      missing
    };
  }

  /**
   * Format Spanish currency
   */
  static formatCurrency(amount: number): string {
    return amount.toLocaleString('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  /**
   * Format Spanish percentage
   */
  static formatPercentage(rate: number): string {
    return rate.toLocaleString('es-ES', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
}

export const liveCalculationService = new LiveCalculationService();