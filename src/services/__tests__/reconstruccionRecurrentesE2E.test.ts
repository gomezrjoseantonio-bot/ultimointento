// ============================================================================
// C1 de extremo a extremo · contra una base, con el motor y la escritura reales
// ============================================================================
//
// `reconstruccionRecurrentes.test.ts` fija la ventana. Esto comprueba lo que de
// verdad importa: que los cargos del pasado aparecen, que nacen PREVISTOS, que
// el saldo NO se mueve, que ejecutarlo dos veces no duplica y que no pisa nada
// de lo ya confirmado.
// ============================================================================

import { reconstruirRecurrentesDelPasado } from '../reconstruccionRecurrentes';
import { calculateAccountBalanceAtDate, corteParaSaldoVivo } from '../accountBalanceService';
import { initDB } from '../db';
import { obtenerSueloReconstruccion } from '../sueloReconstruccion';
import type { Account, TreasuryEvent } from '../db';

// La config de CRA resetea los mocks entre tests, así que la implementación se
// fija en `beforeEach` y no en la factory: ahí se perdería.
jest.mock('../db', () => ({ initDB: jest.fn() }));
jest.mock('../sueloReconstruccion', () => ({ obtenerSueloReconstruccion: jest.fn() }));

const HOY = '2026-08-28';

interface Stores {
  treasuryEvents: any[];
  accounts: Account[];
  compromisosRecurrentes: any[];
  tarjetas: any[];
}
let stores: Stores;
let nextId = 1;

const compromiso = (over: Record<string, unknown> = {}) => ({
  id: 1,
  alias: 'Comunidad',
  ambito: 'inmueble',
  inmuebleId: 1,
  estado: 'activo',
  activo: true,
  fechaInicio: '2026-01-01',
  patron: { tipo: 'mensualDiaFijo', dia: 2 },
  importe: { modo: 'fijo', importe: 60 },
  proveedor: { nombre: 'Comunidad' },
  metodoPago: 'domiciliado',
  cuentaCargo: 1,
  categoria: 'vivienda.comunidad',
  bolsaPresupuesto: 'necesidades',
  responsable: 'titular',
  createdAt: '',
  updatedAt: '',
  ...over,
});

const cuenta: Account = {
  id: 1,
  openingBalance: 1000,
  openingBalanceDate: '2026-08-28T00:00:00.000Z',
} as Account;

function makeDb() {
  const idx = (store: keyof Stores, index: string, clave: unknown) => {
    const list = stores[store] as any[];
    if (index === 'sourceId') return list.filter((e) => e.sourceId === clave);
    if (index === 'sourceType') return list.filter((e) => e.sourceType === clave);
    return [];
  };
  const store = (name: keyof Stores) => ({
    add: async (row: any) => {
      const id = nextId++;
      stores[name].push({ ...row, id });
      return id;
    },
    put: async (row: any) => {
      const list = stores[name] as any[];
      const i = list.findIndex((r) => r.id === row.id);
      if (i >= 0) list[i] = row; else list.push(row);
      return row.id;
    },
    getAll: async () => stores[name],
    index: (name2: string) => ({
      getAll: async (clave: unknown) => idx(name, name2, clave),
      openCursor: async () => null,
    }),
  });
  return {
    getAll: async (name: keyof Stores) => stores[name] ?? [],
    getAllFromIndex: async (name: keyof Stores, index: string, clave: unknown) => idx(name, index, clave),
    get: async (name: keyof Stores, key: number) => (stores[name] as any[]).find((r) => r.id === key),
    add: async (name: keyof Stores, row: any) => store(name).add(row),
    put: async (name: keyof Stores, row: any) => store(name).put(row),
    transaction: (name: keyof Stores) => ({
      objectStore: () => store(name),
      store: store(name),
      done: Promise.resolve(),
    }),
  };
}

beforeEach(() => {
  nextId = 100;
  stores = {
    treasuryEvents: [],
    accounts: [cuenta],
    compromisosRecurrentes: [compromiso()],
    tarjetas: [],
  };
  (initDB as jest.Mock).mockResolvedValue(makeDb());
  // C0 · hoy 28/8 cae en franja de campaña cerrada → suelo = 1/1 del año en curso.
  (obtenerSueloReconstruccion as jest.Mock).mockResolvedValue('2026-01-01');
});

const previstos = (): TreasuryEvent[] =>
  stores.treasuryEvents.filter((e) => e.sourceType === 'gasto_recurrente');

const saldo = (): number =>
  calculateAccountBalanceAtDate({
    account: cuenta,
    cutoffDate: corteParaSaldoVivo(HOY),
    treasuryEvents: stores.treasuryEvents as TreasuryEvent[],
    movements: [],
    incluirRealesFuturos: true,
  });

describe('C1 · el pasado del ejercicio se puebla', () => {
  it('un recurrente mensual con inicio 1/1 genera de enero a agosto', async () => {
    const r = await reconstruirRecurrentesDelPasado(HOY);

    expect(r.suelo).toBe('2026-01-01');
    expect(r.hasta).toBe('2026-08-27');
    expect(r.errores).toEqual([]);
    // Día 2 de cada mes, de enero a agosto · el de agosto (2/8) ya venció.
    expect(previstos().map((e) => e.predictedDate)).toEqual([
      '2026-01-02', '2026-02-02', '2026-03-02', '2026-04-02',
      '2026-05-02', '2026-06-02', '2026-07-02', '2026-08-02',
    ]);
  });

  it('TODOS nacen previstos · ninguno confirmado ni ejecutado', async () => {
    await reconstruirRecurrentesDelPasado(HOY);
    expect(previstos().every((e) => e.status === 'predicted')).toBe(true);
  });

  it('un gasto que empezó el 24/2 no debe nada de enero', async () => {
    stores.compromisosRecurrentes = [compromiso({ fechaInicio: '2026-02-24' })];
    await reconstruirRecurrentesDelPasado(HOY);
    expect(previstos().map((e) => e.predictedDate)).toEqual([
      '2026-03-02', '2026-04-02', '2026-05-02', '2026-06-02', '2026-07-02', '2026-08-02',
    ]);
  });

  it('uno que dejó de cobrarse en marzo no genera después', async () => {
    stores.compromisosRecurrentes = [compromiso({ fechaFin: '2026-03-31' })];
    await reconstruirRecurrentesDelPasado(HOY);
    expect(previstos().map((e) => e.predictedDate)).toEqual([
      '2026-01-02', '2026-02-02', '2026-03-02',
    ]);
  });

  it('nunca se genera para hoy ni para el futuro', async () => {
    stores.compromisosRecurrentes = [compromiso({ patron: { tipo: 'mensualDiaFijo', dia: 28 } })];
    await reconstruirRecurrentesDelPasado(HOY);
    expect(previstos().every((e) => (e.predictedDate ?? '') < HOY)).toBe(true);
  });
});

// ─── Las dos barreras de seguridad ──────────────────────────────────────────

describe('C1 · el saldo no se mueve', () => {
  it('saldo antes == saldo después · un previsto no es caja', async () => {
    const antes = saldo();
    await reconstruirRecurrentesDelPasado(HOY);
    expect(previstos().length).toBeGreaterThan(0);
    expect(saldo()).toBe(antes);
    expect(saldo()).toBe(1000);
  });
});

describe('C1 · idempotencia', () => {
  it('ejecutarlo dos veces no duplica', async () => {
    const primera = await reconstruirRecurrentesDelPasado(HOY);
    const cuantos = previstos().length;

    const segunda = await reconstruirRecurrentesDelPasado(HOY);

    expect(primera.eventosCreados).toBe(cuantos);
    expect(segunda.eventosCreados).toBe(0);
    expect(previstos()).toHaveLength(cuantos);
  });

  it('ni tres', async () => {
    await reconstruirRecurrentesDelPasado(HOY);
    await reconstruirRecurrentesDelPasado(HOY);
    await reconstruirRecurrentesDelPasado(HOY);
    expect(previstos()).toHaveLength(8);
  });
});

describe('C1 · lo ya cerrado no se toca', () => {
  /** Un mes que el usuario ya punteó a mano, con su importe real. */
  const yaConfirmado = (over: Record<string, unknown> = {}) => ({
    id: 55,
    sourceType: 'gasto_recurrente',
    sourceId: 1,
    año: 2026,
    mes: 3,
    predictedDate: '2026-03-02',
    amount: -73.4,
    status: 'executed',
    executedMovementId: 900,
    type: 'expense',
    ...over,
  });

  it('un mes confirmado no se duplica ni se reescribe', async () => {
    stores.treasuryEvents = [yaConfirmado()];
    await reconstruirRecurrentesDelPasado(HOY);

    const marzo = previstos().filter((e) => (e.predictedDate ?? '').startsWith('2026-03'));
    expect(marzo).toHaveLength(1);
    expect(marzo[0].status).toBe('executed');
    expect(marzo[0].amount).toBe(-73.4);
  });

  it('y los demás meses sí se pueblan a su alrededor', async () => {
    stores.treasuryEvents = [yaConfirmado()];
    await reconstruirRecurrentesDelPasado(HOY);
    expect(previstos()).toHaveLength(8);
  });

  it('un mes DESCARTADO tampoco vuelve · el usuario ya dijo que no ocurrió', async () => {
    stores.treasuryEvents = [
      yaConfirmado({ status: 'predicted', executedMovementId: undefined, descartado: true }),
    ];
    await reconstruirRecurrentesDelPasado(HOY);

    const marzo = previstos().filter((e) => (e.predictedDate ?? '').startsWith('2026-03'));
    expect(marzo).toHaveLength(1);
    expect(marzo[0].descartado).toBe(true);
  });
});
