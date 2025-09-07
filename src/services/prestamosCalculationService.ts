// Préstamos Calculation Service
// Implements French amortization system with support for irregular payments

import { Prestamo, PeriodoPago, PlanPagos, CalculoAmortizacion } from '../types/prestamos';

export class PrestamosCalculationService {
  
  /**
   * Calculate monthly payment using French amortization system
   * @param principal Principal amount
   * @param annualRate Annual nominal interest rate (e.g., 0.032 for 3.2%)
   * @param months Remaining months
   * @returns Monthly payment amount
   */
  calculateFrenchPayment(principal: number, annualRate: number, months: number): number {
    if (principal <= 0 || months <= 0) return 0;
    if (annualRate === 0) return principal / months;
    
    const monthlyRate = annualRate / 12;
    const payment = principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months));
    
    return Math.round(payment * 100) / 100; // Round to 2 decimals
  }

  /**
   * Calculate applicable base interest rate (without bonifications)
   * @param prestamo Loan data
   * @param currentDate Current date for mixed loan calculations
   * @returns Annual nominal rate
   */
  calculateBaseRate(prestamo: Prestamo, currentDate?: Date): number {
    const fechaFirma = new Date(prestamo.fechaFirma);
    const evalDate = currentDate || new Date();
    const mesesTranscurridos = this.getMonthsDifference(fechaFirma, evalDate);

    switch (prestamo.tipo) {
      case 'FIJO':
        return prestamo.tipoNominalAnualFijo || 0;
        
      case 'VARIABLE':
        // Round to avoid floating point precision issues
        const rate = (prestamo.valorIndiceActual || 0) + (prestamo.diferencial || 0);
        return Math.round(rate * 10000) / 10000;
        
      case 'MIXTO':
        const tramoFijo = prestamo.tramoFijoMeses || 0;
        if (mesesTranscurridos < tramoFijo) {
          return prestamo.tipoNominalAnualMixtoFijo || 0;
        } else {
          // After fixed period, behaves like VARIABLE
          const mixtoRate = (prestamo.valorIndiceActual || 0) + (prestamo.diferencial || 0);
          return Math.round(mixtoRate * 10000) / 10000;
        }
        
      default:
        return 0;
    }
  }

  /**
   * Generate complete payment schedule
   * @param prestamo Loan configuration
   * @returns Complete payment plan
   */
  generatePaymentSchedule(prestamo: Prestamo): PlanPagos {
    const fechaFirma = new Date(prestamo.fechaFirma);
    const periodos: PeriodoPago[] = [];
    let principalVivo = prestamo.principalVivo;
    
    // Calculate first payment date considering deferrals
    const mesesDiferimiento = prestamo.diferirPrimeraCuotaMeses || 0;
    const fechaPrimeraCuota = new Date(fechaFirma);
    
    if (mesesDiferimiento > 0) {
      // If there's deferral, add exactly that many months
      fechaPrimeraCuota.setMonth(fechaPrimeraCuota.getMonth() + mesesDiferimiento);
    } else {
      // If no deferral, first payment is next month
      fechaPrimeraCuota.setMonth(fechaPrimeraCuota.getMonth() + 1);
    }
    
    // Adjust to payment day
    if (prestamo.diaCargoMes) {
      fechaPrimeraCuota.setDate(prestamo.diaCargoMes);
    }

    const baseRate = this.calculateBaseRate(prestamo);
    const mesesSoloIntereses = prestamo.mesesSoloIntereses || 0;
    const plazoAmortizacion = prestamo.plazoMesesTotal - mesesSoloIntereses;
    
    // Calculate standard payment for amortization period
    const cuotaEstandar = this.calculateFrenchPayment(principalVivo, baseRate, plazoAmortizacion);

    let fechaActual = new Date(fechaPrimeraCuota);
    
    for (let periodo = 1; periodo <= prestamo.plazoMesesTotal; periodo++) {
      const esSoloIntereses = periodo <= mesesSoloIntereses;
      const esProrrateado = periodo === 1 && prestamo.prorratearPrimerPeriodo;
      
      // Calculate accrual period
      let devengoDesde: Date;
      let devengoHasta: Date;
      let fechaCargo = new Date(fechaActual);
      
      if (prestamo.cobroMesVencido && periodo === 1) {
        // First period: from signing to first collection date
        devengoDesde = new Date(fechaFirma);
        devengoHasta = new Date(fechaActual);
        devengoHasta.setDate(devengoHasta.getDate() - 1);
      } else if (prestamo.cobroMesVencido) {
        // Subsequent periods: previous month accrual, current month collection
        devengoDesde = new Date(fechaActual);
        devengoDesde.setMonth(devengoDesde.getMonth() - 1);
        devengoHasta = new Date(fechaActual);
        devengoHasta.setDate(devengoHasta.getDate() - 1);
      } else {
        // Current period collection
        if (periodo === 1) {
          devengoDesde = new Date(fechaFirma);
        } else {
          devengoDesde = new Date(fechaActual);
          devengoDesde.setMonth(devengoDesde.getMonth() - 1);
        }
        devengoHasta = new Date(fechaActual);
        devengoHasta.setDate(devengoHasta.getDate() - 1);
      }

      // Calculate interest for the period
      let interes: number;
      if (esProrrateado) {
        const dias = this.getDaysDifference(devengoDesde, devengoHasta) + 1;
        interes = principalVivo * baseRate / 365 * dias;
      } else {
        interes = principalVivo * baseRate / 12;
      }

      interes = Math.round(interes * 100) / 100;

      let amortizacion: number;
      let cuota: number;

      if (esSoloIntereses) {
        // Interest-only payment
        amortizacion = 0;
        cuota = interes;
      } else {
        // Standard French payment
        if (periodo === prestamo.plazoMesesTotal) {
          // Last payment: pay remaining principal + interest
          amortizacion = principalVivo;
          cuota = amortizacion + interes;
        } else {
          cuota = cuotaEstandar;
          amortizacion = cuota - interes;
        }
      }

      principalVivo -= amortizacion;
      principalVivo = Math.max(0, Math.round(principalVivo * 100) / 100);

      // Calculate days for prorated period
      const diasCalculo = esProrrateado ? this.getDaysDifference(devengoDesde, devengoHasta) + 1 : undefined;

      periodos.push({
        periodo,
        devengoDesde: devengoDesde.toISOString().split('T')[0],
        devengoHasta: devengoHasta.toISOString().split('T')[0],
        fechaCargo: fechaCargo.toISOString().split('T')[0],
        cuota: Math.round(cuota * 100) / 100,
        interes,
        amortizacion: Math.round(amortizacion * 100) / 100,
        principalFinal: principalVivo,
        esProrrateado,
        esSoloIntereses,
        diasDevengo: diasCalculo && diasCalculo > 0 ? diasCalculo : undefined
      });

      // Move to next month
      fechaActual.setMonth(fechaActual.getMonth() + 1);
    }

    const totalIntereses = periodos.reduce((sum, p) => sum + p.interes, 0);
    const fechaFinalizacion = periodos[periodos.length - 1]?.fechaCargo || '';

    return {
      prestamoId: prestamo.id,
      fechaGeneracion: new Date().toISOString(),
      periodos,
      resumen: {
        totalIntereses: Math.round(totalIntereses * 100) / 100,
        totalCuotas: periodos.length,
        fechaFinalizacion
      }
    };
  }

  /**
   * Simulate partial amortization
   * @param prestamo Current loan
   * @param importeAmortizar Amount to amortize
   * @param fechaAmortizacion Date of amortization
   * @param modo Mode: reduce term or reduce payment
   * @returns Simulation results
   */
  simulateAmortization(
    prestamo: Prestamo, 
    importeAmortizar: number, 
    fechaAmortizacion: string,
    modo: 'REDUCIR_PLAZO' | 'REDUCIR_CUOTA'
  ): CalculoAmortizacion {
    
    // Calculate penalty
    const comision = (prestamo.comisionAmortizacionParcial || 0) * importeAmortizar;
    const gastosFijos = prestamo.gastosFijosOperacion || 0;
    const penalizacion = comision + gastosFijos;

    // New principal after amortization
    const nuevoPrincipal = prestamo.principalVivo - importeAmortizar;
    
    // Calculate applicable rate at amortization date
    const fechaAmort = new Date(fechaAmortizacion);
    const baseRate = this.calculateBaseRate(prestamo, fechaAmort);
    
    // Calculate remaining months from amortization date
    const fechaFin = new Date(prestamo.fechaFirma);
    fechaFin.setMonth(fechaFin.getMonth() + prestamo.plazoMesesTotal);
    const mesesRestantes = this.getMonthsDifference(fechaAmort, fechaFin);

    let nuevaCuota: number | undefined;
    let nuevoplazo: number | undefined;
    let nuevaFechaFin: string | undefined;

    if (modo === 'REDUCIR_CUOTA') {
      // Keep same term, reduce payment
      nuevaCuota = this.calculateFrenchPayment(nuevoPrincipal, baseRate, mesesRestantes);
      nuevoplazo = mesesRestantes;
      nuevaFechaFin = fechaFin.toISOString().split('T')[0];
    } else {
      // Keep payment, reduce term
      const cuotaActual = this.calculateFrenchPayment(prestamo.principalVivo, baseRate, mesesRestantes);
      nuevoplazo = this.calculateRemainingMonths(nuevoPrincipal, baseRate, cuotaActual);
      
      const nuevaFecha = new Date(fechaAmort);
      nuevaFecha.setMonth(nuevaFecha.getMonth() + nuevoplazo);
      nuevaFechaFin = nuevaFecha.toISOString().split('T')[0];
    }

    // Calculate interest savings
    const interesesSinAmortizar = this.calculateTotalInterest(prestamo.principalVivo, baseRate, mesesRestantes);
    const interesesConAmortizar = this.calculateTotalInterest(nuevoPrincipal, baseRate, nuevoplazo || mesesRestantes);
    const interesesAhorrados = interesesSinAmortizar - interesesConAmortizar;

    // Calculate break-even point (optional)
    const ahorroMensual = modo === 'REDUCIR_CUOTA' 
      ? this.calculateFrenchPayment(prestamo.principalVivo, baseRate, mesesRestantes) - (nuevaCuota || 0)
      : 0;
    
    const puntoEquilibrio = ahorroMensual > 0 ? Math.ceil(penalizacion / ahorroMensual) : undefined;

    return {
      modo,
      importeAmortizar,
      fechaAmortizacion,
      penalizacion: Math.round(penalizacion * 100) / 100,
      nuevaCuota: nuevaCuota ? Math.round(nuevaCuota * 100) / 100 : undefined,
      nuevoplazo,
      nuevaFechaFin,
      interesesAhorrados: Math.round(interesesAhorrados * 100) / 100,
      puntoEquilibrio
    };
  }

  /**
   * Calculate total interest for a loan
   */
  private calculateTotalInterest(principal: number, rate: number, months: number): number {
    const payment = this.calculateFrenchPayment(principal, rate, months);
    return (payment * months) - principal;
  }

  /**
   * Calculate remaining months given principal, rate and fixed payment
   */
  private calculateRemainingMonths(principal: number, rate: number, payment: number): number {
    if (rate === 0) return Math.ceil(principal / payment);
    
    const monthlyRate = rate / 12;
    const months = -Math.log(1 - (principal * monthlyRate) / payment) / Math.log(1 + monthlyRate);
    
    return Math.ceil(months);
  }

  /**
   * Calculate months difference between two dates
   */
  private getMonthsDifference(date1: Date, date2: Date): number {
    return (date2.getFullYear() - date1.getFullYear()) * 12 + (date2.getMonth() - date1.getMonth());
  }

  /**
   * Calculate days difference between two dates
   */
  private getDaysDifference(date1: Date, date2: Date): number {
    const timeDiff = date2.getTime() - date1.getTime();
    return Math.floor(timeDiff / (1000 * 3600 * 24));
  }
}

export const prestamosCalculationService = new PrestamosCalculationService();