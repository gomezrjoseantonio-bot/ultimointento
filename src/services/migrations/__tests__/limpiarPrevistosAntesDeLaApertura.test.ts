// ============================================================================
// La limpieza de los previstos anteriores a la apertura de su cuenta
// ============================================================================
//
// Hermana del arreglo del motor: éste deja de emitirlos, y esto retira los que
// ya se escribieron. Van juntas a propósito — limpiar sin arreglar los haría
// volver en la siguiente regeneración.

import {
  esPrevistoAnteriorALaApertura,
  limpiarPrevistosAntesDeLaApertura,
} from '../limpiarPrevistosAntesDeLaApertura';
import { initDB } from '../../db';
import type { Account, TreasuryEvent } from '../../db';

const CUENTA = 1;
/** Apertura de la cuenta · lo de antes no pudo salir de ella. */
const APERTURA = '2026-08-27';

const ev = (over: Partial<TreasuryEvent> = {}): TreasuryEvent =>
  ({
    id: 1,
    type: 'expense',
    amount: -50,
    predictedDate: '2026-08-05',
    description: 'Agua',
    sourceType: 'gasto_recurrente',
    generadoPor: 'treasurySyncService',
    accountId: CUENTA,
    status: 'predicted',
    createdAt: '2026-08-27T10:00:00.000Z',
    updatedAt: '2026-08-27T10:00:00.000Z',
    ...over,
  }) as TreasuryEvent;

const aperturas = new Map<number, string>([[CUENTA, APERTURA]]);

describe('esPrevistoAnteriorALaApertura · qué se borra', () => {
  it('un previsto del día 5 en una cuenta abierta el 27', () => {
    expect(esPrevistoAnteriorALaApertura(ev(), aperturas)).toBe(true);
  });

  it('el día ANTERIOR a la apertura todavía es de antes', () => {
    expect(esPrevistoAnteriorALaApertura(ev({ predictedDate: '2026-08-26' }), aperturas)).toBe(true);
  });
});

describe('esPrevistoAnteriorALaApertura · qué NO se toca', () => {
  it('el propio día de la apertura ya tiene cuenta', () => {
    expect(esPrevistoAnteriorALaApertura(ev({ predictedDate: APERTURA }), aperturas)).toBe(false);
  });

  it('lo posterior a la apertura, obviamente', () => {
    expect(esPrevistoAnteriorALaApertura(ev({ predictedDate: '2026-09-05' }), aperturas)).toBe(false);
  });

  // Lo que ha tocado una persona manda sobre cualquier limpieza. Y si el cargo
  // llegó de verdad, el hecho del banco manda sobre la fecha de apertura: será
  // que la apertura estaba mal puesta, no que el dinero no salió.
  it('un CONFIRMADO no se toca', () => {
    expect(esPrevistoAnteriorALaApertura(ev({ status: 'confirmed' }), aperturas)).toBe(false);
  });

  it('un EJECUTADO tampoco', () => {
    expect(esPrevistoAnteriorALaApertura(ev({ status: 'executed' }), aperturas)).toBe(false);
  });

  it('un DESCARTADO tampoco', () => {
    expect(esPrevistoAnteriorALaApertura(ev({ descartado: true }), aperturas)).toBe(false);
  });

  it('uno con movimiento enlazado tampoco', () => {
    expect(esPrevistoAnteriorALaApertura(ev({ executedMovementId: 9 }), aperturas)).toBe(false);
  });

  // Se limpia SOLO lo que el motor arreglado deja de emitir. Borrar una cuota
  // de préstamo o un apunte a mano sería quitar algo que su generador —o su
  // dueño— vuelve a poner, y estaríamos otra vez aquí en la siguiente pasada.
  it('un apunte a mano no es de este motor', () => {
    expect(esPrevistoAnteriorALaApertura(ev({ sourceType: 'manual' }), aperturas)).toBe(false);
  });

  it('una cuota de préstamo tampoco', () => {
    expect(esPrevistoAnteriorALaApertura(ev({ sourceType: 'prestamo_cuota' }), aperturas)).toBe(false);
  });

  it('lo que no escribió el motor de previsiones tampoco', () => {
    expect(esPrevistoAnteriorALaApertura(ev({ generadoPor: 'otro' }), aperturas)).toBe(false);
  });
});

describe('esPrevistoAnteriorALaApertura · en la duda no se borra', () => {
  it('una cuenta sin fecha de apertura no tiene frontera', () => {
    expect(esPrevistoAnteriorALaApertura(ev(), new Map())).toBe(false);
  });

  it('un evento sin cuenta tampoco', () => {
    expect(esPrevistoAnteriorALaApertura(ev({ accountId: undefined }), aperturas)).toBe(false);
  });

  it('un evento sin fecha prevista tampoco', () => {
    expect(esPrevistoAnteriorALaApertura(ev({ predictedDate: '' }), aperturas)).toBe(false);
  });
});

// ============================================================================
// De extremo a extremo · sobre la base de verdad
// ============================================================================

const guardarCuenta = async (over: Partial<Account> = {}): Promise<number> => {
  const db = await initDB();
  return (await db.add('accounts', {
    alias: 'Unicaja', banco: { name: 'Unicaja' }, tipo: 'CORRIENTE',
    openingBalance: 100, openingBalanceDate: APERTURA, activa: true,
    createdAt: APERTURA, updatedAt: APERTURA, ...over,
  } as never)) as number;
};

const guardarEvento = async (e: Partial<TreasuryEvent>): Promise<number> => {
  const db = await initDB();
  const { id: _sinUsar, ...sinId } = ev(e);
  return (await db.add('treasuryEvents', sinId as never)) as number;
};

const existe = async (id: number): Promise<boolean> => {
  const db = await initDB();
  return (await db.get('treasuryEvents', id)) != null;
};

describe('limpiarPrevistosAntesDeLaApertura · sobre la base', () => {
  it('se lleva los de antes de la apertura y deja el resto', async () => {
    const cuentaId = await guardarCuenta();
    const antes = await guardarEvento({ accountId: cuentaId, predictedDate: '2026-08-05' });
    const elDia = await guardarEvento({ accountId: cuentaId, predictedDate: APERTURA });
    const despues = await guardarEvento({ accountId: cuentaId, predictedDate: '2026-09-05' });
    const confirmado = await guardarEvento({
      accountId: cuentaId, predictedDate: '2026-08-03', status: 'confirmed',
    });

    const db = await initDB();
    const recibo = await limpiarPrevistosAntesDeLaApertura(db as never);

    expect(await existe(antes)).toBe(false);
    expect(recibo.borrados).toBe(1);
    expect(await existe(elDia)).toBe(true);
    expect(await existe(despues)).toBe(true);
    expect(await existe(confirmado)).toBe(true);
  });

  it('una cuenta sin fecha de apertura no pierde nada', async () => {
    const cuentaId = await guardarCuenta({ openingBalanceDate: undefined });
    const suyo = await guardarEvento({ accountId: cuentaId, predictedDate: '2026-08-05' });

    const db = await initDB();
    const recibo = await limpiarPrevistosAntesDeLaApertura(db as never);

    expect(recibo.borrados).toBe(0);
    expect(await existe(suyo)).toBe(true);
  });

  it('el recibo cuadra con lo que se borró', async () => {
    const cuentaId = await guardarCuenta();
    await guardarEvento({ accountId: cuentaId, predictedDate: '2026-08-01', amount: -30 });
    await guardarEvento({ accountId: cuentaId, predictedDate: '2026-08-02', amount: -20 });

    const db = await initDB();
    const recibo = await limpiarPrevistosAntesDeLaApertura(db as never);

    expect(recibo.borrados).toBe(2);
    expect(recibo.importe).toBeCloseTo(-50, 2);
    expect(recibo.porCuenta).toEqual({ [cuentaId]: 2 });
  });

  it('es idempotente', async () => {
    const cuentaId = await guardarCuenta();
    await guardarEvento({ accountId: cuentaId, predictedDate: '2026-08-05' });

    const db = await initDB();
    expect((await limpiarPrevistosAntesDeLaApertura(db as never)).borrados).toBe(1);
    expect((await limpiarPrevistosAntesDeLaApertura(db as never)).borrados).toBe(0);
  });
});
