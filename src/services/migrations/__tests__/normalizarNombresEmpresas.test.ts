/**
 * Tests · normalizarNombresEmpresas (T-INVERSIONES-V5 §7.7).
 *
 * Casos cubiertos ·
 *   1. Reescribe `empresaPagadora.nombre` cuando CIF está en la tabla canónica.
 *   2. NO toca planes cuyo CIF no está en la tabla.
 *   3. NO toca planes con nombre ya canónico (idempotente intra-corrida).
 *   4. NO toca planes sin empresaPagadora.
 *   5. Skip-on-flag · 2ª ejecución no toca nada.
 */

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

describe('normalizarNombresEmpresas', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  async function seedPlan(
    db: any,
    overrides: Partial<{
      id: string;
      cif: string | undefined;
      nombre: string | undefined;
    }> = {},
  ): Promise<void> {
    const plan: any = {
      id: overrides.id ?? 'plan-1',
      personalDataId: 1,
      nombre: 'Plan test',
      tipoAdministrativo: 'PPE',
      gestoraActual: 'ING',
      fechaContratacion: '2020-01-01',
      titular: 'yo',
      estado: 'activo',
      origen: 'manual',
      fechaCreacion: '2020-01-01T00:00:00Z',
      fechaActualizacion: '2020-01-01T00:00:00Z',
    };
    if (overrides.cif !== undefined || overrides.nombre !== undefined) {
      plan.empresaPagadora = {
        cif: overrides.cif ?? 'A82009812',
        nombre: overrides.nombre ?? 'ORANGE ESPAGNE SA',
      };
    }
    await db.put('planesPensiones', plan);
  }

  it('1 · reescribe nombre cuando CIF en tabla · flag escrito', async () => {
    const { initDB } = await import('../../db');
    const {
      normalizarNombresEmpresas,
      NORMALIZAR_NOMBRES_EMPRESAS_FLAG_KEY,
    } = await import('../normalizarNombresEmpresas');
    const db = await initDB();

    await seedPlan(db, { id: 'p-orange', cif: 'A82009812', nombre: 'ORANGE ESPAGNE SA' });
    await seedPlan(db, { id: 'p-orange-lower', cif: 'a82009812', nombre: 'orange espagne' });

    const r = await normalizarNombresEmpresas();
    expect(r.skipped).toBe(false);
    expect(r.updated).toBe(2);
    expect(r.errors).toEqual([]);

    const dbAfter = await initDB();
    const p1 = await dbAfter.get('planesPensiones', 'p-orange');
    expect(p1?.empresaPagadora?.nombre).toBe('Orange España S.A.U.');
    // CIF normalizado a uppercase
    expect(p1?.empresaPagadora?.cif).toBe('A82009812');

    const p2 = await dbAfter.get('planesPensiones', 'p-orange-lower');
    expect(p2?.empresaPagadora?.nombre).toBe('Orange España S.A.U.');
    expect(p2?.empresaPagadora?.cif).toBe('A82009812');

    const flag = await dbAfter.get('keyval', NORMALIZAR_NOMBRES_EMPRESAS_FLAG_KEY);
    expect(flag).toBe('completed');
  });

  it('2 · NO toca planes cuyo CIF no está en la tabla', async () => {
    const { initDB } = await import('../../db');
    const { normalizarNombresEmpresas } = await import('../normalizarNombresEmpresas');
    const db = await initDB();

    await seedPlan(db, { id: 'p-otro', cif: 'B12345678', nombre: 'OTRA EMPRESA SA' });

    const r = await normalizarNombresEmpresas();
    expect(r.updated).toBe(0);

    const dbAfter = await initDB();
    const p = await dbAfter.get('planesPensiones', 'p-otro');
    expect(p?.empresaPagadora?.nombre).toBe('OTRA EMPRESA SA');
  });

  it('3 · NO toca planes con nombre ya canónico', async () => {
    const { initDB } = await import('../../db');
    const { normalizarNombresEmpresas } = await import('../normalizarNombresEmpresas');
    const db = await initDB();

    await seedPlan(db, { id: 'p-ok', cif: 'A82009812', nombre: 'Orange España S.A.U.' });

    const r = await normalizarNombresEmpresas();
    expect(r.updated).toBe(0);
  });

  it('4 · NO toca planes sin empresaPagadora', async () => {
    const { initDB } = await import('../../db');
    const { normalizarNombresEmpresas } = await import('../normalizarNombresEmpresas');
    const db = await initDB();

    await seedPlan(db, { id: 'p-individual' });

    const r = await normalizarNombresEmpresas();
    expect(r.updated).toBe(0);
  });

  it('5 · skip-on-flag · 2ª ejecución no toca nada', async () => {
    const { initDB } = await import('../../db');
    const {
      normalizarNombresEmpresas,
      NORMALIZAR_NOMBRES_EMPRESAS_FLAG_KEY,
    } = await import('../normalizarNombresEmpresas');
    const db = await initDB();
    await db.put('keyval', 'completed', NORMALIZAR_NOMBRES_EMPRESAS_FLAG_KEY);
    await seedPlan(db, { id: 'p-1', cif: 'A82009812', nombre: 'ORANGE ESPAGNE SA' });

    const r = await normalizarNombresEmpresas();
    expect(r.skipped).toBe(true);
    expect(r.updated).toBe(0);

    const dbAfter = await initDB();
    const p = await dbAfter.get('planesPensiones', 'p-1');
    expect(p?.empresaPagadora?.nombre).toBe('ORANGE ESPAGNE SA');
  });
});
