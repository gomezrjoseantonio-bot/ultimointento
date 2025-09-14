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
   * Create new loan
   */
  async createPrestamo(prestamoData: Omit<Prestamo, 'id' | 'createdAt' | 'updatedAt'>): Promise<Prestamo> {
    const prestamo: Prestamo = {
      id: `prestamo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...prestamoData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.prestamos.push(prestamo);
    return prestamo;
  }

  /**
   * Update existing loan
   */
  async updatePrestamo(id: string, updates: Partial<Prestamo>): Promise<Prestamo | null> {
    const index = this.prestamos.findIndex(p => p.id === id);
    if (index === -1) return null;

    this.prestamos[index] = {
      ...this.prestamos[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    // Clear cached payment plan when loan is updated
    this.planesGenerados.delete(id);

    return this.prestamos[index];
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
   * Get or generate payment plan for a loan
   */
  async getPaymentPlan(prestamoId: string): Promise<PlanPagos | null> {
    const prestamo = await this.getPrestamoById(prestamoId);
    if (!prestamo) return null;

    // Check if plan is cached
    if (this.planesGenerados.has(prestamoId)) {
      return this.planesGenerados.get(prestamoId)!;
    }

    // Generate new plan
    const plan = prestamosCalculationService.generatePaymentSchedule(prestamo);
    this.planesGenerados.set(prestamoId, plan);
    
    return plan;
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