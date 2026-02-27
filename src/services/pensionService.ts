import { initDB } from './db';
import { PensionIngreso, CalculoPensionResult } from '../types/personal';

class PensionService {
  private db: any = null;

  private async getDB() {
    if (!this.db) {
      this.db = await initDB();
    }
    return this.db;
  }

  /**
   * Get all pensions for a personal data ID
   */
  async getPensiones(personalDataId: number): Promise<PensionIngreso[]> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(['pensiones'], 'readonly');
      const store = transaction.objectStore('pensiones');
      const index = store.index('personalDataId');
      const pensiones = await index.getAll(personalDataId);
      return pensiones || [];
    } catch (error) {
      console.error('Error getting pensiones:', error);
      return [];
    }
  }

  /**
   * Save a new pension
   */
  async savePension(pension: Omit<PensionIngreso, 'id' | 'fechaCreacion' | 'fechaActualizacion'>): Promise<PensionIngreso> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(['pensiones'], 'readwrite');
      const store = tx.objectStore('pensiones');

      const now = new Date().toISOString();
      const newPension: PensionIngreso = {
        ...pension,
        fechaCreacion: now,
        fechaActualizacion: now,
      };

      const result = await store.add(newPension);
      newPension.id = result as number;

      await tx.done;
      return newPension;
    } catch (error) {
      this.db = null;
      console.error('Error saving pension:', error);
      throw error;
    }
  }

  /**
   * Update an existing pension
   */
  async updatePension(id: number, updates: Partial<PensionIngreso>): Promise<PensionIngreso> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(['pensiones'], 'readwrite');
      const store = tx.objectStore('pensiones');

      const existing = await store.get(id);
      if (!existing) {
        throw new Error('Pensión no encontrada');
      }

      const updated: PensionIngreso = {
        ...existing,
        ...updates,
        fechaActualizacion: new Date().toISOString(),
      };

      await store.put(updated);
      await tx.done;
      return updated;
    } catch (error) {
      this.db = null;
      console.error('Error updating pension:', error);
      throw error;
    }
  }

  /**
   * Delete a pension by ID
   */
  async deletePension(id: number): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(['pensiones'], 'readwrite');
      const store = tx.objectStore('pensiones');
      await store.delete(id);
      await tx.done;
    } catch (error) {
      this.db = null;
      console.error('Error deleting pension:', error);
      throw error;
    }
  }

  /**
   * Calculate net pension amounts
   */
  calculatePension(pension: PensionIngreso): CalculoPensionResult {
    const retencionAnual = pension.pensionBrutaAnual * (pension.irpfPorcentaje / 100);
    const netoAnual = pension.pensionBrutaAnual - retencionAnual;
    const netoMensual = netoAnual / 12;

    return { netoMensual, netoAnual, retencionAnual };
  }
}

export const pensionService = new PensionService();
