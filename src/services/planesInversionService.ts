// src/services/planesInversionService.ts
// Compatibility wrapper: delegates to the new planesPensionesService (TAREA 13 V65)
import { planesPensionesService } from './planesPensionesService';
import type { PlanPensiones } from '../types/planesPensiones';
import type { AportacionPeriodica } from '../types/personal';

// Re-export PlanPensiones as the unified type
export type { PlanPensiones as PlanPensionInversion } from '../types/planesPensiones';

class PlanesInversionService {
  async getAllPlanes(): Promise<PlanPensiones[]> {
    try {
      return await planesPensionesService.getAllPlanes();
    } catch {
      return [];
    }
  }

  async getPlanes(personalDataId: number): Promise<PlanPensiones[]> {
    try {
      return await planesPensionesService.getAllPlanes({ personalDataId });
    } catch {
      return [];
    }
  }

  async savePlan(plan: Omit<PlanPensiones, 'id' | 'fechaCreacion' | 'fechaActualizacion'>): Promise<PlanPensiones> {
    return planesPensionesService.createPlan(plan);
  }

  async updatePlan(id: string | number, updates: Partial<PlanPensiones>): Promise<PlanPensiones> {
    return planesPensionesService.updatePlan(String(id), updates);
  }

  async deletePlan(id: string | number): Promise<void> {
    return planesPensionesService.eliminarPlan(String(id));
  }

  calculateProfitLoss(plan: PlanPensiones): {
    totalInvertido: number;
    valorActualTotal: number;
    plusvaliaMinusvalia: number;
    porcentajeRentabilidad: number;
  } {
    const totalInvertido = 0; // aportaciones tracked separately in aportacionesPlan
    const valorActualTotal = plan.valorActual ?? 0;
    const plusvaliaMinusvalia = valorActualTotal - totalInvertido;
    const porcentajeRentabilidad = 0;
    return { totalInvertido, valorActualTotal, plusvaliaMinusvalia, porcentajeRentabilidad };
  }

  async getPlanesByTipo(personalDataId: number, _tipo: string): Promise<PlanPensiones[]> {
    try {
      return await this.getPlanes(personalDataId);
    } catch {
      return [];
    }
  }

  async getPlanesConAportacionPeriodica(personalDataId: number): Promise<PlanPensiones[]> {
    try {
      return await this.getPlanes(personalDataId);
    } catch {
      return [];
    }
  }

  async calculatePortfolioSummary(personalDataId: number): Promise<{
    totalInvertido: number;
    valorActualTotal: number;
    plusvaliasMinusvalias: number;
    rentabilidadPromedio: number;
    planesTotales: number;
  }> {
    try {
      const planes = await this.getPlanes(personalDataId);
      const valorActualTotal = planes.reduce((s, p) => s + (p.valorActual ?? 0), 0);
      return {
        totalInvertido: 0,
        valorActualTotal,
        plusvaliasMinusvalias: valorActualTotal,
        rentabilidadPromedio: 0,
        planesTotales: planes.length,
      };
    } catch {
      return { totalInvertido: 0, valorActualTotal: 0, plusvaliasMinusvalias: 0, rentabilidadPromedio: 0, planesTotales: 0 };
    }
  }

  async updatePlanValue(id: string | number, nuevoValor: number): Promise<PlanPensiones> {
    return planesPensionesService.updatePlan(String(id), { valorActual: nuevoValor });
  }

  getNextContributionDate(_ap: AportacionPeriodica): Date {
    return new Date();
  }

  calculateAnnualContribution(ap: AportacionPeriodica): number {
    switch (ap.frecuencia) {
      case 'mensual': return ap.importe * 12;
      case 'trimestral': return ap.importe * 4;
      case 'semestral': return ap.importe * 2;
      case 'anual': return ap.importe;
      default: return 0;
    }
  }

  getTaxImplications(_plan: PlanPensiones): {
    deducibleAnual: number;
    maxDeducible: number;
    tipoImpositivo: 'diferido' | 'inmediato' | 'exento';
  } {
    return { deducibleAnual: 0, maxDeducible: 1500, tipoImpositivo: 'diferido' };
  }
}

export const planesInversionService = new PlanesInversionService();
