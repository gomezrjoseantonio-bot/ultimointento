/**
 * TAREA 15 sub-tarea 15.3 · tests para migrateKeyvalPlanpagosToPrestamos.
 *
 * Cubre los escenarios listados en spec §2 sub-tarea 15.3:
 *   1. Pre · 3 préstamos con keyval planpagos_${id} · prestamos sin planPagos
 *   2. Run migración · 3 préstamos con planPagos populated · 3 entradas
 *      keyval borradas
 *   3. Idempotente · segunda corrida · skipped
 *   4. Conflict · keyval con valor + prestamo.planPagos con valor distinto ·
 *      no sobrescribe · log conflict · borra keyval
 *   5. Huérfana · clave planpagos_X sin préstamo X · borrada
 *   6. Ya migrado · prestamo.planPagos tiene valor + keyval también · borra
 *      keyval (la fuente canónica es prestamo.planPagos)
 */

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import type { PlanPagos, Prestamo } from '../../../types/prestamos';
import { T15_PLANPAGOS_MIGRATION_FLAG_KEY } from '../migrateKeyvalPlanpagosToPrestamos';

describe('migrateKeyvalPlanpagosToPrestamos', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  const minimalPrestamo = (id: string, overrides: Partial<Prestamo> = {}): Prestamo => ({
    id,
    ambito: 'INMUEBLE',
    nombre: `Préstamo ${id}`,
    principalInicial: 100000,
    principalVivo: 100000,
    fechaFirma: '2024-01-01',
    fechaPrimerCargo: '2024-02-01',
    plazoMesesTotal: 240,
    diaCargoMes: 1,
    esquemaPrimerRecibo: 'NORMAL',
    tipo: 'FIJO',
    sistema: 'FRANCES',
    carencia: 'NINGUNA',
    cuentaCargoId: 'acc-1',
    cuotasPagadas: 0,
    origenCreacion: 'MANUAL',
    activo: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  });

  const minimalPlan = (loanId: string, overrides: Partial<PlanPagos> = {}): PlanPagos => ({
    prestamoId: loanId,
    fechaGeneracion: '2024-01-15T00:00:00.000Z',
    periodos: [
      {
        periodo: 1,
        devengoDesde: '2024-01-01',
        devengoHasta: '2024-01-31',
        fechaCargo: '2024-02-01',
        cuota: 500,
        interes: 100,
        amortizacion: 400,
        principalFinal: 99600,
        pagado: false,
      },
    ],
    resumen: {
      totalIntereses: 100,
      totalCuotas: 500,
      fechaFinalizacion: '2044-01-31',
    },
    ...overrides,
  });

  const seed = async (
    prestamos: Prestamo[],
    keyvalEntries: Array<[string, unknown]>,
  ): Promise<void> => {
    const { initDB } = await import('../../db');
    const db = await initDB();
    const tx = db.transaction(['prestamos', 'keyval'], 'readwrite');
    for (const p of prestamos) {
      await tx.objectStore('prestamos').put(p);
    }
    for (const [key, value] of keyvalEntries) {
      await tx.objectStore('keyval').put(value, key);
    }
    await tx.done;
  };

  const readPrestamo = async (id: string): Promise<Prestamo | undefined> => {
    const { initDB } = await import('../../db');
    const db = await initDB();
    return (await db.get('prestamos', id)) as Prestamo | undefined;
  };

  const readKeyval = async (key: string): Promise<unknown> => {
    const { initDB } = await import('../../db');
    const db = await initDB();
    return db.get('keyval', key);
  };

  const allPlanpagosKeys = async (): Promise<string[]> => {
    const { initDB } = await import('../../db');
    const db = await initDB();
    const keys = (await db.getAllKeys('keyval')) as IDBValidKey[];
    return keys.map((k) => String(k)).filter((k) => k.startsWith('planpagos_'));
  };

  test('mueve N planpagos_* a prestamo.planPagos · borra entradas keyval', async () => {
    const prestamos = ['L1', 'L2', 'L3'].map((id) => minimalPrestamo(id));
    const planL1 = minimalPlan('L1');
    const planL2 = minimalPlan('L2');
    const planL3 = minimalPlan('L3');

    await seed(prestamos, [
      ['planpagos_L1', planL1],
      ['planpagos_L2', planL2],
      ['planpagos_L3', planL3],
    ]);

    const { migrateKeyvalPlanpagosToPrestamos } = await import('../migrateKeyvalPlanpagosToPrestamos');
    const report = await migrateKeyvalPlanpagosToPrestamos();

    expect(report.skipped).toBe(false);
    expect(report.movedCount).toBe(3);
    expect(report.conflictCount).toBe(0);
    expect(report.orphanCount).toBe(0);
    expect(report.errors).toEqual([]);

    const post = await Promise.all(['L1', 'L2', 'L3'].map(readPrestamo));
    expect(post[0]?.planPagos).toEqual(planL1);
    expect(post[1]?.planPagos).toEqual(planL2);
    expect(post[2]?.planPagos).toEqual(planL3);

    expect(await allPlanpagosKeys()).toEqual([]);
  });

  test('idempotente · segunda ejecución · skipped=true · movedCount=0', async () => {
    await seed([minimalPrestamo('L1')], [['planpagos_L1', minimalPlan('L1')]]);

    const { migrateKeyvalPlanpagosToPrestamos } = await import('../migrateKeyvalPlanpagosToPrestamos');

    const first = await migrateKeyvalPlanpagosToPrestamos();
    expect(first.skipped).toBe(false);
    expect(first.movedCount).toBe(1);

    const second = await migrateKeyvalPlanpagosToPrestamos();
    expect(second.skipped).toBe(true);
    expect(second.movedCount).toBe(0);

    expect(await readKeyval(T15_PLANPAGOS_MIGRATION_FLAG_KEY)).toBe('completed');
  });

  test('conflict · prestamo.planPagos ya tiene valor distinto · NO sobrescribe · borra keyval · cuenta conflict', async () => {
    const existingPlan = minimalPlan('L1', {
      fechaGeneracion: '2025-06-01T00:00:00.000Z',
    });
    const keyvalPlan = minimalPlan('L1', {
      fechaGeneracion: '2024-01-15T00:00:00.000Z',
    });

    await seed(
      [minimalPrestamo('L1', { planPagos: existingPlan })],
      [['planpagos_L1', keyvalPlan]],
    );

    const { migrateKeyvalPlanpagosToPrestamos } = await import('../migrateKeyvalPlanpagosToPrestamos');
    const report = await migrateKeyvalPlanpagosToPrestamos();

    expect(report.conflictCount).toBe(1);
    expect(report.movedCount).toBe(0);

    const post = await readPrestamo('L1');
    // No sobrescribir · sigue el plan que ya estaba en el préstamo
    expect(post?.planPagos).toEqual(existingPlan);
    expect(post?.planPagos).not.toEqual(keyvalPlan);

    // keyval limpiada
    expect(await readKeyval('planpagos_L1')).toBeUndefined();
  });

  test('huérfana · clave planpagos_X sin préstamo X · borra keyval · cuenta orphan', async () => {
    await seed(
      [minimalPrestamo('L1')], // existe L1 pero no L99
      [
        ['planpagos_L1', minimalPlan('L1')],
        ['planpagos_L99', minimalPlan('L99')],
      ],
    );

    const { migrateKeyvalPlanpagosToPrestamos } = await import('../migrateKeyvalPlanpagosToPrestamos');
    const report = await migrateKeyvalPlanpagosToPrestamos();

    expect(report.movedCount).toBe(1);
    expect(report.orphanCount).toBe(1);

    expect(await allPlanpagosKeys()).toEqual([]);
  });

  test('ya migrado · prestamo.planPagos tiene valor igual al de keyval · borra keyval · cuenta alreadyMigrated', async () => {
    const plan = minimalPlan('L1');
    await seed(
      [minimalPrestamo('L1', { planPagos: plan })],
      [['planpagos_L1', plan]],
    );

    const { migrateKeyvalPlanpagosToPrestamos } = await import('../migrateKeyvalPlanpagosToPrestamos');
    const report = await migrateKeyvalPlanpagosToPrestamos();

    expect(report.alreadyMigratedCount).toBe(1);
    expect(report.movedCount).toBe(0);
    expect(report.conflictCount).toBe(0);

    expect(await allPlanpagosKeys()).toEqual([]);
  });

  test('NO toca claves keyval que no son planpagos_*', async () => {
    await seed(
      [minimalPrestamo('L1')],
      [
        ['planpagos_L1', minimalPlan('L1')],
        ['matchingConfig', { mode: 'auto' }],
        ['dashboardConfiguration', { layout: 'compact' }],
        ['base-assumptions', { ipc: 0.02 }],
        ['migration_orphaned_inmueble_ids_v1', 'completed'],
      ],
    );

    const { migrateKeyvalPlanpagosToPrestamos } = await import('../migrateKeyvalPlanpagosToPrestamos');
    await migrateKeyvalPlanpagosToPrestamos();

    expect(await readKeyval('matchingConfig')).toEqual({ mode: 'auto' });
    expect(await readKeyval('dashboardConfiguration')).toEqual({ layout: 'compact' });
    expect(await readKeyval('base-assumptions')).toEqual({ ipc: 0.02 });
    expect(await readKeyval('migration_orphaned_inmueble_ids_v1')).toBe('completed');
  });

  test('store keyval sin planpagos_* · marca flag y termina sin trabajo', async () => {
    await seed([minimalPrestamo('L1')], []);

    const { migrateKeyvalPlanpagosToPrestamos } = await import('../migrateKeyvalPlanpagosToPrestamos');
    const report = await migrateKeyvalPlanpagosToPrestamos();

    expect(report.skipped).toBe(false);
    expect(report.movedCount).toBe(0);
    expect(await readKeyval(T15_PLANPAGOS_MIGRATION_FLAG_KEY)).toBe('completed');
  });
});
