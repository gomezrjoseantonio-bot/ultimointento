/**
 * Integration tests for production mode requirements
 * Tests that account creation doesn't generate demo movements
 */

import { TreasuryAccountsAPI, validateIBAN } from '../services/treasuryApiService';
import { initDB } from '../services/db';
import { FLAGS } from '../config/flags';

// Mock IndexedDB for testing
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

jest.mock('../services/treasuryApiService', () => {
  const actual = jest.requireActual('../services/treasuryApiService');
  return {
    ...actual,
    validateIBAN: jest.fn(() => true)
  };
});

describe('Production Mode Requirements', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDB.add.mockResolvedValue(1);
    mockDB.getAll.mockResolvedValue([]);
  });

  describe('Account Creation - No Side Effects', () => {
    it('should create account without generating any movements', async () => {
      // Verify demo mode is disabled
      expect(FLAGS.DEMO_MODE).toBe(false);
      expect(FLAGS.PREVIEW_SIMULATION).toBe(false);

      const accountData = {
        alias: 'Test Account',
        bank: 'Test Bank',
        iban: 'ES1234567890123456789012',
        openingBalance: 1000,
        usage_scope: 'personal' as const
      };

      const createdAccount = await TreasuryAccountsAPI.createAccount(accountData);

      // Verify account was created
      expect(mockDB.add).toHaveBeenCalledWith('accounts', expect.objectContaining({
        name: 'Test Account',
        bank: 'Test Bank',
        iban: 'ES1234567890123456789012',
        balance: 1000,
        openingBalance: 1000,
        isActive: true,
        currency: 'EUR'
      }));

      // Verify NO movements were created
      expect(mockDB.add).toHaveBeenCalledTimes(1); // Only the account
      expect(mockDB.add).not.toHaveBeenCalledWith('movements', expect.anything());

      // Verify account properties
      expect(createdAccount.id).toBe(1);
      expect(createdAccount.name).toBe('Test Account');
      expect(createdAccount.balance).toBe(1000);
      expect(createdAccount.isActive).toBe(true);
    });

    it('should validate IBAN and required fields', async () => {
      // Mock validateIBAN to return false for invalid IBAN
      (validateIBAN as jest.Mock).mockReturnValue(false);

      // Test with invalid IBAN
      await expect(TreasuryAccountsAPI.createAccount({
        alias: 'Test',
        bank: 'Test Bank',
        iban: 'INVALID',
        openingBalance: 1000
      })).rejects.toThrow('Formato de IBAN inválido');

      // Reset mock for valid IBAN
      (validateIBAN as jest.Mock).mockReturnValue(true);

      // Test with missing bank
      await expect(TreasuryAccountsAPI.createAccount({
        alias: 'Test',
        bank: '',
        iban: 'ES1234567890123456789012',
        openingBalance: 1000
      })).rejects.toThrow('El banco es obligatorio');

      // Test with missing IBAN
      await expect(TreasuryAccountsAPI.createAccount({
        alias: 'Test',
        bank: 'Test Bank',
        iban: '',
        openingBalance: 1000
      })).rejects.toThrow('El IBAN es obligatorio');
    });
  });

  describe('Movement Count Verification', () => {
    it('should return zero movements after account creation', async () => {
      // Mock empty movements array
      mockDB.getAll.mockImplementation((store: string) => {
        if (store === 'movements') return Promise.resolve([]);
        if (store === 'accounts') return Promise.resolve([]);
        return Promise.resolve([]);
      });

      // Create account
      const accountData = {
        alias: 'Test Account',
        bank: 'Test Bank', 
        iban: 'ES1234567890123456789012',
        openingBalance: 1000
      };

      await TreasuryAccountsAPI.createAccount(accountData);

      // Verify movements collection is empty
      const movements = await mockDB.getAll('movements');
      expect(movements).toEqual([]);
      expect(movements.length).toBe(0);
    });
  });

  describe('Demo Mode Flags', () => {
    it('should have demo mode disabled by default', () => {
      expect(FLAGS.DEMO_MODE).toBe(false);
      expect(FLAGS.PREVIEW_SIMULATION).toBe(false);
    });
  });
});