import { initDB } from './db';
import { PensionIngreso, CalculoPensionResult } from '../types/personal';

/**
 * V63 (TAREA 7 sub-tarea 4): el store legacy `pensiones` ha sido eliminado.
 * Los registros viven ahora en el store unificado `ingresos` con
 * `tipo='pension'`. Este servicio actúa como adaptador.
 */
const STORE = 'ingresos' as const;
const TIPO = 'pension' as const;

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
      const transaction = db.transaction([STORE], 'readonly');
      const store = transaction.objectStore(STORE);
      const index = store.index('personalDataId');
      const all = (await index.getAll(personalDataId)) as Array<any>;
      return all
        .filter((r) => r.tipo === TIPO)
        .map(({ tipo, ...rest }) => {
          void tipo;
          return rest as PensionIngreso;
        });
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
      const tx = db.transaction([STORE], 'readwrite');
      const store = tx.objectStore(STORE);

      const now = new Date().toISOString();
      const stored = {
        ...pension,
        tipo: TIPO,
        fechaCreacion: now,
        fechaActualizacion: now,
      };

      const result = await store.add(stored);
      const newPension: PensionIngreso = {
        ...pension,
        id: result as number,
        fechaCreacion: now,
        fechaActualizacion: now,
      };

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
      const tx = db.transaction([STORE], 'readwrite');
      const store = tx.objectStore(STORE);

      const existing = await store.get(id);
      if (!existing || existing.tipo !== TIPO) {
        throw new Error('Pensión no encontrada');
      }

      const updated = {
        ...existing,
        ...updates,
        tipo: TIPO,
        fechaActualizacion: new Date().toISOString(),
      };

      await store.put(updated);
      await tx.done;
      const { tipo, ...rest } = updated;
      void tipo;
      return rest as PensionIngreso;
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
      const tx = db.transaction([STORE], 'readwrite');
      const store = tx.objectStore(STORE);
      const existing = await store.get(id);
      if (existing && existing.tipo !== TIPO) {
        await tx.done;
        return;
      }
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
