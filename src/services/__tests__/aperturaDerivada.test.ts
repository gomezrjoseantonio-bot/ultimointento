// §31 · la apertura no se inventa, se DERIVA del extracto.
//
// El caso de Jose: la cuenta Santander se dio de alta con apertura 0 a finales
// de agosto —el saldo del día que abrió la cuenta nadie lo sabe— así que ATLAS
// sumaba solo lo movido desde entonces (−1.961,70) mientras el banco decía
// 2.635,40. Lo que se protege aquí:
//   · el extracto ANTIGUO hace RETROCEDER la apertura hasta su línea más
//     antigua, con el saldo del banco: apertura = saldo − importe de esa línea;
//   · tras aplicarla, el saldo de ATLAS a la fecha de la última línea ES el del
//     banco (2.635,40) · el fichero cuadra de punta a punta;
//   · un extracto que cae DENTRO de lo que ATLAS ya cubría no mueve la fecha:
//     ajusta el importe del saldo de hoy;
//   · ATLAS propone, el usuario confirma: nada se escribe sin `aplicarApertura`.

import {
  aplicarApertura,
  calcularApertura,
  extremosConSaldo,
  lineaMasRecienteConSaldo,
  propuestaDeApertura,
} from '../aperturaDerivada';
import { calculateAccountBalanceAtDate } from '../accountBalanceService';
import { initDB, type Account, type Movement } from '../db';
import type { LineaExtractoPersistida } from '../db/types-lineasExtracto';

jest.mock('../db', () => ({ initDB: jest.fn() }));
// Funciones planas, no `jest.fn`: CRA resetea las implementaciones de los
// mocks antes de cada test (`resetMocks`) y un `jest.fn` con implementación en
// la factoría se quedaría en nada. `servicioConoceLaCuenta` simula la caché.
const estadoMock = { servicioConoceLaCuenta: true, otroFallo: null as string | null, updates: 0 };
jest.mock('../cuentasService', () => ({
  cuentasService: {
    update: async (id: number, data: Record<string, unknown>) => {
      estadoMock.updates += 1;
      if (estadoMock.otroFallo) throw new Error(estadoMock.otroFallo);
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

/** §31 · el saldo con el que se LLEGA a la línea más antigua: 4.597,10 − 3.943,31. */
const APERTURA_DERIVADA = 653.79;
/** Σ de los importes del fichero · lo que se mueve entre la primera línea y la última. */
const SUMA_DEL_FICHERO = 1981.61;

const cuenta = (over: Partial<Account> = {}): Account =>
  ({ id: 42, iban: 'ES61', alias: 'Santander Nómina', openingBalance: 0, openingBalanceDate: '2026-08-31T09:00:00.000Z', ...over }) as Account;

/** El saldo de ATLAS a la fecha `dia` (incluido) · el hub, como lo usa la pantalla. */
const saldoAtlasEl = (dia: string, account: Account) => {
  const siguiente = new Date(`${dia}T00:00:00Z`);
  siguiente.setUTCDate(siguiente.getUTCDate() + 1);
  return (
    Math.round(
      calculateAccountBalanceAtDate({
        account,
        cutoffDate: siguiente.toISOString().slice(0, 10),
        treasuryEvents: stores.treasuryEvents,
        movements: stores.movements,
        lineas: stores.lineasExtracto,
      }) * 100
    ) / 100
  );
};

beforeEach(() => {
  estadoMock.servicioConoceLaCuenta = true;
  estadoMock.otroFallo = null;
  estadoMock.updates = 0;
  stores = { accounts: [cuenta()], movements: [], treasuryEvents: [], lineasExtracto: SANTANDER.map((l) => ({ ...l })) };
  (initDB as jest.Mock).mockResolvedValue(buildDb(stores));
});

describe('los extremos del fichero', () => {
  it('Santander lista lo nuevo primero · la más reciente es la primera fila y la más antigua la última', () => {
    expect(extremosConSaldo(SANTANDER)).toEqual({
      masReciente: { fecha: '2026-09-02', saldoBanco: 2635.4 },
      masAntigua: { fecha: '2026-08-26', saldoBanco: 4597.1, importe: 3943.31 },
    });
  });

  it('un banco que lista lo viejo primero · los mismos dos extremos', () => {
    const alReves = [...SANTANDER].reverse().map((l, i) => ({ ...l, filaOriginal: 8 + i }));
    expect(extremosConSaldo(alReves)).toEqual(extremosConSaldo(SANTANDER));
  });

  it('varias líneas el día más antiguo · manda la PRIMERA operación del día, que es a la que se llega', () => {
    // 26/08: primero +3.943,31 (→4.597,10) y después −100 (→4.497,10). El
    // banco lista lo nuevo primero, así que en el fichero van al revés.
    const conDos = [
      ...SANTANDER.slice(0, 5),
      linea({ id: 7, fecha: '2026-08-26', importe: -100, saldo: 4497.1, fila: 13 }),
      linea({ id: 6, fecha: '2026-08-26', importe: 3943.31, saldo: 4597.1, fila: 14 }),
    ];
    expect(extremosConSaldo(conDos)!.masAntigua).toEqual({ fecha: '2026-08-26', saldoBanco: 4597.1, importe: 3943.31 });
  });

  it('sin columna de saldo no hay nada que derivar · la apertura la pone el usuario (§9)', () => {
    expect(extremosConSaldo(SANTANDER.map(({ saldo: _s, ...l }) => l as LineaExtractoPersistida))).toBeNull();
    expect(lineaMasRecienteConSaldo(SANTANDER)).toEqual({ fecha: '2026-09-02', saldoBanco: 2635.4 });
  });

  it('una línea sin fecha (descartada) no puede ser extremo', () => {
    const conRara = [linea({ id: 9, fecha: '', importe: -5, saldo: 1, fila: 1 }), ...SANTANDER];
    expect(extremosConSaldo(conRara)).toEqual(extremosConSaldo(SANTANDER));
  });
});

describe('el extracto ANTIGUO · la apertura retrocede sola (§31)', () => {
  it('la apertura es el saldo de la línea más antigua MENOS su importe · no el saldo tal cual', async () => {
    const p = (await propuestaDeApertura(buildDb(stores) as never, cuenta(), SANTANDER))!;
    expect(p.modo).toBe('retroceso');
    expect(p.apertura).toEqual({ fecha: '2026-08-26', saldo: APERTURA_DERIVADA });
    // El saldo de la línea (4.597,10) contaría su propio ingreso dos veces.
    expect(p.apertura.saldo).not.toBe(4597.1);
    expect(p.proponer).toBe(true);
    expect(p.aperturaActual).toEqual({ saldo: 0, fecha: '2026-08-31' });
  });

  it('el aviso de descuadre se mantiene · el banco dice 2.635,40 y ATLAS calculaba −1.961,70', async () => {
    const p = (await propuestaDeApertura(buildDb(stores) as never, cuenta(), SANTANDER))!;
    expect(p.fecha).toBe('2026-09-02');
    expect(p.saldoBanco).toBe(2635.4);
    // Σ líneas ≥ 31/08 = −10,20 −3,07 +395 −993,43 −1.350 = −1.961,70
    expect(p.saldoAtlas).toBe(-1961.7);
    expect(p.cuadra).toBe(false);
    expect(p.descuadre).toBe(4597.1);
  });

  it('tras aplicarla, el saldo de ATLAS a la fecha de la última línea ES el del banco', async () => {
    const p = (await propuestaDeApertura(buildDb(stores) as never, cuenta(), SANTANDER))!;
    expect(p.cuadraTrasAplicar).toBe(true);
    expect(p.saldoAtlasTrasAplicar).toBe(2635.4);
    const derivada = cuenta({ openingBalance: p.apertura.saldo, openingBalanceDate: p.apertura.fecha });
    expect(saldoAtlasEl('2026-09-02', derivada)).toBe(2635.4);
    expect(APERTURA_DERIVADA + SUMA_DEL_FICHERO).toBeCloseTo(2635.4, 2);
  });

  it('la cuenta creada HOY con «cuánto tienes hoy» · el extracto antiguo la lleva atrás y el saldo sigue cuadrando', async () => {
    // Lo que hace el wizard nuevo: saldo de hoy, fecha = hoy.
    const reciencreada = cuenta({ openingBalance: 2635.4, openingBalanceDate: '2026-09-04' });
    stores.accounts = [reciencreada];
    const p = (await propuestaDeApertura(buildDb(stores) as never, reciencreada, SANTANDER))!;
    expect(p.modo).toBe('retroceso');
    expect(p.apertura).toEqual({ fecha: '2026-08-26', saldo: APERTURA_DERIVADA });
    // Antes de aplicar, ATLAS ni siquiera contaba las líneas (todas anteriores
    // a la apertura de hoy): 2.635,40 «a ciegas» el día 2 no lo sabía nadie.
    expect(p.saldoAtlas).toBe(0);
    expect(p.cuadraTrasAplicar).toBe(true);

    const escrito = await aplicarApertura(42, p.extremos);
    expect(escrito).toEqual({ openingBalance: APERTURA_DERIVADA, openingBalanceDate: '2026-08-26' });
    expect(saldoAtlasEl('2026-09-02', stores.accounts[0])).toBe(2635.4);
    // Y hoy, con todo el fichero dentro, sigue diciendo lo que dice el banco.
    expect(saldoAtlasEl('2026-09-04', stores.accounts[0])).toBe(2635.4);
  });

  it('cuadra también cuando el fichero mezcla líneas resueltas (movimientos) y sin resolver', async () => {
    // La línea 1 ya se resolvió: su movimiento suma y ella no.
    stores.movements.push({ id: 700, accountId: 42, date: '2026-09-02', amount: -10.2, description: 'Bizum', source: 'import', importBatch: 'lote-sept' } as Movement);
    stores.lineasExtracto[0].movementIds = [700];
    // Y un previsto confirmado del día 1 con su movimiento aparte.
    stores.treasuryEvents.push({ id: 5, accountId: 42, type: 'expense', amount: 993.43, predictedDate: '2026-09-01', status: 'executed', movementId: 701 });
    stores.movements.push({ id: 701, accountId: 42, date: '2026-09-01', amount: -993.43, description: 'Prestamo', source: 'manual' } as Movement);
    stores.lineasExtracto[3].movementIds = [701];

    const p = (await propuestaDeApertura(buildDb(stores) as never, cuenta(), stores.lineasExtracto))!;
    const derivada = cuenta({ openingBalance: p.apertura.saldo, openingBalanceDate: p.apertura.fecha });
    expect(saldoAtlasEl('2026-09-02', derivada)).toBe(2635.4);
  });

  it('sin fecha de apertura, el fichero ES lo más antiguo que ATLAS conoce · retrocede igual', async () => {
    const sinFecha = cuenta({ openingBalanceDate: undefined });
    const p = (await propuestaDeApertura(buildDb(stores) as never, sinFecha, SANTANDER))!;
    expect(p.modo).toBe('retroceso');
    expect(p.apertura).toEqual({ fecha: '2026-08-26', saldo: APERTURA_DERIVADA });
    expect(p.aperturaActual.fecha).toBeNull();
  });
});

describe('el extracto RECIENTE · la fecha no se mueve, se ajusta el importe', () => {
  it('un fichero que cae dentro de lo que ATLAS ya cubría ajusta el saldo, no la fecha', async () => {
    const antigua = cuenta({ openingBalance: 0, openingBalanceDate: '2026-08-01' });
    const p = (await propuestaDeApertura(buildDb(stores) as never, antigua, SANTANDER))!;
    expect(p.modo).toBe('ajuste');
    expect(p.apertura).toEqual({ fecha: '2026-08-01', saldo: 653.79 });
    expect(p.saldoAtlas).toBe(SUMA_DEL_FICHERO);
    expect(p.descuadre).toBe(653.79);
    expect(p.cuadraTrasAplicar).toBe(true);
    // La historia anterior al fichero NO se tira: la apertura sigue en agosto.
    expect(p.apertura.fecha).toBe(p.aperturaActual.fecha);
  });

  it('la cuenta ya cuadra y no hay nada más antiguo que traer · no se propone nada', async () => {
    const yaDerivada = cuenta({ openingBalance: APERTURA_DERIVADA, openingBalanceDate: '2026-08-26' });
    const p = (await propuestaDeApertura(buildDb(stores) as never, yaDerivada, SANTANDER))!;
    expect(p.cuadra).toBe(true);
    expect(p.descuadre).toBe(0);
    expect(p.proponer).toBe(false);
    // Y aplicar no escribe: no hay propuesta.
    stores.accounts = [yaDerivada];
    expect(await aplicarApertura(42, p.extremos)).toBeNull();
    expect(estadoMock.updates).toBe(0);
  });
});

describe('aplicar · solo tras confirmar', () => {
  it('proponer no escribe nada · la cuenta sigue como estaba', async () => {
    await propuestaDeApertura(buildDb(stores) as never, cuenta(), SANTANDER);
    expect(stores.accounts[0]).toMatchObject({ openingBalance: 0, openingBalanceDate: '2026-08-31T09:00:00.000Z' });
    expect(estadoMock.updates).toBe(0);
  });

  it('escribe la apertura derivada en la cuenta · y a partir de ahí ATLAS y el banco dicen lo mismo', async () => {
    const p = (await propuestaDeApertura(buildDb(stores) as never, cuenta(), SANTANDER))!;
    const escrito = await aplicarApertura(42, p.extremos);

    expect(escrito).toEqual({ openingBalance: APERTURA_DERIVADA, openingBalanceDate: '2026-08-26' });
    expect(stores.accounts[0]).toMatchObject({
      openingBalance: APERTURA_DERIVADA,
      openingBalanceDate: '2026-08-26',
      balance: APERTURA_DERIVADA,
    });
    expect(saldoAtlasEl('2026-09-02', stores.accounts[0])).toBe(2635.4);
  });

  it('el movimiento sintético de apertura, si existe, dice lo mismo que la cuenta', async () => {
    stores.movements.push({ id: 1, accountId: 42, date: '2026-08-31', amount: 0, description: 'Saldo inicial de apertura', isOpeningBalance: true, source: 'manual' } as Movement);
    const extremos = extremosConSaldo(SANTANDER)!;
    await aplicarApertura(42, extremos);
    expect(stores.movements.find((m) => m.isOpeningBalance)).toMatchObject({
      amount: APERTURA_DERIVADA, date: '2026-08-26', type: 'Ingreso',
    });
    // Y el hub lo sigue excluyendo: no cuenta dos veces.
    expect(saldoAtlasEl('2026-09-02', stores.accounts[0])).toBe(2635.4);
  });

  it('si el servicio de cuentas no conoce la cuenta, se escribe en la base igualmente', async () => {
    estadoMock.servicioConoceLaCuenta = false;
    await aplicarApertura(42, extremosConSaldo(SANTANDER)!);
    expect(estadoMock.updates).toBe(1);
    expect(stores.accounts[0]).toMatchObject({ openingBalance: APERTURA_DERIVADA, openingBalanceDate: '2026-08-26' });
  });

  it('cualquier otro fallo al escribir la cuenta SUBE · no se esconde con el fallback', async () => {
    estadoMock.otroFallo = 'Un traspaso va de una cuenta a OTRA.';
    await expect(aplicarApertura(42, extremosConSaldo(SANTANDER)!)).rejects.toThrow(/OTRA/);
    expect(stores.accounts[0]).toMatchObject({ openingBalance: 0 });
  });

  it('una cuenta que ya no existe · error claro, nada escrito', async () => {
    await expect(aplicarApertura(99, extremosConSaldo(SANTANDER)!)).rejects.toThrow(/ya no existe/);
  });

  it('se recalcula al aplicar · si entre medias nació el movimiento de una línea, no se cuenta dos veces', async () => {
    const p = (await propuestaDeApertura(buildDb(stores) as never, cuenta(), SANTANDER))!;
    // Al guardar, la línea 1 se ha materializado: su movimiento suma y ella no.
    stores.movements.push({ id: 700, accountId: 42, date: '2026-09-02', amount: -10.2, description: 'Bizum', source: 'import' } as Movement);
    stores.lineasExtracto[0].movementIds = [700];
    await aplicarApertura(42, p.extremos);
    expect(saldoAtlasEl('2026-09-02', stores.accounts[0])).toBe(2635.4);
  });
});

describe('calcularApertura · puro, sin base', () => {
  it('mismos números que el camino completo', () => {
    const p = calcularApertura({
      account: cuenta(),
      extremos: extremosConSaldo(SANTANDER)!,
      treasuryEvents: [],
      movements: [],
      lineas: SANTANDER,
    });
    expect(p).toMatchObject({
      modo: 'retroceso',
      apertura: { fecha: '2026-08-26', saldo: APERTURA_DERIVADA },
      saldoBanco: 2635.4,
      cuadraTrasAplicar: true,
    });
  });
});
