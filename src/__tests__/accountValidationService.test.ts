/**
 * Tests for Account Validation Service
 */

import { 
  isDemoAccount, 
  isValidAccount, 
  filterAccountsForUI, 
  validateAccountForMovements,
  getSafeAccountList
} from '../services/accountValidationService';
import { Account } from '../services/db';
import * as envFlags from '../config/envFlags';

// Mock the environment flags
jest.mock('../config/envFlags');

describe('Account Validation Service', () => {
  const mockAccounts: Account[] = [
    {
      id: 1,
      name: 'BBVA Real Account',
      bank: 'BBVA',
      iban: 'ES1234567890123456789012',
      destination: 'horizon',
      balance: 1000,
      openingBalance: 1000,
      currency: 'EUR',
      isActive: true,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    },
    {
      id: 2,
      name: 'Demo Test Account',
      bank: 'Demo Bank',
      iban: 'ES9999999999999999999999',
      destination: 'horizon',
      balance: 500,
      openingBalance: 500,
      currency: 'EUR',
      isActive: true,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    },
    {
      id: 3,
      name: 'Inactive Account',
      bank: 'Santander',
      iban: 'ES5555555555555555555555',
      destination: 'horizon',
      balance: 0,
      openingBalance: 0,
      currency: 'EUR',
      isActive: false,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    },
    {
      id: 4,
      name: 'Deleted Account',
      bank: 'ING',
      iban: 'ES7777777777777777777777',
      destination: 'horizon',
      balance: 0,
      openingBalance: 0,
      currency: 'EUR',
      isActive: true,
      deleted_at: '2024-01-15',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isDemoAccount', () => {
    it('should identify demo accounts by name', () => {
      expect(isDemoAccount(mockAccounts[1])).toBe(true); // Demo Test Account
      expect(isDemoAccount(mockAccounts[0])).toBe(false); // BBVA Real Account
    });

    it('should identify demo accounts by bank name', () => {
      const demoBankAccount = { ...mockAccounts[0], bank: 'Test Bank Demo' };
      expect(isDemoAccount(demoBankAccount)).toBe(true);
    });

    it('should identify demo accounts by IBAN patterns', () => {
      const demoIbanAccount = { ...mockAccounts[0], iban: 'ES9999999999999999999999' };
      expect(isDemoAccount(demoIbanAccount)).toBe(true);
    });

    it('should handle null/undefined accounts', () => {
      expect(isDemoAccount(null as any)).toBe(false);
      expect(isDemoAccount(undefined as any)).toBe(false);
    });
  });

  describe('isValidAccount', () => {
    beforeEach(() => {
      (envFlags.isDemoModeEnabled as jest.Mock).mockReturnValue(false);
    });

    it('should validate active, non-demo accounts', () => {
      expect(isValidAccount(mockAccounts[0])).toBe(true); // BBVA Real Account
    });

    it('should reject demo accounts when demo mode is disabled', () => {
      expect(isValidAccount(mockAccounts[1])).toBe(false); // Demo Test Account
    });

    it('should accept demo accounts when demo mode is enabled', () => {
      (envFlags.isDemoModeEnabled as jest.Mock).mockReturnValue(true);
      expect(isValidAccount(mockAccounts[1])).toBe(true); // Demo Test Account
    });

    it('should reject inactive accounts', () => {
      expect(isValidAccount(mockAccounts[2])).toBe(false); // Inactive Account
    });

    it('should reject deleted accounts', () => {
      expect(isValidAccount(mockAccounts[3])).toBe(false); // Deleted Account
    });

    it('should reject accounts without required fields', () => {
      const incompleteAccount = { ...mockAccounts[0], iban: '' };
      expect(isValidAccount(incompleteAccount)).toBe(false);
    });
  });

  describe('filterAccountsForUI', () => {
    beforeEach(() => {
      (envFlags.isDemoModeEnabled as jest.Mock).mockReturnValue(false);
    });

    it('should filter out demo accounts by default', () => {
      const filtered = filterAccountsForUI(mockAccounts);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(1); // Only BBVA Real Account
    });

    it('should filter out inactive accounts by default', () => {
      const filtered = filterAccountsForUI([mockAccounts[0], mockAccounts[2]]);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(1); // Only active account
    });

    it('should include inactive accounts when option is set', () => {
      const filtered = filterAccountsForUI([mockAccounts[0], mockAccounts[2]], {
        includeInactive: true
      });
      expect(filtered).toHaveLength(2);
    });

    it('should include deleted accounts when option is set', () => {
      const filtered = filterAccountsForUI([mockAccounts[0], mockAccounts[3]], {
        includeDeleted: true
      });
      expect(filtered).toHaveLength(2);
    });

    it('should include demo accounts when demo mode is enabled', () => {
      (envFlags.isDemoModeEnabled as jest.Mock).mockReturnValue(true);
      const filtered = filterAccountsForUI([mockAccounts[0], mockAccounts[1]]);
      expect(filtered).toHaveLength(2);
    });
  });

  describe('validateAccountForMovements', () => {
    beforeEach(() => {
      (envFlags.isDemoModeEnabled as jest.Mock).mockReturnValue(false);
    });

    it('should validate real active accounts', () => {
      const result = validateAccountForMovements(mockAccounts[0]);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject demo accounts with clear error message', () => {
      const result = validateAccountForMovements(mockAccounts[1]);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('No se permiten cuentas demo en producción');
    });

    it('should reject inactive accounts', () => {
      const result = validateAccountForMovements(mockAccounts[2]);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('La cuenta está desactivada');
    });

    it('should reject deleted accounts', () => {
      const result = validateAccountForMovements(mockAccounts[3]);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('La cuenta ha sido eliminada');
    });

    it('should reject null accounts', () => {
      const result = validateAccountForMovements(null as any);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Cuenta no encontrada');
    });
  });

  describe('getSafeAccountList', () => {
    beforeEach(() => {
      (envFlags.isDemoModeEnabled as jest.Mock).mockReturnValue(false);
    });

    it('should return safe account list with metadata', async () => {
      const result = await getSafeAccountList(mockAccounts);
      
      expect(result.accounts).toHaveLength(1); // Only BBVA Real Account
      expect(result.hasInactive).toBe(true); // Has inactive/deleted accounts
      expect(result.hasDemo).toBe(true); // Has demo accounts (filtered out)
      expect(result.totalFiltered).toBe(3); // 3 accounts filtered out
    });

    it('should include inactive accounts when requested', async () => {
      const result = await getSafeAccountList(mockAccounts, {
        includeInactive: true
      });
      
      expect(result.accounts).toHaveLength(1); // Still only 1 because others are demo/deleted
      expect(result.hasInactive).toBe(true);
    });

    it('should show no demo accounts when demo mode is enabled', async () => {
      (envFlags.isDemoModeEnabled as jest.Mock).mockReturnValue(true);
      const result = await getSafeAccountList(mockAccounts);
      
      expect(result.hasDemo).toBe(false); // No demo filtering in demo mode
      expect(result.accounts.length).toBeGreaterThan(1);
    });
  });
});