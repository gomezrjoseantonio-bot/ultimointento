// src/services/__tests__/dbV63Migration.test.ts
// Tests for V63 migration (TAREA 7 sub-tarea 4 + 4-bis): eliminate 8 orphan
// stores fused into their destinations.

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

const TEST_DB_NAME = 'AtlasHorizonDB';

describe('DB V63+V64 Migration · sub-tareas 4+4-bis+5', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  it('should initialize database at version 64', async () => {
    const dbModule = await import('../db');
    const db = await dbModule.initDB();
    expect(db.version).toBe(64);
    db.close();
  });

  it('should not contain the 10 eliminated stores', async () => {
    const dbModule = await import('../db');
    const db = await dbModule.initDB();

    const eliminatedStores = [
      'nominas',
      'autonomos',
      'pensiones',
      'otrosIngresos',
      'arrastresManual',
      'documentosFiscales',
      'loan_settlements',
      'matchingConfiguration',
      'learningLogs',
      'reconciliationAuditLogs',
    ];

    for (const storeName of eliminatedStores) {
      expect(db.objectStoreNames.contains(storeName)).toBe(false);
    }

    db.close();
  });

  it('should still contain essential destination stores', async () => {
    const dbModule = await import('../db');
    const db = await dbModule.initDB();

    const essentialStores = [
      'ingresos',
      'arrastresIRPF',
      'documents',
      'prestamos',
      'keyval',
    ];

    for (const storeName of essentialStores) {
      expect(db.objectStoreNames.contains(storeName)).toBe(true);
    }

    db.close();
  });

  it('should be idempotent (opening twice stays at version 64)', async () => {
    const dbModule = await import('../db');

    const db1 = await dbModule.initDB();
    expect(db1.version).toBe(64);
    db1.close();

    jest.resetModules();
    const dbModule2 = await import('../db');

    const db2 = await dbModule2.initDB();
    expect(db2.version).toBe(64);
    db2.close();
  });

  it('should successfully delete stores from a V62-like DB', async () => {
    // Manually create a V62 DB with some of the eliminated stores populated
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(TEST_DB_NAME, 62);
      req.onupgradeneeded = () => {
        const db = req.result;
        // Create stores that V63 should delete
        if (!db.objectStoreNames.contains('autonomos')) {
          const s = db.createObjectStore('autonomos', { keyPath: 'id', autoIncrement: true });
          s.createIndex('personalDataId', 'personalDataId', { unique: false });
        }
        if (!db.objectStoreNames.contains('pensiones')) {
          const s = db.createObjectStore('pensiones', { keyPath: 'id', autoIncrement: true });
          s.createIndex('personalDataId', 'personalDataId', { unique: false });
        }
        if (!db.objectStoreNames.contains('matchingConfiguration')) {
          db.createObjectStore('matchingConfiguration', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('loan_settlements')) {
          const s = db.createObjectStore('loan_settlements', { keyPath: 'id', autoIncrement: true });
          s.createIndex('loanId', 'loanId', { unique: false });
        }
        // Destination stores must already exist (created in V60/V61)
        if (!db.objectStoreNames.contains('ingresos')) {
          const s = db.createObjectStore('ingresos', { keyPath: 'id', autoIncrement: true });
          s.createIndex('personalDataId', 'personalDataId', { unique: false });
          s.createIndex('tipo', 'tipo', { unique: false });
        }
        if (!db.objectStoreNames.contains('keyval')) {
          db.createObjectStore('keyval');
        }
        if (!db.objectStoreNames.contains('prestamos')) {
          db.createObjectStore('prestamos', { keyPath: 'id' });
        }
      };
      req.onsuccess = () => {
        req.result.close();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });

    const dbModule = await import('../db');
    const db64 = await dbModule.initDB();

    expect(db64.version).toBe(64);
    expect(db64.objectStoreNames.contains('autonomos')).toBe(false);
    expect(db64.objectStoreNames.contains('pensiones')).toBe(false);
    expect(db64.objectStoreNames.contains('matchingConfiguration')).toBe(false);
    expect(db64.objectStoreNames.contains('loan_settlements')).toBe(false);
    expect(db64.objectStoreNames.contains('learningLogs')).toBe(false);
    expect(db64.objectStoreNames.contains('reconciliationAuditLogs')).toBe(false);
    // Destination stores survive
    expect(db64.objectStoreNames.contains('ingresos')).toBe(true);
    expect(db64.objectStoreNames.contains('keyval')).toBe(true);
    expect(db64.objectStoreNames.contains('prestamos')).toBe(true);
    expect(db64.objectStoreNames.contains('movementLearningRules')).toBe(true);

    db64.close();
  });

  it('should migrate autonomos records into ingresos with tipo="autonomo"', async () => {
    // Seed a V62 DB with one autonomo record + matching configuration
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(TEST_DB_NAME, 62);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('autonomos')) {
          const s = db.createObjectStore('autonomos', { keyPath: 'id', autoIncrement: true });
          s.createIndex('personalDataId', 'personalDataId', { unique: false });
        }
        if (!db.objectStoreNames.contains('matchingConfiguration')) {
          db.createObjectStore('matchingConfiguration', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('ingresos')) {
          const s = db.createObjectStore('ingresos', { keyPath: 'id', autoIncrement: true });
          s.createIndex('personalDataId', 'personalDataId', { unique: false });
          s.createIndex('tipo', 'tipo', { unique: false });
        }
        if (!db.objectStoreNames.contains('keyval')) {
          db.createObjectStore('keyval');
        }
        if (!db.objectStoreNames.contains('prestamos')) {
          db.createObjectStore('prestamos', { keyPath: 'id' });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(['autonomos', 'matchingConfiguration'], 'readwrite');
        tx.objectStore('autonomos').add({
          personalDataId: 1,
          activo: true,
          ingresosFacturados: [],
          gastosDeducibles: [],
          cuotaAutonomos: 350,
        });
        tx.objectStore('matchingConfiguration').add({
          dateWindow: 7,
          amountTolerancePercent: 20,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });

    const dbModule = await import('../db');
    const db64 = await dbModule.initDB();
    expect(db64.version).toBe(64);

    // Autonomo migrated into ingresos with tipo='autonomo'
    const ingresos = (await db64.getAll('ingresos')) as any[];
    const migratedAutonomos = ingresos.filter((r) => r.tipo === 'autonomo');
    expect(migratedAutonomos).toHaveLength(1);
    expect(migratedAutonomos[0].cuotaAutonomos).toBe(350);
    expect(migratedAutonomos[0].activo).toBe(true);

    // Matching configuration migrated into keyval['matchingConfig']
    const config = (await db64.get('keyval', 'matchingConfig')) as any;
    expect(config).toBeDefined();
    expect(config.dateWindow).toBe(7);
    expect(config.amountTolerancePercent).toBe(20);

    db64.close();
  });
});
