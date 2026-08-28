// El camino real · conciliar por extracto cierra la línea de gasto
//
// `cierreLineaInmueble.test.ts` fija las piezas puras. Esto comprueba la
// función que las usa contra una base de datos: que encuentra la línea por las
// DOS vías —la del punteo (`treasuryEventId`) y la del recurrente
// (`origen`+`origenId`)—, que deja los tres campos que mira la declaración, y
// que no toca lo que no es suyo.
//
// Que además escriba el importe y la fecha REALES del banco lo fija
// `conciliacionDatosReales.test.ts`.

import { cerrarLineaDeGastoDelEvento } from '../cierreLineaInmueble';
import type { GastoInmueble, TreasuryEvent } from '../db';

const evento = (over: Partial<TreasuryEvent> = {}): TreasuryEvent =>
  ({
    id: 7,
    sourceType: 'gasto_recurrente',
    sourceId: 42,
    año: 2026,
    mes: 3,
    ambito: 'INMUEBLE',
    inmuebleId: 1,
    status: 'executed',
    ...over,
  }) as TreasuryEvent;

const linea = (over: Partial<GastoInmueble> = {}): GastoInmueble =>
  ({
    id: 5,
    inmuebleId: 1,
    ejercicio: 2026,
    fecha: '2026-03-15',
    concepto: 'Comunidad',
    categoria: 'comunidad',
    casillaAEAT: '0109',
    importe: 60,
    origen: 'recurrente',
    origenId: 'recurrente-42-2026-3',
    estado: 'previsto',
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as GastoInmueble;

/** El movimiento del banco · el mismo importe y fecha que traía la previsión. */
const mov = { id: 31, amount: -60, date: '2026-03-15', accountId: 4 };

/** Una base con un solo store de gastos, que recuerda lo que se le escribe. */
const conLineas = (lineas: GastoInmueble[]) => {
  const filas = lineas.map((l) => ({ ...l }));
  const db = {
    getAllFromIndex: async (_store: string, index: string, clave: unknown) => {
      if (index === 'treasuryEventId') return filas.filter((l) => l.treasuryEventId === clave);
      if (index === 'origen-origenId') {
        const [origen, origenId] = clave as [string, string];
        return filas.filter((l) => l.origen === origen && l.origenId === origenId);
      }
      return [];
    },
    getAll: async () => filas,
    put: async (_store: string, v: GastoInmueble) => {
      const i = filas.findIndex((l) => l.id === v.id);
      if (i >= 0) filas[i] = { ...v };
      return v.id;
    },
  };
  return { db, filas };
};

describe('cerrarLineaDeGastoDelEvento', () => {
  it('RECURRENTE · encuentra la línea por origenId y la cierra', async () => {
    const { db, filas } = conLineas([linea()]);
    const cerrada = await cerrarLineaDeGastoDelEvento(db as never, evento(), mov);

    expect(cerrada).toBe(true);
    expect(filas[0].estado).toBe('confirmado');
    expect(filas[0].estadoTesoreria).toBe('confirmed');
    expect(filas[0].movimientoId).toBe('31');
    expect(filas[0].treasuryEventId).toBe(7);
  });

  it('PUNTEADA ANTES · si la línea ya lleva treasuryEventId, la encuentra por ahí', async () => {
    const { db, filas } = conLineas([
      linea({ origen: 'manual', origenId: undefined, treasuryEventId: 7 }),
    ]);
    expect(await cerrarLineaDeGastoDelEvento(db as never, evento(), mov)).toBe(true);
    expect(filas[0].estado).toBe('confirmado');
  });

  // El índice `treasuryEventId` NO existe en `gastosInmueble` (`upgrade-a.ts:124-130`):
  // el camino real de la vía 1 es el escaneo, no el índice.
  it('SIN el índice `treasuryEventId` · la encuentra escaneando', async () => {
    const { db, filas } = conLineas([
      linea({ origen: 'manual', origenId: undefined, treasuryEventId: 7 }),
    ]);
    const sinIndice = {
      ...db,
      getAllFromIndex: async (store: string, index: string, clave: unknown) => {
        if (index === 'treasuryEventId') throw new Error('índice inexistente');
        return db.getAllFromIndex(store, index, clave);
      },
    };
    expect(await cerrarLineaDeGastoDelEvento(sinIndice as never, evento(), mov)).toBe(true);
    expect(filas[0].estado).toBe('confirmado');
  });

  // El banco dice CUÁNTO y CUÁNDO; qué es sigue siendo del usuario. Que el
  // importe pase a ser el real cuando difiere lo fija `conciliacionDatosReales`.
  it('conserva la clasificación · concepto y casilla no se tocan', async () => {
    const { db, filas } = conLineas([linea({ importe: 60, casillaAEAT: '0109' })]);
    await cerrarLineaDeGastoDelEvento(db as never, evento(), mov);
    expect(filas[0].casillaAEAT).toBe('0109');
    expect(filas[0].concepto).toBe('Comunidad');
  });

  it('es idempotente · volver a conciliar no rompe nada', async () => {
    const { db, filas } = conLineas([linea()]);
    await cerrarLineaDeGastoDelEvento(db as never, evento(), mov);
    await cerrarLineaDeGastoDelEvento(db as never, evento(), mov);
    expect(filas).toHaveLength(1);
    expect(filas[0].estado).toBe('confirmado');
  });

  // Solo se cierra lo que ya existe. Crear la línea aquí duplicaría el gasto
  // del recurrente: una `previsto` con su origenId y otra `confirmado` al lado.
  it('sin línea asociada NO crea ninguna', async () => {
    const { db, filas } = conLineas([]);
    expect(await cerrarLineaDeGastoDelEvento(db as never, evento(), mov)).toBe(false);
    expect(filas).toHaveLength(0);
  });

  it('un evento que no es de inmueble no toca nada', async () => {
    const { db, filas } = conLineas([linea()]);
    const personal = evento({ ambito: 'PERSONAL' as never, inmuebleId: undefined });
    expect(await cerrarLineaDeGastoDelEvento(db as never, personal, mov)).toBe(false);
    expect(filas[0].estado).toBe('previsto');
  });

  it('un ingreso tampoco · aunque sea de un inmueble', async () => {
    const { db, filas } = conLineas([linea()]);
    const ingreso = evento({ sourceType: 'contrato' as never, sourceId: undefined });
    expect(await cerrarLineaDeGastoDelEvento(db as never, ingreso, mov)).toBe(false);
    expect(filas[0].estado).toBe('previsto');
  });

  it('una línea de un ejercicio DECLARADO no se degrada', async () => {
    const { db, filas } = conLineas([linea({ estado: 'declarado' })]);
    expect(await cerrarLineaDeGastoDelEvento(db as never, evento(), mov)).toBe(false);
    expect(filas[0].estado).toBe('declarado');
    expect(filas[0].movimientoId).toBeUndefined();
  });

  it('la línea de OTRO compromiso no se toca', async () => {
    const { db, filas } = conLineas([linea({ origenId: 'recurrente-99-2026-3' })]);
    expect(await cerrarLineaDeGastoDelEvento(db as never, evento(), mov)).toBe(false);
    expect(filas[0].estado).toBe('previsto');
  });

  it('ni la del mismo compromiso en otro mes', async () => {
    const { db, filas } = conLineas([linea({ origenId: 'recurrente-42-2026-4' })]);
    expect(await cerrarLineaDeGastoDelEvento(db as never, evento(), mov)).toBe(false);
    expect(filas[0].estado).toBe('previsto');
  });
});
