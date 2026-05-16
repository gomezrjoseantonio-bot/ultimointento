/**
 * Tests · fixFechaContratacionRetroactiva (Pulido T13 v4 final · issue 2).
 *
 * Casos cubiertos ·
 *   1. Retroceso · plan xml_aeat con fechaContratacion=2024-01-01 y aportación
 *      mínima 2020-12-31 → fechaContratacion pasa a 2020-12-31. Flag escrito.
 *   2. Skip-on-flag · 2ª ejecución no toca nada · skipped=true · updated=0.
 *   3. No-toca-manual · plan con origen='manual' nunca se modifica, aunque
 *      tenga aportaciones anteriores.
 *   4. No-toca-cuando-fechaContratacion ≤ min · plan con
 *      fechaContratacion=2020-01-01 y min aportación 2020-12-31 no se toca.
 *   5. Plan sin aportaciones · ignorado · no se toca.
 *   6. Caso real Jose · PPE Orange · fechaContratacion=2024-01-01 →
 *      2020-12-31 (primera aportación).
 */

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

describe('fixFechaContratacionRetroactiva', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  async function seedPlan(
    db: any,
    overrides: Partial<{
      id: string;
      nombre: string;
      origen: 'manual' | 'xml_aeat' | 'migrado_v60';
      fechaContratacion: string;
    }> = {},
  ): Promise<string> {
    const id = overrides.id ?? 'plan-1';
    await db.put('planesPensiones', {
      id,
      nombre: overrides.nombre ?? 'Test plan',
      titular: 'yo',
      personalDataId: 1,
      tipoAdministrativo: 'PPE',
      gestoraActual: 'X',
      fechaContratacion: overrides.fechaContratacion ?? '2024-01-01',
      estado: 'activo',
      fechaCreacion: '2024-01-01T00:00:00Z',
      fechaActualizacion: '2024-01-01T00:00:00Z',
      origen: overrides.origen ?? 'xml_aeat',
    });
    return id;
  }

  async function seedAportacion(
    db: any,
    planId: string,
    fecha: string,
    ejercicio: number,
  ): Promise<void> {
    await db.put('aportacionesPlan', {
      id: `ap-${planId}-${ejercicio}`,
      planId,
      fecha,
      ejercicioFiscal: ejercicio,
      importeTitular: 1000,
      importeEmpresa: 0,
      origen: 'xml_aeat',
      granularidad: 'anual',
      fechaCreacion: '2024-01-01T00:00:00Z',
      fechaActualizacion: '2024-01-01T00:00:00Z',
    });
  }

  it('1 · retrocede fechaContratacion al min aportaciones · flag escrito', async () => {
    const { initDB } = await import('../../db');
    const { fixFechaContratacionRetroactiva, FECHA_CONTRATACION_RETRO_FLAG_KEY } =
      await import('../fixFechaContratacionRetroactiva');
    const db = await initDB();

    const planId = await seedPlan(db, { fechaContratacion: '2024-01-01' });
    await seedAportacion(db, planId, '2020-12-31', 2020);
    await seedAportacion(db, planId, '2022-06-15', 2022);

    const r = await fixFechaContratacionRetroactiva();
    expect(r.skipped).toBe(false);
    expect(r.updated).toBe(1);
    expect(r.inspected).toBe(1);
    expect(r.errors).toEqual([]);

    const dbAfter = await initDB();
    const plan = await dbAfter.get('planesPensiones', planId);
    expect(plan?.fechaContratacion).toBe('2020-12-31');

    const flag = await dbAfter.get('keyval', FECHA_CONTRATACION_RETRO_FLAG_KEY);
    expect(flag).toBe('completed');
  });

  it('2 · skip-on-flag · 2ª ejecución no toca nada', async () => {
    const { initDB } = await import('../../db');
    const { fixFechaContratacionRetroactiva, FECHA_CONTRATACION_RETRO_FLAG_KEY } =
      await import('../fixFechaContratacionRetroactiva');
    const db = await initDB();
    await db.put('keyval', 'completed', FECHA_CONTRATACION_RETRO_FLAG_KEY);

    const planId = await seedPlan(db, { fechaContratacion: '2024-01-01' });
    await seedAportacion(db, planId, '2020-12-31', 2020);

    const r = await fixFechaContratacionRetroactiva();
    expect(r.skipped).toBe(true);
    expect(r.updated).toBe(0);

    const dbAfter = await initDB();
    const plan = await dbAfter.get('planesPensiones', planId);
    expect(plan?.fechaContratacion).toBe('2024-01-01'); // intacto
  });

  it('3 · NO toca planes con origen=manual ni migrado_v60', async () => {
    const { initDB } = await import('../../db');
    const { fixFechaContratacionRetroactiva } = await import(
      '../fixFechaContratacionRetroactiva'
    );
    const db = await initDB();

    await seedPlan(db, {
      id: 'plan-manual',
      origen: 'manual',
      fechaContratacion: '2024-01-01',
    });
    await seedAportacion(db, 'plan-manual', '2020-12-31', 2020);

    await seedPlan(db, {
      id: 'plan-mig',
      origen: 'migrado_v60',
      fechaContratacion: '2024-01-01',
    });
    await seedAportacion(db, 'plan-mig', '2020-12-31', 2020);

    const r = await fixFechaContratacionRetroactiva();
    expect(r.inspected).toBe(0);
    expect(r.updated).toBe(0);

    const dbAfter = await initDB();
    expect((await dbAfter.get('planesPensiones', 'plan-manual'))?.fechaContratacion)
      .toBe('2024-01-01');
    expect((await dbAfter.get('planesPensiones', 'plan-mig'))?.fechaContratacion)
      .toBe('2024-01-01');
  });

  it('4 · NO toca si fechaContratacion ≤ min(aportaciones)', async () => {
    const { initDB } = await import('../../db');
    const { fixFechaContratacionRetroactiva } = await import(
      '../fixFechaContratacionRetroactiva'
    );
    const db = await initDB();

    const planId = await seedPlan(db, { fechaContratacion: '2020-01-01' });
    await seedAportacion(db, planId, '2020-12-31', 2020);

    const r = await fixFechaContratacionRetroactiva();
    expect(r.inspected).toBe(1);
    expect(r.updated).toBe(0);

    const dbAfter = await initDB();
    expect((await dbAfter.get('planesPensiones', planId))?.fechaContratacion)
      .toBe('2020-01-01');
  });

  it('5 · plan xml_aeat sin aportaciones · no se toca', async () => {
    const { initDB } = await import('../../db');
    const { fixFechaContratacionRetroactiva } = await import(
      '../fixFechaContratacionRetroactiva'
    );
    const db = await initDB();
    const planId = await seedPlan(db, { fechaContratacion: '2024-01-01' });

    const r = await fixFechaContratacionRetroactiva();
    expect(r.inspected).toBe(1);
    expect(r.updated).toBe(0);

    const dbAfter = await initDB();
    expect((await dbAfter.get('planesPensiones', planId))?.fechaContratacion)
      .toBe('2024-01-01');
  });

  it('6 · caso real Jose · PPE Orange 2024→2020', async () => {
    const { initDB } = await import('../../db');
    const { fixFechaContratacionRetroactiva } = await import(
      '../fixFechaContratacionRetroactiva'
    );
    const db = await initDB();
    const planId = await seedPlan(db, {
      id: 'orange-uuid',
      nombre: 'Plan PPE · ORANGE ESPAGNE SA',
      fechaContratacion: '2024-01-01',
    });
    // Aportaciones 2020-2024 (5 ejercicios).
    await seedAportacion(db, planId, '2020-12-31', 2020);
    await seedAportacion(db, planId, '2021-12-31', 2021);
    await seedAportacion(db, planId, '2022-12-31', 2022);
    await seedAportacion(db, planId, '2023-12-31', 2023);
    await seedAportacion(db, planId, '2024-12-31', 2024);

    const r = await fixFechaContratacionRetroactiva();
    expect(r.updated).toBe(1);

    const dbAfter = await initDB();
    expect((await dbAfter.get('planesPensiones', planId))?.fechaContratacion)
      .toBe('2020-12-31');
  });
});
