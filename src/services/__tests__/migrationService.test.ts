/**
 * Unit tests for Proveedor → Contraparte migration
 */

import 'fake-indexeddb/auto';

// Mock initDB
const mockDB = {
  get: jest.fn(),
  put: jest.fn(),
  getAll: jest.fn(),
  add: jest.fn()
};

jest.mock('../db', () => ({
  initDB: jest.fn(() => Promise.resolve(mockDB))
}));

import { performProveedorToContraparteMigration, getCounterpartyFromMovement, normalizeCounterpartyInput } from '../migrationService';

describe('Proveedor → Contraparte Migration', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('performProveedorToContraparteMigration', () => {
    test('should skip migration if already completed', async () => {
      mockDB.get.mockResolvedValueOnce('completed');
      
      const result = await performProveedorToContraparteMigration();
      
      expect(result.migratedMovements).toBe(0);
      expect(result.migratedDocuments).toBe(0);
      expect(result.errors).toEqual([]);
    });

    test('should migrate movements with proveedor field to counterparty', async () => {
      mockDB.get.mockResolvedValueOnce(undefined); // Migration not completed
      mockDB.getAll.mockImplementation((store) => {
        if (store === 'movements') {
          return Promise.resolve([
            {
              id: 1,
              amount: 100,
              description: 'Test movement',
              proveedor: 'Iberdrola',
              counterparty: undefined,
              updatedAt: '2024-01-01T00:00:00.000Z'
            },
            {
              id: 2,
              amount: -50,
              description: 'Another movement',
              counterparty: 'Already has counterparty',
              updatedAt: '2024-01-01T00:00:00.000Z'
            }
          ]);
        }
        if (store === 'documents') {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      const result = await performProveedorToContraparteMigration();
      
      expect(result.migratedMovements).toBe(1);
      expect(mockDB.put).toHaveBeenCalledWith('movements', expect.objectContaining({
        id: 1,
        counterparty: 'Iberdrola',
        updatedAt: expect.any(String)
      }));
      expect(mockDB.put).toHaveBeenCalledWith('keyval', 'completed', 'proveedor-contraparte-migration');
    });

    test('should migrate document metadata from proveedor to counterpartyName', async () => {
      mockDB.get.mockResolvedValueOnce(undefined); // Migration not completed
      mockDB.getAll.mockImplementation((store) => {
        if (store === 'movements') {
          return Promise.resolve([]);
        }
        if (store === 'documents') {
          return Promise.resolve([
            {
              id: 1,
              filename: 'test.pdf',
              metadata: {
                proveedor: 'Test Provider',
                counterpartyName: undefined,
                contraparte: undefined
              }
            }
          ]);
        }
        return Promise.resolve([]);
      });

      const result = await performProveedorToContraparteMigration();
      
      expect(result.migratedDocuments).toBe(1);
      expect(mockDB.put).toHaveBeenCalledWith('documents', expect.objectContaining({
        id: 1,
        metadata: expect.objectContaining({
          counterpartyName: 'Test Provider',
          contraparte: 'Test Provider'
        })
      }));
    });

    test('should handle errors gracefully', async () => {
      mockDB.get.mockResolvedValueOnce(undefined);
      mockDB.getAll.mockRejectedValue(new Error('Database error'));

      const result = await performProveedorToContraparteMigration();
      
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Error migrating movements');
    });
  });

  describe('getCounterpartyFromMovement', () => {
    test('should return counterparty if available', () => {
      const movement = {
        counterparty: 'New Field',
        proveedor: 'Old Field'
      };
      
      expect(getCounterpartyFromMovement(movement)).toBe('New Field');
    });

    test('should fallback to proveedor if counterparty is not available', () => {
      const movement = {
        proveedor: 'Old Field'
      };
      
      expect(getCounterpartyFromMovement(movement)).toBe('Old Field');
    });

    test('should return empty string if neither field is available', () => {
      const movement = {};
      
      expect(getCounterpartyFromMovement(movement)).toBe('');
    });
  });

  describe('normalizeCounterpartyInput', () => {
    test('should prioritize counterparty over proveedor', () => {
      const input = {
        counterparty: 'New Value',
        proveedor: 'Old Value'
      };
      
      expect(normalizeCounterpartyInput(input)).toBe('New Value');
    });

    test('should use proveedor if counterparty is not provided', () => {
      const input = {
        proveedor: 'Old Value'
      };
      
      expect(normalizeCounterpartyInput(input)).toBe('Old Value');
    });

    test('should return empty string if neither field is provided', () => {
      const input = {};
      
      expect(normalizeCounterpartyInput(input)).toBe('');
    });
  });
});