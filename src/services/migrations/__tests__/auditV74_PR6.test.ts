// src/services/migrations/__tests__/auditV74_PR6.test.ts
// T-VALORACIONES PR6 · cobertura de la auditoría de invariante.

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

describe('auditValoracionesCobertura · invariante post-seeds', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  async function setupFixture(opts: {
    properties?: any[];
    inversiones?: any[];
    planes?: any[];
    valoraciones?: any[];
  }): Promise<void> {
    const dbModule = await import('../../db');
    const db = await dbModule.initDB();
    for (const p of opts.properties ?? []) await (db as any).put('properties', p);
    for (const i of opts.inversiones ?? []) await (db as any).put('inversiones', i);
    for (const pl of opts.planes ?? []) await (db as any).put('planesPensiones', pl);
    for (const v of opts.valoraciones ?? []) await (db as any).add('valoracionesActivos', v);
  }

  const valoracion = (activoId: string, tipoActivo: string, valor: number, deletedAt: string | null = null) => ({
    activoId,
    tipoActivo,
    fecha: '2024-06-15',
    valor,
    origen: 'manual',
    divisaOriginal: 'EUR',
    createdAt: '2024-06-15T00:00:00Z',
    updatedAt: '2024-06-15T00:00:00Z',
    deletedAt,
  });

  it('cobertura 100% · todos los activos tienen valoración', async () => {
    await setupFixture({
      properties: [{ id: 1, alias: 'Piso', state: 'activo' }],
      inversiones: [
        { id: 10, nombre: 'ETF', tipo: 'etf', activo: true },
      ],
      planes: [{ id: 'plan-1', nombre: 'Plan A', estado: 'activo' }],
      valoraciones: [
        valoracion('1', 'inmueble', 200000),
        valoracion('10', 'inversion', 5000),
        valoracion('plan-1', 'plan_pensiones', 30000),
      ],
    });

    const { auditValoracionesCobertura } = await import('../auditV74_PR6');
    const r = await auditValoracionesCobertura();

    expect(r.cobertura).toBe(100);
    expect(r.ok).toBe(true);
    expect(r.sinValoracion).toHaveLength(0);
    expect(r.huerfanas).toHaveLength(0);
    expect(r.totalesPorTipo).toEqual({ inmueble: 1, inversion: 1, plan_pensiones: 1 });
    expect(r.conValoracionPorTipo).toEqual({ inmueble: 1, inversion: 1, plan_pensiones: 1 });
    expect(r.porcentajeCoberturaPorTipo).toEqual({ inmueble: 100, inversion: 100, plan_pensiones: 100 });
  });

  it('detecta activos sin valoración', async () => {
    await setupFixture({
      properties: [
        { id: 1, alias: 'Piso con valor', state: 'activo' },
        { id: 2, alias: 'Piso sin valor', state: 'activo' },
      ],
      valoraciones: [valoracion('1', 'inmueble', 200000)],
    });

    const { auditValoracionesCobertura } = await import('../auditV74_PR6');
    const r = await auditValoracionesCobertura();

    expect(r.totalesPorTipo.inmueble).toBe(2);
    expect(r.conValoracionPorTipo.inmueble).toBe(1);
    expect(r.porcentajeCoberturaPorTipo.inmueble).toBe(50);
    expect(r.sinValoracion).toHaveLength(1);
    expect(r.sinValoracion[0]).toEqual({
      activoId: '2',
      tipoActivo: 'inmueble',
      nombre: 'Piso sin valor',
    });
    expect(r.ok).toBe(false);
  });

  it('inmuebles vendidos no se cuentan en la cobertura', async () => {
    await setupFixture({
      properties: [
        { id: 1, alias: 'Piso activo', state: 'activo' },
        { id: 2, alias: 'Piso vendido', state: 'vendido' },
      ],
      valoraciones: [valoracion('1', 'inmueble', 200000)],
    });
    const { auditValoracionesCobertura } = await import('../auditV74_PR6');
    const r = await auditValoracionesCobertura();
    expect(r.totalesPorTipo.inmueble).toBe(1);
    expect(r.cobertura).toBe(100);
    expect(r.ok).toBe(true);
  });

  it('inversiones cerradas (activo=false) no se cuentan', async () => {
    await setupFixture({
      inversiones: [
        { id: 1, nombre: 'Activa', tipo: 'fondo_inversion', activo: true },
        { id: 2, nombre: 'Cerrada', tipo: 'fondo_inversion', activo: false },
      ],
      valoraciones: [valoracion('1', 'inversion', 1000)],
    });
    const { auditValoracionesCobertura } = await import('../auditV74_PR6');
    const r = await auditValoracionesCobertura();
    expect(r.totalesPorTipo.inversion).toBe(1);
    expect(r.cobertura).toBe(100);
  });

  it('planes rescatados no se cuentan', async () => {
    await setupFixture({
      planes: [
        { id: 'plan-activo', nombre: 'Activo', estado: 'activo' },
        { id: 'plan-rescatado', nombre: 'Rescatado', estado: 'rescatado_total' },
      ],
      valoraciones: [valoracion('plan-activo', 'plan_pensiones', 30000)],
    });
    const { auditValoracionesCobertura } = await import('../auditV74_PR6');
    const r = await auditValoracionesCobertura();
    expect(r.totalesPorTipo.plan_pensiones).toBe(1);
    expect(r.cobertura).toBe(100);
  });

  it('inversion legacy con tipo=plan_pensiones se contabiliza como plan_pensiones', async () => {
    await setupFixture({
      inversiones: [
        { id: 99, nombre: 'Plan legacy', tipo: 'plan_pensiones', activo: true },
      ],
      valoraciones: [valoracion('99', 'plan_pensiones', 30000)],
    });
    const { auditValoracionesCobertura } = await import('../auditV74_PR6');
    const r = await auditValoracionesCobertura();
    expect(r.totalesPorTipo.plan_pensiones).toBe(1);
    expect(r.totalesPorTipo.inversion).toBe(0);
    expect(r.cobertura).toBe(100);
  });

  it('valoraciones soft-deleted NO cuentan como cobertura', async () => {
    await setupFixture({
      properties: [{ id: 1, alias: 'Piso', state: 'activo' }],
      valoraciones: [valoracion('1', 'inmueble', 200000, '2024-12-01T00:00:00Z')],
    });
    const { auditValoracionesCobertura } = await import('../auditV74_PR6');
    const r = await auditValoracionesCobertura();
    expect(r.conValoracionPorTipo.inmueble).toBe(0);
    expect(r.sinValoracion).toHaveLength(1);
    expect(r.ok).toBe(false);
  });

  it('detecta valoraciones huérfanas · activoId no existe en store fuente', async () => {
    await setupFixture({
      properties: [{ id: 1, alias: 'Piso', state: 'activo' }],
      valoraciones: [
        valoracion('1', 'inmueble', 200000),
        valoracion('999', 'inmueble', 100000), // huérfana
      ],
    });
    const { auditValoracionesCobertura } = await import('../auditV74_PR6');
    const r = await auditValoracionesCobertura();
    expect(r.huerfanas).toHaveLength(1);
    expect(r.huerfanas[0].activoId).toBe('999');
    expect(r.huerfanas[0].tipoActivo).toBe('inmueble');
    expect(r.ok).toBe(false);
  });

  it('tipos deposito/otro NO cuentan en cobertura ni generan huérfanas', async () => {
    await setupFixture({
      valoraciones: [
        valoracion('d-1', 'deposito', 10000),
        valoracion('o-1', 'otro', 5000),
      ],
    });
    const { auditValoracionesCobertura } = await import('../auditV74_PR6');
    const r = await auditValoracionesCobertura();
    expect(r.totalesPorTipo).toEqual({ inmueble: 0, inversion: 0, plan_pensiones: 0 });
    expect(r.huerfanas).toHaveLength(0);
    expect(r.cobertura).toBe(100);
    expect(r.ok).toBe(true);
  });

  it('inversiones legacy con tipo deposito/deposito_plazo/otro NO entran en cobertura (review Copilot)', async () => {
    await setupFixture({
      inversiones: [
        { id: 1, nombre: 'Depo ING', tipo: 'deposito', activo: true },
        { id: 2, nombre: 'Depo Sant', tipo: 'deposito_plazo', activo: true },
        { id: 3, nombre: 'Otro xyz', tipo: 'otro', activo: true },
        { id: 4, nombre: 'Fondo', tipo: 'fondo_inversion', activo: true },
      ],
      valoraciones: [valoracion('4', 'inversion', 5000)],
    });
    const { auditValoracionesCobertura } = await import('../auditV74_PR6');
    const r = await auditValoracionesCobertura();
    // Solo el fondo cuenta como `inversion` · deposito/otro no entran.
    expect(r.totalesPorTipo).toEqual({ inmueble: 0, inversion: 1, plan_pensiones: 0 });
    expect(r.conValoracionPorTipo.inversion).toBe(1);
    expect(r.cobertura).toBe(100);
    expect(r.sinValoracion).toHaveLength(0);
    expect(r.ok).toBe(true);
  });

  it('valoración de inmueble vendido NO se marca como huérfana (review Copilot)', async () => {
    // Inmueble existe pero está vendido · su valoración histórica sigue
    // siendo legítima · NO debe ser huérfana ni contar en cobertura.
    await setupFixture({
      properties: [
        { id: 1, alias: 'Vendido', state: 'vendido' },
        { id: 2, alias: 'Activo', state: 'activo' },
      ],
      valoraciones: [
        valoracion('1', 'inmueble', 200000), // del vendido · legítima
        valoracion('2', 'inmueble', 250000),
      ],
    });
    const { auditValoracionesCobertura } = await import('../auditV74_PR6');
    const r = await auditValoracionesCobertura();
    expect(r.huerfanas).toHaveLength(0); // ninguna huérfana
    expect(r.totalesPorTipo.inmueble).toBe(1); // solo el activo
    expect(r.cobertura).toBe(100);
    expect(r.ok).toBe(true);
  });

  it('valoración de plan rescatado NO se marca como huérfana', async () => {
    await setupFixture({
      planes: [{ id: 'plan-r', nombre: 'Rescatado', estado: 'rescatado_total' }],
      valoraciones: [valoracion('plan-r', 'plan_pensiones', 30000)],
    });
    const { auditValoracionesCobertura } = await import('../auditV74_PR6');
    const r = await auditValoracionesCobertura();
    expect(r.huerfanas).toHaveLength(0);
    expect(r.totalesPorTipo.plan_pensiones).toBe(0); // rescatado no cuenta
  });

  it('valoración de inversión cerrada NO se marca como huérfana', async () => {
    await setupFixture({
      inversiones: [{ id: 1, nombre: 'Cerrada', tipo: 'fondo_inversion', activo: false }],
      valoraciones: [valoracion('1', 'inversion', 5000)],
    });
    const { auditValoracionesCobertura } = await import('../auditV74_PR6');
    const r = await auditValoracionesCobertura();
    expect(r.huerfanas).toHaveLength(0);
    expect(r.totalesPorTipo.inversion).toBe(0); // cerrada no cuenta
  });

  it('DB vacía · cobertura 100% (vacuously true)', async () => {
    const { auditValoracionesCobertura } = await import('../auditV74_PR6');
    const r = await auditValoracionesCobertura();
    expect(r.cobertura).toBe(100);
    expect(r.ok).toBe(true);
    expect(r.sinValoracion).toHaveLength(0);
    expect(r.huerfanas).toHaveLength(0);
  });

  it('cobertura mixta · cuenta cada tipo independientemente', async () => {
    await setupFixture({
      properties: [
        { id: 1, alias: 'P1', state: 'activo' },
        { id: 2, alias: 'P2', state: 'activo' },
      ],
      inversiones: [
        { id: 10, nombre: 'I1', tipo: 'fondo_inversion', activo: true },
        { id: 11, nombre: 'I2', tipo: 'etf', activo: true },
        { id: 12, nombre: 'I3', tipo: 'crypto', activo: true },
      ],
      planes: [{ id: 'plan-1', nombre: 'P', estado: 'activo' }],
      valoraciones: [
        valoracion('1', 'inmueble', 200000),
        valoracion('10', 'inversion', 5000),
        valoracion('plan-1', 'plan_pensiones', 30000),
      ],
    });
    const { auditValoracionesCobertura } = await import('../auditV74_PR6');
    const r = await auditValoracionesCobertura();
    expect(r.porcentajeCoberturaPorTipo.inmueble).toBe(50); // 1/2
    expect(r.porcentajeCoberturaPorTipo.inversion).toBe(33); // 1/3
    expect(r.porcentajeCoberturaPorTipo.plan_pensiones).toBe(100);
    expect(r.cobertura).toBe(50); // 3/6
    expect(r.sinValoracion).toHaveLength(3);
  });
});

describe('runAuditV74PR6 · side-effect logging', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  async function setupFixture(opts: any) {
    const dbModule = await import('../../db');
    const db = await dbModule.initDB();
    for (const p of opts.properties ?? []) await (db as any).put('properties', p);
    for (const v of opts.valoraciones ?? []) await (db as any).add('valoracionesActivos', v);
  }

  const valoracion = (activoId: string, tipoActivo: string, valor: number) => ({
    activoId,
    tipoActivo,
    fecha: '2024-06-15',
    valor,
    origen: 'manual',
    divisaOriginal: 'EUR',
    createdAt: '2024-06-15T00:00:00Z',
    updatedAt: '2024-06-15T00:00:00Z',
    deletedAt: null,
  });

  it('OK · log con cobertura 100%', async () => {
    await setupFixture({
      properties: [{ id: 1, alias: 'P', state: 'activo' }],
      valoraciones: [valoracion('1', 'inmueble', 200000)],
    });
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const { runAuditV74PR6 } = await import('../auditV74_PR6');
    const r = await runAuditV74PR6();
    expect(r.ok).toBe(true);
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('Cobertura 100%'));
    infoSpy.mockRestore();
  });

  it('Sin valoración · log warning', async () => {
    await setupFixture({
      properties: [{ id: 1, alias: 'Sin val', state: 'activo' }],
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { runAuditV74PR6 } = await import('../auditV74_PR6');
    const r = await runAuditV74PR6();
    expect(r.ok).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('1 activo(s) sin valoración'),
      expect.any(Array),
    );
    warnSpy.mockRestore();
  });

  it('Huérfana · log error', async () => {
    await setupFixture({
      properties: [{ id: 1, alias: 'P', state: 'activo' }],
      valoraciones: [valoracion('1', 'inmueble', 200000), valoracion('999', 'inmueble', 100000)],
    });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { runAuditV74PR6 } = await import('../auditV74_PR6');
    const r = await runAuditV74PR6();
    expect(r.huerfanas).toHaveLength(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('huérfana(s)'),
      expect.any(Array),
    );
    errorSpy.mockRestore();
  });
});
