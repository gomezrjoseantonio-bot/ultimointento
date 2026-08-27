import { initDB, GastoInmueble, GastoCategoria, type AEATBox } from './db';
import { updateLineaInmueble, deleteLineaInmueble } from './lineasInmuebleService';
import { getRentalDaysForYear } from './aeatAmortizationService';
import { sumaDeducidaPorCasilla, esBisiesto } from './gastoDeducible';

// Mapa categoria → casillaAEAT · tipado como `AEATBox` y no como `string` para
// que una casilla que no exista no llegue muda a la declaración.
export const CATEGORIA_A_CASILLA: Record<GastoCategoria, AEATBox> = {
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
    // PR5.5: delega en lineasInmuebleService para propagar los cambios al
    // treasuryEvent y movement asociados (si existen).
    await updateLineaInmueble('gastosInmueble', id, updates as Record<string, unknown>);
  },

  async delete(id: number): Promise<void> {
    // PR5.5: borra en cascada event + movement asociados.
    await deleteLineaInmueble('gastosInmueble', id);
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
    // PR5.5: cascada via lineasInmuebleService para mantener coherencia
    // bidireccional (si el gasto venía de tesorería, borra también event +
    // movement asociados).
    for (const g of existentes) {
      if (g.id != null) await deleteLineaInmueble('gastosInmueble', g.id);
    }
  },

  /**
   * Lo que deduce cada casilla de gasto en ese ejercicio — alimenta el motor IRPF.
   *
   * Antes sumaba el importe entero de todo lo que hubiera en el store. Ahora
   * pasa por `sumaDeducidaPorCasilla`: fuera lo que aún no ha ocurrido, fuera
   * lo que no es gasto, y lo que queda repartido por los días que el inmueble
   * estuvo arrendado.
   *
   * Los días son los mismos que usa la amortización —la unión de los contratos
   * (`getRentalDaysForYear`)— y la base, el año natural. Que las dos cuentas
   * salgan del mismo sitio es el punto: un año no puede tener 272 días para la
   * amortización y 365 para el IBI.
   */
  async getSumaPorCasilla(inmuebleId: number, ejercicio: number): Promise<Record<string, number>> {
    const [gastos, diasArrendados] = await Promise.all([
      this.getByInmuebleYEjercicio(inmuebleId, ejercicio),
      getRentalDaysForYear(inmuebleId, ejercicio),
    ]);
    const diasDelAnio = esBisiesto(ejercicio) ? 366 : 365;
    return sumaDeducidaPorCasilla(gastos, diasArrendados, diasDelAnio);
  },
};
