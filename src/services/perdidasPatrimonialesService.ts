// D-CRUD-MEDIA sub-tarea 15 · CRUD pérdidas patrimoniales del ahorro
// Las pérdidas se crean automáticamente desde fiscalLifecycleService al
// detectarlas en una declaración importada. Hasta hoy no había forma de
// listarlas ni borrarlas desde la UI · si una importación insertaba pérdidas
// erróneas, quedaban atrapadas.

import { initDB } from './db';
import type { PerdidaPatrimonialAhorro } from './db';

const STORE = 'perdidasPatrimonialesAhorro' as const;

export const perdidasPatrimonialesService = {
  async listar(filtro?: {
    ejercicioOrigen?: number;
    estado?: PerdidaPatrimonialAhorro['estado'];
  }): Promise<PerdidaPatrimonialAhorro[]> {
    const db = await initDB();
    const all: PerdidaPatrimonialAhorro[] = await db.getAll(STORE);
    return all
      .filter((p) => {
        if (filtro?.ejercicioOrigen !== undefined && p.ejercicioOrigen !== filtro.ejercicioOrigen) return false;
        if (filtro?.estado !== undefined && p.estado !== filtro.estado) return false;
        return true;
      })
      .sort((a, b) => b.ejercicioOrigen - a.ejercicioOrigen);
  },

  async obtener(id: number): Promise<PerdidaPatrimonialAhorro | undefined> {
    const db = await initDB();
    return await db.get(STORE, id);
  },

  /**
   * Borra una pérdida patrimonial. ATENCIÓN: si la pérdida tenía aplicaciones
   * en ejercicios futuros (importeAplicado > 0), el cálculo de IRPF de esos
   * ejercicios queda inconsistente hasta que se recalcule. La UI debe avisar.
   */
  async eliminar(id: number): Promise<void> {
    const db = await initDB();
    await db.delete(STORE, id);
  },
};
