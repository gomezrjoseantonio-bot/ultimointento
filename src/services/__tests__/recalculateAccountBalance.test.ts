import { initDB } from '../db';
import { recalculateAccountBalance } from '../treasuryEventsService';

const baseAccount = (overrides: Record<string, any> = {}) => ({
  iban: 'ES6600491500051234567892',
  status: 'ACTIVE' as const,
  activa: true,
  isActive: true,
  alias: 'Cuenta principal',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const baseMovement = (overrides: Record<string, any> = {}) => ({
  status: 'conciliado' as const,
  unifiedStatus: 'conciliado' as const,
  source: 'manual' as const,
  type: 'Ingreso' as const,
  origin: 'Manual' as const,
  movementState: 'Conciliado' as const,
  ambito: 'PERSONAL' as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe('recalculateAccountBalance · frontera del saldo inicial', () => {
  beforeEach(async () => {
    const db = await initDB();
    await Promise.all([db.clear('accounts'), db.clear('movements')]);
  });

  it('no suma movimientos anteriores al openingBalanceDate (ya están en el saldo de apertura)', async () => {
    const db = await initDB();
    const accountId = Number(await db.add('accounts', baseAccount({
      openingBalance: 250000,
      openingBalanceDate: '2026-07-31',
    })));

    // Movimiento sintético de apertura (se ignora siempre).
    await db.add('movements', baseMovement({
      accountId,
      amount: 250000,
      date: '2026-07-31',
      isOpeningBalance: true,
      description: 'Saldo inicial de apertura',
    }));
    // Anterior al saldo inicial → NO debe contarse.
    await db.add('movements', baseMovement({
      accountId,
      amount: 180000,
      date: '2026-03-15',
      description: 'Cobro venta (prehistoria)',
    }));
    // Posterior al saldo inicial → sí cuenta.
    await db.add('movements', baseMovement({
      accountId,
      amount: -1000,
      type: 'Gasto',
      date: '2026-08-05',
      description: 'Gasto posterior',
    }));

    await recalculateAccountBalance(accountId);

    const account = await db.get('accounts', accountId);
    // 250000 (apertura) − 1000 (post) = 249000. El +180000 del 15/3 queda fuera.
    expect(account?.balance).toBe(249000);
  });

  it('sin openingBalanceDate cuenta todos los movimientos (sin frontera)', async () => {
    const db = await initDB();
    const accountId = Number(await db.add('accounts', baseAccount({
      openingBalance: 1000,
    })));

    await db.add('movements', baseMovement({ accountId, amount: 500, date: '2020-01-01' }));
    await db.add('movements', baseMovement({ accountId, amount: -200, type: 'Gasto', date: '2026-08-05' }));

    await recalculateAccountBalance(accountId);

    const account = await db.get('accounts', accountId);
    expect(account?.balance).toBe(1300);
  });
});
