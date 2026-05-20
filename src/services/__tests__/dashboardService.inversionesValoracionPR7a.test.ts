// src/services/__tests__/dashboardService.inversionesValoracionPR7a.test.ts
// T-VALORACIONES PR7a · verifica que `getPatrimonioNeto` del dashboard
// prefiere valor del servicio nuevo `valoracionesActivos` sobre el
// campo legacy `inv.valor_actual` para inversiones, alineado con el
// comportamiento que ya tenía para inmuebles.

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

describe('dashboardService · inversiones leen valoracionesActivos con fallback legacy (PR7a)', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  async function seedFixture(opts: {
    inversiones?: any[];
    valoraciones?: any[];
    properties?: any[];
    accounts?: any[];
  }): Promise<void> {
    const dbModule = await import('../db');
    const db = await dbModule.initDB();
    for (const i of opts.inversiones ?? []) await (db as any).put('inversiones', i);
    for (const v of opts.valoraciones ?? []) await (db as any).add('valoracionesActivos', v);
    for (const p of opts.properties ?? []) await (db as any).put('properties', p);
    for (const a of opts.accounts ?? []) await (db as any).put('accounts', a);
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

  it('inversion con valoración en el servicio · gana sobre valor_actual legacy', async () => {
    await seedFixture({
      inversiones: [
        {
          id: 1,
          nombre: 'ETF Test',
          tipo: 'etf',
          entidad: 'Indexa',
          valor_actual: 5000, // legacy · stale
          activo: true,
          aportaciones: [],
          total_aportado: 4000,
          rentabilidad_euros: 1000,
          rentabilidad_porcentaje: 25,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ],
      valoraciones: [valoracion('1', 'inversion', 12000)], // valor real más reciente
    });

    const { dashboardService } = await import('../dashboardService');
    const patrimonio = await dashboardService.getPatrimonioNeto();
    expect(patrimonio.desglose.inversiones).toBe(12000);
  });

  it('inversion sin valoración en el servicio · cae al valor_actual legacy', async () => {
    await seedFixture({
      inversiones: [
        {
          id: 2,
          nombre: 'Fondo legacy',
          tipo: 'fondo_inversion',
          entidad: 'BBVA',
          valor_actual: 3500,
          activo: true,
          aportaciones: [],
          total_aportado: 3000,
          rentabilidad_euros: 500,
          rentabilidad_porcentaje: 16.67,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ],
      valoraciones: [], // sin valoraciones · fallback
    });
    const { dashboardService } = await import('../dashboardService');
    const patrimonio = await dashboardService.getPatrimonioNeto();
    expect(patrimonio.desglose.inversiones).toBe(3500);
  });

  it('inversion legacy con tipo plan_pensiones busca en mapa de planes', async () => {
    await seedFixture({
      inversiones: [
        {
          id: 99,
          nombre: 'Plan legacy en store inversiones',
          tipo: 'plan_pensiones',
          entidad: 'X',
          valor_actual: 8000, // legacy
          activo: true,
          aportaciones: [],
          total_aportado: 7000,
          rentabilidad_euros: 1000,
          rentabilidad_porcentaje: 14.29,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ],
      valoraciones: [valoracion('99', 'plan_pensiones', 25000)], // gana
    });
    const { dashboardService } = await import('../dashboardService');
    const patrimonio = await dashboardService.getPatrimonioNeto();
    expect(patrimonio.desglose.inversiones).toBe(25000);
  });

  it('inversion cerrada (activo=false) no cuenta', async () => {
    await seedFixture({
      inversiones: [
        {
          id: 5,
          nombre: 'Cerrada',
          tipo: 'fondo_inversion',
          entidad: 'X',
          valor_actual: 99999,
          activo: false,
          aportaciones: [],
          total_aportado: 0,
          rentabilidad_euros: 0,
          rentabilidad_porcentaje: 0,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ],
      valoraciones: [valoracion('5', 'inversion', 88888)],
    });
    const { dashboardService } = await import('../dashboardService');
    const patrimonio = await dashboardService.getPatrimonioNeto();
    expect(patrimonio.desglose.inversiones).toBe(0);
  });

  it('múltiples inversiones · suma usando mejor fuente por activo', async () => {
    await seedFixture({
      inversiones: [
        {
          id: 1,
          nombre: 'ETF actualizado',
          tipo: 'etf',
          entidad: 'X',
          valor_actual: 5000,
          activo: true,
          aportaciones: [],
          total_aportado: 4000,
          rentabilidad_euros: 1000,
          rentabilidad_porcentaje: 25,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        {
          id: 2,
          nombre: 'Fondo solo legacy',
          tipo: 'fondo_inversion',
          entidad: 'X',
          valor_actual: 3000,
          activo: true,
          aportaciones: [],
          total_aportado: 2500,
          rentabilidad_euros: 500,
          rentabilidad_porcentaje: 20,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ],
      valoraciones: [valoracion('1', 'inversion', 12000)], // 1 tiene · 2 no
    });
    const { dashboardService } = await import('../dashboardService');
    const patrimonio = await dashboardService.getPatrimonioNeto();
    // 12000 (1 servicio) + 3000 (2 legacy fallback) = 15000
    expect(patrimonio.desglose.inversiones).toBe(15000);
  });
});
