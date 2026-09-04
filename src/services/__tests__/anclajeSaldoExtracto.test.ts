// E1.5-anclaje-saldo · anclar la apertura de la cuenta al saldo del banco.
//
// El caso de Jose: la cuenta Santander se dio de alta con apertura 0 a finales
// de agosto, así que ATLAS sumaba solo lo movido desde entonces (−1.070,93)
// mientras el banco decía 2.635,40. Lo que se protege aquí:
//   · se ancla por la línea MÁS RECIENTE del extracto (decisión de Jose);
//   · tras anclar, el saldo de ATLAS a esa fecha ES el del banco · por
//     construcción, con el propio hub;
//   · ATLAS propone, el usuario confirma: nada se escribe sin `aplicarAnclaje`;
//   · nunca hacia atrás: un extracto anterior a la apertura no ancla;
//   · el descuadre se ve cuando la cuenta ya tenía apertura.

import {
  aplicarAnclaje,
  calcularAnclaje,
  lineaMasRecienteConSaldo,
  propuestaDeAnclaje,
} from '../anclajeSaldoExtracto';
import { calculateAccountBalanceAtDate } from '../accountBalanceService';
import { initDB, type Account, type Movement } from '../db';
import type { LineaExtractoPersistida } from '../db/types-lineasExtracto';

jest.mock('../db', () => ({ initDB: jest.fn() }));
// Funciones planas, no `jest.fn`: CRA resetea las implementaciones de los
// mocks antes de cada test (`resetMocks`) y un `jest.fn` con implementación en
// la factoría se quedaría en nada. `servicioConoceLaCuenta` simula la caché.
const estadoMock = { servicioConoceLaCuenta: true, updates: 0 };
jest.mock('../cuentasService', () => ({
  cuentasService: {
    update: async (id: number, data: Record<string, unknown>) => {
      estadoMock.updates += 1;
      if (!estadoMock.servicioConoceLaCuenta) throw new Error('Cuenta no encontrada');
      const db = await (jest.requireMock('../db').initDB as jest.Mock)();
      const cuenta = await db.get('accounts', id);
      if (!cuenta) throw new Error('Cuenta no encontrada');
      await db.put('accounts', { ...cuenta, ...data, balance: data.openingBalance });
    },
  },
}));

interface Stores {
  accounts: Account[];
  movements: Movement[];
  treasuryEvents: any[];
  lineasExtracto: any[];
}

let stores: Stores;

function buildDb(s: Stores) {
  return {
    get: async (store: keyof Stores, id: number) => (s[store] as any[]).find((r) => r.id === id),
    getAll: async (store: keyof Stores) => s[store] ?? [],
    put: async (store: keyof Stores, row: any) => {
      const list = s[store] as any[];
      const i = list.findIndex((r) => r.id === row.id);
      if (i >= 0) list[i] = row;
      else list.push(row);
      return row.id;
    },
  };
}

const NOW = '2026-09-04T10:00:00.000Z';

/** Una línea como la deja el import tras E1.5 · pendiente, sin movimiento, con el saldo del banco. */
function linea(l: {
  id: number; fecha: string; importe: number; saldo?: number; fila?: number; cuenta?: number; movementIds?: number[];
}): LineaExtractoPersistida {
  return {
    id: l.id,
    accountId: l.cuenta ?? 42,
    importBatchId: 'lote-sept',
    fechaOperacion: l.fecha,
    fechaValor: l.fecha,
    importe: l.importe,
    conceptoLiteral: `linea ${l.id}`,
    ...(l.saldo != null ? { saldo: l.saldo } : {}),
    ...(l.fila != null ? { filaOriginal: l.fila } : {}),
    hashLinea: `v1:${l.id}`,
    hashMovement: `42|${l.fecha}|${Math.round(l.importe * 100)}|linea ${l.id}`,
    estado: 'pendiente',
    movementIds: l.movementIds ?? [],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

// El extracto de Santander, en miniatura y como lo lista el banco: lo más
// nuevo PRIMERO. El saldo tras cada línea es el que dice el banco.
//   02/09 −10,20 → 2.635,40 · 02/09 −3,07 → 2.645,60 · 01/09 +395 → 2.648,67
//   01/09 −993,43 → 2.253,67 · 31/08 −1.350 → 3.247,10 · 26/08 +3.943,31 → 4.597,10
const SANTANDER: LineaExtractoPersistida[] = [
  linea({ id: 1, fecha: '2026-09-02', importe: -10.2, saldo: 2635.4, fila: 8 }),
  linea({ id: 2, fecha: '2026-09-02', importe: -3.07, saldo: 2645.6, fila: 9 }),
  linea({ id: 3, fecha: '2026-09-01', importe: 395, saldo: 2648.67, fila: 10 }),
  linea({ id: 4, fecha: '2026-09-01', importe: -993.43, saldo: 2253.67, fila: 11 }),
  linea({ id: 5, fecha: '2026-08-31', importe: -1350, saldo: 3247.1, fila: 12 }),
  linea({ id: 6, fecha: '2026-08-26', importe: 3943.31, saldo: 4597.1, fila: 13 }),
];

const cuenta = (over: Partial<Account> = {}): Account =>
  ({ id: 42, iban: 'ES61', alias: 'Santander Nómina', openingBalance: 0, openingBalanceDate: '2026-08-31T09:00:00.000Z', ...over }) as Account;

/** El saldo de ATLAS a la fecha `dia` (incluido) · el hub, como lo usa la pantalla. */
const saldoAtlasEl = (dia: string, account: Account) =>
  Math.round(
    calculateAccountBalanceAtDate({
      account,
      cutoffDate: dia === '2026-09-02' ? '2026-09-03' : `${dia.slice(0, 8)}${String(Number(dia.slice(8)) + 1).padStart(2, '0')}`,
      treasuryEvents: stores.treasuryEvents,
      movements: stores.movements,
      lineas: stores.lineasExtracto,
    }) * 100
  ) / 100;

beforeEach(() => {
  estadoMock.servicioConoceLaCuenta = true;
  estadoMock.updates = 0;
  stores = { accounts: [cuenta()], movements: [], treasuryEvents: [], lineasExtracto: SANTANDER.map((l) => ({ ...l })) };
  (initDB as jest.Mock).mockResolvedValue(buildDb(stores));
});

describe('la línea más reciente con saldo', () => {
  it('Santander lista lo nuevo primero · de las dos del 2 de septiembre manda la primera del fichero', () => {
    expect(lineaMasRecienteConSaldo(SANTANDER)).toEqual({ fecha: '2026-09-02', saldoBanco: 2635.4 });
  });

  it('un banco que lista lo viejo primero · manda la última del fichero', () => {
    const alReves = [...SANTANDER].reverse().map((l, i) => ({ ...l, filaOriginal: 8 + i }));
    expect(lineaMasRecienteConSaldo(alReves)).toEqual({ fecha: '2026-09-02', saldoBanco: 2635.4 });
  });

  it('sin columna de saldo no hay ancla · la apertura la pone el usuario (§9)', () => {
    expect(lineaMasRecienteConSaldo(SANTANDER.map(({ saldo: _s, ...l }) => l as LineaExtractoPersistida))).toBeNull();
  });

  it('una línea sin fecha (descartada) no puede ser el ancla', () => {
    const conRara = [linea({ id: 9, fecha: '', importe: -5, saldo: 1, fila: 1 }), ...SANTANDER];
    expect(lineaMasRecienteConSaldo(conRara)).toEqual({ fecha: '2026-09-02', saldoBanco: 2635.4 });
  });
});

describe('la propuesta · el caso de Jose', () => {
  it('con apertura 0 al 31 de agosto, ATLAS calcula solo lo movido desde entonces y el banco dice otra cosa', async () => {
    const p = await propuestaDeAnclaje(buildDb(stores) as never, cuenta(), SANTANDER);
    expect(p).not.toBeNull();
    // Σ líneas ≥ 31/08 = −10,20 −3,07 +395 −993,43 −1.350 = −1.961,70
    expect(p!.saldoAtlas).toBe(-1961.7);
    expect(p!.saldoBanco).toBe(2635.4);
    expect(p!.fecha).toBe('2026-09-02');
    expect(p!.cuadra).toBe(false);
    expect(p!.descuadre).toBe(4597.1);
    expect(p!.aplicable).toBe(true);
    expect(p!.aperturaActual).toEqual({ saldo: 0, fecha: '2026-08-31' });
    // Apertura propuesta: el saldo del banco menos lo que suma el propio día 2.
    expect(p!.aperturaPropuesta).toBe(2635.4 + 10.2 + 3.07);
  });

  it('tras aplicar la apertura propuesta, el saldo de ATLAS a la fecha del ancla ES el del banco', async () => {
    const p = (await propuestaDeAnclaje(buildDb(stores) as never, cuenta(), SANTANDER))!;
    const anclada = cuenta({ openingBalance: p.aperturaPropuesta, openingBalanceDate: p.fecha });
    expect(saldoAtlasEl('2026-09-02', anclada)).toBe(2635.4);
    // Y la propuesta sobre la cuenta ya anclada dice que cuadra.
    const otraVez = calcularAnclaje({
      account: anclada,
      ancla: { fecha: p.fecha, saldoBanco: p.saldoBanco },
      treasuryEvents: [],
      movements: [],
      lineas: stores.lineasExtracto,
    });
    expect(otraVez.cuadra).toBe(true);
    expect(otraVez.descuadre).toBe(0);
  });

  it('cuadra también cuando el día del ancla mezcla líneas resueltas (movimientos) y sin resolver', async () => {
    // La línea 1 ya se resolvió: su movimiento suma y ella no.
    stores.movements.push({ id: 700, accountId: 42, date: '2026-09-02', amount: -10.2, description: 'Bizum', source: 'import', importBatch: 'lote-sept' } as Movement);
    stores.lineasExtracto[0].movementIds = [700];
    // Y un previsto confirmado del día 1 con su movimiento aparte.
    stores.treasuryEvents.push({ id: 5, accountId: 42, type: 'expense', amount: 993.43, predictedDate: '2026-09-01', status: 'executed', movementId: 701 });
    stores.movements.push({ id: 701, accountId: 42, date: '2026-09-01', amount: -993.43, description: 'Prestamo', source: 'manual' } as Movement);
    stores.lineasExtracto[3].movementIds = [701];

    const p = (await propuestaDeAnclaje(buildDb(stores) as never, cuenta(), stores.lineasExtracto))!;
    const anclada = cuenta({ openingBalance: p.aperturaPropuesta, openingBalanceDate: p.fecha });
    expect(saldoAtlasEl('2026-09-02', anclada)).toBe(2635.4);
  });

  it('la cuenta YA tenía apertura y no cuadra · se ve el descuadre, no se pisa nada', async () => {
    const conApertura = cuenta({ openingBalance: 1000, openingBalanceDate: '2026-08-31' });
    const p = (await propuestaDeAnclaje(buildDb(stores) as never, conApertura, SANTANDER))!;
    expect(p.cuadra).toBe(false);
    expect(p.saldoAtlas).toBe(1000 - 1961.7);
    expect(p.aperturaActual).toEqual({ saldo: 1000, fecha: '2026-08-31' });
    expect(p.aplicable).toBe(true);
    // Solo se ha propuesto: la cuenta sigue como estaba.
    expect(stores.accounts[0].openingBalance).toBe(0);
  });

  it('nunca hacia atrás · un extracto anterior a la apertura no se ancla', async () => {
    const posterior = cuenta({ openingBalance: 500, openingBalanceDate: '2026-09-04' });
    stores.accounts = [posterior];
    const p = (await propuestaDeAnclaje(buildDb(stores) as never, posterior, SANTANDER))!;
    expect(p.aplicable).toBe(false);
    expect(await aplicarAnclaje(42, { fecha: p.fecha, saldoBanco: p.saldoBanco })).toBeNull();
    expect(stores.accounts[0]).toMatchObject({ openingBalance: 500, openingBalanceDate: '2026-09-04' });
    expect(estadoMock.updates).toBe(0);
  });
});

describe('aplicar · solo tras confirmar', () => {
  it('escribe la apertura en la cuenta · y a partir de ahí ATLAS y el banco dicen lo mismo', async () => {
    const p = (await propuestaDeAnclaje(buildDb(stores) as never, cuenta(), SANTANDER))!;
    const escrito = await aplicarAnclaje(42, { fecha: p.fecha, saldoBanco: p.saldoBanco });

    expect(escrito).toEqual({ openingBalance: 2648.67, openingBalanceDate: '2026-09-02' });
    expect(stores.accounts[0]).toMatchObject({ openingBalance: 2648.67, openingBalanceDate: '2026-09-02', balance: 2648.67 });
    expect(saldoAtlasEl('2026-09-02', stores.accounts[0])).toBe(2635.4);
  });

  it('el movimiento sintético de apertura, si existe, dice lo mismo que la cuenta', async () => {
    stores.movements.push({ id: 1, accountId: 42, date: '2026-08-31', amount: 0, description: 'Saldo inicial de apertura', isOpeningBalance: true, source: 'manual' } as Movement);
    await aplicarAnclaje(42, { fecha: '2026-09-02', saldoBanco: 2635.4 });
    expect(stores.movements.find((m) => m.isOpeningBalance)).toMatchObject({ amount: 2648.67, date: '2026-09-02', type: 'Ingreso' });
    // Y el hub lo sigue excluyendo: no cuenta dos veces.
    expect(saldoAtlasEl('2026-09-02', stores.accounts[0])).toBe(2635.4);
  });

  it('si el servicio de cuentas no conoce la cuenta, se escribe en la base igualmente', async () => {
    estadoMock.servicioConoceLaCuenta = false;
    await aplicarAnclaje(42, { fecha: '2026-09-02', saldoBanco: 2635.4 });
    expect(estadoMock.updates).toBe(1);
    expect(stores.accounts[0]).toMatchObject({ openingBalance: 2648.67, openingBalanceDate: '2026-09-02' });
  });

  it('una cuenta que ya no existe · error claro, nada escrito', async () => {
    await expect(aplicarAnclaje(99, { fecha: '2026-09-02', saldoBanco: 1 })).rejects.toThrow(/ya no existe/);
  });
});
