import { calculateTreasuryMonthOpeningBalance } from './treasuryMonthOpeningBalance';
import type { Account, Movement, TreasuryEvent } from '../../services/db';

const makeAccount = (overrides: Partial<Account> = {}): Account => ({
  id: overrides.id ?? 1,
  iban: overrides.iban ?? 'ES1',
  status: overrides.status ?? 'ACTIVE',
  activa: overrides.activa ?? true,
  createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
  updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00.000Z',
  openingBalance: overrides.openingBalance ?? 1000,
  openingBalanceDate: overrides.openingBalanceDate ?? '2026-03-01',
  ...overrides,
});

const makeEvent = (overrides: Partial<TreasuryEvent> = {}): TreasuryEvent => ({
  id: overrides.id,
  accountId: overrides.accountId ?? 1,
  type: overrides.type ?? 'income',
  amount: overrides.amount ?? 0,
  predictedDate: overrides.predictedDate ?? '2026-03-01',
  description: overrides.description ?? 'Evento',
  sourceType: overrides.sourceType ?? 'manual',
  status: overrides.status ?? 'confirmed',
  createdAt: overrides.createdAt ?? '2026-03-01T00:00:00.000Z',
  updatedAt: overrides.updatedAt ?? '2026-03-01T00:00:00.000Z',
  ...overrides,
});

const makeMovement = (overrides: Partial<Movement> = {}): Movement => ({
  id: overrides.id,
  accountId: overrides.accountId ?? 1,
  date: overrides.date ?? '2026-03-01',
  amount: overrides.amount ?? 0,
  description: overrides.description ?? 'Movimiento',
  status: overrides.status ?? 'pendiente',
  unifiedStatus: overrides.unifiedStatus ?? 'confirmado',
  source: overrides.source ?? 'manual',
  category: overrides.category ?? { tipo: 'General' },
  type: overrides.type ?? 'Ajuste',
  origin: overrides.origin ?? 'Manual',
  movementState: overrides.movementState ?? 'Confirmado',
  ambito: overrides.ambito ?? 'PERSONAL',
  statusConciliacion: overrides.statusConciliacion ?? 'sin_match',
  createdAt: overrides.createdAt ?? '2026-03-01T00:00:00.000Z',
  updatedAt: overrides.updatedAt ?? '2026-03-01T00:00:00.000Z',
  ...overrides,
});

describe('calculateTreasuryMonthOpeningBalance', () => {
  it('keeps current and past month openings tied to the real ledger balance', () => {
    const balance = calculateTreasuryMonthOpeningBalance({
      account: makeAccount(),
      selectedMonth: '2026-03',
      treasuryEvents: [
        makeEvent({ type: 'income', amount: 200, predictedDate: '2026-02-10' }),
      ],
      movements: [
        makeMovement({ amount: -50, date: '2026-02-12' }),
      ],
      today: new Date('2026-03-20T12:00:00.000Z'),
    });

    expect(balance).toBeCloseTo(1150, 2);
  });

  it('rolls future month openings from the previous month forecast close so april starts where march ends', () => {
    const balance = calculateTreasuryMonthOpeningBalance({
      account: makeAccount({ openingBalance: 35083.01, openingBalanceDate: '2026-03-01' }),
      selectedMonth: '2026-04',
      treasuryEvents: [
        makeEvent({ type: 'income', amount: 17921.91, predictedDate: '2026-03-25', status: 'predicted' }),
        makeEvent({ type: 'expense', amount: 42555.2, predictedDate: '2026-03-26', status: 'predicted' }),
        makeEvent({ type: 'financing', amount: 90459.69, predictedDate: '2026-03-27', status: 'predicted' }),
      ],
      movements: [
        makeMovement({ amount: 133000, date: '2026-03-10' }),
      ],
      today: new Date('2026-03-20T12:00:00.000Z'),
    });

    expect(balance).toBeCloseTo(-80009.97, 2);
  });

  it('chains projected month closes across multiple future months', () => {
    const balance = calculateTreasuryMonthOpeningBalance({
      account: makeAccount({ openingBalance: 1000, openingBalanceDate: '2026-03-01' }),
      selectedMonth: '2026-05',
      treasuryEvents: [
        makeEvent({ type: 'income', amount: 200, predictedDate: '2026-03-15', status: 'predicted' }),
        makeEvent({ type: 'expense', amount: 50, predictedDate: '2026-04-10', status: 'predicted' }),
      ],
      movements: [],
      today: new Date('2026-03-20T12:00:00.000Z'),
    });

    expect(balance).toBeCloseTo(1150, 2);
  });
});
