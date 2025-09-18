import { initDB } from './db';
import { 
  Nomina, 
  Variable, 
  ReglaDia, 
  CalculoNominaResult,
  DistribucionMensualResult
} from '../types/personal';

class NominaService {
  private db: any = null;

  private async getDB() {
    if (!this.db) {
      this.db = await initDB();
    }
    return this.db;
  }

  /**
   * Get all nominas for a personal data ID
   */
  async getNominas(personalDataId: number): Promise<Nomina[]> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(['nominas'], 'readonly');
      const store = transaction.objectStore('nominas');
      const index = store.index('personalDataId');
      const nominas = await index.getAll(personalDataId);
      return nominas || [];
    } catch (error) {
      console.error('Error getting nominas:', error);
      return [];
    }
  }

  /**
   * Get active nomina for a personal data ID
   */
  async getActivaNomina(personalDataId: number): Promise<Nomina | null> {
    try {
      const nominas = await this.getNominas(personalDataId);
      return nominas.find(n => n.activa) || null;
    } catch (error) {
      console.error('Error getting active nomina:', error);
      return null;
    }
  }

  /**
   * Save or update a nomina
   */
  async saveNomina(nomina: Omit<Nomina, 'id' | 'fechaCreacion' | 'fechaActualizacion'>): Promise<Nomina> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(['nominas'], 'readwrite');
      const store = transaction.objectStore('nominas');
      
      const now = new Date().toISOString();
      
      // If setting as active, deactivate other nominas for the same personalDataId
      if (nomina.activa) {
        await this.deactivateOtherNominas(nomina.personalDataId, undefined);
      }
      
      const newNomina: Nomina = {
        ...nomina,
        fechaCreacion: now,
        fechaActualizacion: now
      };

      const result = await store.add(newNomina);
      newNomina.id = result;
      
      await transaction.complete;
      return newNomina;
    } catch (error) {
      console.error('Error saving nomina:', error);
      throw error;
    }
  }

  /**
   * Update an existing nomina
   */
  async updateNomina(id: number, updates: Partial<Nomina>): Promise<Nomina> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(['nominas'], 'readwrite');
      const store = transaction.objectStore('nominas');
      
      const existing = await store.get(id);
      if (!existing) {
        throw new Error('Nomina not found');
      }

      // If setting as active, deactivate other nominas for the same personalDataId
      if (updates.activa) {
        await this.deactivateOtherNominas(existing.personalDataId, id);
      }

      const updated: Nomina = {
        ...existing,
        ...updates,
        fechaActualizacion: new Date().toISOString()
      };

      await store.put(updated);
      await transaction.complete;
      
      return updated;
    } catch (error) {
      console.error('Error updating nomina:', error);
      throw error;
    }
  }

  /**
   * Delete a nomina
   */
  async deleteNomina(id: number): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(['nominas'], 'readwrite');
      const store = transaction.objectStore('nominas');
      
      await store.delete(id);
      await transaction.complete;
    } catch (error) {
      console.error('Error deleting nomina:', error);
      throw error;
    }
  }

  /**
   * Deactivate other nominas for the same personal data ID
   */
  private async deactivateOtherNominas(personalDataId: number, excludeId?: number): Promise<void> {
    try {
      const nominas = await this.getNominas(personalDataId);
      const db = await this.getDB();
      const transaction = db.transaction(['nominas'], 'readwrite');
      const store = transaction.objectStore('nominas');

      for (const nomina of nominas) {
        if (nomina.id !== excludeId && nomina.activa) {
          const updated = { ...nomina, activa: false, fechaActualizacion: new Date().toISOString() };
          await store.put(updated);
        }
      }

      await transaction.complete;
    } catch (error) {
      console.error('Error deactivating other nominas:', error);
      throw error;
    }
  }

  /**
   * Calculate net monthly salary and distribution
   */
  calculateSalary(nomina: Nomina): CalculoNominaResult {
    const { salarioBrutoAnual, distribucion, variables, bonus } = nomina;
    
    // Calculate base monthly salary
    const mesesDistribucion = distribucion.tipo === 'personalizado' ? 
      (distribucion.meses || 12) : 
      (distribucion.tipo === 'catorce' ? 14 : 12);
    
    const salarioBaseMensual = salarioBrutoAnual / mesesDistribucion;
    
    // Generate monthly distribution
    const distribuccionMensual: DistribucionMensualResult[] = [];
    let totalAnualNeto = 0;
    
    for (let mes = 1; mes <= 12; mes++) {
      // Base salary (distributed according to configuration)
      let salarioBase = 0;
      if (mesesDistribucion === 12) {
        salarioBase = salarioBaseMensual;
      } else if (mesesDistribucion === 14) {
        // 12 months of base salary + 2 extra payments in June and December
        salarioBase = salarioBaseMensual;
        if (mes === 6 || mes === 12) {
          salarioBase += salarioBaseMensual;
        }
      } else {
        // Custom distribution - distribute evenly across specified months
        salarioBase = salarioBaseMensual;
      }
      
      // Variables for this month
      const variablesDelMes = variables.reduce((total, variable) => {
        const distribucionMes = variable.distribucionMeses.find(d => d.mes === mes);
        if (distribucionMes) {
          const variableAnual = variable.tipo === 'porcentaje' ? 
            (salarioBrutoAnual * variable.valor / 100) : 
            variable.valor;
          return total + (variableAnual * distribucionMes.porcentaje / 100);
        }
        return total;
      }, 0);
      
      // Bonus for this month
      const bonusDelMes = bonus
        .filter(b => b.mes === mes)
        .reduce((total, b) => total + b.importe, 0);
      
      // Total bruto mensual
      const bruteMensual = salarioBase + variablesDelMes + bonusDelMes;
      
      // Simplified net calculation (approximation)
      // In a real implementation, this would include tax calculations
      const netoMensual = this.calculateNetFromBruto(bruteMensual);
      
      distribuccionMensual.push({
        mes,
        salarioBase,
        variables: variablesDelMes,
        bonus: bonusDelMes,
        netoTotal: netoMensual
      });
      
      totalAnualNeto += netoMensual;
    }
    
    const netoMensualPromedio = totalAnualNeto / 12;
    
    return {
      netoMensual: netoMensualPromedio,
      distribuccionMensual,
      totalAnualNeto
    };
  }

  /**
   * Simplified net salary calculation
   * In a real implementation, this would use official tax tables
   */
  private calculateNetFromBruto(brutoMensual: number): number {
    // Simplified calculation assuming ~25% total deductions
    // This includes IRPF, Social Security, unemployment insurance, etc.
    const deductionRate = 0.25;
    return brutoMensual * (1 - deductionRate);
  }

  /**
   * Validate variable distribution
   */
  validateVariableDistribution(variable: Variable): { isValid: boolean; error?: string } {
    const totalPorcentaje = variable.distribucionMeses.reduce((total, d) => total + d.porcentaje, 0);
    
    if (totalPorcentaje === 0) {
      return { isValid: false, error: 'Debe distribuir al menos en un mes' };
    }
    
    // Allow distribution to be less than or greater than 100%
    if (totalPorcentaje !== 100) {
      return { 
        isValid: true, 
        error: `La distribución suma ${totalPorcentaje}% (se permite diferente de 100%)` 
      };
    }
    
    return { isValid: true };
  }

  /**
   * Get next payment date based on payment rules
   */
  getNextPaymentDate(reglasDia: ReglaDia, currentDate: Date = new Date()): Date {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    switch (reglasDia.tipo) {
      case 'fijo':
        const day = reglasDia.dia || 1;
        const fixedDate = new Date(year, month, day);
        
        // If the date has passed this month, get next month
        if (fixedDate <= currentDate) {
          return new Date(year, month + 1, day);
        }
        return fixedDate;
        
      case 'ultimo-habil':
        return this.getLastBusinessDay(year, month);
        
      case 'n-esimo-habil':
        const position = reglasDia.posicion || -1;
        return this.getNthBusinessDay(year, month, position);
        
      default:
        return new Date(year, month + 1, 1); // First day of next month as fallback
    }
  }

  /**
   * Get last business day of the month
   */
  private getLastBusinessDay(year: number, month: number): Date {
    const lastDay = new Date(year, month + 1, 0); // Last day of current month
    
    while (lastDay.getDay() === 0 || lastDay.getDay() === 6) { // Sunday or Saturday
      lastDay.setDate(lastDay.getDate() - 1);
    }
    
    return lastDay;
  }

  /**
   * Get nth business day from end of month
   * Negative position means counting from end (e.g., -1 = last, -2 = penultimate)
   */
  private getNthBusinessDay(year: number, month: number, position: number): Date {
    if (position >= 0) {
      // Count from beginning of month
      const firstDay = new Date(year, month, 1);
      let businessDays = 0;
      let currentDay = new Date(firstDay);
      
      while (businessDays < position) {
        if (currentDay.getDay() !== 0 && currentDay.getDay() !== 6) {
          businessDays++;
        }
        if (businessDays < position) {
          currentDay.setDate(currentDay.getDate() + 1);
        }
      }
      
      return currentDay;
    } else {
      // Count from end of month
      const lastBusinessDay = this.getLastBusinessDay(year, month);
      let businessDays = 1;
      let currentDay = new Date(lastBusinessDay);
      
      while (businessDays < Math.abs(position)) {
        currentDay.setDate(currentDay.getDate() - 1);
        if (currentDay.getDay() !== 0 && currentDay.getDay() !== 6) {
          businessDays++;
        }
      }
      
      return currentDay;
    }
  }
}

export const nominaService = new NominaService();