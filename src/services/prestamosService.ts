// Préstamos Service - Mock data and CRUD operations

import { Prestamo, PlanPagos } from '../types/prestamos';
import { prestamosCalculationService } from './prestamosCalculationService';

export class PrestamosService {
  private prestamos: Prestamo[] = [];
  private planesGenerados: Map<string, PlanPagos> = new Map();

  constructor() {
    this.initMockData();
  }

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
   * Initialize mock data for development
   */
  private initMockData(): void {
    const mockPrestamos: Prestamo[] = [
      {
        id: 'prestamo_001',
        inmuebleId: 'property_001',
        nombre: 'Hipoteca Vivienda Principal',
        principalInicial: 180000,
        principalVivo: 165000,
        fechaFirma: '2023-08-10',
        plazoMesesTotal: 300,
        tipo: 'VARIABLE',
        indice: 'EURIBOR',
        valorIndiceActual: 0.0365,
        diferencial: 0.012,
        periodoRevisionMeses: 12,
        fechaProximaRevision: '2025-08-10',
        mesesSoloIntereses: 0,
        diferirPrimeraCuotaMeses: 2,
        prorratearPrimerPeriodo: true,
        cobroMesVencido: true,
        diaCargoMes: 10,
        cuentaCargoId: 'cuenta_001',
        comisionAmortizacionParcial: 0.01,
        comisionCancelacionTotal: 0.005,
        gastosFijosOperacion: 30,
        // Bonifications
        fechaFinPeriodo: '2025-12-31',
        fechaEvaluacion: '2025-12-01',
        offsetEvaluacionDias: 30,
        bonificaciones: [
          {
            id: 'bonif_001',
            nombre: 'Nómina',
            reduccionPuntosPorcentuales: 0.003, // 0.30 pp
            lookbackMeses: 4,
            regla: { tipo: 'NOMINA', minimoMensual: 1200 },
            costeAnualEstimado: 0,
            estado: 'EN_RIESGO',
            progreso: {
              descripcion: 'Llevas 2/4 meses de nómina ≥ 1.200€',
              faltante: 'Faltan 2 meses con nómina ≥ 1.200€'
            }
          },
          {
            id: 'bonif_002',
            nombre: 'Seguro Hogar',
            reduccionPuntosPorcentuales: 0.002, // 0.20 pp
            lookbackMeses: 12,
            regla: { tipo: 'SEGURO_HOGAR', activo: true },
            costeAnualEstimado: 240,
            estado: 'CUMPLIDA',
            progreso: {
              descripcion: 'Seguro activo desde hace 8 meses'
            }
          },
          {
            id: 'bonif_003',
            nombre: 'Tarjeta',
            reduccionPuntosPorcentuales: 0.001, // 0.10 pp
            lookbackMeses: 3,
            regla: { tipo: 'TARJETA', movimientosMesMin: 6 },
            estado: 'CUMPLIDA',
            progreso: {
              descripcion: 'Promedio de 8 movimientos/mes últimos 3 meses'
            }
          }
        ],
        createdAt: '2023-08-10T10:00:00Z',
        updatedAt: '2024-12-01T15:30:00Z'
      },
      {
        id: 'prestamo_002',
        inmuebleId: 'property_002',
        nombre: 'Préstamo Reforma',
        principalInicial: 45000,
        principalVivo: 38500,
        fechaFirma: '2024-03-15',
        plazoMesesTotal: 120,
        tipo: 'FIJO',
        tipoNominalAnualFijo: 0.045,
        mesesSoloIntereses: 3,
        diferirPrimeraCuotaMeses: 0,
        prorratearPrimerPeriodo: false,
        cobroMesVencido: false,
        diaCargoMes: 15,
        cuentaCargoId: 'cuenta_002',
        comisionAmortizacionParcial: 0.015,
        comisionCancelacionTotal: 0.01,
        gastosFijosOperacion: 25,
        createdAt: '2024-03-15T14:20:00Z',
        updatedAt: '2024-11-20T09:15:00Z'
      },
      {
        id: 'prestamo_003',
        inmuebleId: 'property_001',
        nombre: 'Hipoteca Mixta Inversión',
        principalInicial: 250000,
        principalVivo: 240000,
        fechaFirma: '2024-01-20',
        plazoMesesTotal: 360,
        tipo: 'MIXTO',
        tramoFijoMeses: 60,
        tipoNominalAnualMixtoFijo: 0.032,
        indice: 'EURIBOR',
        valorIndiceActual: 0.0365,
        diferencial: 0.015,
        periodoRevisionMeses: 12,
        mesesSoloIntereses: 6,
        diferirPrimeraCuotaMeses: 1,
        prorratearPrimerPeriodo: true,
        cobroMesVencido: true,
        diaCargoMes: 20,
        cuentaCargoId: 'cuenta_003',
        comisionAmortizacionParcial: 0.008,
        comisionCancelacionTotal: 0.004,
        gastosFijosOperacion: 40,
        createdAt: '2024-01-20T11:45:00Z',
        updatedAt: '2024-12-01T16:00:00Z'
      }
    ];

    this.prestamos = mockPrestamos;
  }

  /**
   * Get all loans (for development/testing)
   */
  async getAllPrestamos(): Promise<Prestamo[]> {
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