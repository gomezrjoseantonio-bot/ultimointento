// src/services/patronGastosPersonalesService.ts
// V62 (TAREA 7 sub-tarea 3): store eliminado · stub enriquecido para preservar API surface.
// Futuro: migrar a compromisosRecurrentes.

import { PatronGastoPersonal, PersonalData, PersonalExpense, PersonalExpenseFrequency } from '../types/personal';

class PatronGastosPersonalesService {
  async getPatrones(_personalDataId: number): Promise<PatronGastoPersonal[]> {
    return [];
  }

  async savePatron(_patron: Omit<PatronGastoPersonal, 'id' | 'createdAt' | 'updatedAt' | 'origen'> & { origen?: 'perfil' | 'manual' }): Promise<PatronGastoPersonal> {
    console.warn('[patronGastosPersonalesService] Store eliminado en V62 · operación no-op');
    const now = new Date().toISOString();
    return { ..._patron, id: 0, origen: _patron.origen ?? 'manual', createdAt: now, updatedAt: now };
  }

  async updatePatron(_id: number, _data: Omit<PatronGastoPersonal, 'id' | 'createdAt' | 'updatedAt' | 'origen'> & { origen?: 'perfil' | 'manual' }): Promise<PatronGastoPersonal> {
    console.warn('[patronGastosPersonalesService] Store eliminado en V62 · operación no-op');
    const now = new Date().toISOString();
    return { ..._data, id: _id, origen: _data.origen ?? 'manual', createdAt: now, updatedAt: now };
  }

  async deletePatron(_id: number): Promise<void> {
    console.warn('[patronGastosPersonalesService] Store eliminado en V62 · operación no-op');
  }

  calcularImporteMensual(patron: PatronGastoPersonal | PersonalExpense): number {
    if (!patron.activo) return 0;
    if (patron.frecuencia === 'meses_especificos') {
      if (patron.asymmetricPayments && patron.asymmetricPayments.length > 0) {
        const annual = patron.asymmetricPayments.reduce((sum, p) => sum + p.importe, 0);
        return annual / 12;
      }
      const months = patron.mesesCobro?.length ?? 0;
      return months > 0 ? (patron.importe * months) / 12 : 0;
    }
    const factors: Record<Exclude<PersonalExpenseFrequency, 'meses_especificos'>, number> = {
      semanal: 52 / 12,
      mensual: 1,
      bimestral: 1 / 2,
      trimestral: 1 / 3,
      semestral: 1 / 6,
      anual: 1 / 12,
    };
    return patron.importe * (factors[patron.frecuencia as Exclude<PersonalExpenseFrequency, 'meses_especificos'>] ?? 0);
  }

  async calcularTotalMensual(_personalDataId: number): Promise<number> {
    return 0;
  }

  getSugeridosPorPerfil(_personalDataId: number, _profile?: PersonalData | null): Omit<PatronGastoPersonal, 'id' | 'createdAt' | 'updatedAt'>[] {
    return [];
  }

  async loadTemplatePatrones(_personalDataId: number, _profile?: PersonalData | null): Promise<void> {
    console.warn('[patronGastosPersonalesService] Store eliminado en V62 · operación no-op');
  }

  async smartMergeTemplatePatrones(_personalDataId: number, _profile?: PersonalData | null): Promise<void> {
    console.warn('[patronGastosPersonalesService] Store eliminado en V62 · operación no-op');
  }

  async smartSyncTemplatePatrones(_personalDataId: number, _profile?: PersonalData | null): Promise<void> {
    console.warn('[patronGastosPersonalesService] Store eliminado en V62 · operación no-op');
  }

  async getExpenses(personalDataId: number): Promise<PatronGastoPersonal[]> {
    return this.getPatrones(personalDataId);
  }

  // Legacy method names for backward compatibility
  async getAll(): Promise<PatronGastoPersonal[]> {
    return [];
  }

  async getAllForPersonalData(personalDataId: number): Promise<PatronGastoPersonal[]> {
    return this.getPatrones(personalDataId);
  }

  async save(patron: Partial<PatronGastoPersonal>): Promise<PatronGastoPersonal | null> {
    console.warn('[patronGastosPersonalesService] Store eliminado en V62 · operación no-op');
    return null;
  }

  async delete(id: number): Promise<void> {
    return this.deletePatron(id);
  }

  async deleteByPersonalDataId(_personalDataId: number): Promise<void> {
    console.warn('[patronGastosPersonalesService] Store eliminado en V62 · operación no-op');
  }
}

export const patronGastosPersonalesService = new PatronGastosPersonalesService();

