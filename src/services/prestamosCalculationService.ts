// Préstamos Calculation Service
// Implements French amortization system with support for irregular payments

import { Prestamo, PeriodoPago, PlanPagos, CalculoAmortizacion } from '../types/prestamos';

export class PrestamosCalculationService {
  
  /**
   * Calculate monthly payment using French amortization system
   * @param principal Principal amount
   * @param annualRate Annual nominal interest rate as a percentage (e.g., 3.2 for 3.2%)
   * @param months Remaining months
   * @returns Monthly payment amount
   */
  calculateFrenchPayment(principal: number, annualRate: number, months: number): number {
    if (principal <= 0 || months <= 0) return 0;
    if (annualRate === 0) return principal / months;
    
    const monthlyRate = annualRate / 100 / 12;
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
   * Check if a bonification should be applied (active states)
   */
  private isActiveBonification(bonif: any): boolean {
    return bonif.estado === 'CUMPLIDA' || bonif.estado === 'SELECCIONADO' || 
           bonif.estado === 'ACTIVO_POR_GRACIA' || bonif.seleccionado === true;
  }

  /**
   * Calculate bonified interest rate (with applied bonifications)
   * @param prestamo Loan data
   * @param currentDate Current date for mixed loan calculations
   * @returns Annual nominal rate with bonifications applied
   */
  calculateBonifiedRate(prestamo: Prestamo, currentDate?: Date): number {
    const baseRate = this.calculateBaseRate(prestamo, currentDate);
    
    if (!prestamo.bonificaciones || prestamo.bonificaciones.length === 0) {
      return baseRate;
    }

    // Sum up all active bonifications (CUMPLIDA, SELECCIONADO, or ACTIVO_POR_GRACIA)
    const totalBonifications = prestamo.bonificaciones
      .filter(bonif => this.isActiveBonification(bonif))
      .reduce((sum, bonif) => sum + bonif.reduccionPuntosPorcentuales, 0);

    // Apply bonifications (rate cannot go below 0)
    const bonifiedRate = Math.max(0, baseRate - totalBonifications);
    return Math.round(bonifiedRate * 10000) / 10000;
  }

  /**
   * Calculate savings from bonifications
   * @param prestamo Loan data
   * @param currentDate Current date for calculations
   * @returns Detailed savings breakdown
   */
  calculateBonificationSavings(prestamo: Prestamo, currentDate?: Date): {
    baseRate: number;
    bonifiedRate: number;
    basePayment: number;
    bonifiedPayment: number;
    totalSavingsPerMonth: number;
    totalSavingsPerYear: number;
    bonificationBreakdown: Array<{
      bonificationId: string;
      name: string;
      reduction: number;
      savingsPerMonth: number;
      savingsPerYear: number;
    }>;
  } {
    const baseRate = this.calculateBaseRate(prestamo, currentDate);
    const bonifiedRate = this.calculateBonifiedRate(prestamo, currentDate);
    
    // Calculate remaining term for payments
    const fechaFirma = new Date(prestamo.fechaFirma);
    const evalDate = currentDate || new Date();
    const mesesTranscurridos = this.getMonthsDifference(fechaFirma, evalDate);
    const mesesRestantes = Math.max(1, prestamo.plazoMesesTotal - mesesTranscurridos);
    
    // Calculate payments with and without bonifications
    const basePayment = this.calculateFrenchPayment(prestamo.principalVivo, baseRate, mesesRestantes);
    const bonifiedPayment = this.calculateFrenchPayment(prestamo.principalVivo, bonifiedRate, mesesRestantes);
    
    const totalSavingsPerMonth = basePayment - bonifiedPayment;
    const totalSavingsPerYear = totalSavingsPerMonth * 12;

    // Calculate savings breakdown per bonification
    const bonificationBreakdown: Array<{
      bonificationId: string;
      name: string;
      reduction: number;
      savingsPerMonth: number;
      savingsPerYear: number;
    }> = [];

    if (prestamo.bonificaciones) {
      let cumulativeRate = baseRate;
      
      for (const bonif of prestamo.bonificaciones.filter(b => this.isActiveBonification(b))) {
        const rateBeforeBonif = cumulativeRate;
        const rateAfterBonif = Math.max(0, cumulativeRate - bonif.reduccionPuntosPorcentuales);
        
        const paymentBefore = this.calculateFrenchPayment(prestamo.principalVivo, rateBeforeBonif, mesesRestantes);
        const paymentAfter = this.calculateFrenchPayment(prestamo.principalVivo, rateAfterBonif, mesesRestantes);
        
        const savingsPerMonth = paymentBefore - paymentAfter;
        const savingsPerYear = savingsPerMonth * 12;
        
        bonificationBreakdown.push({
          bonificationId: bonif.id,
          name: bonif.nombre,
          reduction: bonif.reduccionPuntosPorcentuales,
          savingsPerMonth: Math.round(savingsPerMonth * 100) / 100,
          savingsPerYear: Math.round(savingsPerYear * 100) / 100
        });
        
        cumulativeRate = rateAfterBonif;
      }
    }

    return {
      baseRate: Math.round(baseRate * 10000) / 10000,
      bonifiedRate: Math.round(bonifiedRate * 10000) / 10000,
      basePayment: Math.round(basePayment * 100) / 100,
      bonifiedPayment: Math.round(bonifiedPayment * 100) / 100,
      totalSavingsPerMonth: Math.round(totalSavingsPerMonth * 100) / 100,
      totalSavingsPerYear: Math.round(totalSavingsPerYear * 100) / 100,
      bonificationBreakdown
    };
  }

  /**
   * Evaluate bonification compliance and generate alerts
   * @param prestamo Loan data
   * @param currentDate Current evaluation date
   * @returns Compliance status and alerts
   */
  evaluateBonifications(prestamo: Prestamo, currentDate?: Date): {
    bonificationStatus: Array<{
      bonificationId: string;
      name: string;
      status: 'CUMPLIDA' | 'EN_RIESGO' | 'PERDIDA' | 'PENDIENTE';
      economicImpact?: {
        lossSavingsPerMonth: number;
        lossSavingsPerYear: number;
      };
      alertDates?: {
        evaluationDate: string;
        applicationDate: string;
        daysUntilEvaluation: number;
      };
      progress?: {
        description: string;
        missing?: string;
      };
    }>;
    upcomingAlerts: Array<{
      bonificationId: string;
      alertType: 'T-45' | 'T-21' | 'T-7' | 'T-2';
      message: string;
      economicImpact: {
        additionalCostPerMonth: number;
        additionalCostPerYear: number;
      };
      actionRequired: string;
    }>;
  } {
    const evalDate = currentDate || new Date();
    const bonificationStatus: any[] = [];
    const upcomingAlerts: any[] = [];

    if (!prestamo.bonificaciones) {
      return { bonificationStatus, upcomingAlerts };
    }

    for (const bonif of prestamo.bonificaciones) {
      // Calculate economic impact if this bonification is lost
      const economicImpact = this.calculateBonificationLossImpact(prestamo, bonif.id, currentDate);
      
      // Calculate alert dates if applicable
      let alertDates;
      if (prestamo.fechaFinPeriodo && prestamo.fechaEvaluacion) {
        const evaluationDate = new Date(prestamo.fechaEvaluacion);
        const daysUntilEvaluation = Math.ceil((evaluationDate.getTime() - evalDate.getTime()) / (1000 * 60 * 60 * 24));
        
        alertDates = {
          evaluationDate: prestamo.fechaEvaluacion,
          applicationDate: prestamo.fechaFinPeriodo,
          daysUntilEvaluation
        };

        // Generate alerts based on days remaining
        if (daysUntilEvaluation > 0) {
          if ([45, 21, 7, 2].includes(daysUntilEvaluation)) {
            const alertType = `T-${daysUntilEvaluation}` as 'T-45' | 'T-21' | 'T-7' | 'T-2';
            upcomingAlerts.push({
              bonificationId: bonif.id,
              alertType,
              message: `Bonificación "${bonif.nombre}" en riesgo. Te falta ${bonif.progreso?.faltante || 'cumplir requisitos'}. Si no la cumples antes del ${prestamo.fechaEvaluacion}, tu cuota subirá +${economicImpact.additionalCostPerMonth.toFixed(2)} €/mes (+${economicImpact.additionalCostPerYear.toFixed(2)} €/año) desde ${prestamo.fechaFinPeriodo}.`,
              economicImpact,
              actionRequired: this.getBonificationActionRequired(bonif)
            });
          }
        }
      }

      bonificationStatus.push({
        bonificationId: bonif.id,
        name: bonif.nombre,
        status: bonif.estado,
        economicImpact: bonif.estado !== 'CUMPLIDA' ? economicImpact : undefined,
        alertDates,
        progress: bonif.progreso
      });
    }

    return { bonificationStatus, upcomingAlerts };
  }

  /**
   * Calculate economic impact of losing a specific bonification
   */
  private calculateBonificationLossImpact(prestamo: Prestamo, bonificationId: string, currentDate?: Date): {
    additionalCostPerMonth: number;
    additionalCostPerYear: number;
  } {
    const bonification = prestamo.bonificaciones?.find(b => b.id === bonificationId);
    if (!bonification) {
      return { additionalCostPerMonth: 0, additionalCostPerYear: 0 };
    }

    const fechaFirma = new Date(prestamo.fechaFirma);
    const evalDate = currentDate || new Date();
    const mesesTranscurridos = this.getMonthsDifference(fechaFirma, evalDate);
    const mesesRestantes = Math.max(1, prestamo.plazoMesesTotal - mesesTranscurridos);

    const currentRate = this.calculateBonifiedRate(prestamo, currentDate);
    const rateWithoutThisBonif = currentRate + bonification.reduccionPuntosPorcentuales;

    const currentPayment = this.calculateFrenchPayment(prestamo.principalVivo, currentRate, mesesRestantes);
    const paymentWithoutBonif = this.calculateFrenchPayment(prestamo.principalVivo, rateWithoutThisBonif, mesesRestantes);

    const additionalCostPerMonth = paymentWithoutBonif - currentPayment;
    const additionalCostPerYear = additionalCostPerMonth * 12;

    return {
      additionalCostPerMonth: Math.round(additionalCostPerMonth * 100) / 100,
      additionalCostPerYear: Math.round(additionalCostPerYear * 100) / 100
    };
  }

  /**
   * Get action required message for bonification compliance
   */
  private getBonificationActionRequired(bonification: any): string {
    switch (bonification.regla.tipo) {
      case 'NOMINA':
        return `Asegurar nómina ≥ ${bonification.regla.minimoMensual}€ por ${bonification.lookbackMeses} meses`;
      case 'PLAN_PENSIONES':
        return 'Mantener plan de pensiones activo';
      case 'SEGURO_HOGAR':
        return 'Mantener seguro de hogar activo';
      case 'SEGURO_VIDA':
        return 'Mantener seguro de vida activo';
      case 'TARJETA':
        const tarjetaReqs = [];
        if (bonification.regla.movimientosMesMin) {
          tarjetaReqs.push(`${bonification.regla.movimientosMesMin} movimientos/mes`);
        }
        if (bonification.regla.importeMinimo) {
          tarjetaReqs.push(`facturar ≥${bonification.regla.importeMinimo}€/año`);
        }
        return `Uso de tarjeta: ${tarjetaReqs.join(' o ')}`;
      case 'ALARMA':
        return 'Mantener servicio de alarma activo';
      default:
        return bonification.regla.descripcion || 'Cumplir requisitos específicos';
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
    let principalVivo = prestamo.principalInicial;
    
    // Calculate first payment date considering deferrals.
    // Keep a stable target day across months, clamping to month-end when needed
    // (e.g. day 31 -> Feb 28/29) to avoid month skips caused by Date overflow.
    const mesesDiferimiento = prestamo.diferirPrimeraCuotaMeses || 0;
    const paymentDay = prestamo.diaCargoMes || fechaFirma.getDate();
    const firstOffsetMonths = mesesDiferimiento > 0 ? mesesDiferimiento : 1;
    const fechaPrimeraCuota = this.addMonthsWithClampedDay(
      fechaFirma,
      firstOffsetMonths,
      paymentDay,
    );

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
        interes = principalVivo * (baseRate / 100) / 365 * dias;
      } else {
        interes = principalVivo * (baseRate / 100) / 12;
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
        diasDevengo: diasCalculo && diasCalculo > 0 ? diasCalculo : undefined,
        pagado: false
      });

      // Move to next month preserving billing day and clamping when month is shorter
      fechaActual = this.addMonthsWithClampedDay(fechaActual, 1, paymentDay);
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
   * Adds months to a date while keeping a target day-of-month clamped to month end.
   * Prevents JS Date overflow from skipping months (e.g. Jan-31 + 1 month -> Mar-02).
   */
  private addMonthsWithClampedDay(baseDate: Date, monthsToAdd: number, dayOfMonth: number): Date {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth() + monthsToAdd;
    const firstOfTargetMonth = new Date(year, month, 1);
    const lastDay = new Date(
      firstOfTargetMonth.getFullYear(),
      firstOfTargetMonth.getMonth() + 1,
      0,
    ).getDate();
    const safeDay = Math.max(1, Math.min(dayOfMonth, lastDay));

    return new Date(
      firstOfTargetMonth.getFullYear(),
      firstOfTargetMonth.getMonth(),
      safeDay,
    );
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
    
    const monthlyRate = rate / 100 / 12;
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