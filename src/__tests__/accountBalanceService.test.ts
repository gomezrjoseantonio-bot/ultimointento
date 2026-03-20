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
