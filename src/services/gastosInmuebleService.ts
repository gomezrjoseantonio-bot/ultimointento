import { initDB, GastoInmueble, GastoCategoria } from './db';

// Mapa categoria → casillaAEAT
export const CATEGORIA_A_CASILLA: Record<GastoCategoria, string> = {
  intereses:  '0105',
  reparacion: '0106',
  comunidad:  '0109',
  gestion:    '0112',
  servicio:   '0112',
  suministro: '0113',
  seguro:     '0114',
  ibi:        '0115',
  otro:       '0106',
};

export const gastosInmuebleService = {
  async add(gasto: Omit<GastoInmueble, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const db = await initDB();
    const now = new Date().toISOString();
    // Upsert por origen+origenId: si ya existe, actualiza los campos en vez de
    // crear un duplicado. Esto permite que reimportar un XML refresque campos
    // como importeBruto que pueden no estar presentes en datos antiguos.
    if (gasto.origenId && gasto.origen) {
      const existentes = await db.getAllFromIndex('gastosInmueble', 'origen-origenId', [gasto.origen, gasto.origenId]);
      if (existentes.length > 0) {
        const existing = existentes[0];
        await db.put('gastosInmueble', {
          ...existing,
          ...gasto,
          id: existing.id,
          createdAt: existing.createdAt,
          updatedAt: now,
        });
        return existing.id!;
      }
    }
    return db.add('gastosInmueble', { ...gasto, createdAt: now, updatedAt: now } as any) as unknown as number;
  },

  async update(id: number, updates: Partial<GastoInmueble>): Promise<void> {
    const db = await initDB();
    const existing = await db.get('gastosInmueble', id);
    if (!existing) return;
    await db.put('gastosInmueble', { ...existing, ...updates, updatedAt: new Date().toISOString() });
  },

  async delete(id: number): Promise<void> {
    const db = await initDB();
    await db.delete('gastosInmueble', id);
  },

  async getByInmueble(inmuebleId: number): Promise<GastoInmueble[]> {
    const db = await initDB();
    return db.getAllFromIndex('gastosInmueble', 'inmuebleId', inmuebleId);
  },

  async getByInmuebleYEjercicio(inmuebleId: number, ejercicio: number): Promise<GastoInmueble[]> {
    const db = await initDB();
    return db.getAllFromIndex('gastosInmueble', 'inmueble-ejercicio', [inmuebleId, ejercicio]);
  },

  async getByEjercicio(ejercicio: number): Promise<GastoInmueble[]> {
    const db = await initDB();
    return db.getAllFromIndex('gastosInmueble', 'ejercicio', ejercicio);
  },

  async getAll(): Promise<GastoInmueble[]> {
    const db = await initDB();
    return db.getAll('gastosInmueble');
  },

  async deleteByOrigenId(origen: string, origenId: string): Promise<void> {
    const db = await initDB();
    const existentes = await db.getAllFromIndex('gastosInmueble', 'origen-origenId', [origen, origenId]);
    for (const g of existentes) {
      if (g.id != null) await db.delete('gastosInmueble', g.id);
    }
  },

  // Suma por casilla para un inmueble y ejercicio — alimenta el motor IRPF
  async getSumaPorCasilla(inmuebleId: number, ejercicio: number): Promise<Record<string, number>> {
    const gastos = await this.getByInmuebleYEjercicio(inmuebleId, ejercicio);
    return gastos.reduce((acc, g) => {
      acc[g.casillaAEAT] = (acc[g.casillaAEAT] || 0) + g.importe;
      return acc;
    }, {} as Record<string, number>);
  },
};
