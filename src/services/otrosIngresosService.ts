import { initDB } from './db';
import { 
  OtrosIngresos
} from '../types/personal';

class OtrosIngresosService {
  private db: any = null;

  private async getDB() {
    if (!this.db) {
      this.db = await initDB();
    }
    return this.db;
  }

  /**
   * Get all other income sources for a personal data ID
   */
  async getOtrosIngresos(personalDataId: number): Promise<OtrosIngresos[]> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(['otrosIngresos'], 'readonly');
      const store = transaction.objectStore('otrosIngresos');
      const index = store.index('personalDataId');
      const ingresos = await index.getAll(personalDataId);
      return ingresos || [];
    } catch (error) {
      console.error('Error getting otros ingresos:', error);
      return [];
    }
  }

  /**
   * Get active income sources
   */
  async getIngresosActivos(personalDataId: number): Promise<OtrosIngresos[]> {
    try {
      const ingresos = await this.getOtrosIngresos(personalDataId);
      return ingresos.filter(ingreso => ingreso.activo);
    } catch (error) {
      console.error('Error getting active ingresos:', error);
      return [];
    }
  }

  /**
   * Save or update an income source
   */
  async saveIngreso(ingreso: Omit<OtrosIngresos, 'id' | 'fechaCreacion' | 'fechaActualizacion'>): Promise<OtrosIngresos> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(['otrosIngresos'], 'readwrite');
      const store = transaction.objectStore('otrosIngresos');
      
      const now = new Date().toISOString();
      
      const newIngreso: OtrosIngresos = {
        ...ingreso,
        fechaCreacion: now,
        fechaActualizacion: now
      };

      const result = await store.add(newIngreso);
      newIngreso.id = result;
      
      await transaction.complete;
      return newIngreso;
    } catch (error) {
      console.error('Error saving ingreso:', error);
      throw error;
    }
  }

  /**
   * Update an existing income source
   */
  async updateIngreso(id: number, updates: Partial<OtrosIngresos>): Promise<OtrosIngresos> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(['otrosIngresos'], 'readwrite');
      const store = transaction.objectStore('otrosIngresos');
      
      const existing = await store.get(id);
      if (!existing) {
        throw new Error('Ingreso not found');
      }

      const updated: OtrosIngresos = {
        ...existing,
        ...updates,
        fechaActualizacion: new Date().toISOString()
      };

      await store.put(updated);
      await transaction.complete;
      
      return updated;
    } catch (error) {
      console.error('Error updating ingreso:', error);
      throw error;
    }
  }

  /**
   * Delete an income source
   */
  async deleteIngreso(id: number): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(['otrosIngresos'], 'readwrite');
      const store = transaction.objectStore('otrosIngresos');
      
      await store.delete(id);
      await transaction.complete;
    } catch (error) {
      console.error('Error deleting ingreso:', error);
      throw error;
    }
  }

  /**
   * Calculate monthly income from recurring sources
   */
  calculateMonthlyIncome(ingresos: OtrosIngresos[]): number {
    return ingresos
      .filter(ingreso => ingreso.activo && ingreso.frecuencia !== 'unico')
      .reduce((total, ingreso) => {
        switch (ingreso.frecuencia) {
          case 'mensual':
            return total + ingreso.importe;
          case 'trimestral':
            return total + (ingreso.importe / 3);
          case 'semestral':
            return total + (ingreso.importe / 6);
          case 'anual':
            return total + (ingreso.importe / 12);
          default:
            return total;
        }
      }, 0);
  }

  /**
   * Calculate annual income from all sources
   */
  calculateAnnualIncome(ingresos: OtrosIngresos[]): number {
    return ingresos
      .filter(ingreso => ingreso.activo)
      .reduce((total, ingreso) => {
        switch (ingreso.frecuencia) {
          case 'mensual':
            return total + (ingreso.importe * 12);
          case 'trimestral':
            return total + (ingreso.importe * 4);
          case 'semestral':
            return total + (ingreso.importe * 2);
          case 'anual':
          case 'unico':
            return total + ingreso.importe;
          default:
            return total;
        }
      }, 0);
  }

  /**
   * Get income sources by type
   */
  async getIngresosByTipo(personalDataId: number, tipo: OtrosIngresos['tipo']): Promise<OtrosIngresos[]> {
    try {
      const ingresos = await this.getOtrosIngresos(personalDataId);
      return ingresos.filter(ingreso => ingreso.tipo === tipo);
    } catch (error) {
      console.error('Error getting ingresos by tipo:', error);
      return [];
    }
  }

  /**
   * Get income sources by titularidad
   */
  async getIngresosByTitularidad(personalDataId: number, titularidad: OtrosIngresos['titularidad']): Promise<OtrosIngresos[]> {
    try {
      const ingresos = await this.getOtrosIngresos(personalDataId);
      return ingresos.filter(ingreso => ingreso.titularidad === titularidad);
    } catch (error) {
      console.error('Error getting ingresos by titularidad:', error);
      return [];
    }
  }

  /**
   * Get next payment date for an income source
   */
  getNextPaymentDate(ingreso: OtrosIngresos): Date | null {
    if (!ingreso.activo || ingreso.frecuencia === 'unico') {
      return null;
    }

    const today = new Date();
    const nextDate = new Date(today);
    
    switch (ingreso.frecuencia) {
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
      default:
        return null;
    }
    
    // Apply day rules
    switch (ingreso.reglasDia.tipo) {
      case 'fijo':
        nextDate.setDate(ingreso.reglasDia.dia || 1);
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
   * Calculate income summary by type
   */
  getIncomeSummaryByType(ingresos: OtrosIngresos[]): {
    dividendos: { mensual: number; anual: number; count: number };
    intereses: { mensual: number; anual: number; count: number };
    fondosIndexados: { mensual: number; anual: number; count: number };
    otros: { mensual: number; anual: number; count: number };
    total: { mensual: number; anual: number; count: number };
  } {
    const activeIngresos = ingresos.filter(i => i.activo);
    
    const dividendos = activeIngresos.filter(i => i.tipo === 'dividendos');
    const intereses = activeIngresos.filter(i => i.tipo === 'intereses');
    const fondosIndexados = activeIngresos.filter(i => i.tipo === 'fondos-indexados');
    const otros = activeIngresos.filter(i => i.tipo === 'otros');
    
    return {
      dividendos: {
        mensual: this.calculateMonthlyIncome(dividendos),
        anual: this.calculateAnnualIncome(dividendos),
        count: dividendos.length
      },
      intereses: {
        mensual: this.calculateMonthlyIncome(intereses),
        anual: this.calculateAnnualIncome(intereses),
        count: intereses.length
      },
      fondosIndexados: {
        mensual: this.calculateMonthlyIncome(fondosIndexados),
        anual: this.calculateAnnualIncome(fondosIndexados),
        count: fondosIndexados.length
      },
      otros: {
        mensual: this.calculateMonthlyIncome(otros),
        anual: this.calculateAnnualIncome(otros),
        count: otros.length
      },
      total: {
        mensual: this.calculateMonthlyIncome(activeIngresos),
        anual: this.calculateAnnualIncome(activeIngresos),
        count: activeIngresos.length
      }
    };
  }

  /**
   * Get tax implications for different income types
   */
  getTaxImplications(ingreso: OtrosIngresos): {
    retencion: number;
    declaracionAnual: boolean;
    tipoRendimiento: 'capital-mobiliario' | 'actividades-economicas' | 'otros';
  } {
    // Simplified tax calculation - in real implementation would be more complex
    switch (ingreso.tipo) {
      case 'dividendos':
        return {
          retencion: 19, // General rate for dividends
          declaracionAnual: true,
          tipoRendimiento: 'capital-mobiliario'
        };
      case 'intereses':
        return {
          retencion: 19, // General rate for interest
          declaracionAnual: true,
          tipoRendimiento: 'capital-mobiliario'
        };
      case 'fondos-indexados':
        return {
          retencion: 0, // Usually no withholding until sale
          declaracionAnual: false, // Unless sold
          tipoRendimiento: 'capital-mobiliario'
        };
      default:
        return {
          retencion: 15, // Conservative estimate
          declaracionAnual: true,
          tipoRendimiento: 'otros'
        };
    }
  }
}

export const otrosIngresosService = new OtrosIngresosService();