import { resolveDisplayAccountId } from '../components/treasury/TreasuryReconciliationView';

describe('resolveDisplayAccountId', () => {
  test('maps credit-card accountId to charge accountId', () => {
    const cardSettlementByAccountId = new Map([[42, { chargeAccountId: 7 }]]);

    const result = resolveDisplayAccountId({
      eventAccountId: 42,
      eventSourceId: 999,
      sourceType: 'personal_expense',
      cardSettlementByAccountId,
      cardAliasMatchers: [],
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
      cardAliasMatchers: [],
    });

    expect(result).toBe(7);
  });

  test('maps receipt description alias to charge account when accountId is missing', () => {
    const cardSettlementByAccountId = new Map<number, { chargeAccountId: number }>();
    const cardAliasMatchers = [{ label: 'carrefour pass', config: { chargeAccountId: 11 } }];

    const result = resolveDisplayAccountId({
      eventAccountId: undefined,
      eventSourceId: undefined,
      sourceType: 'manual',
      description: 'Recibo tarjeta Carrefour Pass',
      cardSettlementByAccountId,
      cardAliasMatchers,
    });

    expect(result).toBe(11);
  });

  test('does not map non receipt descriptions by alias fallback', () => {
    const cardSettlementByAccountId = new Map<number, { chargeAccountId: number }>();
    const cardAliasMatchers = [{ label: 'carrefour pass', config: { chargeAccountId: 11 } }];

    const result = resolveDisplayAccountId({
      eventAccountId: undefined,
      eventSourceId: undefined,
      sourceType: 'manual',
      description: 'Pago tarjeta Carrefour Pass',
      cardSettlementByAccountId,
      cardAliasMatchers,
    });

    expect(result).toBeUndefined();
  });


  test('matches compact receipt format without spaces', () => {
    const cardSettlementByAccountId = new Map<number, { chargeAccountId: number }>();
    const cardAliasMatchers = [{ label: 'carrefour pass', config: { chargeAccountId: 13 } }];

    const result = resolveDisplayAccountId({
      eventAccountId: undefined,
      eventSourceId: undefined,
      sourceType: 'manual',
      description: 'RECIBOTARJETA Carrefour Pass',
      cardSettlementByAccountId,
      cardAliasMatchers,
    });

    expect(result).toBe(13);
  });

  test('matches receipt alias by containment when labels differ slightly', () => {
    const cardSettlementByAccountId = new Map<number, { chargeAccountId: number }>();
    const cardAliasMatchers = [{ label: 'visa carrefour pass', config: { chargeAccountId: 15 } }];

    const result = resolveDisplayAccountId({
      eventAccountId: undefined,
      eventSourceId: undefined,
      sourceType: 'manual',
      description: 'Recibo tarjeta Carrefour Pass',
      cardSettlementByAccountId,
      cardAliasMatchers,
    });

    expect(result).toBe(15);
  });

  test('does not use sourceId fallback for non personal_expense events', () => {
    const cardSettlementByAccountId = new Map([[42, { chargeAccountId: 7 }]]);

    const result = resolveDisplayAccountId({
      eventAccountId: undefined,
      eventSourceId: 42,
      sourceType: 'contrato',
      cardSettlementByAccountId,
      cardAliasMatchers: [],
    });

    expect(result).toBeUndefined();
  });
});
