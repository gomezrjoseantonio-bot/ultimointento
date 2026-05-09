// D-CRUD-MEDIA sub-tarea 17 · CRUD vínculos accesorio (parking/trastero)
// Hasta hoy declaracionDistributorService solo hacía db.add al importar AEAT.
// Si una vinculación principal-accesorio se importaba errónea, no había
// forma de corregirla ni borrarla desde la UI.

import { initDB } from './db';
import type { VinculoAccesorio } from './db';

const STORE = 'vinculosAccesorio' as const;

export const vinculosAccesorioService = {
  async listar(): Promise<VinculoAccesorio[]> {
    const db = await initDB();
    const all: VinculoAccesorio[] = await db.getAll(STORE);
    return all.sort((a, b) => b.ejercicio - a.ejercicio || a.id! - b.id!);
  },

  async obtener(id: number): Promise<VinculoAccesorio | undefined> {
    const db = await initDB();
    return await db.get(STORE, id);
  },

  /**
   * Edita campos editables del vínculo (estado · fechas · ejercicio).
   * NO permite cambiar inmueblePrincipalId / inmuebleAccesorioId (la identidad).
   */
  async actualizar(
    id: number,
    updates: Partial<Pick<VinculoAccesorio, 'fechaInicio' | 'fechaFin' | 'estado' | 'ejercicio'>>,
  ): Promise<VinculoAccesorio> {
    const db = await initDB();
    const existing = (await db.get(STORE, id)) as VinculoAccesorio | undefined;
    if (!existing) throw new Error('Vínculo accesorio no encontrado');
    const updated: VinculoAccesorio = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await db.put(STORE, updated);
    return updated;
  },

  async eliminar(id: number): Promise<void> {
    const db = await initDB();
    await db.delete(STORE, id);
  },
};
