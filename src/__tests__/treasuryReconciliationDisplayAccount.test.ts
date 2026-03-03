import { resolveDisplayAccountId } from '../components/treasury/TreasuryReconciliationView';

describe('resolveDisplayAccountId', () => {
  test('maps credit-card accountId to charge accountId', () => {
    const cardSettlementByAccountId = new Map([[42, { chargeAccountId: 7 }]]);

    const result = resolveDisplayAccountId({
      eventAccountId: 42,
      eventSourceId: 999,
      sourceType: 'personal_expense',
      cardSettlementByAccountId,
      cardSettlementByAlias: new Map(),
    });

    expect(result).toBe(7);
  });

  test('falls back to sourceId for legacy card receipts without accountId', () => {
    const cardSettlementByAccountId = new Map([[42, { chargeAccountId: 7 }]]);

    const result = resolveDisplayAccountId({
      eventAccountId: undefined,
      eventSourceId: 42,
      sourceType: 'personal_expense',
      cardSettlementByAccountId,
      cardSettlementByAlias: new Map(),
    });

    expect(result).toBe(7);
  });

  test('maps receipt description alias to charge account when accountId is missing', () => {
    const cardSettlementByAccountId = new Map<number, { chargeAccountId: number }>();
    const cardSettlementByAlias = new Map([['carrefour pass', { chargeAccountId: 11 }]]);

    const result = resolveDisplayAccountId({
      eventAccountId: undefined,
      eventSourceId: undefined,
      sourceType: 'manual',
      description: 'Recibo tarjeta Carrefour Pass',
      cardSettlementByAccountId,
      cardSettlementByAlias,
    });

    expect(result).toBe(11);
  });

  test('does not map non receipt descriptions by alias fallback', () => {
    const cardSettlementByAccountId = new Map<number, { chargeAccountId: number }>();
    const cardSettlementByAlias = new Map([['carrefour pass', { chargeAccountId: 11 }]]);

    const result = resolveDisplayAccountId({
      eventAccountId: undefined,
      eventSourceId: undefined,
      sourceType: 'manual',
      description: 'Pago tarjeta Carrefour Pass',
      cardSettlementByAccountId,
      cardSettlementByAlias,
    });

    expect(result).toBeUndefined();
  });

  test('does not use sourceId fallback for non personal_expense events', () => {
    const cardSettlementByAccountId = new Map([[42, { chargeAccountId: 7 }]]);

    const result = resolveDisplayAccountId({
      eventAccountId: undefined,
      eventSourceId: 42,
      sourceType: 'contrato',
      cardSettlementByAccountId,
      cardSettlementByAlias: new Map(),
    });

    expect(result).toBeUndefined();
  });
});
