// src/services/__tests__/dbV64Migration.test.ts
// Tests for V64 migration (TAREA 7 sub-tarea 5): eliminate 2 ambiguous stores.
//   · learningLogs → movementLearningRules.history[] (FIFO max 50)
//   · reconciliationAuditLogs: wipe without destination (0 readers)

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

const TEST_DB_NAME = 'AtlasHorizonDB';

describe('DB V64 Migration · sub-tarea 5', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  it('should initialize database at version 64', async () => {
    const dbModule = await import('../db');
    const db = await dbModule.initDB();
    expect(db.version).toBe(65);
    db.close();
  });

  it('should not contain learningLogs or reconciliationAuditLogs', async () => {
    const dbModule = await import('../db');
    const db = await dbModule.initDB();

    expect(db.objectStoreNames.contains('learningLogs')).toBe(false);
    expect(db.objectStoreNames.contains('reconciliationAuditLogs')).toBe(false);

    db.close();
  });

  it('should still contain movementLearningRules', async () => {
    const dbModule = await import('../db');
    const db = await dbModule.initDB();

    expect(db.objectStoreNames.contains('movementLearningRules')).toBe(true);

    db.close();
  });

  it('should be idempotent (opening twice stays at version 64)', async () => {
    const dbModule = await import('../db');

    const db1 = await dbModule.initDB();
    expect(db1.version).toBe(65);
    db1.close();

    jest.resetModules();
    const dbModule2 = await import('../db');

    const db2 = await dbModule2.initDB();
    expect(db2.version).toBe(65);
    db2.close();
  });

  it('should delete learningLogs and reconciliationAuditLogs from a V63-like DB', async () => {
    // Manually create a V63 DB that still has the two AMBIGUOUS stores
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(TEST_DB_NAME, 63);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('movementLearningRules')) {
          const s = db.createObjectStore('movementLearningRules', { keyPath: 'id', autoIncrement: true });
          s.createIndex('learnKey', 'learnKey', { unique: true });
        }
        if (!db.objectStoreNames.contains('learningLogs')) {
          const s = db.createObjectStore('learningLogs', { keyPath: 'id', autoIncrement: true });
          s.createIndex('ruleId', 'ruleId', { unique: false });
        }
        if (!db.objectStoreNames.contains('reconciliationAuditLogs')) {
          db.createObjectStore('reconciliationAuditLogs', { keyPath: 'id', autoIncrement: true });
        }
        // Minimum required stores so initDB() doesn't fail
        if (!db.objectStoreNames.contains('keyval')) {
          db.createObjectStore('keyval');
        }
        if (!db.objectStoreNames.contains('ingresos')) {
          const s = db.createObjectStore('ingresos', { keyPath: 'id', autoIncrement: true });
          s.createIndex('personalDataId', 'personalDataId', { unique: false });
          s.createIndex('tipo', 'tipo', { unique: false });
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

    expect(db64.version).toBe(65);
    expect(db64.objectStoreNames.contains('learningLogs')).toBe(false);
    expect(db64.objectStoreNames.contains('reconciliationAuditLogs')).toBe(false);
    expect(db64.objectStoreNames.contains('movementLearningRules')).toBe(true);

    db64.close();
  });

  it('should migrate learningLogs entries into movementLearningRules.history[] grouped by ruleId', async () => {
    // Seed a V63 DB with one rule and two log entries pointing to it
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(TEST_DB_NAME, 63);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('movementLearningRules')) {
          const s = db.createObjectStore('movementLearningRules', { keyPath: 'id', autoIncrement: true });
          s.createIndex('learnKey', 'learnKey', { unique: true });
        }
        if (!db.objectStoreNames.contains('learningLogs')) {
          const s = db.createObjectStore('learningLogs', { keyPath: 'id', autoIncrement: true });
          s.createIndex('ruleId', 'ruleId', { unique: false });
        }
        if (!db.objectStoreNames.contains('reconciliationAuditLogs')) {
          db.createObjectStore('reconciliationAuditLogs', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('keyval')) {
          db.createObjectStore('keyval');
        }
        if (!db.objectStoreNames.contains('ingresos')) {
          const s = db.createObjectStore('ingresos', { keyPath: 'id', autoIncrement: true });
          s.createIndex('personalDataId', 'personalDataId', { unique: false });
          s.createIndex('tipo', 'tipo', { unique: false });
        }
        if (!db.objectStoreNames.contains('prestamos')) {
          db.createObjectStore('prestamos', { keyPath: 'id' });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(['movementLearningRules', 'learningLogs'], 'readwrite');
        // Seed rule with id=1
        tx.objectStore('movementLearningRules').add({
          id: 1,
          learnKey: 'test-key-abc',
          counterpartyPattern: 'endesa',
          descriptionPattern: 'recibo luz',
          amountSign: 'negative',
          categoria: 'Suministros',
          ambito: 'INMUEBLE',
          source: 'IMPLICIT',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          appliedCount: 2,
        });
        // Seed two learning log entries linked to ruleId=1
        tx.objectStore('learningLogs').add({
          action: 'CREATE_RULE',
          movimientoId: 42,
          ruleId: 1,
          learnKey: 'test-key-abc',
          categoria: 'Suministros',
          ambito: 'INMUEBLE',
          ts: '2024-01-01T10:00:00Z',
        });
        tx.objectStore('learningLogs').add({
          action: 'BACKFILL',
          movimientoId: 43,
          ruleId: 1,
          learnKey: 'test-key-abc',
          categoria: 'Suministros',
          ambito: 'INMUEBLE',
          ts: '2024-01-01T11:00:00Z',
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
    expect(db64.version).toBe(65);

    // learningLogs deleted
    expect(db64.objectStoreNames.contains('learningLogs')).toBe(false);

    // history[] populated on the rule
    const rules = (await db64.getAll('movementLearningRules')) as any[];
    expect(rules).toHaveLength(1);
    const rule = rules[0];
    expect(Array.isArray(rule.history)).toBe(true);
    expect(rule.history).toHaveLength(2);

    const createEntry = rule.history.find((h: any) => h.action === 'CREATE_RULE');
    expect(createEntry).toBeDefined();
    expect(createEntry.movimientoId).toBe(42);
    expect(createEntry.ts).toBe('2024-01-01T10:00:00Z');

    const backfillEntry = rule.history.find((h: any) => h.action === 'BACKFILL');
    expect(backfillEntry).toBeDefined();
    expect(backfillEntry.movimientoId).toBe(43);

    db64.close();
  });

  it('should enforce FIFO cap of 50 when migrating learningLogs', async () => {
    // Seed 60 log entries for one rule — only last 50 should survive
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(TEST_DB_NAME, 63);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('movementLearningRules')) {
          const s = db.createObjectStore('movementLearningRules', { keyPath: 'id', autoIncrement: true });
          s.createIndex('learnKey', 'learnKey', { unique: true });
        }
        if (!db.objectStoreNames.contains('learningLogs')) {
          const s = db.createObjectStore('learningLogs', { keyPath: 'id', autoIncrement: true });
          s.createIndex('ruleId', 'ruleId', { unique: false });
        }
        if (!db.objectStoreNames.contains('reconciliationAuditLogs')) {
          db.createObjectStore('reconciliationAuditLogs', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('keyval')) {
          db.createObjectStore('keyval');
        }
        if (!db.objectStoreNames.contains('ingresos')) {
          const s = db.createObjectStore('ingresos', { keyPath: 'id', autoIncrement: true });
          s.createIndex('personalDataId', 'personalDataId', { unique: false });
          s.createIndex('tipo', 'tipo', { unique: false });
        }
        if (!db.objectStoreNames.contains('prestamos')) {
          db.createObjectStore('prestamos', { keyPath: 'id' });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(['movementLearningRules', 'learningLogs'], 'readwrite');
        tx.objectStore('movementLearningRules').add({
          id: 1,
          learnKey: 'cap-test-key',
          counterpartyPattern: 'test',
          descriptionPattern: 'test',
          amountSign: 'negative',
          categoria: 'Test',
          ambito: 'PERSONAL',
          source: 'IMPLICIT',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          appliedCount: 60,
        });
        for (let i = 0; i < 60; i++) {
          const ts = new Date(2024, 0, 1, i % 24, 0, 0).toISOString();
          tx.objectStore('learningLogs').add({
            action: 'APPLY_RULE',
            movimientoId: 100 + i,
            ruleId: 1,
            learnKey: 'cap-test-key',
            categoria: 'Test',
            ambito: 'PERSONAL',
            ts,
          });
        }
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
    expect(db64.version).toBe(65);

    const rules = (await db64.getAll('movementLearningRules')) as any[];
    const rule = rules[0];
    expect(Array.isArray(rule.history)).toBe(true);
    expect(rule.history.length).toBeLessThanOrEqual(50);

    db64.close();
  });
});
