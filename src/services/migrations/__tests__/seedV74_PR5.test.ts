// src/services/migrations/__tests__/seedV74_PR5.test.ts
// T-VALORACIONES PR5 · cobertura del seed migración inmuebles.

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { extractValorInmueble } from '../seedV74_PR5';

// Mock localStorage si no existe
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

describe('extractValorInmueble · jerarquía de campos', () => {
  it('valor_actual gana sobre todos los demás', () => {
    const p = {
      valor_actual: 250000,
      valorActual: 999,
      currentValue: 888,
      marketValue: 777,
      tasacion: 666,
    };
    const r = extractValorInmueble(p);
    expect(r.valor).toBe(250000);
    expect(r.fuente).toBe('valor_actual');
    expect(r.esAnchorFiscal).toBe(false);
  });

  it('valorActual cuando no hay valor_actual', () => {
    const r = extractValorInmueble({ valorActual: 240000 });
    expect(r.valor).toBe(240000);
    expect(r.fuente).toBe('valorActual');
    expect(r.esAnchorFiscal).toBe(false);
  });

  it('currentValue cuando no hay snake_case', () => {
    const r = extractValorInmueble({ currentValue: 230000 });
    expect(r.valor).toBe(230000);
    expect(r.fuente).toBe('currentValue');
  });

  it('marketValue alias', () => {
    const r = extractValorInmueble({ marketValue: 220000 });
    expect(r.fuente).toBe('marketValue');
  });

  it('estimatedValue alias', () => {
    const r = extractValorInmueble({ estimatedValue: 210000 });
    expect(r.fuente).toBe('estimatedValue');
  });

  it('valuation alias', () => {
    const r = extractValorInmueble({ valuation: 200000 });
    expect(r.fuente).toBe('valuation');
  });

  it('compra.valor_actual anidado', () => {
    const r = extractValorInmueble({ compra: { valor_actual: 190000 } });
    expect(r.valor).toBe(190000);
    expect(r.fuente).toBe('compra.valor_actual');
  });

  it('acquisitionCosts.currentValue anidado', () => {
    const r = extractValorInmueble({ acquisitionCosts: { currentValue: 180000 } });
    expect(r.fuente).toBe('acquisitionCosts.currentValue');
  });

  it('tasacion · esAnchorFiscal=true', () => {
    const r = extractValorInmueble({ tasacion: 270000 });
    expect(r.valor).toBe(270000);
    expect(r.fuente).toBe('tasacion (pericial)');
    expect(r.esAnchorFiscal).toBe(true);
  });

  it('tasacion ignorada si hay valor_actual de mercado', () => {
    const r = extractValorInmueble({ valor_actual: 250000, tasacion: 270000 });
    expect(r.fuente).toBe('valor_actual');
    expect(r.esAnchorFiscal).toBe(false);
  });

  it('acquisitionCosts.price como fallback con nota "revisar"', () => {
    const r = extractValorInmueble({ acquisitionCosts: { price: 150000 } });
    expect(r.valor).toBe(150000);
    expect(r.fuente).toContain('acquisitionCosts.price');
    expect(r.fuente).toContain('revisar');
    expect(r.esAnchorFiscal).toBe(false);
  });

  it('compra.precio_compra fallback final', () => {
    const r = extractValorInmueble({ compra: { precio_compra: 140000 } });
    expect(r.fuente).toContain('compra.precio_compra');
    expect(r.fuente).toContain('revisar');
  });

  it('sin ningún campo válido devuelve valor=null', () => {
    const r = extractValorInmueble({});
    expect(r.valor).toBeNull();
    expect(r.fuente).toBe('sin valor detectado');
  });

  it('valores 0 o negativos NO se aceptan (legacy 0 = sin dato · igual que PR4)', () => {
    expect(extractValorInmueble({ valor_actual: 0 }).valor).toBeNull();
    expect(extractValorInmueble({ valor_actual: -1000 }).valor).toBeNull();
    expect(extractValorInmueble({ tasacion: 0 }).valor).toBeNull();
  });

  it('valor NaN o Infinity NO se aceptan', () => {
    expect(extractValorInmueble({ valor_actual: NaN }).valor).toBeNull();
    expect(extractValorInmueble({ valor_actual: Infinity }).valor).toBeNull();
  });

  it('cuando valor_actual es inválido, cae al siguiente', () => {
    const r = extractValorInmueble({ valor_actual: 0, currentValue: 200000 });
    expect(r.valor).toBe(200000);
    expect(r.fuente).toBe('currentValue');
  });
});

describe('runSeedV74PR5 · seed migración inmuebles', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    (globalThis as any).localStorage?.clear?.();
    jest.resetModules();
  });

  async function seedTestData(
    inmuebles: any[],
    existingValoraciones: any[] = [],
  ): Promise<void> {
    const dbModule = await import('../../db');
    const db = await dbModule.initDB();
    for (const p of inmuebles) await (db as any).put('properties', p);
    for (const v of existingValoraciones) await (db as any).add('valoracionesActivos', v);
  }

  it('happy path · 2 inmuebles activos generan 2 valoraciones', async () => {
    await seedTestData([
      {
        id: 1,
        alias: 'Piso Madrid',
        state: 'activo',
        valor_actual: 250000,
        updated_at: '2024-06-15T10:00:00Z',
      },
      {
        id: 2,
        alias: 'Garaje Sevilla',
        state: 'activo',
        valor_actual: 18000,
        updated_at: '2024-05-20T10:00:00Z',
      },
    ]);

    const { runSeedV74PR5 } = await import('../seedV74_PR5');
    const r = await runSeedV74PR5();
    expect(r.skipped).toBe(false);
    expect(r.inmueblesTotal).toBe(2);
    expect(r.inmueblesActivos).toBe(2);
    expect(r.inmueblesSeeded).toBe(2);
    expect(r.inmueblesSeededComoAnchorFiscal).toBe(0);

    const dbModule = await import('../../db');
    const db = await dbModule.initDB();
    const all = (await (db as any).getAll('valoracionesActivos')) as any[];
    expect(all).toHaveLength(2);

    const piso = all.find((v) => v.activoId === '1');
    expect(piso.tipoActivo).toBe('inmueble');
    expect(piso.valor).toBe(250000);
    expect(piso.fecha).toBe('2024-06-15');
    expect(piso.origen).toBe('seed_legacy_field_v74');
    expect(piso.esAnchorFiscal).toBe(false);
    expect(piso.notas).toContain('Piso Madrid');
    expect(piso.notas).toContain('valor_actual');
  });

  it('inmueble vendido (state !== activo) se salta', async () => {
    await seedTestData([
      {
        id: 1,
        alias: 'Vendido',
        state: 'vendido',
        valor_actual: 200000,
      },
    ]);
    const { runSeedV74PR5 } = await import('../seedV74_PR5');
    const r = await runSeedV74PR5();
    expect(r.inmueblesSkippedNoActivos).toBe(1);
    expect(r.inmueblesSeeded).toBe(0);
    expect(r.inmueblesActivos).toBe(0);
  });

  it('inmueble con solo tasacion · esAnchorFiscal=true', async () => {
    await seedTestData([
      {
        id: 7,
        alias: 'Inmueble pericial',
        state: 'activo',
        tasacion: 280000,
      },
    ]);
    const { runSeedV74PR5 } = await import('../seedV74_PR5');
    const r = await runSeedV74PR5();
    expect(r.inmueblesSeeded).toBe(1);
    expect(r.inmueblesSeededComoAnchorFiscal).toBe(1);

    const dbModule = await import('../../db');
    const db = await dbModule.initDB();
    const all = (await (db as any).getAll('valoracionesActivos')) as any[];
    expect(all[0].esAnchorFiscal).toBe(true);
    expect(all[0].valor).toBe(280000);
    expect(all[0].notas).toContain('pericial');
  });

  it('inmueble con solo precio_compra · fallback con nota "revisar"', async () => {
    await seedTestData([
      {
        id: 9,
        alias: 'Solo compra',
        state: 'activo',
        compra: { precio_compra: 165000 },
      },
    ]);
    const { runSeedV74PR5 } = await import('../seedV74_PR5');
    const r = await runSeedV74PR5();
    expect(r.inmueblesSeeded).toBe(1);

    const dbModule = await import('../../db');
    const db = await dbModule.initDB();
    const all = (await (db as any).getAll('valoracionesActivos')) as any[];
    expect(all[0].valor).toBe(165000);
    expect(all[0].esAnchorFiscal).toBe(false);
    expect(all[0].notas).toContain('precio_compra');
    expect(all[0].notas).toContain('revisar');
  });

  it('inmueble sin ningún campo válido se salta + warning', async () => {
    await seedTestData([
      {
        id: 5,
        alias: 'Vacío',
        state: 'activo',
      },
    ]);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { runSeedV74PR5 } = await import('../seedV74_PR5');
    const r = await runSeedV74PR5();
    expect(r.inmueblesSeeded).toBe(0);
    expect(r.inmueblesSkippedSinValor).toBe(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('sin valor detectado'));
    warnSpy.mockRestore();
  });

  it('idempotencia · 2ª invocación skipped=true', async () => {
    await seedTestData([
      { id: 1, alias: 'Piso', state: 'activo', valor_actual: 200000 },
    ]);
    const { runSeedV74PR5 } = await import('../seedV74_PR5');
    const r1 = await runSeedV74PR5();
    expect(r1.skipped).toBe(false);
    expect(r1.inmueblesSeeded).toBe(1);

    const r2 = await runSeedV74PR5();
    expect(r2.skipped).toBe(true);
    expect(r2.inmueblesSeeded).toBe(0);

    const dbModule = await import('../../db');
    const db = await dbModule.initDB();
    const all = (await (db as any).getAll('valoracionesActivos')) as any[];
    expect(all).toHaveLength(1);
  });

  it('respeta valoraciones manuales previas (no duplica)', async () => {
    const now = new Date().toISOString();
    await seedTestData(
      [{ id: 7, alias: 'Piso ya importado', state: 'activo', valor_actual: 999999 }],
      [
        {
          activoId: '7',
          tipoActivo: 'inmueble',
          fecha: '2024-01-15',
          valor: 245000,
          origen: 'import_csv',
          divisaOriginal: 'EUR',
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
      ],
    );
    const { runSeedV74PR5 } = await import('../seedV74_PR5');
    const r = await runSeedV74PR5();
    expect(r.inmueblesSkippedYaTienen).toBe(1);
    expect(r.inmueblesSeeded).toBe(0);

    const dbModule = await import('../../db');
    const db = await dbModule.initDB();
    const all = (await (db as any).getAll('valoracionesActivos')) as any[];
    expect(all).toHaveLength(1);
    expect(all[0].valor).toBe(245000); // no se sobrescribió
  });

  it('fecha · usa updated_at del inmueble si está, si no today', async () => {
    await seedTestData([
      {
        id: 1,
        alias: 'Con updated_at',
        state: 'activo',
        valor_actual: 200000,
        updated_at: '2023-12-01T15:30:00Z',
      },
      {
        id: 2,
        alias: 'Sin fechas',
        state: 'activo',
        valor_actual: 200000,
      },
    ]);
    const { runSeedV74PR5 } = await import('../seedV74_PR5');
    await runSeedV74PR5();

    const dbModule = await import('../../db');
    const db = await dbModule.initDB();
    const all = (await (db as any).getAll('valoracionesActivos')) as any[];
    const conFecha = all.find((v) => v.activoId === '1');
    expect(conFecha.fecha).toBe('2023-12-01');
    const sinFechas = all.find((v) => v.activoId === '2');
    // today
    expect(sinFechas.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('error durante seed · NO marca completed · reintenta', async () => {
    await seedTestData([
      { id: 1, alias: 'Piso', state: 'activo', valor_actual: 200000 },
    ]);
    const valoracionesModule = await import('../../valoracionesService');
    const spy = jest.spyOn(valoracionesModule, 'bulkInsert').mockRejectedValueOnce(new Error('fallo simulado'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { runSeedV74PR5 } = await import('../seedV74_PR5');
    const r1 = await runSeedV74PR5();
    expect(r1.skipped).toBe(false);
    expect(errorSpy).toHaveBeenCalled();

    spy.mockRestore();
    errorSpy.mockRestore();
    jest.resetModules();

    const { runSeedV74PR5: runSeedReset } = await import('../seedV74_PR5');
    const r2 = await runSeedReset();
    expect(r2.skipped).toBe(false);
    expect(r2.inmueblesSeeded).toBe(1);
  });
});
