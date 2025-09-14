// Préstamos Service - CRUD operations

import { Prestamo, PlanPagos } from '../types/prestamos';
import { prestamosCalculationService } from './prestamosCalculationService';

export class PrestamosService {
  private prestamos: Prestamo[] = [];
  private planesGenerados: Map<string, PlanPagos> = new Map();

  /**
   * Get all loans for a property
   */
  async getPrestamosByProperty(inmuebleId: string): Promise<Prestamo[]> {
    return this.prestamos.filter(p => p.inmuebleId === inmuebleId);
  }

  /**
   * Get loan by ID
   */
  async getPrestamoById(id: string): Promise<Prestamo | null> {
    return this.prestamos.find(p => p.id === id) || null;
  }

  /**
   * Create new loan - ENHANCED to automatically generate amortization schedule
   */
  async createPrestamo(prestamoData: Omit<Prestamo, 'id' | 'createdAt' | 'updatedAt'>): Promise<Prestamo> {
    const prestamo: Prestamo = {
      id: `prestamo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...prestamoData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.prestamos.push(prestamo);
    
    // AUTO-GENERATE AMORTIZATION SCHEDULE ON SAVE
    console.log(`[PRESTAMOS] Auto-generating amortization schedule for loan ${prestamo.id}`);
    try {
      const paymentPlan = prestamosCalculationService.generatePaymentSchedule(prestamo);
      this.planesGenerados.set(prestamo.id, paymentPlan);
      console.log(`[PRESTAMOS] Amortization schedule generated: ${paymentPlan.periodos.length} payments, total interest: €${paymentPlan.resumen.totalIntereses.toFixed(2)}`);
    } catch (error) {
      console.error(`[PRESTAMOS] Failed to generate amortization schedule for loan ${prestamo.id}:`, error);
      // Don't fail loan creation if schedule generation fails
    }
    
    return prestamo;
  }

  /**
   * Update existing loan - ENHANCED to recalculate amortization schedule when parameters change
   */
  async updatePrestamo(id: string, updates: Partial<Prestamo>): Promise<Prestamo | null> {
    const index = this.prestamos.findIndex(p => p.id === id);
    if (index === -1) return null;

    const originalPrestamo = { ...this.prestamos[index] };
    
    this.prestamos[index] = {
      ...this.prestamos[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    // Check if parameters that affect amortization schedule changed
    const parametersChanged = this.hasAmortizationParametersChanged(originalPrestamo, this.prestamos[index]);
    
    if (parametersChanged) {
      console.log(`[PRESTAMOS] Loan parameters changed, regenerating amortization schedule for ${id}`);
      // Clear cached payment plan and regenerate
      this.planesGenerados.delete(id);
      
      try {
        const paymentPlan = prestamosCalculationService.generatePaymentSchedule(this.prestamos[index]);
        this.planesGenerados.set(id, paymentPlan);
        console.log(`[PRESTAMOS] Amortization schedule updated: ${paymentPlan.periodos.length} payments, total interest: €${paymentPlan.resumen.totalIntereses.toFixed(2)}`);
      } catch (error) {
        console.error(`[PRESTAMOS] Failed to regenerate amortization schedule for loan ${id}:`, error);
      }
    } else {
      // Just clear cache to ensure fresh calculation on next request
      this.planesGenerados.delete(id);
    }

    return this.prestamos[index];
  }

  /**
   * Check if amortization-affecting parameters have changed
   */
  private hasAmortizationParametersChanged(original: Prestamo, updated: Prestamo): boolean {
    const criticalFields = [
      'principalInicial', 'principalVivo', 'plazoMesesTotal', 'tipo',
      'tipoNominalAnualFijo', 'valorIndiceActual', 'diferencial', 
      'tramoFijoMeses', 'tipoNominalAnualMixtoFijo', 'mesesSoloIntereses',
      'diferirPrimeraCuotaMeses', 'diaCargoMes', 'fechaFirma'
    ];
    
    return criticalFields.some(field => 
      original[field as keyof Prestamo] !== updated[field as keyof Prestamo]
    );
  }

  /**
   * Delete loan
   */
  async deletePrestamo(id: string): Promise<boolean> {
    const index = this.prestamos.findIndex(p => p.id === id);
    if (index === -1) return false;

    this.prestamos.splice(index, 1);
    this.planesGenerados.delete(id);
    return true;
  }

  /**
   * Get or generate payment plan for a loan - ENHANCED with automatic schedule persistence
   */
  async getPaymentPlan(prestamoId: string): Promise<PlanPagos | null> {
    const prestamo = await this.getPrestamoById(prestamoId);
    if (!prestamo) return null;

    // Check if plan is cached and recent
    if (this.planesGenerados.has(prestamoId)) {
      const cachedPlan = this.planesGenerados.get(prestamoId)!;
      
      // Check if cached plan is recent (within 1 hour)
      const planAge = Date.now() - new Date(cachedPlan.fechaGeneracion).getTime();
      const isRecent = planAge < 60 * 60 * 1000; // 1 hour
      
      if (isRecent) {
        console.log(`[PRESTAMOS] Using cached amortization schedule for ${prestamoId}`);
        return cachedPlan;
      } else {
        console.log(`[PRESTAMOS] Cached schedule expired, regenerating for ${prestamoId}`);
      }
    }

    // Generate new plan
    console.log(`[PRESTAMOS] Generating fresh amortization schedule for ${prestamoId}`);
    const plan = prestamosCalculationService.generatePaymentSchedule(prestamo);
    this.planesGenerados.set(prestamoId, plan);
    
    // Log generation summary
    console.log(`[PRESTAMOS] Schedule generated - ${plan.periodos.length} payments, ends ${plan.resumen.fechaFinalizacion}, total interest: €${plan.resumen.totalIntereses.toFixed(2)}`);
    
    return plan;
  }

  /**
   * Force regeneration of payment plan (useful for testing parameter changes)
   */
  async regeneratePaymentPlan(prestamoId: string): Promise<PlanPagos | null> {
    console.log(`[PRESTAMOS] Force regenerating amortization schedule for ${prestamoId}`);
    this.planesGenerados.delete(prestamoId);
    return this.getPaymentPlan(prestamoId);
  }

  /**
   * Get amortization schedule summary
   */
  async getAmortizationSummary(prestamoId: string): Promise<{
    totalPayments: number;
    totalInterest: number;
    monthlyPayment: number;
    finalPaymentDate: string;
    principalRemaining: number;
  } | null> {
    const plan = await this.getPaymentPlan(prestamoId);
    if (!plan) return null;

    const lastPeriod = plan.periodos[plan.periodos.length - 1];
    const regularPayments = plan.periodos.filter(p => !p.esProrrateado && !p.esSoloIntereses);
    const averagePayment = regularPayments.length > 0 
      ? regularPayments.reduce((sum, p) => sum + p.cuota, 0) / regularPayments.length 
      : 0;

    return {
      totalPayments: plan.periodos.length,
      totalInterest: plan.resumen.totalIntereses,
      monthlyPayment: Math.round(averagePayment * 100) / 100,
      finalPaymentDate: plan.resumen.fechaFinalizacion,
      principalRemaining: lastPeriod?.principalFinal || 0
    };
  }

  /**
   * Simulate amortization scenarios
   */
  async simulateAmortization(
    prestamoId: string,
    importeAmortizar: number,
    fechaAmortizacion: string,
    modo: 'REDUCIR_PLAZO' | 'REDUCIR_CUOTA'
  ) {
    const prestamo = await this.getPrestamoById(prestamoId);
    if (!prestamo) throw new Error('Préstamo no encontrado');

    return prestamosCalculationService.simulateAmortization(
      prestamo,
      importeAmortizar,
      fechaAmortizacion,
      modo
    );
  }

  /**
   * Apply amortization to loan (update principal)
   */
  async applyAmortization(prestamoId: string, importe: number): Promise<Prestamo | null> {
    const prestamo = await this.getPrestamoById(prestamoId);
    if (!prestamo) return null;

    const nuevoPrincipal = Math.max(0, prestamo.principalVivo - importe);
    
    return this.updatePrestamo(prestamoId, {
      principalVivo: nuevoPrincipal
    });
  }

  /**
   * Initialize with empty data for production use
   */
  private initializeSampleData(): void {
    // Production version: no sample data
    // This method is kept for compatibility but does nothing
  }

  /**
   * Get all loans (for development/testing)
   */
  async getAllPrestamos(): Promise<Prestamo[]> {
    // Return loans without initializing sample data
    return [...this.prestamos];
  }

  /**
   * Clear all cached payment plans
   */
  clearCache(): void {
    this.planesGenerados.clear();
  }
}

export const prestamosService = new PrestamosService();