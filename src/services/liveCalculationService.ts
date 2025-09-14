// Live calculation service for FEIN validation and loan creation
// Provides real-time calculations without requiring a "Calculate" button

import { FEINData } from '../types/fein';
import { CalculoLive, PrestamoFinanciacion } from '../types/financiacion';
import { bonificacionesService } from './bonificacionesService';

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
      tinBase: Math.round(tinBase * 100) / 100,
      sumaPuntosAplicada: totalBonificaciones,
      ahorroMensual: Math.round(ahorroMensual * 100) / 100,
      ahorroAnual: Math.round(ahorroAnual * 100) / 100,
      proximaFechaRevision
    };
  }

  /**
   * Calculate live loan metrics from PrestamoFinanciacion data
   */
  static calculateFromPrestamo(prestamo: PrestamoFinanciacion): CalculoLive | null {
    // Validate required fields
    if (!prestamo.capitalInicial || !prestamo.plazoTotal || !prestamo.tipo) {
      return null;
    }
    
    // Calculate base rate
    const tinBase = this.calculateBaseRate(prestamo);
    if (tinBase === 0) return null;
    
    // Apply bonifications intent
    const bonificationResult = bonificacionesService.applyIntent(prestamo);
    
    // Determine effective rate
    let tinEfectivo: number;
    if (prestamo.tipo === 'FIJO') {
      tinEfectivo = bonificationResult.tinResult || tinBase;
    } else if (prestamo.tipo === 'VARIABLE') {
      // For variable, the differential is affected, but we show the total rate
      const valorIndice = prestamo.valorIndice || 0;
      const diferencialEfectivo = bonificationResult.difResult || (prestamo.diferencial || 0);
      tinEfectivo = valorIndice + diferencialEfectivo;
    } else if (prestamo.tipo === 'MIXTO') {
      tinEfectivo = bonificationResult.tinResult || tinBase;
    } else {
      tinEfectivo = tinBase;
    }
    
    // Calculate payment
    const plazoMeses = prestamo.plazoPeriodo === 'AÑOS' ? prestamo.plazoTotal * 12 : prestamo.plazoTotal;
    const cuotaEstimada = this.calculateFrenchPayment(prestamo.capitalInicial, tinEfectivo, plazoMeses);
    
    // Calculate savings
    const cuotaBaseSinBonificaciones = this.calculateFrenchPayment(prestamo.capitalInicial, tinBase, plazoMeses);
    const ahorroMensual = cuotaBaseSinBonificaciones - cuotaEstimada;
    const ahorroAnual = ahorroMensual * 12;
    
    // Approximate APR (simplified calculation)
    const taeAproximada = this.calculateApproximateAPR(tinEfectivo, prestamo);
    
    // Next change date
    let proximoCambio = bonificationResult.proximoCambio;
    if (!proximoCambio && (prestamo.tipo === 'VARIABLE' || prestamo.tipo === 'MIXTO')) {
      const fechaFirma = new Date(prestamo.fechaFirma);
      const fechaRevisionAnual = new Date(fechaFirma);
      fechaRevisionAnual.setFullYear(fechaRevisionAnual.getFullYear() + 1);
      proximoCambio = {
        fecha: fechaRevisionAnual.toISOString().split('T')[0],
        tipo: 'REVISION_ANUAL',
        descripcion: 'Revisión anual de condiciones'
      };
    }

    return {
      cuotaEstimada: Math.round(cuotaEstimada * 100) / 100,
      taeAproximada: Math.round(taeAproximada * 10000) / 10000,
      tinEfectivo: Math.round(tinEfectivo * 10000) / 10000,
      tinBase: Math.round(tinBase * 10000) / 10000,
      sumaPuntosAplicada: bonificationResult.sumaPuntosAplicada,
      ahorroMensual: ahorroMensual > 0 ? Math.round(ahorroMensual * 100) / 100 : undefined,
      ahorroAnual: ahorroAnual > 0 ? Math.round(ahorroAnual * 100) / 100 : undefined,
      proximoCambio
    };
  }
  
  /**
   * Calculate base interest rate before bonifications
   */
  private static calculateBaseRate(prestamo: PrestamoFinanciacion): number {
    switch (prestamo.tipo) {
      case 'FIJO':
        return prestamo.tinFijo || 0;
      case 'VARIABLE':
        return (prestamo.valorIndice || 0) + (prestamo.diferencial || 0);
      case 'MIXTO':
        // During fixed period, use fixed rate
        return prestamo.tinTramoFijo || 0;
      default:
        return 0;
    }
  }
  
  /**
   * Calculate French amortization payment
   */
  private static calculateFrenchPayment(capital: number, tasaAnual: number, meses: number): number {
    if (tasaAnual === 0) {
      return capital / meses;
    }
    
    const tasaMensual = tasaAnual / 12 / 100;
    const factor = Math.pow(1 + tasaMensual, meses);
    return capital * (tasaMensual * factor) / (factor - 1);
  }
  
  /**
   * Calculate approximate APR (TAE)
   */
  private static calculateApproximateAPR(tin: number, prestamo: PrestamoFinanciacion): number {
    // Simplified APR calculation including basic commissions
    let comisiones = 0;
    
    // Opening commission
    if (prestamo.comisionApertura) {
      comisiones += prestamo.capitalInicial * (prestamo.comisionApertura / 100);
    }
    
    // Annual maintenance commission
    if (prestamo.comisionMantenimiento) {
      const plazoAnos = prestamo.plazoPeriodo === 'AÑOS' ? prestamo.plazoTotal : prestamo.plazoTotal / 12;
      comisiones += prestamo.comisionMantenimiento * plazoAnos;
    }
    
    // Simplified APR formula (TIN + commission impact)
    const comisionImpact = (comisiones / prestamo.capitalInicial) * 100;
    const plazoAnos = prestamo.plazoPeriodo === 'AÑOS' ? prestamo.plazoTotal : prestamo.plazoTotal / 12;
    
    return tin + (comisionImpact / plazoAnos);
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