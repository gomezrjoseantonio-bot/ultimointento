/**
 * Tests for cuentasService.create() opening balance movement (P1)
 *
 * Verifies that when an account is created with a non-zero openingBalance,
 * a corresponding opening balance movement is written to IndexedDB.
 */

// Mock IndexedDB
const mockDB = {
  add: jest.fn(),
  get: jest.fn(),
  getAll: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  getAllFromIndex: jest.fn(),
};

jest.mock('../services/db', () => ({
  initDB: jest.fn(() => Promise.resolve(mockDB)),
}));

// Bypass IBAN validation so tests don't depend on valid checksum digits
jest.mock('../utils/accountHelpers', () => ({
  validateIbanEs: jest.fn(),
  normalizeIban: jest.fn(),
  detectBankByIBAN: jest.fn(),
}));

import { cuentasService } from '../services/cuentasService';
import { validateIbanEs, normalizeIban } from '../utils/accountHelpers';
import { initDB } from '../services/db';

const TEST_IBAN = 'ES0000000000000000000000';

let ibanCounter = 0;
const uniqueIban = () => `ES${String(++ibanCounter).padStart(22, '0')}`;

describe('cuentasService.create() - opening balance movement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-setup implementations after resetMocks (CRA sets resetMocks: true)
    (initDB as jest.Mock).mockResolvedValue(mockDB);
    (validateIbanEs as jest.Mock).mockReturnValue({ ok: true });
    (normalizeIban as jest.Mock).mockImplementation((iban: string) =>
      iban.replace(/\s/g, '').toUpperCase()
    );
    // getAll('accounts') returns empty so account is always new
    mockDB.getAll.mockResolvedValue([]);
    // db.add returns the new IndexedDB-assigned ID
    mockDB.add.mockResolvedValue(99);
  });

  it('creates an opening balance movement when openingBalance is non-zero', async () => {
    await cuentasService.create({
      alias: 'Cuenta Nómina',
      iban: uniqueIban(),
      openingBalance: 1500,
      openingBalanceDate: '2024-01-15',
    });

    // First add call is the account, second is the movement
    expect(mockDB.add).toHaveBeenCalledTimes(2);
    expect(mockDB.add).toHaveBeenCalledWith(
      'movements',
      expect.objectContaining({
        accountId: 99,
        amount: 1500,
        isOpeningBalance: true,
        status: 'conciliado',
        origin: 'Manual',
        ambito: 'PERSONAL',
        statusConciliacion: 'sin_match',
      })
    );
  });

  it('does not create a movement when openingBalance is zero', async () => {
    await cuentasService.create({
      alias: 'Cuenta Sin Saldo',
      iban: uniqueIban(),
      openingBalance: 0,
    });

    // Only the account add should be called
    expect(mockDB.add).toHaveBeenCalledTimes(1);
    expect(mockDB.add).toHaveBeenCalledWith('accounts', expect.anything());
    expect(mockDB.add).not.toHaveBeenCalledWith('movements', expect.anything());
  });

  it('does not create a movement when openingBalance is omitted', async () => {
    await cuentasService.create({
      alias: 'Cuenta Sin Saldo Explícito',
      iban: uniqueIban(),
    });

    expect(mockDB.add).toHaveBeenCalledTimes(1);
    expect(mockDB.add).not.toHaveBeenCalledWith('movements', expect.anything());
  });

  it('creates a negative (Gasto) movement when openingBalance is negative', async () => {
    await cuentasService.create({
      alias: 'Cuenta Descubierta',
      iban: uniqueIban(),
      openingBalance: -200,
    });

    expect(mockDB.add).toHaveBeenCalledWith(
      'movements',
      expect.objectContaining({
        amount: -200,
        type: 'Gasto',
        isOpeningBalance: true,
      })
    );
  });

  it('normalizes the date to YYYY-MM-DD in the movement', async () => {
    await cuentasService.create({
      alias: 'Cuenta Nómina',
      iban: uniqueIban(),
      openingBalance: 500,
      openingBalanceDate: '2024-03-20T10:00:00.000Z',
    });

    expect(mockDB.add).toHaveBeenCalledWith(
      'movements',
      expect.objectContaining({
        date: '2024-03-20',
      })
    );
  });


  it('updates opening balance and date when editing an account', async () => {
    mockDB.getAll.mockResolvedValue([]);
    mockDB.add.mockResolvedValue(101);

    const created = await cuentasService.create({
      alias: 'Cuenta Editable',
      iban: uniqueIban(),
      openingBalance: 100,
      openingBalanceDate: '2024-01-01',
    });

    const updated = await cuentasService.update(created.id!, {
      openingBalance: 250,
      openingBalanceDate: '2024-02-01T00:00:00.000Z',
    });

    expect(updated.openingBalance).toBe(250);
    expect(updated.balance).toBe(250);
    expect(updated.openingBalanceDate).toBe('2024-02-01T00:00:00.000Z');
  });

  it('uses the dbAccountId returned by syncAccountToIndexedDB (no second getAll)', async () => {
    await cuentasService.create({
      alias: 'Cuenta Nómina',
      iban: uniqueIban(),
      openingBalance: 1000,
    });

    // getAll should only be called once (inside syncAccountToIndexedDB to check for existing)
    // NOT a second time to look up the account by IBAN
    const getAllCalls = mockDB.getAll.mock.calls.filter(
      (call: string[]) => call[0] === 'accounts'
    );
    expect(getAllCalls.length).toBe(1);
  });
});
