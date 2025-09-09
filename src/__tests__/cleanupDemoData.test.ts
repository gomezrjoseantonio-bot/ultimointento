/**
 * Tests for Demo Data Cleanup Script
 */

import { cleanupDemoData } from '../../scripts/cleanupDemoData';
import { initDB, Account, Movement } from '../services/db';

// Define CleanupStats interface for testing
interface CleanupStats {
  demoMovements: number;
  orphanedMovements: number;
  demoAccounts: number;
  accountsRecalculated: number;
  errors: number;
}

// Mock the database for testing
jest.mock('../services/db');

describe('cleanupDemoData', () => {
  let mockDB: any;

  beforeEach(() => {
    mockDB = {
      getAll: jest.fn(),
      delete: jest.fn(),
      put: jest.fn(),
      getAllFromIndex: jest.fn(),
    };
    (initDB as jest.Mock).mockResolvedValue(mockDB);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should remove demo movements and accounts', async () => {
    // Setup test data
    const mockAccounts: Account[] = [
      {
        id: 1,
        name: 'Real Account',
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
        name: 'Demo Account',
        bank: 'Demo Bank',
        iban: 'ES9999999999999999999999',
        destination: 'horizon',
        balance: 500,
        openingBalance: 500,
        currency: 'EUR',
        isActive: true,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      }
    ];

    const mockMovements: Movement[] = [
      {
        id: 1,
        accountId: 1,
        date: '2024-01-01',
        amount: 100,
        description: 'Real payment',
        status: 'pendiente',
        type: 'Ingreso',
        origin: 'CSV',
        movementState: 'Confirmado',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      },
      {
        id: 2,
        accountId: 2,
        date: '2024-01-01',
        amount: 50,
        description: 'Demo transaction for testing',
        status: 'pendiente',
        type: 'Gasto',
        origin: 'Manual',
        movementState: 'Confirmado',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      },
      {
        id: 3,
        accountId: 999, // Orphaned movement - account doesn't exist
        date: '2024-01-01',
        amount: 25,
        description: 'Orphaned movement',
        status: 'pendiente',
        type: 'Gasto',
        origin: 'CSV',
        movementState: 'Confirmado',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      }
    ];

    mockDB.getAll.mockImplementation((store: string) => {
      if (store === 'accounts') return Promise.resolve(mockAccounts);
      if (store === 'movements') return Promise.resolve(mockMovements);
      return Promise.resolve([]);
    });

    mockDB.getAllFromIndex.mockResolvedValue([mockMovements[0]]); // For balance recalculation

    // Run cleanup
    const stats = await cleanupDemoData();

    // Verify results
    expect(stats.demoMovements).toBe(1); // Demo transaction
    expect(stats.orphanedMovements).toBe(1); // Orphaned movement
    expect(stats.demoAccounts).toBe(1); // Demo account
    expect(stats.accountsRecalculated).toBe(1); // Real account recalculated
    expect(stats.errors).toBe(0);

    // Verify database operations
    expect(mockDB.delete).toHaveBeenCalledWith('movements', 2); // Demo movement
    expect(mockDB.delete).toHaveBeenCalledWith('movements', 3); // Orphaned movement
    expect(mockDB.delete).toHaveBeenCalledWith('accounts', 2); // Demo account
    expect(mockDB.put).toHaveBeenCalledTimes(1); // Account balance update
  });

  it('should be idempotent - running multiple times should not cause errors', async () => {
    // Setup empty database
    mockDB.getAll.mockResolvedValue([]);
    mockDB.getAllFromIndex.mockResolvedValue([]);

    // Run cleanup twice
    const stats1 = await cleanupDemoData();
    const stats2 = await cleanupDemoData();

    // Both runs should complete without errors
    expect(stats1.errors).toBe(0);
    expect(stats2.errors).toBe(0);
    expect(stats1.demoMovements).toBe(0);
    expect(stats2.demoMovements).toBe(0);
  });

  it('should handle database errors gracefully', async () => {
    mockDB.getAll.mockRejectedValue(new Error('Database error'));

    const stats = await cleanupDemoData();

    expect(stats.errors).toBeGreaterThan(0);
  });

  it('should correctly identify demo patterns', async () => {
    const mockAccounts: Account[] = [
      {
        id: 1,
        name: 'Test Demo Account',
        bank: 'Real Bank',
        iban: 'ES1234567890123456789012',
        destination: 'horizon',
        balance: 1000,
        openingBalance: 1000,
        currency: 'EUR',
        isActive: true,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      }
    ];

    const mockMovements: Movement[] = [
      {
        id: 1,
        accountId: 1,
        date: '2024-01-01',
        amount: 100,
        description: 'Sample payment for testing',
        status: 'pendiente',
        type: 'Gasto',
        origin: 'Manual',
        movementState: 'Confirmado',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      }
    ];

    mockDB.getAll.mockImplementation((store: string) => {
      if (store === 'accounts') return Promise.resolve(mockAccounts);
      if (store === 'movements') return Promise.resolve(mockMovements);
      return Promise.resolve([]);
    });

    const stats = await cleanupDemoData();

    // Should detect demo account and movement based on description patterns
    expect(stats.demoAccounts).toBe(1);
    expect(stats.demoMovements).toBe(1);
  });
});