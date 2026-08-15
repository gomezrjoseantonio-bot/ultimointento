const mockDB = {
  getAll: jest.fn(),
  put: jest.fn(),
};

jest.mock('../services/db', () => ({
  initDB: jest.fn(() => Promise.resolve(mockDB)),
}));

import {
  calculateAccountBalanceAtDate,
  calculateTotalInitialCash,
  rollForwardAccountBalancesToMonth,
} from '../services/accountBalanceService';
import { initDB } from '../services/db';

describe('accountBalanceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (initDB as jest.Mock).mockResolvedValue(mockDB);
  });

  it('calculates account balance from opening balance + previous events + previous movements', () => {
    const value = calculateAccountBalanceAtDate({
      account: {
        id: 1,
        iban: 'ES1',
        status: 'ACTIVE',
        activa: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        openingBalance: 1000,
        openingBalanceDate: '2024-01-01',
      },
      cutoffDate: '2024-03-01',
      treasuryEvents: [
        { accountId: 1, type: 'income', amount: 200, predictedDate: '2024-02-10' } as any,
        { accountId: 1, type: 'expense', amount: 50, predictedDate: '2024-02-12' } as any,
        { accountId: 1, type: 'income', amount: 999, predictedDate: '2024-03-02' } as any,
      ],
      movements: [
        { accountId: 1, amount: -20, date: '2024-02-15' } as any,
        { accountId: 1, amount: 500, date: '2024-03-01' } as any,
      ],
    });

    expect(value).toBe(1130);
  });

  it('un evento executed descuenta su importe REAL (actualAmount), no el previsto', () => {
    // Previsión de gas: previsto 30 €, real 13,38 €. Al puntear se marca executed
    // con actualAmount=13,38 y su movimiento (−13,38) queda vinculado (movementId).
    // El saldo debe bajar 13,38, no 30. Antes contaba `amount` (30) → saldo 16,62
    // demasiado bajo (760 en vez de 777).
    const value = calculateAccountBalanceAtDate({
      account: {
        id: 4,
        iban: 'ES4',
        status: 'ACTIVE',
        activa: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        openingBalance: 1000,
        openingBalanceDate: '2026-01-01',
      } as any,
      cutoffDate: '2026-08-15',
      treasuryEvents: [
        {
          id: 900,
          accountId: 4,
          type: 'expense',
          amount: -30, // previsto
          actualAmount: 13.38, // real (magnitud positiva)
          predictedDate: '2026-08-03',
          status: 'executed',
          movementId: 55,
        } as any,
      ],
      movements: [
        // El movimiento real vinculado · se excluye (reconciledMovementIds) para
        // no contar dos veces; el importe lo aporta el evento con su actualAmount.
        { id: 55, accountId: 4, amount: -13.38, date: '2026-08-03' } as any,
      ],
    });

    expect(value).toBeCloseTo(986.62, 2); // 1000 − 13,38
  });

  it('una compra con tarjeta de CRÉDITO no mueve el saldo (sale en el recibo)', () => {
    const value = calculateAccountBalanceAtDate({
      account: {
        id: 5,
        iban: 'ES5',
        status: 'ACTIVE',
        activa: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        openingBalance: 1000,
        openingBalanceDate: '2026-01-01',
      } as any,
      cutoffDate: '2026-08-20',
      treasuryEvents: [],
      movements: [
        // Compra manual en tarjeta de crédito · NO descuenta ahora.
        { id: 70, accountId: 5, amount: -80, date: '2026-08-10', gastoTarjetaCredito: true } as any,
        // Un gasto normal de la misma cuenta sí descuenta.
        { id: 71, accountId: 5, amount: -20, date: '2026-08-11' } as any,
      ],
    });

    expect(value).toBe(980); // 1000 − 20 (la compra de crédito de 80 no cuenta)
  });


  it('saldo vivo · un abono real del extracto cuenta aunque el banco lo valore por delante de hoy', () => {
    // Caso real Sabadell: hoy es 15/08, y la remuneración mensual (+1,03) llega
    // en el extracto fechada el 17/08 con el saldo del banco ya subido. Con el
    // corte estricto (mañana = 16/08) ese abono quedaba fuera y "no subía a la
    // cuenta". En saldo VIVO tiene que contar: ha ocurrido, lo dice el extracto.
    const params = {
      account: {
        id: 6,
        iban: 'ES6',
        status: 'ACTIVE',
        activa: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        openingBalance: 777.04,
        openingBalanceDate: '2026-01-01',
      } as any,
      cutoffDate: '2026-08-16', // corteParaSaldoVivo('2026-08-15')
      treasuryEvents: [],
      movements: [
        { id: 80, accountId: 6, amount: 1.03, date: '2026-08-17', source: 'import' } as any,
      ],
    };

    // Histórico (por defecto): el abono del 17 no entra en un corte del 16.
    expect(calculateAccountBalanceAtDate(params)).toBeCloseTo(777.04, 2);
    // Vivo: la realidad manda sobre la fecha de valor · 777,04 + 1,03 = 778,07.
    expect(
      calculateAccountBalanceAtDate({ ...params, incluirRealesFuturos: true })
    ).toBeCloseTo(778.07, 2);
  });

  it('saldo vivo · una previsión futura NO cuenta aunque se incluyan reales futuros', () => {
    // El flag solo abre la puerta a la REALIDAD (movimientos). Una previsión
    // sigue esperando su día: contarla inflaría el saldo con dinero no ocurrido.
    const value = calculateAccountBalanceAtDate({
      account: {
        id: 7,
        iban: 'ES7',
        status: 'ACTIVE',
        activa: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        openingBalance: 100,
        openingBalanceDate: '2026-01-01',
      } as any,
      cutoffDate: '2026-08-16',
      treasuryEvents: [
        { accountId: 7, type: 'income', amount: 500, predictedDate: '2026-08-30', status: 'predicted' } as any,
      ],
      movements: [],
      incluirRealesFuturos: true,
    });

    expect(value).toBe(100);
  });

  it('allows callers to ignore imported movements when projecting month openings for treasury forecast continuity', () => {
    const value = calculateAccountBalanceAtDate({
      account: {
        id: 1,
        iban: 'ES1',
        status: 'ACTIVE',
        activa: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        openingBalance: 1000,
        openingBalanceDate: '2024-01-01',
      },
      cutoffDate: '2024-03-01',
      treasuryEvents: [
        { accountId: 1, type: 'income', amount: 200, predictedDate: '2024-02-10' } as any,
        { accountId: 1, type: 'expense', amount: 50, predictedDate: '2024-02-12' } as any,
      ],
      movements: [],
    });

    expect(value).toBe(1150);
  });

  it('ignores the synthetic opening balance movement to avoid double counting across months', () => {
    const value = calculateAccountBalanceAtDate({
      account: {
        id: 1,
        iban: 'ES1',
        status: 'ACTIVE',
        activa: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        openingBalance: 1000,
        openingBalanceDate: '2024-03-01',
      },
      cutoffDate: '2024-04-01',
      treasuryEvents: [],
      movements: [
        {
          accountId: 1,
          amount: 1000,
          date: '2024-03-01',
          isOpeningBalance: true,
        } as any,
        {
          accountId: 1,
          amount: -50,
          date: '2024-03-15',
        } as any,
      ],
    });

    expect(value).toBe(950);
  });

  it('uses prior-month bank movements when calculating the opening balance of the next month', () => {
    const aprilOpening = calculateAccountBalanceAtDate({
      account: {
        id: 1,
        iban: 'ES1',
        status: 'ACTIVE',
        activa: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        openingBalance: 1000,
        openingBalanceDate: '2024-03-01',
      },
      cutoffDate: '2024-04-01',
      treasuryEvents: [
        { accountId: 1, type: 'income', amount: 200, predictedDate: '2024-03-10' } as any,
        { accountId: 1, type: 'expense', amount: 50, predictedDate: '2024-03-12' } as any,
      ],
      movements: [
        { accountId: 1, amount: -25, date: '2024-03-20' } as any,
        { accountId: 1, amount: 80, date: '2024-03-28' } as any,
      ],
    });

    expect(aprilOpening).toBe(1205);
  });

  it('ignores predicted treasury events when calculating the real opening balance of the next month', () => {
    const value = calculateAccountBalanceAtDate({
      account: {
        id: 1,
        iban: 'ES1',
        status: 'ACTIVE',
        activa: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        openingBalance: 460,
        openingBalanceDate: '2024-03-01',
      },
      cutoffDate: '2024-04-01',
      treasuryEvents: [
        { accountId: 1, type: 'expense', amount: 22514.97, predictedDate: '2024-03-18', status: 'predicted' } as any,
        { accountId: 1, type: 'income', amount: 22510, predictedDate: '2024-03-18', status: 'predicted' } as any,
      ],
      movements: [
        { accountId: 1, amount: -22.99, date: '2024-03-01' } as any,
        { accountId: 1, amount: -431.61, date: '2024-03-01' } as any,
        { accountId: 1, amount: 0.51, date: '2024-03-18' } as any,
        { accountId: 1, amount: -22514.97, date: '2024-03-18' } as any,
        { accountId: 1, amount: 22510, date: '2024-03-18' } as any,
      ],
    });

    expect(value).toBeCloseTo(0.94, 2);
  });

  it('does not double count confirmed events that are already reflected by same-day bank movements in month openings', () => {
    const value = calculateAccountBalanceAtDate({
      account: {
        id: 1,
        iban: 'ES1',
        status: 'ACTIVE',
        activa: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        openingBalance: 100,
        openingBalanceDate: '2024-03-01',
      },
      cutoffDate: '2024-04-01',
      treasuryEvents: [
        { accountId: 1, type: 'expense', amount: 200, predictedDate: '2024-03-18', status: 'confirmed' } as any,
      ],
      movements: [
        { accountId: 1, amount: -200, date: '2024-03-18' } as any,
        { accountId: 1, amount: 15, date: '2024-03-20' } as any,
      ],
    });

    expect(value).toBeCloseTo(-85, 2);
  });

  it('does not double count reconciled movements when rolling an account opening into the next month', () => {
    const value = calculateAccountBalanceAtDate({
      account: {
        id: 1,
        iban: 'ES1',
        status: 'ACTIVE',
        activa: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        openingBalance: 100,
        openingBalanceDate: '2024-03-01',
      },
      cutoffDate: '2024-04-01',
      treasuryEvents: [
        {
          accountId: 1,
          type: 'expense',
          amount: 200,
          predictedDate: '2024-03-18',
          movementId: 9001,
        } as any,
        {
          accountId: 1,
          type: 'income',
          amount: 120,
          predictedDate: '2024-03-18',
        } as any,
      ],
      movements: [
        { id: 9001, accountId: 1, amount: -200, date: '2024-03-18' } as any,
        { id: 9002, accountId: 1, amount: 15, date: '2024-03-20' } as any,
      ],
    });

    expect(value).toBeCloseTo(35, 2);
  });


  it('excluye movimientos y eventos anteriores al saldo inicial (ya incluidos en openingBalance)', () => {
    const value = calculateAccountBalanceAtDate({
      account: {
        id: 1,
        iban: 'ES1',
        status: 'ACTIVE',
        activa: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        openingBalance: 250000,
        openingBalanceDate: '2026-07-31',
      },
      cutoffDate: '2026-12-31',
      treasuryEvents: [
        // Anterior al saldo inicial → NO debe contarse (ya está en openingBalance).
        { accountId: 1, type: 'income', amount: 180000, predictedDate: '2026-03-15', status: 'executed' } as any,
        // Posterior → sí cuenta.
        { accountId: 1, type: 'expense', amount: 500, predictedDate: '2026-09-10', status: 'executed' } as any,
      ],
      movements: [
        // Anterior al saldo inicial → NO debe contarse.
        { accountId: 1, amount: 180000, date: '2026-03-15' } as any,
        // Posterior → sí cuenta.
        { accountId: 1, amount: -1000, date: '2026-08-05' } as any,
      ],
    });

    // 250000 (apertura) − 500 (evento post) − 1000 (mov post) = 248500.
    // Los dos flujos del 15/3 quedan fuera: ya están dentro del saldo de apertura.
    expect(value).toBe(248500);
  });

  it('sums all active accounts as total initial cash', async () => {
    mockDB.getAll.mockImplementation(async (table: string) => {
      if (table === 'accounts') {
        return [
          { id: 1, status: 'ACTIVE', activa: true, openingBalance: 100, openingBalanceDate: '2024-01-01' },
          { id: 2, status: 'INACTIVE', activa: false, openingBalance: 900, openingBalanceDate: '2024-01-01' },
          { id: 3, status: 'ACTIVE', activa: true, openingBalance: 200, openingBalanceDate: '2024-01-01' },
        ];
      }
      return [];
    });

    const total = await calculateTotalInitialCash('2024-03-01');
    expect(total).toBe(300);
  });

  it('rolls forward account balances to month start', async () => {
    mockDB.getAll.mockImplementation(async (table: string) => {
      if (table === 'accounts') {
        return [
          {
            id: 1,
            status: 'ACTIVE',
            activa: true,
            openingBalance: 1000,
            openingBalanceDate: '2024-01-01',
            balance: 1000,
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ];
      }
      if (table === 'treasuryEvents') {
        return [{ accountId: 1, type: 'expense', amount: 200, predictedDate: '2024-01-20' }];
      }
      if (table === 'movements') {
        return [{ accountId: 1, amount: 50, date: '2024-02-10' }];
      }
      return [];
    });

    await rollForwardAccountBalancesToMonth(2024, 3);

    expect(mockDB.put).toHaveBeenCalledWith(
      'accounts',
      expect.objectContaining({
        id: 1,
        balance: 850,
      }),
    );
  });
});
