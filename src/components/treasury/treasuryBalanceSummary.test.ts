import { calculateAccountTreasurySummary } from './treasuryBalanceSummary';
import type { TreasuryEvent } from './TreasuryReconciliationView';

const account = { id: 'bbva', balance: 940.92 };

const makeEvent = (overrides: Partial<TreasuryEvent>): TreasuryEvent => ({
  id: overrides.id ?? Math.random().toString(),
  accountId: overrides.accountId ?? 'bbva',
  concept: overrides.concept ?? 'Movimiento',
  amount: overrides.amount ?? 0,
  date: overrides.date ?? '2026-03-01',
  type: overrides.type ?? 'expense',
  status: overrides.status ?? 'previsto',
  ...overrides,
});

describe('calculateAccountTreasurySummary', () => {
  it('calcula hoy con punteados hasta hoy y fin de mes con todos los eventos del mes', () => {
    const events: TreasuryEvent[] = [
      makeEvent({ id: '1', amount: 351.43, date: '2026-03-05', status: 'confirmado', type: 'financing' }),
      makeEvent({ id: '2', amount: 140, date: '2026-03-05', status: 'confirmado', type: 'expense' }),
      makeEvent({ id: '3', amount: 157.9, date: '2026-03-05', status: 'confirmado', type: 'expense' }),
      makeEvent({ id: '4', amount: 100, date: '2026-03-05', status: 'confirmado', type: 'income' }),
      makeEvent({ id: '5', amount: 107.33, date: '2026-03-16', status: 'confirmado', type: 'expense' }),
      makeEvent({ id: '6', amount: 300, date: '2026-03-18', status: 'confirmado', type: 'income' }),
      makeEvent({ id: '7', amount: 95.33, date: '2026-03-28', status: 'previsto', type: 'expense' }),
      makeEvent({ id: '8', amount: 71.5, date: '2026-03-28', status: 'previsto', type: 'expense' }),
      makeEvent({ id: '9', amount: 71.5, date: '2026-03-28', status: 'previsto', type: 'expense' }),
      makeEvent({ id: '10', amount: 285.4, date: '2026-03-31', status: 'previsto', type: 'financing' }),
    ];

    const summary = calculateAccountTreasurySummary({
      account,
      events,
      selectedMonth: '2026-03',
      today: new Date('2026-03-18T12:00:00.000Z'),
    });

    expect(summary.hoy).toBeCloseTo(584.26, 2);
    expect(summary.totalPunteado).toBeCloseTo(584.26, 2);
    expect(summary.finMes).toBeCloseTo(60.53, 2);
    expect(summary.pendienteTotal).toBeCloseTo(-523.73, 2);
  });

  it('no adelanta al hoy movimientos confirmados con fecha futura, pero sí los refleja en total punteado', () => {
    const events: TreasuryEvent[] = [
      makeEvent({ id: '1', amount: 250, date: '2026-03-20', status: 'confirmado', type: 'income' }),
    ];

    const summary = calculateAccountTreasurySummary({
      account,
      events,
      selectedMonth: '2026-03',
      today: new Date('2026-03-18T12:00:00.000Z'),
    });

    expect(summary.hoy).toBeCloseTo(940.92, 2);
    expect(summary.totalPunteado).toBeCloseTo(1190.92, 2);
    expect(summary.finMes).toBeCloseTo(1190.92, 2);
  });
});
