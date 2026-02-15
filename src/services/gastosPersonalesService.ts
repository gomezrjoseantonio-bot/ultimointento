import { initDB } from './db';
import { GastoRecurrente, GastoPuntual, CategoriaGasto } from '../types/personal';

class GastosPersonalesService {
  private db: any = null;

  private async getDB() {
    if (!this.db) {
      this.db = await initDB();
    }
    return this.db;
  }

  // ============================================================================
  // CRUD Gastos Recurrentes
  // ============================================================================

  /**
   * Get all recurring expenses for a personal data ID
   */
  async getGastosRecurrentes(personalDataId: number): Promise<GastoRecurrente[]> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(['gastosRecurrentes'], 'readonly');
      const store = transaction.objectStore('gastosRecurrentes');
      const index = store.index('personalDataId');
      const gastos = await index.getAll(personalDataId);
      return gastos || [];
    } catch (error) {
      console.error('Error getting gastos recurrentes:', error);
      return [];
    }
  }

  /**
   * Get active recurring expenses for a personal data ID
   */
  async getGastosRecurrentesActivos(personalDataId: number): Promise<GastoRecurrente[]> {
    try {
      const gastos = await this.getGastosRecurrentes(personalDataId);
      return gastos.filter(g => g.activo);
    } catch (error) {
      console.error('Error getting active gastos recurrentes:', error);
      return [];
    }
  }

  /**
   * Save a new recurring expense
   */
  async saveGastoRecurrente(gasto: Omit<GastoRecurrente, 'id' | 'fechaCreacion' | 'fechaActualizacion'>): Promise<GastoRecurrente> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(['gastosRecurrentes'], 'readwrite');
      const store = tx.objectStore('gastosRecurrentes');
      
      const now = new Date().toISOString();
      const newGasto: GastoRecurrente = {
        ...gasto,
        fechaCreacion: now,
        fechaActualizacion: now
      };

      const result = await store.add(newGasto);
      newGasto.id = result as number;
      
      await tx.done;
      return newGasto;
    } catch (error) {
      this.db = null;
      console.error('Error saving gasto recurrente:', error);
      throw error;
    }
  }

  /**
   * Update an existing recurring expense
   */
  async updateGastoRecurrente(id: number, updates: Partial<GastoRecurrente>): Promise<GastoRecurrente> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(['gastosRecurrentes'], 'readwrite');
      const store = tx.objectStore('gastosRecurrentes');
      
      const existing = await store.get(id);
      if (!existing) {
        throw new Error('Gasto recurrente not found');
      }

      const updated: GastoRecurrente = {
        ...existing,
        ...updates,
        fechaActualizacion: new Date().toISOString()
      };

      await store.put(updated);
      await tx.done;
      
      return updated;
    } catch (error) {
      this.db = null;
      console.error('Error updating gasto recurrente:', error);
      throw error;
    }
  }

  /**
   * Delete a recurring expense
   */
  async deleteGastoRecurrente(id: number): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(['gastosRecurrentes'], 'readwrite');
      const store = tx.objectStore('gastosRecurrentes');
      
      await store.delete(id);
      await tx.done;
    } catch (error) {
      this.db = null;
      console.error('Error deleting gasto recurrente:', error);
      throw error;
    }
  }

  /**
   * Toggle active status of a recurring expense
   */
  async toggleGastoRecurrenteActivo(id: number): Promise<GastoRecurrente> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(['gastosRecurrentes'], 'readwrite');
      const store = tx.objectStore('gastosRecurrentes');
      
      const gasto = await store.get(id);
      if (!gasto) {
        throw new Error('Gasto recurrente not found');
      }

      gasto.activo = !gasto.activo;
      gasto.fechaActualizacion = new Date().toISOString();
      
      await store.put(gasto);
      await tx.done;
      
      return gasto;
    } catch (error) {
      this.db = null;
      console.error('Error toggling gasto recurrente:', error);
      throw error;
    }
  }

  // ============================================================================
  // CRUD Gastos Puntuales
  // ============================================================================

  /**
   * Get one-time expenses for a personal data ID
   * Optionally filter by month and year
   */
  async getGastosPuntuales(personalDataId: number, mes?: number, anio?: number): Promise<GastoPuntual[]> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(['gastosPuntuales'], 'readonly');
      const store = transaction.objectStore('gastosPuntuales');
      const index = store.index('personalDataId');
      const gastos = await index.getAll(personalDataId);
      
      if (mes !== undefined && anio !== undefined) {
        return gastos.filter((g: GastoPuntual) => {
          const fecha = new Date(g.fecha);
          return fecha.getMonth() + 1 === mes && fecha.getFullYear() === anio;
        });
      }
      
      return gastos || [];
    } catch (error) {
      console.error('Error getting gastos puntuales:', error);
      return [];
    }
  }

  /**
   * Save a new one-time expense
   */
  async saveGastoPuntual(gasto: Omit<GastoPuntual, 'id' | 'fechaCreacion'>): Promise<GastoPuntual> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(['gastosPuntuales'], 'readwrite');
      const store = tx.objectStore('gastosPuntuales');
      
      const now = new Date().toISOString();
      const newGasto: GastoPuntual = {
        ...gasto,
        fechaCreacion: now
      };

      const result = await store.add(newGasto);
      newGasto.id = result as number;
      
      await tx.done;
      return newGasto;
    } catch (error) {
      this.db = null;
      console.error('Error saving gasto puntual:', error);
      throw error;
    }
  }

  /**
   * Delete a one-time expense
   */
  async deleteGastoPuntual(id: number): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(['gastosPuntuales'], 'readwrite');
      const store = tx.objectStore('gastosPuntuales');
      
      await store.delete(id);
      await tx.done;
    } catch (error) {
      this.db = null;
      console.error('Error deleting gasto puntual:', error);
      throw error;
    }
  }

  // ============================================================================
  // Cálculos
  // ============================================================================

  /**
   * Calculate total expenses for a specific month
   */
  async calcularTotalGastosMes(personalDataId: number, mes: number, anio: number): Promise<{
    recurrentes: number;
    puntuales: number;
    total: number;
    porCategoria: Record<CategoriaGasto, number>;
  }> {
    try {
      // Get active recurring expenses
      const recurrentes = await this.getGastosRecurrentesActivos(personalDataId);
      
      // Get one-time expenses for the month
      const puntuales = await this.getGastosPuntuales(personalDataId, mes, anio);
      
      // Calculate recurring expenses for the month
      const totalRecurrentes = recurrentes.reduce((sum, gasto) => {
        const importeMensual = this.calcularImporteMensual(gasto);
        return sum + importeMensual;
      }, 0);
      
      // Calculate one-time expenses
      const totalPuntuales = puntuales.reduce((sum, gasto) => sum + gasto.importe, 0);
      
      // Calculate by category
      const porCategoria: Record<CategoriaGasto, number> = {
        vivienda: 0,
        suministros: 0,
        transporte: 0,
        seguros: 0,
        suscripciones: 0,
        salud: 0,
        educacion: 0,
        otros: 0
      };
      
      recurrentes.forEach(gasto => {
        const importeMensual = this.calcularImporteMensual(gasto);
        porCategoria[gasto.categoria] += importeMensual;
      });
      
      puntuales.forEach(gasto => {
        porCategoria[gasto.categoria] += gasto.importe;
      });
      
      return {
        recurrentes: totalRecurrentes,
        puntuales: totalPuntuales,
        total: totalRecurrentes + totalPuntuales,
        porCategoria
      };
    } catch (error) {
      console.error('Error calculating total gastos mes:', error);
      return {
        recurrentes: 0,
        puntuales: 0,
        total: 0,
        porCategoria: {
          vivienda: 0,
          suministros: 0,
          transporte: 0,
          seguros: 0,
          suscripciones: 0,
          salud: 0,
          educacion: 0,
          otros: 0
        }
      };
    }
  }

  /**
   * Calculate monthly amount for a recurring expense
   */
  private calcularImporteMensual(gasto: GastoRecurrente): number {
    switch (gasto.frecuencia) {
      case 'mensual':
        return gasto.importe;
      case 'bimestral':
        return gasto.importe / 2;
      case 'trimestral':
        return gasto.importe / 3;
      case 'semestral':
        return gasto.importe / 6;
      case 'anual':
        return gasto.importe / 12;
      default:
        return 0;
    }
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  /**
   * Get Lucide icon name for a category
   */
  getCategoriaIcon(categoria: CategoriaGasto): string {
    const iconMap: Record<CategoriaGasto, string> = {
      vivienda: 'Home',
      suministros: 'Zap',
      transporte: 'Car',
      seguros: 'Shield',
      suscripciones: 'Tv',
      salud: 'Heart',
      educacion: 'GraduationCap',
      otros: 'MoreHorizontal'
    };
    return iconMap[categoria] || 'MoreHorizontal';
  }

  /**
   * Get label for a category
   */
  getCategoriaLabel(categoria: CategoriaGasto): string {
    const labelMap: Record<CategoriaGasto, string> = {
      vivienda: 'Vivienda',
      suministros: 'Suministros',
      transporte: 'Transporte',
      seguros: 'Seguros',
      suscripciones: 'Suscripciones',
      salud: 'Salud',
      educacion: 'Educación',
      otros: 'Otros'
    };
    return labelMap[categoria] || 'Otros';
  }

  /**
   * Get all categories
   */
  getCategorias(): { value: CategoriaGasto; label: string; icon: string }[] {
    const categorias: CategoriaGasto[] = [
      'vivienda',
      'suministros',
      'transporte',
      'seguros',
      'suscripciones',
      'salud',
      'educacion',
      'otros'
    ];
    
    return categorias.map(cat => ({
      value: cat,
      label: this.getCategoriaLabel(cat),
      icon: this.getCategoriaIcon(cat)
    }));
  }
}

export const gastosPersonalesService = new GastosPersonalesService();
