// V88 · las cuentas que eran tarjeta se van · VOCABULARIO §3.
//
// Esta migración BORRA, así que lo que vigilan estos tests no es solo que se
// vaya lo que tiene que irse: es que no se lleve por delante nada más, que deje
// dicho qué se llevó, y que no rompa lo que se queda.

import { borrarCuentasDeTarjeta } from '../v88-borrarCuentasDeTarjeta';
import { initDB } from '../../db';

const STORES = ['accounts', 'movements', 'importBatches', 'treasuryEvents', 'tarjetas'] as const;

const cuentaTarjeta = (over: Record<string, unknown> = {}) => ({
  alias: 'Visa Santander',
  tipo: 'TARJETA_CREDITO',
  cardConfig: { settlementDay: 5, chargeAccountId: 42 },
  activa: true,
  status: 'ACTIVE',
  createdAt: '2025-03-01T00:00:00.000Z',
  updatedAt: '2025-03-01T00:00:00.000Z',
  ...over,
});

const guardar = async (store: string, valor: Record<string, unknown>): Promise<number> => {
  const db = await initDB();
  return (await db.add(store as never, valor as never)) as number;
};

const todos = async (store: string): Promise<Record<string, any>[]> => {
  const db = await initDB();
  return ((await db.getAll(store as never)) ?? []) as Record<string, any>[];
};

const limpiar = async () => {
  const db = await initDB();
  for (const store of STORES) {
    await db.clear(store as never);
  }
  for (const store of ['prestamos', 'contracts']) {
    try {
      await db.clear(store as never);
    } catch {
      /* el almacén puede no existir en este esquema */
    }
  }
};

const migrar = async () => {
  const db = await initDB();
  return borrarCuentasDeTarjeta(db as never);
};

describe('la cuenta que era tarjeta desaparece', () => {
  beforeEach(limpiar);

  it('se va con sus movimientos', async () => {
    const id = await guardar('accounts', cuentaTarjeta());
    await guardar('movements', { accountId: id, amount: -40, date: '2026-01-05' });
    await guardar('movements', { accountId: id, amount: -12, date: '2026-01-09' });

    const r = await migrar();

    expect(await todos('accounts')).toEqual([]);
    expect(await todos('movements')).toEqual([]);
    expect(r.movimientosBorrados).toBe(2);
  });

  // Borrar no se deshace · si algún día falta un saldo, tiene que poder leerse
  // qué se fue y de dónde.
  it('deja dicho qué se llevó', async () => {
    const id = await guardar('accounts', cuentaTarjeta({ alias: 'Amex' }));
    await guardar('movements', { accountId: id, amount: -40, date: '2026-01-05' });

    const r = await migrar();

    expect(r.borradas).toEqual([{ id, alias: 'Amex', movimientos: 1 }]);
  });

  it('se lleva también sus lotes de importación y sus eventos', async () => {
    const id = await guardar('accounts', cuentaTarjeta());
    // `importBatches` lleva su id a mano · no lo pone la base.
    await guardar('importBatches', { id: 'lote-1', accountId: id, createdAt: '2026-01-01' });
    await guardar('treasuryEvents', { accountId: id, status: 'predicted', amount: -40 });

    await migrar();

    expect(await todos('importBatches')).toEqual([]);
    expect(await todos('treasuryEvents')).toEqual([]);
  });

  // Lo importado hace tiempo trae el id como cadena. Por el índice `accountId`
  // no aparecería, y se quedarían movimientos dentro de una cuenta que ya no
  // existe — sumando a un patrimonio sin sitio del que colgar.
  it('los movimientos con el id en texto también se van', async () => {
    const id = await guardar('accounts', cuentaTarjeta());
    await guardar('movements', { accountId: String(id), amount: -40, date: '2026-01-05' });

    const r = await migrar();

    expect(await todos('movements')).toEqual([]);
    expect(r.movimientosBorrados).toBe(1);
  });

  // El usuario ya la había quitado de la vista · dejar sus movimientos dentro
  // no conserva nada, solo esconde el mismo dinero contado dos veces.
  it.each([
    ['marcada como DELETED', { status: 'DELETED' }],
    ['con fecha de borrado', { deleted_at: '2026-01-01T00:00:00.000Z' }],
  ])('la borrada en blando %s también se va', async (_caso, marca) => {
    await guardar('accounts', cuentaTarjeta(marca));

    const r = await migrar();

    expect(await todos('accounts')).toEqual([]);
    expect(r.borradas).toHaveLength(1);
  });
});

describe('lo que no es una cuenta de tarjeta no se toca', () => {
  beforeEach(limpiar);

  it.each(['CORRIENTE', 'EFECTIVO'])('%s se queda con sus movimientos', async (tipo) => {
    const id = await guardar('accounts', cuentaTarjeta({ tipo, alias: 'Nómina' }));
    await guardar('movements', { accountId: id, amount: 1800, date: '2026-01-25' });

    const r = await migrar();

    expect(await todos('accounts')).toHaveLength(1);
    expect(await todos('movements')).toHaveLength(1);
    expect(r.borradas).toEqual([]);
  });

  it('los movimientos de la cuenta de al lado siguen ahí', async () => {
    const tarjeta = await guardar('accounts', cuentaTarjeta());
    const corriente = await guardar('accounts', cuentaTarjeta({ tipo: 'CORRIENTE', alias: 'Sabadell' }));
    await guardar('movements', { accountId: tarjeta, amount: -40, date: '2026-01-05' });
    await guardar('movements', { accountId: corriente, amount: -40, date: '2026-02-05' });

    await migrar();

    const quedan = await todos('movements');
    expect(quedan).toHaveLength(1);
    expect(quedan[0].accountId).toBe(corriente);
  });
});

// Un cinturón, no una garantía · pero borrar la cuenta de la que algo sigue
// cobrando deja ese algo apuntando al vacío, y eso no lo pidió nadie.
describe('no se borra una cuenta de la que algo sigue cobrando', () => {
  beforeEach(limpiar);

  it('una tarjeta que se liquida en ella la conserva', async () => {
    const id = await guardar('accounts', cuentaTarjeta());
    await guardar('tarjetas', {
      alias: 'Carrefour',
      origen: 'externa',
      modalidad: 'credito',
      cuentaLiquidacionId: id,
      activa: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    });

    const r = await migrar();

    expect(await todos('accounts')).toHaveLength(1);
    expect(r.borradas).toEqual([]);
    expect(r.conservadas[0].porque).toContain('Carrefour');
  });

  it('otra cuenta que carga ahí su recibo la conserva', async () => {
    const id = await guardar('accounts', cuentaTarjeta());
    await guardar(
      'accounts',
      cuentaTarjeta({ tipo: 'CORRIENTE', alias: 'Sabadell', cardConfig: { settlementDay: 5, chargeAccountId: id } })
    );

    const r = await migrar();

    expect(r.conservadas).toHaveLength(1);
    expect(r.conservadas[0].porque).toContain('Sabadell');
  });

  // Esa también se va · protegerla con una referencia que va a desaparecer
  // dejaría las dos cuentas donde estaban.
  it('la referencia desde otra cuenta de tarjeta no protege', async () => {
    const id = await guardar('accounts', cuentaTarjeta({ alias: 'Visa' }));
    await guardar('accounts', cuentaTarjeta({ alias: 'Amex', cardConfig: { settlementDay: 5, chargeAccountId: id } }));

    const r = await migrar();

    expect(await todos('accounts')).toEqual([]);
    expect(r.borradas).toHaveLength(2);
  });
});

// Un evento con el id de un movimiento que ya no existe no es un cabo suelto
// inofensivo: se lee como «esto ya se cobró», y el apunte que lo probaba no
// aparece por ninguna parte.
describe('nada se queda apuntando a un movimiento borrado', () => {
  beforeEach(limpiar);

  it.each(['executedMovementId', 'movementId'])('%s se suelta y el evento vuelve a previsto', async (campo) => {
    const tarjeta = await guardar('accounts', cuentaTarjeta());
    const corriente = await guardar('accounts', cuentaTarjeta({ tipo: 'CORRIENTE', alias: 'Sabadell' }));
    const movId = await guardar('movements', { accountId: tarjeta, amount: -40, date: '2026-01-05' });
    await guardar('treasuryEvents', {
      accountId: corriente,
      status: 'executed',
      amount: -40,
      [campo]: movId,
    });

    const r = await migrar();

    const [ev] = await todos('treasuryEvents');
    expect(ev[campo]).toBeUndefined();
    expect(ev.status).toBe('predicted');
    expect(r.eventosDesenlazados).toBe(1);
  });

  it('un evento que apunta a un movimiento vivo no se toca', async () => {
    await guardar('accounts', cuentaTarjeta());
    const corriente = await guardar('accounts', cuentaTarjeta({ tipo: 'CORRIENTE', alias: 'Sabadell' }));
    const movId = await guardar('movements', { accountId: corriente, amount: -40, date: '2026-01-05' });
    await guardar('treasuryEvents', {
      accountId: corriente,
      status: 'executed',
      amount: -40,
      executedMovementId: movId,
    });

    const r = await migrar();

    const [ev] = await todos('treasuryEvents');
    expect(ev.executedMovementId).toBe(movId);
    expect(ev.status).toBe('executed');
    expect(r.eventosDesenlazados).toBe(0);
  });
});

describe('repetirla no hace nada', () => {
  beforeEach(limpiar);

  it('la segunda pasada ya no encuentra ninguna', async () => {
    const id = await guardar('accounts', cuentaTarjeta());
    await guardar('movements', { accountId: id, amount: -40, date: '2026-01-05' });

    const primera = await migrar();
    const segunda = await migrar();

    expect(primera.borradas).toHaveLength(1);
    expect(segunda.borradas).toEqual([]);
    expect(segunda.movimientosBorrados).toBe(0);
  });
});
