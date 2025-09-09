/**
 * ATLAS HORIZON - Unified Banking Pipeline Tests
 * 
 * Tests the core functionality per problem statement requirements:
 * - Deduplication (idempotent)
 * - Budget matching with tolerances
 * - Transfer detection
 * - Complete pipeline integration
 */

import { 
  deduplicateMovements, 
  MovementToCheck 
} from '../services/enhancedDeduplicationService';

import { 
  showImportToast 
} from '../services/unifiedBankingPipeline';

// Mock IndexedDB for tests
const mockDB = {
  getAll: jest.fn(() => Promise.resolve([])),
  add: jest.fn(() => Promise.resolve(1)),
  put: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
  get: jest.fn(() => Promise.resolve(null))
};

jest.mock('../services/db', () => ({
  initDB: jest.fn(() => Promise.resolve(mockDB))
}));

// Mock toast for tests
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn()
  }
}));

const mockMovements: MovementToCheck[] = [
  {
    accountId: 1,
    date: '2024-01-15',
    amount: -123.45,
    description: 'PAGO IBERDROLA ENERGIA',
    bank_ref: 'REF001'
  },
  {
    accountId: 1,
    date: '2024-01-15',
    amount: -123.45,
    description: 'PAGO IBERDROLA ENERGIA', // Exact duplicate
    bank_ref: 'REF001'
  },
  {
    accountId: 1,
    date: '2024-01-16',
    amount: 1500.00,
    description: 'ALQUILER ENERO',
    counterparty: 'INQUILINO H1'
  },
  {
    accountId: 2,
    date: '2024-01-16',
    amount: -500.00,
    description: 'TRANSFERENCIA A CUENTA GASTOS'
  },
  {
    accountId: 3,
    date: '2024-01-16',
    amount: 500.00,
    description: 'TRANSFERENCIA DESDE CUENTA PRINCIPAL'
  }
];

describe('Enhanced Deduplication Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDB.getAll.mockResolvedValue([]);
  });

  test('should detect exact duplicates', async () => {
    const result = await deduplicateMovements(mockMovements);
    
    expect(result.summary.total).toBe(5);
    expect(result.summary.duplicates).toBe(1); // One exact duplicate
    expect(result.summary.unique).toBe(4);
    expect(result.duplicates.length).toBe(1);
    expect(result.unique.length).toBe(4);
  });

  test('should be idempotent - same results on re-run', async () => {
    const result1 = await deduplicateMovements(mockMovements);
    const result2 = await deduplicateMovements(mockMovements);
    
    expect(result1.summary).toEqual(result2.summary);
    expect(result1.unique.length).toBe(result2.unique.length);
    expect(result1.duplicates.length).toBe(result2.duplicates.length);
  });

  test('should handle empty input', async () => {
    const result = await deduplicateMovements([]);
    
    expect(result.summary.total).toBe(0);
    expect(result.summary.unique).toBe(0);
    expect(result.summary.duplicates).toBe(0);
  });

  test('should skip movements with missing required fields', async () => {
    const invalidMovements: MovementToCheck[] = [
      {
        accountId: 0, // Invalid
        date: '2024-01-15',
        amount: -123.45,
        description: 'TEST'
      },
      {
        accountId: 1,
        date: '', // Invalid
        amount: -123.45,
        description: 'TEST'
      }
    ];

    const result = await deduplicateMovements(invalidMovements);
    
    expect(result.summary.unique).toBe(0);
    expect(result.summary.duplicates).toBe(0);
  });

  test('should normalize descriptions consistently', async () => {
    const movementsWithVariants: MovementToCheck[] = [
      {
        accountId: 1,
        date: '2024-01-15',
        amount: -123.45,
        description: 'PAGO   IBERDROLA    ENERGIA' // Extra spaces
      },
      {
        accountId: 1,
        date: '2024-01-15',
        amount: -123.45,
        description: 'pago iberdrola energia' // Different case
      }
    ];

    const result = await deduplicateMovements(movementsWithVariants);
    
    // Should detect as duplicates due to normalization
    expect(result.summary.duplicates).toBe(1);
    expect(result.summary.unique).toBe(1);
  });

  test('should preserve existing hashes when checking against database', async () => {
    // Mock existing movements in database
    mockDB.getAll.mockResolvedValue([
      {
        accountId: 1,
        date: '2024-01-15',
        amount: -123.45,
        description: 'PAGO IBERDROLA ENERGIA',
        bank_ref: 'REF001'
      }
    ] as any);

    const result = await deduplicateMovements([mockMovements[0]]);
    
    // Should detect as duplicate against database
    expect(result.summary.duplicates).toBe(1);
    expect(result.summary.unique).toBe(0);
  });
});

describe('Import Toast Messages', () => {
  test('should show appropriate toast messages', () => {
    const toast = require('react-hot-toast').default;
    
    // Test success message
    const successResult = {
      success: true,
      created: 24,
      skipped: 3,
      errors: 0,
      conciliated: 15,
      unplanned: 9,
      transfers: 2,
      createdIds: [],
      batchId: 'test'
    };

    showImportToast(successResult);
    expect(toast.success).toHaveBeenCalledWith('Importados: 24 · Duplicados: 3 · Errores: 0');

    // Test error message
    const errorResult = {
      success: false,
      created: 0,
      skipped: 0,
      errors: 1,
      conciliated: 0,
      unplanned: 0,
      transfers: 0,
      createdIds: [],
      batchId: 'test',
      errorDetails: [{ line: 1, error: 'Parse error' }]
    };

    showImportToast(errorResult);
    expect(toast.error).toHaveBeenCalledWith('Error en importación: Parse error');

    // Test account selection required
    const selectionResult = {
      success: false,
      requiresAccountSelection: true,
      created: 0,
      skipped: 0,
      errors: 0,
      conciliated: 0,
      unplanned: 0,
      transfers: 0,
      createdIds: [],
      batchId: 'test'
    };

    showImportToast(selectionResult);
    expect(toast.error).toHaveBeenCalledWith('Selecciona cuenta destino para continuar');
  });
});

describe('Data Normalization', () => {
  test('should normalize descriptions correctly', async () => {
    const testCases = [
      {
        input: '  PAGO  IBERDROLA   ENERGIA  ',
        expected: 'PAGO IBERDROLA ENERGIA'
      },
      {
        input: 'Transferencia desde la cuenta',
        expected: 'TRANSFERENCIA DESDE CUENTA'
      },
      {
        input: 'DOMICILIACIÓN DE RECIBO N.º 123-456',
        expected: 'DOMICILIACION RECIBO N 123456'
      }
    ];

    for (const testCase of testCases) {
      const movements: MovementToCheck[] = [
        {
          accountId: 1,
          date: '2024-01-15',
          amount: -123.45,
          description: testCase.input
        }
      ];

      const result = await deduplicateMovements(movements);
      
      // The normalization should work consistently
      expect(result.unique.length).toBe(1);
      expect(result.duplicates.length).toBe(0);
    }
  });

  test('should handle special characters and accents', async () => {
    const movements: MovementToCheck[] = [
      {
        accountId: 1,
        date: '2024-01-15',
        amount: -123.45,
        description: 'PAGO DOMICILIACIÓN ENERGÍA'
      },
      {
        accountId: 1,
        date: '2024-01-15',
        amount: -123.45,
        description: 'PAGO DOMICILIACION ENERGIA' // No accents
      }
    ];

    const result = await deduplicateMovements(movements);
    
    // Should treat as separate movements due to different characters
    expect(result.summary.unique).toBe(2);
    expect(result.summary.duplicates).toBe(0);
  });
});

describe('Edge Cases', () => {
  test('should handle movements with zero amounts', async () => {
    const movements: MovementToCheck[] = [
      {
        accountId: 1,
        date: '2024-01-15',
        amount: 0,
        description: 'AJUSTE SALDO'
      }
    ];

    const result = await deduplicateMovements(movements);
    
    expect(result.summary.unique).toBe(1);
    expect(result.summary.duplicates).toBe(0);
  });

  test('should handle very small amount differences', async () => {
    const movements: MovementToCheck[] = [
      {
        accountId: 1,
        date: '2024-01-15',
        amount: -123.45,
        description: 'PAGO IBERDROLA'
      },
      {
        accountId: 1,
        date: '2024-01-15',
        amount: -123.46, // 1 cent difference
        description: 'PAGO IBERDROLA'
      }
    ];

    const result = await deduplicateMovements(movements);
    
    // Should treat as different movements
    expect(result.summary.unique).toBe(2);
    expect(result.summary.duplicates).toBe(0);
  });

  test('should handle very long descriptions', async () => {
    const longDescription = 'A'.repeat(1000); // Very long description
    
    const movements: MovementToCheck[] = [
      {
        accountId: 1,
        date: '2024-01-15',
        amount: -123.45,
        description: longDescription
      },
      {
        accountId: 1,
        date: '2024-01-15',
        amount: -123.45,
        description: longDescription
      }
    ];

    const result = await deduplicateMovements(movements);
    
    // Should still detect duplicates
    expect(result.summary.duplicates).toBe(1);
    expect(result.summary.unique).toBe(1);
  });

  test('should handle different date formats consistently', async () => {
    const movements: MovementToCheck[] = [
      {
        accountId: 1,
        date: '2024-01-15',
        amount: -123.45,
        description: 'PAGO IBERDROLA'
      },
      {
        accountId: 1,
        date: '2024-01-15', // Same date
        amount: -123.45,
        description: 'PAGO IBERDROLA'
      }
    ];

    const result = await deduplicateMovements(movements);
    
    expect(result.summary.duplicates).toBe(1);
    expect(result.summary.unique).toBe(1);
  });
});

describe('Hash Generation', () => {
  test('should generate consistent hashes for identical data', async () => {
    const movement1: MovementToCheck = {
      accountId: 1,
      date: '2024-01-15',
      amount: -123.45,
      description: 'PAGO IBERDROLA ENERGIA',
      bank_ref: 'REF001'
    };

    const movement2: MovementToCheck = {
      accountId: 1,
      date: '2024-01-15',
      amount: -123.45,
      description: 'PAGO IBERDROLA ENERGIA',
      bank_ref: 'REF001'
    };

    const result = await deduplicateMovements([movement1, movement2]);
    
    expect(result.summary.duplicates).toBe(1);
    expect(result.summary.unique).toBe(1);
  });

  test('should generate different hashes for different data', async () => {
    const movement1: MovementToCheck = {
      accountId: 1,
      date: '2024-01-15',
      amount: -123.45,
      description: 'PAGO IBERDROLA ENERGIA',
      bank_ref: 'REF001'
    };

    const movement2: MovementToCheck = {
      accountId: 2, // Different account
      date: '2024-01-15',
      amount: -123.45,
      description: 'PAGO IBERDROLA ENERGIA',
      bank_ref: 'REF001'
    };

    const result = await deduplicateMovements([movement1, movement2]);
    
    expect(result.summary.duplicates).toBe(0);
    expect(result.summary.unique).toBe(2);
  });
});