// src/services/gastosPersonalesRealService.ts
// V62 (TAREA 7 sub-tarea 3): store eliminado · stub para evitar romper consumers.
// Futuro: usar movements + treasuryEvents.

import { GastoPersonalReal } from '../types/personal';

export const gastosPersonalesRealService = {
  async getAll(): Promise<GastoPersonalReal[]> {
    return [];
  },

  async getAllForPersonalData(_personalDataId: number): Promise<GastoPersonalReal[]> {
    return [];
  },

  async getByEjercicio(_personalDataId: number, _ejercicio: number): Promise<GastoPersonalReal[]> {
    return [];
  },

  async save(_gasto: Partial<GastoPersonalReal>): Promise<GastoPersonalReal | null> {
    console.warn('[gastosPersonalesRealService] Store eliminado en V62 · operación no-op');
    return null;
  },

  async delete(_id: number): Promise<void> {
    console.warn('[gastosPersonalesRealService] Store eliminado en V62 · operación no-op');
  },
};
