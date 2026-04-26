// src/services/__tests__/dbV62Migration.test.ts
// Tests for V62 migration: eliminate 11 duplicate/fossil stores

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

const TEST_DB_NAME = 'AtlasHorizonDB';

describe('DB V62 Migration', () => {
  beforeEach(() => {
    // Isolate storage between tests
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  it('should initialize database at version 63', async () => {
    const dbModule = await import('../db');
    const db = await dbModule.initDB();
    expect(db.version).toBe(65);
    db.close();
  });

  it('should not contain the 11 eliminated stores', async () => {
    const dbModule = await import('../db');
    const db = await dbModule.initDB();
    
    const eliminatedStores = [
      'kpiConfigurations',
      'configuracion_fiscal',
      'treasuryRecommendations',
      'valoraciones_mensuales',
      'patrimonioSnapshots',
      'operacionesProveedor',
      'patronGastosPersonales',
      'gastosPersonalesReal',
      'opexRules',
      'rentaMensual',
      'ejerciciosFiscales',
    ];

    for (const storeName of eliminatedStores) {
      expect(db.objectStoreNames.contains(storeName)).toBe(false);
    }

    db.close();
  });

  it('should still contain essential stores', async () => {
    const dbModule = await import('../db');
    const db = await dbModule.initDB();
    
    const essentialStores = [
      'properties',
      'accounts',
      'movements',
      'treasuryEvents',
      'ingresos',
      'proveedores',
      'compromisosRecurrentes',
      'ejerciciosFiscalesCoord',
      'valoraciones_historicas',
      'keyval',
    ];

    for (const storeName of essentialStores) {
      expect(db.objectStoreNames.contains(storeName)).toBe(true);
    }

    db.close();
  });

  it('should be idempotent (opening twice stays at version 63)', async () => {
    const dbModule = await import('../db');
    
    const db1 = await dbModule.initDB();
    expect(db1.version).toBe(65);
    db1.close();

    // Reset to force a new connection
    jest.resetModules();
    const dbModule2 = await import('../db');
    
    const db2 = await dbModule2.initDB();
    expect(db2.version).toBe(65);
    db2.close();
  });

  it('should successfully delete stores from a V61 DB', async () => {
    // Manually create a V61-like DB with some of the eliminated stores
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(TEST_DB_NAME, 61);
      req.onupgradeneeded = () => {
        const db = req.result;
        // Create a few stores that should be deleted in V62
        if (!db.objectStoreNames.contains('kpiConfigurations')) {
          db.createObjectStore('kpiConfigurations', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('opexRules')) {
          db.createObjectStore('opexRules', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('ejerciciosFiscales')) {
          db.createObjectStore('ejerciciosFiscales', { keyPath: 'ejercicio' });
        }
        // Also create an essential store that should remain
        if (!db.objectStoreNames.contains('properties')) {
          db.createObjectStore('properties', { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        // Verify V61 has these stores
        expect(db.objectStoreNames.contains('kpiConfigurations')).toBe(true);
        expect(db.objectStoreNames.contains('opexRules')).toBe(true);
        expect(db.objectStoreNames.contains('ejerciciosFiscales')).toBe(true);
        expect(db.objectStoreNames.contains('properties')).toBe(true);
        db.close();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });

    // Now open with initDB (should trigger V62 migration)
    const dbModule = await import('../db');
    const db62 = await dbModule.initDB();

    // Verify V62 deleted the stores
    expect(db62.version).toBe(65);
    expect(db62.objectStoreNames.contains('kpiConfigurations')).toBe(false);
    expect(db62.objectStoreNames.contains('opexRules')).toBe(false);
    expect(db62.objectStoreNames.contains('ejerciciosFiscales')).toBe(false);
    
    // Verify essential store still exists
    expect(db62.objectStoreNames.contains('properties')).toBe(true);

    db62.close();
  });
});
