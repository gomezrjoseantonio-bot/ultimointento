/**
 * Test suite to validate that no default treasury movements are created
 * when creating new accounts
 */

import { initDB, Account, Movement } from '../services/db';
import { TreasuryAccountsAPI } from '../services/treasuryApiService';
import { cleanupAllDemoData, isDemoMovement } from '../services/demoDataCleanupService';

describe('Treasury Movement Default Prevention', () => {
  beforeEach(async () => {
    // Clean the database before each test
    await cleanupAllDemoData();
  });

  test('should not create default movements when creating a new account', async () => {
    // Create a new account
    const accountData = {
      bank: 'Banco Test',
      iban: 'ES9121000418450200051999',
      openingBalance: 0
    };

    const account = await TreasuryAccountsAPI.createAccount(accountData);
    expect(account.id).toBeDefined();

    // Check that no movements were created for this account
    const db = await initDB();
    const movements = await db.getAllFromIndex('movements', 'accountId', account.id!);
    
    expect(movements).toHaveLength(0);
  });

  test('should detect demo movements correctly', () => {
    const demoMovements = [
      {
        id: 1,
        accountId: 1,
        date: '2024-01-01',
        description: 'Demo payment example',
        amount: 100,
        status: 'pendiente' as const,
        unifiedStatus: 'no_planificado' as const,
        source: 'manual' as const,
        category: { tipo: 'Demo' },
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      },
      {
        id: 2,
        accountId: 1,
        date: '2024-01-01',
        description: 'Test transaction',
        amount: 500,
        status: 'pendiente' as const,
        unifiedStatus: 'no_planificado' as const,
        source: 'manual' as const,
        category: { tipo: 'Test' },
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      },
      {
        id: 3,
        accountId: 1,
        date: '2024-01-01',
        description: 'Ejemplo de movimiento',
        amount: 1000,
        status: 'pendiente' as const,
        unifiedStatus: 'no_planificado' as const,
        source: 'manual' as const,
        category: { tipo: 'Ejemplo' },
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      }
    ];

    demoMovements.forEach(movement => {
      expect(isDemoMovement(movement as Movement)).toBe(true);
    });
  });

  test('should not flag real movements as demo', () => {
    const realMovements = [
      {
        id: 1,
        accountId: 1,
        date: '2024-01-01',
        description: 'Pago nómina empresa',
        amount: 2500,
        status: 'pendiente' as const,
        unifiedStatus: 'no_planificado' as const,
        source: 'import' as const,
        category: { tipo: 'Ingresos' },
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      },
      {
        id: 2,
        accountId: 1,
        date: '2024-01-01',
        description: 'Transferencia a cuenta ahorro',
        amount: -1000,
        status: 'pendiente' as const,
        unifiedStatus: 'no_planificado' as const,
        source: 'manual' as const,
        category: { tipo: 'Transferencias' },
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      }
    ];

    realMovements.forEach(movement => {
      expect(isDemoMovement(movement as Movement)).toBe(false);
    });
  });

  test('should cleanup any existing demo data', async () => {
    const result = await cleanupAllDemoData();
    
    // Should complete without errors
    expect(result.errors).toHaveLength(0);
    
    // Verify no demo movements exist after cleanup
    const db = await initDB();
    const allMovements = await db.getAll('movements');
    const remainingDemoMovements = allMovements.filter(isDemoMovement);
    
    expect(remainingDemoMovements).toHaveLength(0);
  });
});