import { resolveDisplayAccountId } from '../components/treasury/TreasuryReconciliationView';

describe('resolveDisplayAccountId', () => {
  test('maps credit-card accountId to charge accountId', () => {
    const cardSettlementByAccountId = new Map([[42, { chargeAccountId: 7 }]]);

    const result = resolveDisplayAccountId({
      eventAccountId: 42,
      eventSourceId: 999,
      sourceType: 'personal_expense',
      cardSettlementByAccountId,
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
    });

    expect(result).toBe(7);
  });

  test('does not use sourceId fallback for non personal_expense events', () => {
    const cardSettlementByAccountId = new Map([[42, { chargeAccountId: 7 }]]);

    const result = resolveDisplayAccountId({
      eventAccountId: undefined,
      eventSourceId: 42,
      sourceType: 'contrato',
      cardSettlementByAccountId,
    });

    expect(result).toBeUndefined();
  });
});
