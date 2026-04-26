// src/services/patronGastosPersonalesService.ts
// V62 (TAREA 7 sub-tarea 3): store eliminado · stub para evitar romper consumers.
// Futuro: migrar a compromisosRecurrentes.

import { PatronGastoPersonal } from '../types/personal';

export const patronGastosPersonalesService = {
  async getAll(): Promise<PatronGastoPersonal[]> {
    return [];
  },

  async getAllForPersonalData(_personalDataId: number): Promise<PatronGastoPersonal[]> {
    return [];
  },

  async save(_patron: Partial<PatronGastoPersonal>): Promise<PatronGastoPersonal | null> {
    console.warn('[patronGastosPersonalesService] Store eliminado en V62 · operación no-op');
    return null;
  },

  async delete(_id: number): Promise<void> {
    console.warn('[patronGastosPersonalesService] Store eliminado en V62 · operación no-op');
  },

  async deleteByPersonalDataId(_personalDataId: number): Promise<void> {
    console.warn('[patronGastosPersonalesService] Store eliminado en V62 · operación no-op');
  },
};
