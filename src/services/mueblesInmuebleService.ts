import { initDB, MuebleInmueble } from './db';

const DAY_MS = 86400000;

const sortByDateDesc = (a: MuebleInmueble, b: MuebleInmueble) =>
  b.fechaAlta.localeCompare(a.fechaAlta);

export const mueblesInmuebleService = {
  async crear(input: Omit<MuebleInmueble, 'id' | 'createdAt' | 'updatedAt'>): Promise<MuebleInmueble> {
    const db = await initDB();
    const now = new Date().toISOString();
    const mueble = { ...input, createdAt: now, updatedAt: now };
    const id = await db.add('mueblesInmueble', mueble);
    return { ...mueble, id: id as number };
  },

  async actualizar(id: number, updates: Partial<Omit<MuebleInmueble, 'id' | 'createdAt'>>): Promise<MuebleInmueble> {
    const db = await initDB();
    const actual = await db.get('mueblesInmueble', id);
    if (!actual) throw new Error('MuebleInmueble no encontrado');
    const mueble: MuebleInmueble = { ...actual, ...updates, updatedAt: new Date().toISOString() };
    await db.put('mueblesInmueble', mueble);
    return mueble;
  },

  async getPorInmueble(inmuebleId: number): Promise<MuebleInmueble[]> {
    const db = await initDB();
    const items = await db.getAllFromIndex('mueblesInmueble', 'inmuebleId', inmuebleId);
    return items.sort(sortByDateDesc);
  },

  async getPorInmuebleYEjercicio(inmuebleId: number, ejercicio: number): Promise<MuebleInmueble[]> {
    const db = await initDB();
    return db.getAllFromIndex('mueblesInmueble', 'inmueble-ejercicio', [inmuebleId, ejercicio]);
  },

  // Amortización anual: importe / vidaUtil
  calcularAmortizacionAnual(mueble: MuebleInmueble): number {
    const vidaUtil = mueble.vidaUtil || 10;
    return mueble.importe / vidaUtil;
  },

  async calcularAmortizacionMobiliarioAnual(
    inmuebleId: number,
    ejercicio: number,
    diasArrendados: number,
    diasDisponibles: number
  ): Promise<number> {
    const muebles = await this.getPorInmueble(inmuebleId);
    const inicioEjercicio = new Date(ejercicio, 0, 1);
    const finEjercicio = new Date(ejercicio, 11, 31);
    let total = 0;

    for (const mueble of muebles) {
      const fechaAlta = new Date(mueble.fechaAlta);
      if (fechaAlta > finEjercicio) continue;
      if (!mueble.activo) continue;

      const vidaUtil = mueble.vidaUtil || 10;
      const amortizacionAnual = mueble.importe / vidaUtil;

      const anosDesdeAlta = ejercicio - fechaAlta.getFullYear();
      const amortizacionAcumuladaPrevia = anosDesdeAlta > 0
        ? Math.min(mueble.importe, amortizacionAnual * anosDesdeAlta)
        : 0;
      if (amortizacionAcumuladaPrevia >= mueble.importe) continue;

      const desde = fechaAlta > inicioEjercicio ? fechaAlta : inicioEjercicio;
      const hasta = finEjercicio;
      const diasActivo = Math.max(0, Math.ceil((hasta.getTime() - desde.getTime()) / DAY_MS) + 1);
      if (diasActivo === 0) continue;

      const ratioArrendamiento = diasDisponibles > 0 ? diasArrendados / diasDisponibles : 1;
      const amortEsteEjercicio = (amortizacionAnual / diasDisponibles) * diasActivo * ratioArrendamiento;
      const maxRestante = mueble.importe - amortizacionAcumuladaPrevia;
      total += Math.min(amortEsteEjercicio, maxRestante);
    }

    return Math.round(total * 100) / 100;
  },

  async darDeBaja(id: number): Promise<void> {
    await this.actualizar(id, { activo: false });
  },

  async eliminar(id: number): Promise<void> {
    const db = await initDB();
    await db.delete('mueblesInmueble', id);
  },
};
