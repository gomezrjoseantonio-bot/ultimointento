/**
 * Tests for Bank Import Service Demo Prevention
 */

import { importBankStatement, ImportOptions, ImportResult } from '../services/bankStatementImportService';
import { initDB } from '../services/db';

// Mock dependencies
jest.mock('../services/db');
jest.mock('../features/inbox/importers/bankParser');
jest.mock('../services/ibanAccountMatchingService');
jest.mock('../services/demoDataCleanupService', () => ({
  isDemoMovement: jest.fn().mockReturnValue(false)
}));

describe('bankStatementImportService - Demo Prevention', () => {
  let mockDB: any;

  beforeEach(() => {
    mockDB = {
      get: jest.fn(),
      getAll: jest.fn(),
      add: jest.fn(),
      getAllFromIndex: jest.fn(),
    };
    (initDB as jest.Mock).mockResolvedValue(mockDB);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should reject movements with demo descriptions', async () => {
    // Mock account exists
    mockDB.get.mockResolvedValue({
      id: 1,
      name: 'Test Account',
      bank: 'BBVA',
      iban: 'ES1234567890123456789012',
      isActive: true
    });

    // Mock existing movements for duplicate detection
    mockDB.getAll.mockResolvedValue([]);

    // Mock bank parser to return demo movement
    const mockBankParser = require('../features/inbox/importers/bankParser').BankParserService;
    mockBankParser.prototype.parseFile = jest.fn().mockResolvedValue({
      success: true,
      movements: [
        {
          date: '2024-01-01',
          description: 'Demo transaction for testing',
          amount: 100
        }
      ]
    });

    // Mock IBAN resolution
    const ibanService = require('../services/ibanAccountMatchingService');
    ibanService.extractIBANFromBankStatement = jest.fn().mockResolvedValue({ iban_completo: 'ES1234567890123456789012' });
    ibanService.matchAccountByIBAN = jest.fn().mockResolvedValue({ cuenta_id: 1, requiresSelection: false });

    const options: ImportOptions = {
      file: new File(['test'], 'bank-statement.csv', { type: 'text/csv' }),
      destinationAccountId: 1,
      usuario: 'test-user'
    };

    const result = await importBankStatement(options);

    // Should complete but reject the demo movement
    expect(result.success).toBe(true);
    expect(result.inserted).toBe(0);
    expect(result.errors).toBe(1); // Demo movement rejected
  });

  it('should reject movements for non-existent accounts', async () => {
    // Mock account doesn't exist
    mockDB.get.mockResolvedValue(null);
    mockDB.getAll.mockResolvedValue([]);

    // Mock bank parser
    const mockBankParser = require('../features/inbox/importers/bankParser').BankParserService;
    mockBankParser.prototype.parseFile = jest.fn().mockResolvedValue({
      success: true,
      movements: [
        {
          date: '2024-01-01',
          description: 'Valid transaction',
          amount: 100
        }
      ]
    });

    // Mock IBAN resolution
    const ibanService = require('../services/ibanAccountMatchingService');
    ibanService.extractIBANFromBankStatement = jest.fn().mockResolvedValue({ iban_completo: 'ES1234567890123456789012' });
    ibanService.matchAccountByIBAN = jest.fn().mockResolvedValue({ cuenta_id: 999, requiresSelection: false });

    const options: ImportOptions = {
      file: new File(['test'], 'bank-statement.csv', { type: 'text/csv' }),
      destinationAccountId: 999, // Non-existent account
      usuario: 'test-user'
    };

    const result = await importBankStatement(options);

    // Should complete but reject movements for invalid account
    expect(result.success).toBe(true);
    expect(result.inserted).toBe(0);
    expect(result.errors).toBe(1); // Invalid account
  });

  it.each([
    '2024-01-01',
    '02/10/2025',
    '02.10.2025'
  ])('should fail import when amount field looks like a date string (%s)', async (dateLikeAmount) => {
    mockDB.get.mockResolvedValue({
      id: 1,
      name: 'Cuenta Principal',
      bank: 'BBVA',
      iban: 'ES1234567890123456789012',
      isActive: true
    });

    mockDB.getAll.mockResolvedValue([]);

    const mockBankParser = require('../features/inbox/importers/bankParser').BankParserService;
    const parseFileMock = jest.fn().mockResolvedValue({
      success: true,
      movements: [
        {
          date: '2024-01-01',
          description: 'Ingreso real',
          amount: dateLikeAmount
        }
      ]
    });
    mockBankParser.prototype.parseFile = parseFileMock;

    const ibanService = require('../services/ibanAccountMatchingService');
    ibanService.extractIBANFromBankStatement = jest.fn().mockResolvedValue({ iban_completo: 'ES1234567890123456789012' });
    ibanService.matchAccountByIBAN = jest.fn().mockResolvedValue({ cuenta_id: 1, requiresSelection: false });

    const options: ImportOptions = {
      file: new File(['test'], 'bank-statement.csv', { type: 'text/csv' }),
      destinationAccountId: 1,
      usuario: 'test-user'
    };

    const result = await importBankStatement(options);

    expect(result.success).toBe(false);
    expect(result.errors).toBe(1);
    expect(result.inserted).toBe(0);
    expect(mockDB.add).not.toHaveBeenCalled();
    expect(parseFileMock).toHaveBeenCalledTimes(1);
  });

  it('should accept valid movements for existing accounts', async () => {
    // Mock account exists
    mockDB.get.mockResolvedValue({
      id: 1,
      name: 'Test Account',
      bank: 'BBVA',
      iban: 'ES1234567890123456789012',
      isActive: true
    });

    mockDB.getAll.mockResolvedValue([]); // No existing movements
    mockDB.add.mockResolvedValue(1); // Successful creation

    // Mock bank parser with valid movement
    const mockBankParser = require('../features/inbox/importers/bankParser').BankParserService;
    mockBankParser.prototype.parseFile = jest.fn().mockResolvedValue({
      success: true,
      movements: [
        {
          date: '2024-01-01',
          description: 'Valid payment to supplier',
          amount: 87.65
        }
      ]
    });

    // Mock IBAN resolution
    const ibanService = require('../services/ibanAccountMatchingService');
    ibanService.extractIBANFromBankStatement = jest.fn().mockResolvedValue({ iban_completo: 'ES1234567890123456789012' });
    ibanService.matchAccountByIBAN = jest.fn().mockResolvedValue({ cuenta_id: 1, requiresSelection: false });

    const options: ImportOptions = {
      file: new File(['test'], 'bank-statement.csv', { type: 'text/csv' }),
      destinationAccountId: 1,
      usuario: 'test-user'
    };

    const result = await importBankStatement(options);

    // Should accept valid movement
    expect(result.success).toBe(true);
    expect(result.inserted).toBe(1);
    expect(result.errors).toBe(0);
    expect(mockDB.add).toHaveBeenCalledTimes(1);
  });

  it('should reject movements with various demo patterns', async () => {
    const demoDescriptions = [
      'DEMO payment',
      'Test transaction',
      'Sample movement',
      'demo transfer',
      'TEST PAYMENT'
    ];

    // Mock account exists
    mockDB.get.mockResolvedValue({
      id: 1,
      name: 'Test Account',
      bank: 'BBVA',
      iban: 'ES1234567890123456789012',
      isActive: true
    });

    mockDB.getAll.mockResolvedValue([]);

    for (const description of demoDescriptions) {
      // Mock bank parser
      const mockBankParser = require('../features/inbox/importers/bankParser').BankParserService;
      mockBankParser.prototype.parseFile = jest.fn().mockResolvedValue({
        success: true,
        movements: [
          {
            date: '2024-01-01',
            description,
            amount: 100
          }
        ]
      });

      // Mock IBAN resolution
      const ibanService = require('../services/ibanAccountMatchingService');
      ibanService.extractIBANFromBankStatement = jest.fn().mockResolvedValue({ iban_completo: 'ES1234567890123456789012' });
      ibanService.matchAccountByIBAN = jest.fn().mockResolvedValue({ cuenta_id: 1, requiresSelection: false });

      const options: ImportOptions = {
        file: new File(['test'], `statement-${description}.csv`, { type: 'text/csv' }),
        destinationAccountId: 1,
        usuario: 'test-user'
      };

      const result = await importBankStatement(options);

      // Should reject all demo movements
      expect(result.errors).toBe(1);
      expect(result.inserted).toBe(0);
    }
  });
});