// R1 · «poner en alquiler» como entidad propia · helpers puros + marcar/desmarcar.

import {
  siguienteIdHabitacion,
  habitacionesPorDefecto,
  explotacionDesdeLegacy,
  marcarAlquilable,
  desmarcarAlquilable,
  getExplotacionDeInmueble,
} from '../explotacionAlquilerService';
import type { Property } from '../db';
import { initDB } from '../db';

jest.mock('../db', () => ({ initDB: jest.fn() }));

const prop = (over: Partial<Property>): Property =>
  ({ id: 1, alias: 'Piso', bedrooms: 3, ...over }) as Property;

describe('siguienteIdHabitacion', () => {
  it('empieza en hab-1 sin habitaciones', () => {
    expect(siguienteIdHabitacion([])).toBe('hab-1');
    expect(siguienteIdHabitacion(undefined)).toBe('hab-1');
  });
  it('toma el mayor N y suma 1 (no reusa ids que un contrato pueda apuntar)', () => {
    expect(
      siguienteIdHabitacion([
        { id: 'hab-1', nombre: 'A' },
        { id: 'hab-3', nombre: 'C' },
      ]),
    ).toBe('hab-4');
  });
  it('ignora ids que no sigan el esquema hab-N', () => {
    expect(siguienteIdHabitacion([{ id: 'suite', nombre: 'S' }])).toBe('hab-1');
  });
});

describe('habitacionesPorDefecto', () => {
  it('nombra Habitación 1..N con ids hab-1..hab-N', () => {
    expect(habitacionesPorDefecto(2)).toEqual([
      { id: 'hab-1', nombre: 'Habitación 1', estado: 'operativo' },
      { id: 'hab-2', nombre: 'Habitación 2', estado: 'operativo' },
    ]);
  });
  it('nunca baja de 1', () => {
    expect(habitacionesPorDefecto(0)).toHaveLength(1);
  });
});

describe('explotacionDesdeLegacy', () => {
  it('la vivienda habitual NUNCA se marca (uso propio)', () => {
    expect(explotacionDesdeLegacy(prop({ usoTipo: 'vivienda_habitual' }))).toBeNull();
  });

  it('sin ninguna señal de alquiler no se marca', () => {
    expect(explotacionDesdeLegacy(prop({ usoTipo: 'disponible' }))).toBeNull();
    expect(explotacionDesdeLegacy(prop({}))).toBeNull();
  });

  it('un contrato es señal suficiente → completo operativo', () => {
    expect(explotacionDesdeLegacy(prop({ usoTipo: 'disponible' }), true)).toEqual({
      inmuebleId: 1,
      modo: 'completo',
      estado: 'operativo',
    });
  });

  it('uso de arrendamiento larga → completo, vacante si no hay estado ni contrato', () => {
    expect(explotacionDesdeLegacy(prop({ usoTipo: 'larga_estancia' }))).toEqual({
      inmuebleId: 1,
      modo: 'completo',
      estado: 'vacante',
    });
  });

  it('turístico → modo turistico', () => {
    expect(explotacionDesdeLegacy(prop({ usoTipo: 'corta_estancia' }))?.modo).toBe('turistico');
  });

  it('por habitaciones → modo habitaciones sembrando N desde numeroHabitaciones', () => {
    const r = explotacionDesdeLegacy(
      prop({
        usoTipo: 'larga_estancia',
        modoExplotacion: 'por_habitaciones',
        alquilerPorHabitaciones: { activo: true, numeroHabitaciones: 2 },
      }),
    );
    expect(r?.modo).toBe('habitaciones');
    expect(r?.habitaciones).toHaveLength(2);
  });

  it('por habitaciones sin numeroHabitaciones cae a bedrooms', () => {
    const r = explotacionDesdeLegacy(
      prop({ bedrooms: 4, alquilerPorHabitaciones: { activo: true } }),
    );
    expect(r?.habitaciones).toHaveLength(4);
  });

  it('respeta el estado operativo legacy (en_reforma)', () => {
    expect(
      explotacionDesdeLegacy(
        prop({ usoTipo: 'larga_estancia', explotacion: { estadoOperativo: 'en_reforma' } }),
      )?.estado,
    ).toBe('en_reforma');
  });
});

describe('marcar / desmarcar (IO)', () => {
  const setup = (registros: any[] = []) => {
    const store = new Map<number, any>(registros.map((r) => [r.id, { ...r }]));
    let auto = registros.length;
    (initDB as jest.Mock).mockResolvedValue({
      getFromIndex: async (_s: string, _idx: string, inmuebleId: number) =>
        [...store.values()].find((e) => e.inmuebleId === inmuebleId),
      add: async (_s: string, v: any) => {
        const id = ++auto;
        store.set(id, { ...v, id });
        return id;
      },
      put: async (_s: string, v: any) => {
        store.set(v.id, { ...v });
        return v.id;
      },
      delete: async (_s: string, id: number) => {
        store.delete(id);
      },
    });
    return store;
  };

  it('marcar crea la explotación con estado por defecto vacante', async () => {
    const store = setup();
    const r = await marcarAlquilable(7, { modo: 'completo' });
    expect(r.id).toBeDefined();
    expect(r.estado).toBe('vacante');
    expect(store.get(r.id!)?.inmuebleId).toBe(7);
  });

  it('marcar es idempotente por inmueble: actualiza en vez de duplicar', async () => {
    const store = setup([
      { id: 1, inmuebleId: 7, modo: 'completo', estado: 'vacante', createdAt: 'x', updatedAt: 'x' },
    ]);
    const r = await marcarAlquilable(7, { modo: 'habitaciones', estado: 'operativo', numeroHabitaciones: 2 });
    expect(store.size).toBe(1);
    expect(r.id).toBe(1);
    expect(r.modo).toBe('habitaciones');
    expect(r.estado).toBe('operativo');
    expect(r.habitaciones).toHaveLength(2);
  });

  it('desmarcar borra la explotación', async () => {
    const store = setup([
      { id: 1, inmuebleId: 7, modo: 'completo', estado: 'vacante', createdAt: 'x', updatedAt: 'x' },
    ]);
    await desmarcarAlquilable(7);
    expect(store.size).toBe(0);
    expect(await getExplotacionDeInmueble(7)).toBeUndefined();
  });
});
