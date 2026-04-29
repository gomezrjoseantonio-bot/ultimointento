/**
 * TAREA 15 sub-tarea 15.2 · tests para `runKeyvalCleanup()`.
 *
 * Cubre los 4 escenarios listados en spec §2 sub-tarea 15.2:
 *   1. DB con claves a borrar · tras run · claves no existen · deletedCount > 0
 *   2. Run idempotente · segunda ejecución · skipped=true · deletedCount=0
 *   3. Si una clave falla al borrar · sigue con resto · reporta en errors[]
 *   4. Flag `cleanup_T15_v1` se escribe correctamente y previene re-ejecución
 *
 * Adicionalmente:
 *   - claves no listadas (configFiscal, matchingConfig, planpagos_*, base-assumptions)
 *     NO deben ser tocadas
 */

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { T15_CLEANUP_FLAG_KEY, T15_KEYS_TO_DELETE } from '../keyvalCleanupService';

describe('keyvalCleanupService · runKeyvalCleanup()', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  const seedKeyval = async (entries: Array<[string, unknown]>): Promise<void> => {
    const { initDB } = await import('../db');
    const db = await initDB();
    const tx = db.transaction('keyval', 'readwrite');
    for (const [key, value] of entries) {
      await tx.objectStore('keyval').put(value, key);
    }
    await tx.done;
  };

  const readKey = async (key: string): Promise<unknown> => {
    const { initDB } = await import('../db');
    const db = await initDB();
    return db.get('keyval', key);
  };

  test('borra todas las claves T15 cuando existen · deletedCount > 0', async () => {
    await seedKeyval([
      ['proveedor-contraparte-migration', 'completed'],
      ['base-projection', { years: [] }],
      ['kpiConfig_horizon', { metrics: [] }],
      ['kpiConfig_pulse', { metrics: [] }],
    ]);

    const { runKeyvalCleanup } = await import('../keyvalCleanupService');
    const report = await runKeyvalCleanup();

    expect(report.skipped).toBe(false);
    expect(report.deletedCount).toBe(4);
    expect(report.skippedCount).toBe(0);
    expect(report.errors).toEqual([]);

    for (const key of T15_KEYS_TO_DELETE) {
      expect(await readKey(key)).toBeUndefined();
    }
  });

  test('idempotente · segunda ejecución hace skip vía flag · deletedCount=0', async () => {
    await seedKeyval([
      ['proveedor-contraparte-migration', 'completed'],
      ['base-projection', { years: [] }],
    ]);

    const { runKeyvalCleanup } = await import('../keyvalCleanupService');

    const first = await runKeyvalCleanup();
    expect(first.skipped).toBe(false);
    expect(first.deletedCount).toBe(2);

    const second = await runKeyvalCleanup();
    expect(second.skipped).toBe(true);
    expect(second.deletedCount).toBe(0);
    expect(second.skippedCount).toBe(0);

    expect(await readKey(T15_CLEANUP_FLAG_KEY)).toBe('completed');
  });

  test('claves ausentes · skippedCount cuenta · deletedCount sólo las que existían', async () => {
    await seedKeyval([
      ['base-projection', { years: [] }],
      // proveedor-contraparte-migration y kpiConfig_* NO existen en la DB
    ]);

    const { runKeyvalCleanup } = await import('../keyvalCleanupService');
    const report = await runKeyvalCleanup();

    expect(report.skipped).toBe(false);
    expect(report.deletedCount).toBe(1);
    expect(report.skippedCount).toBe(3);
    expect(report.errors).toEqual([]);
  });

  test('NO toca claves fuera de la lista (configFiscal, matchingConfig, planpagos_*, base-assumptions)', async () => {
    await seedKeyval([
      ['proveedor-contraparte-migration', 'completed'],
      ['base-projection', { years: [] }],
      // claves preservadas
      ['configFiscal', { ejercicio: 2024 }],
      ['matchingConfig', { mode: 'auto' }],
      ['base-assumptions', { ipc: 0.02 }],
      ['dashboardConfiguration', { layout: 'compact' }],
      ['planpagos_loan-1', { periodos: [] }],
      ['planpagos_loan-2', { periodos: [{ cuota: 100 }] }],
      ['migration_orphaned_inmueble_ids_v1', 'completed'],
    ]);

    const { runKeyvalCleanup } = await import('../keyvalCleanupService');
    await runKeyvalCleanup();

    expect(await readKey('configFiscal')).toEqual({ ejercicio: 2024 });
    expect(await readKey('matchingConfig')).toEqual({ mode: 'auto' });
    expect(await readKey('base-assumptions')).toEqual({ ipc: 0.02 });
    expect(await readKey('dashboardConfiguration')).toEqual({ layout: 'compact' });
    expect(await readKey('planpagos_loan-1')).toEqual({ periodos: [] });
    expect(await readKey('planpagos_loan-2')).toEqual({ periodos: [{ cuota: 100 }] });
    expect(await readKey('migration_orphaned_inmueble_ids_v1')).toBe('completed');
  });

  test('flag cleanup_T15_v1 escrito tras primer run', async () => {
    await seedKeyval([['base-projection', { years: [] }]]);

    const { runKeyvalCleanup } = await import('../keyvalCleanupService');
    await runKeyvalCleanup();

    expect(await readKey(T15_CLEANUP_FLAG_KEY)).toBe('completed');
  });

  test('store keyval vacío · todas las claves van a skippedCount · flag escrito', async () => {
    const { runKeyvalCleanup } = await import('../keyvalCleanupService');
    const report = await runKeyvalCleanup();

    expect(report.skipped).toBe(false);
    expect(report.deletedCount).toBe(0);
    expect(report.skippedCount).toBe(T15_KEYS_TO_DELETE.length);
    expect(await readKey(T15_CLEANUP_FLAG_KEY)).toBe('completed');
  });

  test('error al borrar una clave · sigue con resto · reporta en errors[]', async () => {
    await seedKeyval([
      ['proveedor-contraparte-migration', 'completed'],
      ['base-projection', { years: [] }],
      ['kpiConfig_horizon', { metrics: [] }],
      ['kpiConfig_pulse', { metrics: [] }],
    ]);

    const { runKeyvalCleanup } = await import('../keyvalCleanupService');
    const dbModule = await import('../db');
    const realDb = await dbModule.initDB();
    const originalDelete = realDb.delete.bind(realDb);
    (realDb as any).delete = async (storeName: string, key: any) => {
      if (storeName === 'keyval' && key === 'base-projection') {
        throw new Error('simulated delete failure');
      }
      return originalDelete(storeName, key);
    };

    try {
      const report = await runKeyvalCleanup();

      expect(report.errors).toHaveLength(1);
      expect(report.errors[0]).toMatchObject({
        key: 'base-projection',
        error: 'simulated delete failure',
      });
      // Las otras 3 claves se borraron correctamente
      expect(report.deletedCount).toBe(3);
      expect(await readKey('proveedor-contraparte-migration')).toBeUndefined();
      expect(await readKey('kpiConfig_horizon')).toBeUndefined();
      expect(await readKey('kpiConfig_pulse')).toBeUndefined();
    } finally {
      (realDb as any).delete = originalDelete;
    }
  });
});
