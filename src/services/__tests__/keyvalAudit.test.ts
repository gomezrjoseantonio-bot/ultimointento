/**
 * TAREA 15.1 · tests para la utilidad __keyvalAudit.
 *
 * Cubre:
 *  - clasificación de claves conocidas (cat A/B/C/D)
 *  - claves desconocidas marcadas como `unknown` + recomendación TODO_REVIEW
 *  - orden estable A → B → C → D → unknown · alfabético dentro de cada categoría
 *  - patrón dinámico `planpagos_*` clasificado como C/MOVE
 *  - conteo `byCategory` correcto
 *  - lista `unknownKeys` correcta
 */

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

describe('__keyvalAudit · auditKeyval()', () => {
  beforeEach(() => {
    // DB limpia por test · evita state cacheada entre tests
    (global as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  const seedKeyval = async (entries: Array<[string, unknown]>): Promise<void> => {
    // Importa el módulo db de la app (después del reset) para que use la
    // misma DB que la utility leerá.
    const { initDB } = await import('../db');
    const db = await initDB();
    const tx = db.transaction('keyval', 'readwrite');
    for (const [key, value] of entries) {
      await tx.objectStore('keyval').put(value, key);
    }
    await tx.done;
  };

  test('clasifica claves conocidas en sus categorías correspondientes', async () => {
    await seedKeyval([
      ['matchingConfig', { mode: 'auto' }],
      ['dashboardConfiguration', { layout: 'compact' }],
      ['base-assumptions', { ipc: 0.02 }],
      ['base-projection', { years: [] }],
      ['proveedor-contraparte-migration', 'completed'],
      ['migration_orphaned_inmueble_ids_v1', 'completed'],
    ]);

    const { auditKeyval } = await import('../__keyvalAudit');
    const report = await auditKeyval();

    const byKey = Object.fromEntries(report.entries.map((e) => [e.key, e]));

    expect(byKey['matchingConfig'].category).toBe('A');
    expect(byKey['matchingConfig'].recommendation).toBe('KEEP');

    expect(byKey['dashboardConfiguration'].category).toBe('A');
    expect(byKey['dashboardConfiguration'].recommendation).toBe('KEEP');

    expect(byKey['base-assumptions'].category).toBe('A');
    expect(byKey['base-assumptions'].recommendation).toBe('TODO_PROYECCION');

    expect(byKey['base-projection'].category).toBe('B');
    expect(byKey['base-projection'].recommendation).toBe('TODO_PROYECCION');

    expect(byKey['proveedor-contraparte-migration'].category).toBe('D');
    expect(byKey['proveedor-contraparte-migration'].recommendation).toBe('DELETE');

    expect(byKey['migration_orphaned_inmueble_ids_v1'].category).toBe('D');
    expect(byKey['migration_orphaned_inmueble_ids_v1'].recommendation).toBe('KEEP');
  });

  test('clasifica planpagos_* como C/MOVE', async () => {
    await seedKeyval([
      ['planpagos_loan-1', { periodos: [] }],
      ['planpagos_loan-42', { periodos: [{ cuota: 100 }] }],
    ]);

    const { auditKeyval } = await import('../__keyvalAudit');
    const report = await auditKeyval();

    const planpagos = report.entries.filter((e) => e.key.startsWith('planpagos_'));
    expect(planpagos).toHaveLength(2);
    for (const e of planpagos) {
      expect(e.category).toBe('C');
      expect(e.recommendation).toBe('MOVE');
    }
  });

  test('marca claves no catalogadas como unknown/TODO_REVIEW y las añade a unknownKeys', async () => {
    await seedKeyval([
      ['matchingConfig', { mode: 'auto' }],
      ['totally_unknown_legacy_key', { whatever: 1 }],
      ['another-unknown', 'foo'],
    ]);

    const { auditKeyval } = await import('../__keyvalAudit');
    const report = await auditKeyval();

    const byKey = Object.fromEntries(report.entries.map((e) => [e.key, e]));

    expect(byKey['totally_unknown_legacy_key'].category).toBe('unknown');
    expect(byKey['totally_unknown_legacy_key'].recommendation).toBe('TODO_REVIEW');

    expect(byKey['another-unknown'].category).toBe('unknown');
    expect(byKey['another-unknown'].recommendation).toBe('TODO_REVIEW');

    expect(report.unknownKeys.sort()).toEqual(['another-unknown', 'totally_unknown_legacy_key']);
  });

  test('byCategory cuenta correctamente claves de cada categoría', async () => {
    await seedKeyval([
      ['matchingConfig', { mode: 'auto' }],            // A
      ['dashboardConfiguration', { layout: 'x' }],     // A
      ['base-projection', { years: [] }],              // B
      ['planpagos_a', { periodos: [] }],               // C
      ['planpagos_b', { periodos: [] }],               // C
      ['planpagos_c', { periodos: [] }],               // C
      ['proveedor-contraparte-migration', 'completed'], // D
      ['migration_orphaned_inmueble_ids_v1', 'done'],  // D
      ['random-residual', 1],                          // unknown
    ]);

    const { auditKeyval } = await import('../__keyvalAudit');
    const report = await auditKeyval();

    expect(report.totalKeys).toBe(9);
    expect(report.byCategory).toEqual({ A: 2, B: 1, C: 3, D: 2, unknown: 1 });
  });

  test('orden estable · A → B → C → D → unknown · alfabético dentro de cada categoría', async () => {
    await seedKeyval([
      ['random-zzz', 1],                                // unknown
      ['planpagos_b', { periodos: [] }],                // C
      ['planpagos_a', { periodos: [] }],                // C
      ['matchingConfig', { mode: 'auto' }],             // A
      ['proveedor-contraparte-migration', 'done'],      // D
      ['base-projection', { years: [] }],               // B
      ['dashboardConfiguration', { layout: 'x' }],      // A
      ['migration_orphaned_inmueble_ids_v1', 'done'],   // D
      ['aaa-random', 'foo'],                            // unknown
    ]);

    const { auditKeyval } = await import('../__keyvalAudit');
    const report = await auditKeyval();

    const orderedKeys = report.entries.map((e) => e.key);
    expect(orderedKeys).toEqual([
      // A (alfabético)
      'dashboardConfiguration',
      'matchingConfig',
      // B
      'base-projection',
      // C (alfabético)
      'planpagos_a',
      'planpagos_b',
      // D (alfabético)
      'migration_orphaned_inmueble_ids_v1',
      'proveedor-contraparte-migration',
      // unknown (alfabético)
      'aaa-random',
      'random-zzz',
    ]);
  });

  test('store keyval vacío · totalKeys=0 · entries vacío', async () => {
    const { auditKeyval } = await import('../__keyvalAudit');
    const report = await auditKeyval();

    expect(report.totalKeys).toBe(0);
    expect(report.entries).toEqual([]);
    expect(report.unknownKeys).toEqual([]);
    expect(report.byCategory).toEqual({ A: 0, B: 0, C: 0, D: 0, unknown: 0 });
  });

  test('valueType y byteSize calculados a partir del valor', async () => {
    await seedKeyval([
      ['matchingConfig', { a: 1 }],
      ['proveedor-contraparte-migration', 'completed'],
      ['planpagos_x', { periodos: [{ cuota: 1 }, { cuota: 2 }] }],
    ]);

    const { auditKeyval } = await import('../__keyvalAudit');
    const report = await auditKeyval();

    const byKey = Object.fromEntries(report.entries.map((e) => [e.key, e]));
    expect(byKey['matchingConfig'].valueType).toBe('object');
    expect(byKey['proveedor-contraparte-migration'].valueType).toBe('string');
    expect(byKey['planpagos_x'].valueType).toBe('object');

    expect(byKey['matchingConfig'].byteSize).toBeGreaterThan(0);
    expect(byKey['proveedor-contraparte-migration'].byteSize).toBeGreaterThan(0);
  });
});
