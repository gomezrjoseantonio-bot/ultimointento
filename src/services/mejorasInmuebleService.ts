import { initDB, MejoraInmueble } from './db';
import { updateLineaInmueble, deleteLineaInmueble } from './lineasInmuebleService';

const sortByDateDesc = (a: MejoraInmueble, b: MejoraInmueble) =>
  (b.fecha ?? `${b.ejercicio}-01-01`).localeCompare(a.fecha ?? `${a.ejercicio}-01-01`);

export const mejorasInmuebleService = {
  async crear(input: Omit<MejoraInmueble, 'id' | 'createdAt' | 'updatedAt'>): Promise<MejoraInmueble> {
    const db = await initDB();
    const now = new Date().toISOString();
    const mejora = { ...input, createdAt: now, updatedAt: now };
    const id = await db.add('mejorasInmueble', mejora);
    return { ...mejora, id: id as number };
  },

  async actualizar(id: number, updates: Partial<Omit<MejoraInmueble, 'id' | 'createdAt'>>): Promise<MejoraInmueble> {
    // PR5.5: propaga cambios al treasuryEvent y movement asociados (si existen).
    const updated = (await updateLineaInmueble('mejorasInmueble', id, updates as Record<string, unknown>)) as
      | MejoraInmueble
      | null;
    if (!updated) throw new Error('MejoraInmueble no encontrada');
    return updated;
  },

  async getPorInmueble(inmuebleId: number): Promise<MejoraInmueble[]> {
    const db = await initDB();
    const mejoras = await db.getAllFromIndex('mejorasInmueble', 'inmuebleId', inmuebleId);
    return mejoras.sort(sortByDateDesc);
  },

  async getPorInmuebleYEjercicio(inmuebleId: number, ejercicio: number): Promise<MejoraInmueble[]> {
    const db = await initDB();
    const mejoras = await db.getAllFromIndex('mejorasInmueble', 'inmueble-ejercicio', [inmuebleId, ejercicio]);
    return mejoras.sort(sortByDateDesc);
  },

  async getHastaEjercicio(inmuebleId: number, ejercicio: number): Promise<MejoraInmueble[]> {
    const mejoras = await this.getPorInmueble(inmuebleId);
    return mejoras.filter(m => m.ejercicio <= ejercicio);
  },

  async getTotalHastaEjercicio(inmuebleId: number, ejercicio: number): Promise<number> {
    const mejoras = await this.getHastaEjercicio(inmuebleId, ejercicio);
    return mejoras.reduce((sum, m) => sum + m.importe, 0);
  },

  async getTotalCapexHastaEjercicio(inmuebleId: number, ejercicio: number): Promise<number> {
    const mejoras = await this.getHastaEjercicio(inmuebleId, ejercicio);
    return mejoras.filter(m => m.tipo !== 'reparacion').reduce((sum, m) => sum + m.importe, 0);
  },

  async getTotalReparacionesEjercicio(inmuebleId: number, ejercicio: number): Promise<number> {
    const mejoras = await this.getPorInmueble(inmuebleId);
    return mejoras.filter(m => m.tipo === 'reparacion' && m.ejercicio === ejercicio).reduce((sum, m) => sum + m.importe, 0);
  },

  async eliminar(id: number): Promise<void> {
    // PR5.5: borra en cascada event + movement asociados.
    await deleteLineaInmueble('mejorasInmueble', id);
  },
};
