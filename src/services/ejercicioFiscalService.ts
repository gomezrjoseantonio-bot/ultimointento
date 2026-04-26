// src/services/ejercicioFiscalService.ts
// V62 (TAREA 7 sub-tarea 3): store eliminado · stub para evitar romper consumers.
// Usar ejerciciosFiscalesCoord en su lugar.

import { initDB } from './db';

// Legacy type (no longer in db.ts)
export interface EjercicioFiscal {
  ejercicio: number;
  estado: 'en_curso' | 'pendiente' | 'declarado' | 'prescrito';
  origen?: 'XML' | 'manual' | 'migración';
  snapshotId?: number;
  createdAt: string;
  updatedAt: string;
}

export const ejercicioFiscalService = {
  async get(_ejercicio: number): Promise<EjercicioFiscal | undefined> {
    return undefined;
  },

  async create(_ejercicio: Partial<EjercicioFiscal>): Promise<EjercicioFiscal | null> {
    console.warn('[ejercicioFiscalService] Store eliminado en V62 · usar ejerciciosFiscalesCoord');
    return null;
  },

  async update(_ejercicio: EjercicioFiscal): Promise<void> {
    console.warn('[ejercicioFiscalService] Store eliminado en V62 · operación no-op');
  },

  async delete(_ejercicio: number): Promise<void> {
    console.warn('[ejercicioFiscalService] Store eliminado en V62 · operación no-op');
  },
};

export async function getEjercicio(_ejercicio: number): Promise<EjercicioFiscal | undefined> {
  return undefined;
}

export async function getAllEjercicios(): Promise<EjercicioFiscal[]> {
  // Try to return from ejerciciosFiscalesCoord
  const db = await initDB();
  try {
    const coords = await db.getAll('ejerciciosFiscalesCoord');
    return coords.map(c => ({
      ejercicio: c.año,
      estado: c.estado,
      origen: 'manual' as const,
      createdAt: c.createdAt || new Date().toISOString(),
      updatedAt: c.updatedAt || new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

export async function getOrCreateEjercicio(año: number): Promise<EjercicioFiscal> {
  // Fallback to creating a minimal stub
  return {
    ejercicio: año,
    estado: 'en_curso',
    origen: 'manual',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function declararEjercicio(_ejercicio: number): Promise<void> {
  console.warn('[ejercicioFiscalService] Store eliminado en V62 · operación no-op');
}
