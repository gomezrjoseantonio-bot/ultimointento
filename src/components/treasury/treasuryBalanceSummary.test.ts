import { calculateAccountTreasurySummary } from './treasuryBalanceSummary';
import type { Movement } from '../../services/db';
import type { TreasuryEvent } from './TreasuryReconciliationView';

const account = { id: '1', balance: 940.92 };

const makeEvent = (overrides: Partial<TreasuryEvent>): TreasuryEvent => ({
  id: overrides.id ?? Math.random().toString(),
  accountId: overrides.accountId ?? '1',
  concept: overrides.concept ?? 'Movimiento',
  amount: overrides.amount ?? 0,
  date: overrides.date ?? '2026-03-01',
  type: overrides.type ?? 'expense',
  status: overrides.status ?? 'previsto',
  ...overrides,
});

const makeMovement = (overrides: Partial<Movement>): Movement => ({
  id: overrides.id,
  accountId: overrides.accountId ?? 0,
  date: overrides.date ?? '2026-03-01',
  amount: overrides.amount ?? 0,
  description: overrides.description ?? 'Movimiento bancario',
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

describe('calculateAccountTreasurySummary', () => {
  it('calcula hoy con punteados y movimientos reales hasta hoy, y fin de mes con toda la actividad del mes', () => {
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

    const movements: Movement[] = [
      makeMovement({ accountId: Number.NaN, amount: 999, date: '2026-03-08' }),
      makeMovement({ accountId: 1, amount: 25.5, date: '2026-03-10' }),
      makeMovement({ accountId: 1, amount: -10.25, date: '2026-03-25' }),
    ];

    const summary = calculateAccountTreasurySummary({
      account,
      events,
      movements,
      selectedMonth: '2026-03',
      today: new Date('2026-03-18T12:00:00.000Z'),
    });

    expect(summary.hoy).toBeCloseTo(609.76, 2);
    expect(summary.totalPunteado).toBeCloseTo(599.51, 2);
    expect(summary.finMes).toBeCloseTo(75.78, 2);
    expect(summary.pendienteTotal).toBeCloseTo(-523.73, 2);
    expect(summary.movimientosHastaHoy).toBeCloseTo(25.5, 2);
    expect(summary.movimientosTotal).toBeCloseTo(15.25, 2);
  });

  it('mantiene el saldo real de marzo cuando los movimientos ya existen aunque los eventos sigan pendientes sin puntear', () => {
    const summary = calculateAccountTreasurySummary({
      account: { id: '1', balance: 460 },
      events: [
        makeEvent({ id: '1', amount: 22.99, date: '2026-03-01', status: 'previsto', type: 'expense' }),
        makeEvent({ id: '2', amount: 431.61, date: '2026-03-01', status: 'previsto', type: 'expense' }),
        makeEvent({ id: '3', amount: 0.51, date: '2026-03-18', status: 'previsto', type: 'income' }),
        makeEvent({ id: '4', amount: 22514.97, date: '2026-03-18', status: 'previsto', type: 'expense' }),
        makeEvent({ id: '5', amount: 22510, date: '2026-03-18', status: 'previsto', type: 'income' }),
      ],
      movements: [
        makeMovement({ id: 101, accountId: 1, amount: -22.99, date: '2026-03-01' }),
        makeMovement({ id: 102, accountId: 1, amount: -431.61, date: '2026-03-01' }),
        makeMovement({ id: 103, accountId: 1, amount: 0.51, date: '2026-03-18' }),
        makeMovement({ id: 104, accountId: 1, amount: -22514.97, date: '2026-03-18' }),
        makeMovement({ id: 105, accountId: 1, amount: 22510, date: '2026-03-18' }),
      ],
      selectedMonth: '2026-03',
      today: new Date('2026-03-20T12:00:00.000Z'),
    });

    expect(summary.movimientosHastaHoy).toBeCloseTo(-459.06, 2);
    expect(summary.pendienteHastaHoy).toBeCloseTo(0, 2);
    expect(summary.hoy).toBeCloseTo(0.94, 2);
    expect(summary.finMes).toBeCloseTo(0.94, 2);
  });


  it('no adelanta al hoy movimientos o eventos fechados en futuro, pero sí los refleja en total punteado y fin de mes', () => {
    const events: TreasuryEvent[] = [
      makeEvent({ id: '1', amount: 250, date: '2026-03-20', status: 'confirmado', type: 'income' }),
    ];

    const movements: Movement[] = [
      makeMovement({ accountId: 1, amount: -50, date: '2026-03-21' }),
    ];

    const summary = calculateAccountTreasurySummary({
      account,
      events,
      movements,
      selectedMonth: '2026-03',
      today: new Date('2026-03-18T12:00:00.000Z'),
    });

    expect(summary.hoy).toBeCloseTo(940.92, 2);
    expect(summary.totalPunteado).toBeCloseTo(1140.92, 2);
    expect(summary.finMes).toBeCloseTo(1140.92, 2);
    expect(summary.movimientosHastaHoy).toBeCloseTo(0, 2);
    expect(summary.movimientosTotal).toBeCloseTo(-50, 2);
  });

  it('mantiene continuidad entre el cierre de un mes y la apertura del siguiente cuando solo hay movimientos bancarios', () => {
    const marchSummary = calculateAccountTreasurySummary({
      account,
      events: [],
      movements: [
        makeMovement({ accountId: 1, amount: 120, date: '2026-03-12' }),
        makeMovement({ accountId: 1, amount: -40, date: '2026-03-24' }),
      ],
      selectedMonth: '2026-03',
      today: new Date('2026-03-31T12:00:00.000Z'),
    });

    const aprilSummary = calculateAccountTreasurySummary({
      account: { id: '1', balance: marchSummary.finMes },
      events: [],
      movements: [],
      selectedMonth: '2026-04',
      today: new Date('2026-04-01T12:00:00.000Z'),
    });

    expect(marchSummary.finMes).toBeCloseTo(1020.92, 2);
    expect(aprilSummary.hoy).toBeCloseTo(marchSummary.finMes, 2);
    expect(aprilSummary.finMes).toBeCloseTo(marchSummary.finMes, 2);
  });

  it('no duplica movimientos bancarios cuando un evento confirmado ya tiene el mismo importe y fecha aunque no siga punteado', () => {
    const summary = calculateAccountTreasurySummary({
      account,
      events: [
        makeEvent({
          id: '1',
          amount: 200,
          date: '2026-03-12',
          status: 'confirmado',
          type: 'expense',
        }),
      ],
      movements: [
        makeMovement({
          id: 9101,
          accountId: 1,
          amount: -200,
          date: '2026-03-12',
        }),
        makeMovement({
          id: 9102,
          accountId: 1,
          amount: -50,
          date: '2026-03-13',
        }),
      ],
      selectedMonth: '2026-03',
      today: new Date('2026-03-31T12:00:00.000Z'),
    });

    expect(summary.movimientosTotal).toBeCloseTo(-50, 2);
    expect(summary.totalPunteado).toBeCloseTo(690.92, 2);
    expect(summary.finMes).toBeCloseTo(690.92, 2);
  });

  it('no duplica movimientos bancarios ya conciliados con eventos de tesorería', () => {
    const summary = calculateAccountTreasurySummary({
      account,
      events: [
        makeEvent({
          id: '1',
          amount: 200,
          date: '2026-03-12',
          status: 'confirmado',
          type: 'expense',
          movementId: 9001,
        }),
      ],
      movements: [
        makeMovement({
          id: 9001,
          accountId: 1,
          amount: -200,
          date: '2026-03-12',
          statusConciliacion: 'match_manual',
        }),
        makeMovement({
          id: 9002,
          accountId: 1,
          amount: -50,
          date: '2026-03-13',
        }),
      ],
      selectedMonth: '2026-03',
      today: new Date('2026-03-31T12:00:00.000Z'),
    });

    expect(summary.movimientosTotal).toBeCloseTo(-50, 2);
    expect(summary.totalPunteado).toBeCloseTo(690.92, 2);
    expect(summary.finMes).toBeCloseTo(690.92, 2);
  });
});
