import { initDB } from './db';
import { 
  PlanPensionInversion, 
  AportacionPeriodica
} from '../types/personal';

class PlanesInversionService {
  private db: any = null;

  private async getDB() {
    if (!this.db) {
      this.db = await initDB();
    }
    return this.db;
  }

  /**
   * Get all plans for a personal data ID
   */
  async getPlanes(personalDataId: number): Promise<PlanPensionInversion[]> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(['planesPensionInversion'], 'readonly');
      const store = transaction.objectStore('planesPensionInversion');
      const index = store.index('personalDataId');
      const planes = await index.getAll(personalDataId);
      return planes || [];
    } catch (error) {
      console.error('Error getting planes:', error);
      return [];
    }
  }

  /**
   * Save or update a plan
   */
  async savePlan(plan: Omit<PlanPensionInversion, 'id' | 'fechaCreacion' | 'fechaActualizacion'>): Promise<PlanPensionInversion> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(['planesPensionInversion'], 'readwrite');
      const store = transaction.objectStore('planesPensionInversion');
      
      const now = new Date().toISOString();
      
      const newPlan: PlanPensionInversion = {
        ...plan,
        fechaCreacion: now,
        fechaActualizacion: now
      };

      const result = await store.add(newPlan);
      newPlan.id = result;
      
      await transaction.complete;
      return newPlan;
    } catch (error) {
      console.error('Error saving plan:', error);
      throw error;
    }
  }

  /**
   * Update an existing plan
   */
  async updatePlan(id: number, updates: Partial<PlanPensionInversion>): Promise<PlanPensionInversion> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(['planesPensionInversion'], 'readwrite');
      const store = transaction.objectStore('planesPensionInversion');
      
      const existing = await store.get(id);
      if (!existing) {
        throw new Error('Plan not found');
      }

      const updated: PlanPensionInversion = {
        ...existing,
        ...updates,
        fechaActualizacion: new Date().toISOString()
      };

      await store.put(updated);
      await transaction.complete;
      
      return updated;
    } catch (error) {
      console.error('Error updating plan:', error);
      throw error;
    }
  }

  /**
   * Delete a plan
   */
  async deletePlan(id: number): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(['planesPensionInversion'], 'readwrite');
      const store = transaction.objectStore('planesPensionInversion');
      
      await store.delete(id);
      await transaction.complete;
    } catch (error) {
      console.error('Error deleting plan:', error);
      throw error;
    }
  }

  /**
   * Calculate profit/loss for a plan
   */
  calculateProfitLoss(plan: PlanPensionInversion): {
    totalInvertido: number;
    valorActualTotal: number;
    plusvaliaMinusvalia: number;
    porcentajeRentabilidad: number;
  } {
    const totalInvertido = plan.aportacionesRealizadas;
    const valorActualTotal = plan.unidades ? plan.unidades * plan.valorActual : plan.valorActual;
    const plusvaliaMinusvalia = valorActualTotal - totalInvertido;
    const porcentajeRentabilidad = totalInvertido > 0 ? (plusvaliaMinusvalia / totalInvertido) * 100 : 0;

    return {
      totalInvertido,
      valorActualTotal,
      plusvaliaMinusvalia,
      porcentajeRentabilidad
    };
  }

  /**
   * Get plans by type
   */
  async getPlanesByTipo(personalDataId: number, tipo: PlanPensionInversion['tipo']): Promise<PlanPensionInversion[]> {
    try {
      const planes = await this.getPlanes(personalDataId);
      return planes.filter(plan => plan.tipo === tipo);
    } catch (error) {
      console.error('Error getting planes by tipo:', error);
      return [];
    }
  }

  /**
   * Get plans with periodic contributions
   */
  async getPlanesConAportacionPeriodica(personalDataId: number): Promise<PlanPensionInversion[]> {
    try {
      const planes = await this.getPlanes(personalDataId);
      return planes.filter(plan => !plan.esHistorico && plan.aportacionPeriodica?.activa);
    } catch (error) {
      console.error('Error getting planes with periodic contributions:', error);
      return [];
    }
  }

  /**
   * Calculate total portfolio value
   */
  async calculatePortfolioSummary(personalDataId: number, titularidad?: PlanPensionInversion['titularidad']): Promise<{
    totalInvertido: number;
    valorActualTotal: number;
    plusvaliasMinusvalias: number;
    rentabilidadPromedio: number;
    planesTotales: number;
  }> {
    try {
      const planes = await this.getPlanes(personalDataId);
      const planesFiltrados = titularidad ? planes.filter(p => p.titularidad === titularidad) : planes;
      
      let totalInvertido = 0;
      let valorActualTotal = 0;
      let plusvaliasMinusvalias = 0;
      
      planesFiltrados.forEach(plan => {
        const calculo = this.calculateProfitLoss(plan);
        totalInvertido += calculo.totalInvertido;
        valorActualTotal += calculo.valorActualTotal;
        plusvaliasMinusvalias += calculo.plusvaliaMinusvalia;
      });
      
      const rentabilidadPromedio = totalInvertido > 0 ? (plusvaliasMinusvalias / totalInvertido) * 100 : 0;
      
      return {
        totalInvertido,
        valorActualTotal,
        plusvaliasMinusvalias,
        rentabilidadPromedio,
        planesTotales: planesFiltrados.length
      };
    } catch (error) {
      console.error('Error calculating portfolio summary:', error);
      return {
        totalInvertido: 0,
        valorActualTotal: 0,
        plusvaliasMinusvalias: 0,
        rentabilidadPromedio: 0,
        planesTotales: 0
      };
    }
  }

  /**
   * Update plan current value
   */
  async updatePlanValue(id: number, nuevoValor: number, nuevasUnidades?: number): Promise<PlanPensionInversion> {
    try {
      const updates: Partial<PlanPensionInversion> = {
        valorActual: nuevoValor
      };
      
      if (nuevasUnidades !== undefined) {
        updates.unidades = nuevasUnidades;
      }
      
      return await this.updatePlan(id, updates);
    } catch (error) {
      console.error('Error updating plan value:', error);
      throw error;
    }
  }

  /**
   * Get next contribution date for a plan
   */
  getNextContributionDate(aportacion: AportacionPeriodica): Date {
    const today = new Date();
    const nextDate = new Date(today);
    
    switch (aportacion.frecuencia) {
      case 'mensual':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'trimestral':
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case 'semestral':
        nextDate.setMonth(nextDate.getMonth() + 6);
        break;
      case 'anual':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
    }
    
    // Apply day rules
    switch (aportacion.reglasDia.tipo) {
      case 'fijo':
        nextDate.setDate(aportacion.reglasDia.dia || 1);
        break;
      case 'ultimo-habil':
        // Move to last business day of the month
        nextDate.setMonth(nextDate.getMonth() + 1, 0); // Last day of month
        while (nextDate.getDay() === 0 || nextDate.getDay() === 6) {
          nextDate.setDate(nextDate.getDate() - 1);
        }
        break;
      case 'n-esimo-habil':
        // For simplicity, use the 5th business day of the month
        nextDate.setDate(7);
        break;
    }
    
    return nextDate;
  }

  /**
   * Calculate annual contribution for a plan
   */
  calculateAnnualContribution(aportacion: AportacionPeriodica): number {
    switch (aportacion.frecuencia) {
      case 'mensual':
        return aportacion.importe * 12;
      case 'trimestral':
        return aportacion.importe * 4;
      case 'semestral':
        return aportacion.importe * 2;
      case 'anual':
        return aportacion.importe;
      default:
        return 0;
    }
  }

  /**
   * Get tax implications for pension plans
   */
  getTaxImplications(plan: PlanPensionInversion): {
    deducibleAnual: number;
    maxDeducible: number;
    tipoImpositivo: 'diferido' | 'inmediato' | 'exento';
  } {
    // Simplified tax calculation - in real implementation would be more complex
    switch (plan.tipo) {
      case 'plan-pensiones':
        return {
          deducibleAnual: plan.aportacionPeriodica ? this.calculateAnnualContribution(plan.aportacionPeriodica) : 0,
          maxDeducible: 1500, // 2024 limit
          tipoImpositivo: 'diferido'
        };
      case 'inversion':
      case 'acciones':
        return {
          deducibleAnual: 0,
          maxDeducible: 0,
          tipoImpositivo: 'inmediato'
        };
      case 'fondo-indexado':
        return {
          deducibleAnual: 0,
          maxDeducible: 0,
          tipoImpositivo: 'diferido'
        };
      default:
        return {
          deducibleAnual: 0,
          maxDeducible: 0,
          tipoImpositivo: 'inmediato'
        };
    }
  }
}

export const planesInversionService = new PlanesInversionService();