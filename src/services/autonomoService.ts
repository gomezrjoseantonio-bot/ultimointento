import { initDB } from './db';
import { 
  Autonomo, 
  IngresosAutonomo, 
  GastoDeducible, 
  CalculoAutonomoResult 
} from '../types/personal';

class AutonomoService {
  private db: any = null;

  private async getDB() {
    if (!this.db) {
      this.db = await initDB();
    }
    return this.db;
  }

  /**
   * Get all autonomos for a personal data ID
   */
  async getAutonomos(personalDataId: number): Promise<Autonomo[]> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(['autonomos'], 'readonly');
      const store = transaction.objectStore('autonomos');
      const index = store.index('personalDataId');
      const autonomos = await index.getAll(personalDataId);
      return autonomos || [];
    } catch (error) {
      console.error('Error getting autonomos:', error);
      return [];
    }
  }

  /**
   * Get active autonomo for a personal data ID
   */
  async getActivoAutonomo(personalDataId: number): Promise<Autonomo | null> {
    try {
      const autonomos = await this.getAutonomos(personalDataId);
      return autonomos.find(a => a.activo) || null;
    } catch (error) {
      console.error('Error getting active autonomo:', error);
      return null;
    }
  }

  /**
   * Save or update an autonomo
   */
  async saveAutonomo(autonomo: Omit<Autonomo, 'id' | 'fechaCreacion' | 'fechaActualizacion'>): Promise<Autonomo> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(['autonomos'], 'readwrite');
      const store = transaction.objectStore('autonomos');
      
      const now = new Date().toISOString();
      
      // If setting as active, deactivate other autonomos for the same personalDataId
      if (autonomo.activo) {
        await this.deactivateOtherAutonomos(autonomo.personalDataId, undefined);
      }
      
      const newAutonomo: Autonomo = {
        ...autonomo,
        fechaCreacion: now,
        fechaActualizacion: now
      };

      const result = await store.add(newAutonomo);
      newAutonomo.id = result;
      
      await transaction.complete;
      return newAutonomo;
    } catch (error) {
      console.error('Error saving autonomo:', error);
      throw error;
    }
  }

  /**
   * Update an existing autonomo
   */
  async updateAutonomo(id: number, updates: Partial<Autonomo>): Promise<Autonomo> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(['autonomos'], 'readwrite');
      const store = transaction.objectStore('autonomos');
      
      const existing = await store.get(id);
      if (!existing) {
        throw new Error('Autonomo not found');
      }

      // If setting as active, deactivate other autonomos for the same personalDataId
      if (updates.activo) {
        await this.deactivateOtherAutonomos(existing.personalDataId, id);
      }

      const updated: Autonomo = {
        ...existing,
        ...updates,
        fechaActualizacion: new Date().toISOString()
      };

      await store.put(updated);
      await transaction.complete;
      
      return updated;
    } catch (error) {
      console.error('Error updating autonomo:', error);
      throw error;
    }
  }

  /**
   * Delete an autonomo
   */
  async deleteAutonomo(id: number): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(['autonomos'], 'readwrite');
      const store = transaction.objectStore('autonomos');
      
      await store.delete(id);
      await transaction.complete;
    } catch (error) {
      console.error('Error deleting autonomo:', error);
      throw error;
    }
  }

  /**
   * Deactivate other autonomos for the same personal data ID
   */
  private async deactivateOtherAutonomos(personalDataId: number, excludeId?: number): Promise<void> {
    try {
      const autonomos = await this.getAutonomos(personalDataId);
      const db = await this.getDB();
      const transaction = db.transaction(['autonomos'], 'readwrite');
      const store = transaction.objectStore('autonomos');

      for (const autonomo of autonomos) {
        if (autonomo.id !== excludeId && autonomo.activo) {
          const updated = { ...autonomo, activo: false, fechaActualizacion: new Date().toISOString() };
          await store.put(updated);
        }
      }

      await transaction.complete;
    } catch (error) {
      console.error('Error deactivating other autonomos:', error);
      throw error;
    }
  }

  /**
   * Calculate autonomo results for a specific month/year
   */
  calculateAutonomoResults(autonomo: Autonomo, year: number, month?: number): CalculoAutonomoResult {
    const { ingresosFacturados, gastosDeducibles, cuotaAutonomos } = autonomo;
    
    // Filter by month if specified, otherwise use entire year
    const ingresosFiltrados = month 
      ? ingresosFacturados.filter(i => new Date(i.fecha).getFullYear() === year && new Date(i.fecha).getMonth() + 1 === month)
      : ingresosFacturados.filter(i => new Date(i.fecha).getFullYear() === year);
    
    const gastosFiltrados = month
      ? gastosDeducibles.filter(g => new Date(g.fecha).getFullYear() === year && new Date(g.fecha).getMonth() + 1 === month)
      : gastosDeducibles.filter(g => new Date(g.fecha).getFullYear() === year);

    // Calculate total income (net of IVA for accurate calculation)
    const ingresosBrutos = ingresosFiltrados.reduce((total, ingreso) => {
      if (ingreso.conIva && ingreso.tipoIva) {
        // Remove IVA to get net income
        const baseImponible = ingreso.importe / (1 + ingreso.tipoIva / 100);
        return total + baseImponible;
      }
      return total + ingreso.importe;
    }, 0);

    // Calculate total deductible expenses
    const gastos = gastosFiltrados.reduce((total, gasto) => total + gasto.importe, 0);

    // Calculate autonomo fee (monthly or proportional)
    const cuotaPeriodo = month ? cuotaAutonomos : cuotaAutonomos * 12;

    // Calculate net result
    const resultadoNeto = ingresosBrutos - gastos - cuotaPeriodo;

    // Annual calculation
    const resultadoAnual = month 
      ? resultadoNeto * 12 // Extrapolate from month
      : resultadoNeto;

    return {
      resultadoNetoMensual: month ? resultadoNeto : resultadoNeto / 12,
      ingresosBrutos,
      gastos,
      cuotaAutonomos: cuotaPeriodo,
      resultadoAnual
    };
  }

  /**
   * Add income to autonomo
   */
  async addIngreso(autonomoId: number, ingreso: Omit<IngresosAutonomo, 'id'>): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(['autonomos'], 'readwrite');
      const store = transaction.objectStore('autonomos');
      
      const autonomo = await store.get(autonomoId);
      if (!autonomo) {
        throw new Error('Autonomo not found');
      }

      const newIngreso: IngresosAutonomo = {
        ...ingreso,
        id: Date.now().toString()
      };

      autonomo.ingresosFacturados.push(newIngreso);
      autonomo.fechaActualizacion = new Date().toISOString();

      await store.put(autonomo);
      await transaction.complete;
    } catch (error) {
      console.error('Error adding ingreso:', error);
      throw error;
    }
  }

  /**
   * Add expense to autonomo
   */
  async addGasto(autonomoId: number, gasto: Omit<GastoDeducible, 'id'>): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(['autonomos'], 'readwrite');
      const store = transaction.objectStore('autonomos');
      
      const autonomo = await store.get(autonomoId);
      if (!autonomo) {
        throw new Error('Autonomo not found');
      }

      const newGasto: GastoDeducible = {
        ...gasto,
        id: Date.now().toString()
      };

      autonomo.gastosDeducibles.push(newGasto);
      autonomo.fechaActualizacion = new Date().toISOString();

      await store.put(autonomo);
      await transaction.complete;
    } catch (error) {
      console.error('Error adding gasto:', error);
      throw error;
    }
  }

  /**
   * Remove income from autonomo
   */
  async removeIngreso(autonomoId: number, ingresoId: string): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(['autonomos'], 'readwrite');
      const store = transaction.objectStore('autonomos');
      
      const autonomo = await store.get(autonomoId);
      if (!autonomo) {
        throw new Error('Autonomo not found');
      }

      autonomo.ingresosFacturados = autonomo.ingresosFacturados.filter((i: IngresosAutonomo) => i.id !== ingresoId);
      autonomo.fechaActualizacion = new Date().toISOString();

      await store.put(autonomo);
      await transaction.complete;
    } catch (error) {
      console.error('Error removing ingreso:', error);
      throw error;
    }
  }

  /**
   * Remove expense from autonomo
   */
  async removeGasto(autonomoId: number, gastoId: string): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(['autonomos'], 'readwrite');
      const store = transaction.objectStore('autonomos');
      
      const autonomo = await store.get(autonomoId);
      if (!autonomo) {
        throw new Error('Autonomo not found');
      }

      autonomo.gastosDeducibles = autonomo.gastosDeducibles.filter((g: GastoDeducible) => g.id !== gastoId);
      autonomo.fechaActualizacion = new Date().toISOString();

      await store.put(autonomo);
      await transaction.complete;
    } catch (error) {
      console.error('Error removing gasto:', error);
      throw error;
    }
  }

  /**
   * Get quarterly summary for autonomo
   */
  getQuarterlySummary(autonomo: Autonomo, year: number, quarter: number): CalculoAutonomoResult {
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = quarter * 3;
    
    let totalIngresos = 0;
    let totalGastos = 0;
    
    for (let month = startMonth; month <= endMonth; month++) {
      const monthlyResult = this.calculateAutonomoResults(autonomo, year, month);
      totalIngresos += monthlyResult.ingresosBrutos;
      totalGastos += monthlyResult.gastos;
    }
    
    const cuotaTrimestral = autonomo.cuotaAutonomos * 3;
    const resultadoNeto = totalIngresos - totalGastos - cuotaTrimestral;
    
    return {
      resultadoNetoMensual: resultadoNeto / 3,
      ingresosBrutos: totalIngresos,
      gastos: totalGastos,
      cuotaAutonomos: cuotaTrimestral,
      resultadoAnual: resultadoNeto * 4 // Extrapolate to year
    };
  }
}

export const autonomoService = new AutonomoService();