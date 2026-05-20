// src/services/migrations/__tests__/seedV74_PR4.test.ts
// T-VALORACIONES PR4 · cobertura del seed migración planes + inversiones.

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { mapInversionTipo } from '../seedV74_PR4';

const TEST_DB_NAME = 'AtlasHorizonDB';

// Mock localStorage para el snapshot (jsdom lo provee pero el smoke test corre
// como node sin DOM por defecto).
beforeAll(() => {
  if (typeof (globalThis as any).localStorage === 'undefined') {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    };
  }
});

describe('mapInversionTipo · mapeo TipoPosicion → schema v2', () => {
  it('accion → inversion/accion', () => {
    expect(mapInversionTipo('accion')).toEqual({ tipoActivo: 'inversion', subtipoInversion: 'accion' });
  });

  it('reit → inversion/accion (tradea como acción)', () => {
    expect(mapInversionTipo('reit')).toEqual({ tipoActivo: 'inversion', subtipoInversion: 'accion' });
  });

  it('etf → inversion/etf', () => {
    expect(mapInversionTipo('etf')).toEqual({ tipoActivo: 'inversion', subtipoInversion: 'etf' });
  });

  it('fondo_inversion → inversion/fondo', () => {
    expect(mapInversionTipo('fondo_inversion')).toEqual({
      tipoActivo: 'inversion',
      subtipoInversion: 'fondo',
    });
  });

  it('crypto → inversion/crypto', () => {
    expect(mapInversionTipo('crypto')).toEqual({ tipoActivo: 'inversion', subtipoInversion: 'crypto' });
  });

  it('cuenta_remunerada → inversion (sin subtipo)', () => {
    expect(mapInversionTipo('cuenta_remunerada')).toEqual({ tipoActivo: 'inversion' });
  });

  it('prestamo_p2p → inversion (sin subtipo)', () => {
    expect(mapInversionTipo('prestamo_p2p')).toEqual({ tipoActivo: 'inversion' });
  });

  it('deposito → deposito', () => {
    expect(mapInversionTipo('deposito')).toEqual({ tipoActivo: 'deposito' });
  });

  it('deposito_plazo → deposito', () => {
    expect(mapInversionTipo('deposito_plazo')).toEqual({ tipoActivo: 'deposito' });
  });

  it('plan_pensiones (legacy en inversiones) → plan_pensiones', () => {
    expect(mapInversionTipo('plan_pensiones')).toEqual({ tipoActivo: 'plan_pensiones' });
  });

  it('plan_empleo → plan_pensiones', () => {
    expect(mapInversionTipo('plan_empleo')).toEqual({ tipoActivo: 'plan_pensiones' });
  });

  it('otro → otro', () => {
    expect(mapInversionTipo('otro')).toEqual({ tipoActivo: 'otro' });
  });

  it('tipo desconocido → otro (fallback)', () => {
    expect(mapInversionTipo('desconocido')).toEqual({ tipoActivo: 'otro' });
  });
});

describe('runSeedV74PR4 · seed migración', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    (globalThis as any).localStorage?.clear?.();
    jest.resetModules();
  });

  // NOTA · NO cerramos la conexión DB · `initDB()` cachea `dbPromise` y un
  // close aquí dejaría la conexión cacheada inválida para el siguiente
  // `runSeedV74PR4()`. `jest.resetModules()` + `new IDBFactory()` en
  // `beforeEach` garantizan aislamiento entre tests.
  async function seedTestData(
    planes: any[],
    inversiones: any[],
    existingValoraciones: any[] = [],
  ): Promise<void> {
    const dbModule = await import('../../db');
    const db = await dbModule.initDB();
    if (planes.length > 0) {
      for (const p of planes) await (db as any).put('planesPensiones', p);
    }
    if (inversiones.length > 0) {
      for (const i of inversiones) await (db as any).put('inversiones', i);
    }
    if (existingValoraciones.length > 0) {
      for (const v of existingValoraciones) await (db as any).add('valoracionesActivos', v);
    }
  }

  it('happy path · plan + inversión válidos generan 2 valoraciones seed', async () => {
    await seedTestData(
      [
        {
          id: 'plan-uuid-1',
          nombre: 'Plan Test',
          gestoraActual: 'ING',
          valorActual: 50000,
          fechaUltimaValoracion: '2024-06-15',
          fechaCreacion: '2020-01-01',
          fechaActualizacion: '2024-06-15',
          estado: 'activo',
          titular: 'yo',
          tipoAdministrativo: 'PPI',
          personalDataId: 1,
          origen: 'manual',
        },
      ],
      [
        {
          id: 42,
          nombre: 'ETF VWCE',
          tipo: 'etf',
          entidad: 'Indexa',
          valor_actual: 15000,
          fecha_valoracion: '2024-06-20',
          activo: true,
          aportaciones: [],
          total_aportado: 12000,
          rentabilidad_euros: 3000,
          rentabilidad_porcentaje: 25,
          created_at: '2024-01-01',
          updated_at: '2024-06-20',
        },
      ],
    );

    const { runSeedV74PR4 } = await import('../seedV74_PR4');
    const report = await runSeedV74PR4();

    expect(report.skipped).toBe(false);
    expect(report.planesSeeded).toBe(1);
    expect(report.inversionesSeeded).toBe(1);
    expect(report.planesSkippedSinValor).toBe(0);
    expect(report.inversionesSkippedSinValor).toBe(0);

    const dbModule = await import('../../db');
    const db = await dbModule.initDB();
    const all = (await (db as any).getAll('valoracionesActivos')) as any[];
    expect(all).toHaveLength(2);

    const plan = all.find((v) => v.activoId === 'plan-uuid-1');
    expect(plan).toBeDefined();
    expect(plan.tipoActivo).toBe('plan_pensiones');
    expect(plan.valor).toBe(50000);
    expect(plan.fecha).toBe('2024-06-15');
    expect(plan.origen).toBe('seed_legacy_field_v74');
    expect(plan.notas).toContain('Seed desde planesPensiones.valorActual');

    const inv = all.find((v) => v.activoId === '42');
    expect(inv).toBeDefined();
    expect(inv.tipoActivo).toBe('inversion');
    expect(inv.subtipoInversion).toBe('etf');
    expect(inv.valor).toBe(15000);
    expect(inv.fecha).toBe('2024-06-20');
    db.close();
  });

  it('idempotencia · segunda invocación skipped=true', async () => {
    await seedTestData(
      [
        {
          id: 'plan-1',
          nombre: 'P',
          valorActual: 1000,
          estado: 'activo',
          titular: 'yo',
          tipoAdministrativo: 'PPI',
          personalDataId: 1,
          origen: 'manual',
          fechaCreacion: '2020-01-01',
          fechaActualizacion: '2024-01-01',
        },
      ],
      [],
    );
    const { runSeedV74PR4 } = await import('../seedV74_PR4');
    const r1 = await runSeedV74PR4();
    expect(r1.skipped).toBe(false);
    expect(r1.planesSeeded).toBe(1);

    const r2 = await runSeedV74PR4();
    expect(r2.skipped).toBe(true);
    expect(r2.planesSeeded).toBe(0);

    const dbModule = await import('../../db');
    const db = await dbModule.initDB();
    const all = (await (db as any).getAll('valoracionesActivos')) as any[];
    expect(all).toHaveLength(1); // no se duplica
    db.close();
  });

  it('plan sin valorActual válido se salta con warning', async () => {
    await seedTestData(
      [
        {
          id: 'plan-sin-valor',
          nombre: 'Plan vacío',
          // sin valorActual
          estado: 'activo',
          titular: 'yo',
          tipoAdministrativo: 'PPI',
          personalDataId: 1,
          origen: 'manual',
          fechaCreacion: '2020-01-01',
          fechaActualizacion: '2024-01-01',
        },
      ],
      [],
    );
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { runSeedV74PR4 } = await import('../seedV74_PR4');
    const report = await runSeedV74PR4();
    expect(report.planesSeeded).toBe(0);
    expect(report.planesSkippedSinValor).toBe(1);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('inversión inactiva (activo=false) se salta', async () => {
    await seedTestData(
      [],
      [
        {
          id: 1,
          nombre: 'Posición cerrada',
          tipo: 'fondo_inversion',
          entidad: 'X',
          valor_actual: 0,
          fecha_valoracion: '2024-01-01',
          activo: false, // ← cerrada
          aportaciones: [],
          total_aportado: 0,
          rentabilidad_euros: 0,
          rentabilidad_porcentaje: 0,
          created_at: '2023-01-01',
          updated_at: '2024-01-01',
        },
      ],
    );
    const { runSeedV74PR4 } = await import('../seedV74_PR4');
    const report = await runSeedV74PR4();
    expect(report.inversionesTotal).toBe(1);
    expect(report.inversionesSeeded).toBe(0);
  });

  it('plan estado=rescatado_total se salta', async () => {
    await seedTestData(
      [
        {
          id: 'plan-rescatado',
          nombre: 'Plan rescatado',
          valorActual: 100,
          estado: 'rescatado_total',
          titular: 'yo',
          tipoAdministrativo: 'PPI',
          personalDataId: 1,
          origen: 'manual',
          fechaCreacion: '2020-01-01',
          fechaActualizacion: '2024-01-01',
        },
      ],
      [],
    );
    const { runSeedV74PR4 } = await import('../seedV74_PR4');
    const report = await runSeedV74PR4();
    expect(report.planesSeeded).toBe(0);
  });

  it('respeta valoraciones manuales previas (no duplica)', async () => {
    // Plan que ya tiene una valoración manual en el store nuevo.
    const now = new Date().toISOString();
    await seedTestData(
      [
        {
          id: 'plan-pre-existente',
          nombre: 'Plan ya importado',
          valorActual: 99999, // este valor NO debería entrar
          estado: 'activo',
          titular: 'yo',
          tipoAdministrativo: 'PPI',
          personalDataId: 1,
          origen: 'manual',
          fechaCreacion: '2020-01-01',
          fechaActualizacion: '2024-01-01',
        },
      ],
      [],
      [
        {
          activoId: 'plan-pre-existente',
          tipoActivo: 'plan_pensiones',
          fecha: '2024-01-15',
          valor: 45000,
          origen: 'import_csv',
          divisaOriginal: 'EUR',
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
      ],
    );
    const { runSeedV74PR4 } = await import('../seedV74_PR4');
    const report = await runSeedV74PR4();
    expect(report.planesSkippedYaTienen).toBe(1);
    expect(report.planesSeeded).toBe(0);

    const dbModule = await import('../../db');
    const db = await dbModule.initDB();
    const all = (await (db as any).getAll('valoracionesActivos')) as any[];
    expect(all).toHaveLength(1);
    expect(all[0].valor).toBe(45000); // no se sobrescribió
    db.close();
  });

  it('inversiones con distintos `tipo` infieren subtipoInversion correctamente', async () => {
    await seedTestData(
      [],
      [
        {
          id: 1,
          nombre: 'Acción Telefónica',
          tipo: 'accion',
          entidad: 'BBVA',
          valor_actual: 2000,
          fecha_valoracion: '2024-06-01',
          activo: true,
          aportaciones: [],
          total_aportado: 1800,
          rentabilidad_euros: 200,
          rentabilidad_porcentaje: 11,
          created_at: '2024-01-01',
          updated_at: '2024-06-01',
        },
        {
          id: 2,
          nombre: 'BTC',
          tipo: 'crypto',
          entidad: 'Bit2Me',
          valor_actual: 5000,
          fecha_valoracion: '2024-06-01',
          activo: true,
          aportaciones: [],
          total_aportado: 4000,
          rentabilidad_euros: 1000,
          rentabilidad_porcentaje: 25,
          created_at: '2024-01-01',
          updated_at: '2024-06-01',
        },
        {
          id: 3,
          nombre: 'Depósito ING',
          tipo: 'deposito_plazo',
          entidad: 'ING',
          valor_actual: 10000,
          fecha_valoracion: '2024-06-01',
          activo: true,
          aportaciones: [],
          total_aportado: 10000,
          rentabilidad_euros: 0,
          rentabilidad_porcentaje: 0,
          created_at: '2024-01-01',
          updated_at: '2024-06-01',
        },
      ],
    );
    const { runSeedV74PR4 } = await import('../seedV74_PR4');
    await runSeedV74PR4();

    const dbModule = await import('../../db');
    const db = await dbModule.initDB();
    const all = (await (db as any).getAll('valoracionesActivos')) as any[];
    expect(all).toHaveLength(3);

    const accion = all.find((v) => v.activoId === '1');
    expect(accion.tipoActivo).toBe('inversion');
    expect(accion.subtipoInversion).toBe('accion');

    const crypto = all.find((v) => v.activoId === '2');
    expect(crypto.tipoActivo).toBe('inversion');
    expect(crypto.subtipoInversion).toBe('crypto');

    const depo = all.find((v) => v.activoId === '3');
    expect(depo.tipoActivo).toBe('deposito');
    expect(depo.subtipoInversion).toBeUndefined();
    db.close();
  });

  it('error durante seed · NO marca como completed · reintenta próxima vez', async () => {
    // Hacemos que bulkInsert falle borrando el store antes de invocar el seed.
    await seedTestData(
      [
        {
          id: 'plan-1',
          nombre: 'P',
          valorActual: 1000,
          estado: 'activo',
          titular: 'yo',
          tipoAdministrativo: 'PPI',
          personalDataId: 1,
          origen: 'manual',
          fechaCreacion: '2020-01-01',
          fechaActualizacion: '2024-01-01',
        },
      ],
      [],
    );
    // Forzar fallo · spy en bulkInsert para que throw
    const valoracionesModule = await import('../../valoracionesService');
    const spy = jest.spyOn(valoracionesModule, 'bulkInsert').mockRejectedValueOnce(new Error('fallo simulado'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { runSeedV74PR4 } = await import('../seedV74_PR4');
    const r1 = await runSeedV74PR4();
    expect(r1.skipped).toBe(false);
    expect(errorSpy).toHaveBeenCalled();

    spy.mockRestore();
    errorSpy.mockRestore();
    jest.resetModules();

    // Segunda corrida · debería re-intentar (no marcamos completed tras fallo)
    const { runSeedV74PR4: runSeedV74PR4Reset } = await import('../seedV74_PR4');
    const r2 = await runSeedV74PR4Reset();
    expect(r2.skipped).toBe(false);
    expect(r2.planesSeeded).toBe(1);
  });
});
