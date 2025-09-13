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
   * Initialize with sample data for development
   */
  private initializeSampleData(): void {
    // Only add sample data if no loans exist
    if (this.prestamos.length === 0) {
      const sampleLoans: Prestamo[] = [
        {
          id: 'prestamo_sample_1',
          inmuebleId: 'standalone',
          nombre: 'Préstamo Personal Expansión',
          principalInicial: 25000,
          principalVivo: 22500,
          fechaFirma: '2023-06-15',
          plazoMesesTotal: 60,
          tipo: 'FIJO',
          tipoNominalAnualFijo: 0.035,
          diaCargoMes: 15,
          cuentaCargoId: 'acc1',
          comisionAmortizacionParcial: 0.01,
          comisionCancelacionTotal: 0.005,
          bonificaciones: [
            {
              id: 'bonif_1',
              nombre: 'Nómina Domiciliada',
              reduccionPuntosPorcentuales: 0.005,
              lookbackMeses: 6,
              regla: { tipo: 'NOMINA', minimoMensual: 1200 },
              estado: 'CUMPLIDA',
              progreso: {
                descripcion: 'Nómina de 1.500€ durante 6 meses consecutivos'
              }
            }
          ],
          createdAt: '2023-06-15T10:00:00Z',
          updatedAt: '2023-12-15T10:00:00Z'
        },
        {
          id: 'prestamo_sample_2',
          inmuebleId: 'prop_001',
          nombre: 'Hipoteca Vivienda Principal',
          principalInicial: 180000,
          principalVivo: 168400,
          fechaFirma: '2022-03-10',
          plazoMesesTotal: 300,
          tipo: 'VARIABLE',
          indice: 'EURIBOR',
          valorIndiceActual: 0.025,
          diferencial: 0.008,
          periodoRevisionMeses: 12,
          fechaProximaRevision: '2024-03-10',
          diaCargoMes: 10,
          cuentaCargoId: 'acc2',
          comisionAmortizacionParcial: 0.005,
          bonificaciones: [
            {
              id: 'bonif_2',
              nombre: 'Seguro Hogar',
              reduccionPuntosPorcentuales: 0.002,
              lookbackMeses: 12,
              regla: { tipo: 'SEGURO_HOGAR', activo: true },
              estado: 'CUMPLIDA',
              progreso: {
                descripcion: 'Seguro de hogar activo'
              }
            },
            {
              id: 'bonif_3',
              nombre: 'Tarjeta de Crédito',
              reduccionPuntosPorcentuales: 0.001,
              lookbackMeses: 6,
              regla: { tipo: 'TARJETA', movimientosMesMin: 3, importeMinimo: 300 },
              estado: 'EN_RIESGO',
              progreso: {
                descripcion: 'Solo 2 movimientos este mes',
                faltante: 'Necesitas 1 movimiento más este mes'
              }
            }
          ],
          createdAt: '2022-03-10T10:00:00Z',
          updatedAt: '2023-12-15T10:00:00Z'
        },
        {
          id: 'prestamo_sample_3',
          inmuebleId: 'standalone',
          nombre: 'Préstamo Coche',
          principalInicial: 15000,
          principalVivo: 8200,
          fechaFirma: '2021-09-20',
          plazoMesesTotal: 48,
          tipo: 'FIJO',
          tipoNominalAnualFijo: 0.045,
          diaCargoMes: 20,
          cuentaCargoId: 'acc3',
          createdAt: '2021-09-20T10:00:00Z',
          updatedAt: '2023-12-15T10:00:00Z'
        }
      ];

      this.prestamos = sampleLoans;
    }
  }

  /**
   * Get all loans (for development/testing)
   */
  async getAllPrestamos(): Promise<Prestamo[]> {
    // Initialize sample data if needed
    this.initializeSampleData();
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