// TAREA 17 sub-task 17.2 · Tests for movementMatchingService.
//
// Covers the 6 obligatory cases in spec §3.1:
//   1. Same-day, same-account, same-amount, contract event → high-score match
//   2. One-day-adjacent date difference → 65 (no provider) or 90 (with provider)
//   3. One movement vs two passing events → multiMatches[]
//   4. Two movements compete for one event → higher score wins, the loser
//      drops to sinMatch[]
//   5. Events in non-'predicted' status are ignored as candidates
//   6. fechaWindowDays boundary excludes events outside the window
import { matchBatch } from '../movementMatchingService';
import { initDB, Movement, TreasuryEvent } from '../db';

jest.mock('../db', () => ({
  initDB: jest.fn(),
}));

interface FakeStores {
  movements: Movement[];
  treasuryEvents: TreasuryEvent[];
}

function buildDb(stores: FakeStores) {
  const lookup = (storeName: keyof FakeStores) => stores[storeName] ?? [];
  return {
    get: jest.fn(async (storeName: keyof FakeStores, key: number) => {
      return lookup(storeName).find((row: any) => row.id === key);
    }),
    getAll: jest.fn(async (storeName: keyof FakeStores) => lookup(storeName)),
    getAllFromIndex: jest.fn(
      async (storeName: keyof FakeStores, _index: string, value: number) => {
        if (storeName !== 'treasuryEvents') return [];
        return stores.treasuryEvents.filter(e => e.accountId === value);
      },
    ),
  };
}

const baseMovement: Movement = {
  id: 0,
  accountId: 0,
  date: '2026-04-22',
  amount: 0,
  description: '',
  status: 'pending' as any,
  unifiedStatus: 'no_planificado',
  source: 'import',
  category: { tipo: '' },
};

const baseEvent: TreasuryEvent = {
  id: 0,
  type: 'income',
  amount: 0,
  predictedDate: '2026-04-22',
  description: '',
  sourceType: 'contract',
  status: 'predicted',
  accountId: 0,
};

const movement = (overrides: Partial<Movement>): Movement => ({
  ...baseMovement,
  ...overrides,
});

const event = (overrides: Partial<TreasuryEvent>): TreasuryEvent => ({
  ...baseEvent,
  ...overrides,
});

describe('movementMatchingService.matchBatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('1. Same date + amount + account + contract event ⇒ score ≥ 90 ⇒ matches[]', async () => {
    const stores: FakeStores = {
      movements: [
        movement({
          id: 1,
          accountId: 42,
          date: '2026-04-22',
          amount: 380,
          description: 'TRANSFERENCIA RECIBIDA INQUILINO PEREZ',
        }),
      ],
      treasuryEvents: [
        event({
          id: 100,
          accountId: 42,
          type: 'income',
          amount: 380,
          predictedDate: '2026-04-22',
          providerName: 'Inquilino Perez',
          sourceType: 'contract',
        }),
      ],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(stores));

    const result = await matchBatch([1]);

    expect(result.sinMatch).toEqual([]);
    expect(result.multiMatches).toEqual([]);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].movementId).toBe(1);
    expect(result.matches[0].treasuryEventId).toBe(100);
    expect(result.matches[0].score).toBeGreaterThanOrEqual(90);
    expect(result.matches[0].reasons).toEqual(
      expect.arrayContaining([
        'fecha_exacta',
        'importe_exacto',
        'cuenta_match',
        'descripcion_proveedor',
      ]),
    );
  });

  it('2. One-day-adjacent date diff ⇒ 65 without provider, 90 with provider', async () => {
    const noProviderStores: FakeStores = {
      movements: [
        movement({
          id: 1,
          accountId: 42,
          date: '2026-04-23',
          amount: 380,
          description: 'CONCEPTO GENERICO SIN PROVEEDOR',
        }),
      ],
      treasuryEvents: [
        event({
          id: 100,
          accountId: 42,
          type: 'income',
          amount: 380,
          predictedDate: '2026-04-22',
        }),
      ],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(noProviderStores));

    const noProviderResult = await matchBatch([1]);
    // 20 (fecha_dia_adyacente) + 30 (importe_exacto) + 15 (cuenta_match) = 65
    // Threshold 70 → no candidate clears, goes to sinMatch.
    expect(noProviderResult.sinMatch).toEqual([1]);
    expect(noProviderResult.matches).toEqual([]);

    const withProviderStores: FakeStores = {
      movements: [
        movement({
          id: 1,
          accountId: 42,
          date: '2026-04-23',
          amount: 380,
          description: 'TRANSFERENCIA INQUILINO PEREZ ABRIL',
        }),
      ],
      treasuryEvents: [
        event({
          id: 100,
          accountId: 42,
          type: 'income',
          amount: 380,
          predictedDate: '2026-04-22',
          providerName: 'Inquilino Perez',
        }),
      ],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(withProviderStores));

    const withProviderResult = await matchBatch([1]);
    // 65 (above) + 25 (descripcion_proveedor) = 90
    expect(withProviderResult.matches).toHaveLength(1);
    expect(withProviderResult.matches[0].score).toBe(90);
  });

  it('3. One movement vs two passing events ⇒ multiMatches[]', async () => {
    const stores: FakeStores = {
      movements: [
        movement({
          id: 1,
          accountId: 42,
          date: '2026-04-22',
          amount: 500,
          description: 'TRANSFERENCIA RENTA ABRIL',
        }),
      ],
      treasuryEvents: [
        event({
          id: 100,
          accountId: 42,
          type: 'income',
          amount: 500,
          predictedDate: '2026-04-22',
        }),
        event({
          id: 101,
          accountId: 42,
          type: 'income',
          amount: 500,
          predictedDate: '2026-04-22',
        }),
      ],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(stores));

    const result = await matchBatch([1]);

    expect(result.matches).toEqual([]);
    expect(result.sinMatch).toEqual([]);
    expect(result.multiMatches).toHaveLength(1);
    expect(result.multiMatches[0].movementId).toBe(1);
    expect(result.multiMatches[0].candidates).toHaveLength(2);
    const eventIds = result.multiMatches[0].candidates.map(c => c.treasuryEventId).sort();
    expect(eventIds).toEqual([100, 101]);
    for (const candidate of result.multiMatches[0].candidates) {
      // 30 (fecha_exacta) + 30 (importe_exacto) + 15 (cuenta_match) = 75
      expect(candidate.score).toBeGreaterThanOrEqual(70);
    }
  });

  it('4. Two movements compete for one event ⇒ higher score wins, loser → sinMatch[]', async () => {
    const stores: FakeStores = {
      movements: [
        // Loser: same amount and account, no provider in description.
        movement({
          id: 1,
          accountId: 42,
          date: '2026-04-22',
          amount: 500,
          description: 'TRANSFERENCIA SIN PROVEEDOR',
        }),
        // Winner: provider explicitly named in description ⇒ +25.
        movement({
          id: 2,
          accountId: 42,
          date: '2026-04-22',
          amount: 500,
          description: 'TRANSFERENCIA INQUILINO PEREZ MES ABRIL',
        }),
      ],
      treasuryEvents: [
        event({
          id: 100,
          accountId: 42,
          type: 'income',
          amount: 500,
          predictedDate: '2026-04-22',
          providerName: 'Inquilino Perez',
        }),
      ],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(stores));

    const result = await matchBatch([1, 2]);

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].movementId).toBe(2);
    expect(result.matches[0].treasuryEventId).toBe(100);
    expect(result.sinMatch).toEqual([1]);
    expect(result.multiMatches).toEqual([]);
  });

  it('5. Events with status !== "predicted" are silently ignored', async () => {
    const stores: FakeStores = {
      movements: [
        movement({
          id: 1,
          accountId: 42,
          date: '2026-04-22',
          amount: 380,
          description: 'TRANSFERENCIA INQUILINO PEREZ',
        }),
      ],
      treasuryEvents: [
        event({
          id: 100,
          accountId: 42,
          type: 'income',
          amount: 380,
          predictedDate: '2026-04-22',
          providerName: 'Inquilino Perez',
          status: 'confirmed', // already confirmed → not a candidate
        }),
        event({
          id: 101,
          accountId: 42,
          type: 'income',
          amount: 380,
          predictedDate: '2026-04-22',
          providerName: 'Inquilino Perez',
          status: 'executed', // already matched to another movement → not a candidate
        }),
      ],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(stores));

    const result = await matchBatch([1]);

    expect(result.matches).toEqual([]);
    expect(result.multiMatches).toEqual([]);
    expect(result.sinMatch).toEqual([1]);
  });

  it('6. fechaWindowDays excludes events outside the window', async () => {
    const stores: FakeStores = {
      movements: [
        movement({
          id: 1,
          accountId: 42,
          date: '2026-04-22',
          amount: 380,
          description: 'TRANSFERENCIA INQUILINO PEREZ',
        }),
      ],
      treasuryEvents: [
        event({
          id: 100,
          accountId: 42,
          type: 'income',
          amount: 380,
          predictedDate: '2026-04-30', // 8 days away
          providerName: 'Inquilino Perez',
        }),
      ],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(stores));

    const result = await matchBatch([1], { fechaWindowDays: 5 });

    expect(result.matches).toEqual([]);
    expect(result.multiMatches).toEqual([]);
    expect(result.sinMatch).toEqual([1]);
  });
});
