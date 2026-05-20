// src/services/__tests__/planesPensionesService.hydrateValorActualPR7a.test.ts
// T-VALORACIONES PR7a''''' · verifica que `planesPensionesService` hidrata
// `valorActual` con la última valoración del servicio nuevo
// (`valoracionesActivos`) en `getPlan`, `getAllPlanes` y
// `getPlanesPorTipo`. Patrón upstream hydration.

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

describe('planesPensionesService · hydrateValorActual via valoracionesActivos (PR7a\'\'\'\'\')', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  async function seedFixture(opts: { planes?: any[]; valoraciones?: any[] }) {
    const dbModule = await import('../db');
    const db = await dbModule.initDB();
    for (const p of opts.planes ?? []) await (db as any).put('planesPensiones', p);
    for (const v of opts.valoraciones ?? []) await (db as any).add('valoracionesActivos', v);
  }

  const valoracion = (activoId: string, valor: number, deletedAt: string | null = null) => ({
    activoId,
    tipoActivo: 'plan_pensiones',
    fecha: '2024-12-01',
    valor,
    origen: 'manual',
    divisaOriginal: 'EUR',
    createdAt: '2024-12-01T00:00:00Z',
    updatedAt: '2024-12-01T00:00:00Z',
    deletedAt,
  });

  const plan = (id: string, valorActual: number) => ({
    id,
    nombre: `Plan ${id}`,
    titular: 'yo',
    personalDataId: 1,
    tipoAdministrativo: 'PPI',
    gestoraActual: 'X',
    fechaContratacion: '2020-01-15',
    valorActual,
    fechaUltimaValoracion: '2024-01-01',
    estado: 'activo',
    origen: 'manual',
    fechaCreacion: '2020-01-15T00:00:00Z',
    fechaActualizacion: '2024-01-01T00:00:00Z',
  });

  it('getPlan · valoración en servicio sobreescribe valorActual legacy', async () => {
    await seedFixture({
      planes: [plan('plan-1', 30_000)],
      valoraciones: [valoracion('plan-1', 45_000)],
    });
    const { planesPensionesService } = await import('../planesPensionesService');
    const p = await planesPensionesService.getPlan('plan-1');
    expect(p?.valorActual).toBe(45_000);
  });

  it('getPlan · sin valoración en servicio mantiene legacy', async () => {
    await seedFixture({
      planes: [plan('plan-2', 28_000)],
      valoraciones: [],
    });
    const { planesPensionesService } = await import('../planesPensionesService');
    const p = await planesPensionesService.getPlan('plan-2');
    expect(p?.valorActual).toBe(28_000);
  });

  it('getPlan · id no existe devuelve undefined', async () => {
    await seedFixture({});
    const { planesPensionesService } = await import('../planesPensionesService');
    const p = await planesPensionesService.getPlan('no-existe');
    expect(p).toBeUndefined();
  });

  it('getAllPlanes · cada plan hidratado independientemente', async () => {
    await seedFixture({
      planes: [plan('p1', 30_000), plan('p2', 20_000), plan('p3', 50_000)],
      valoraciones: [
        valoracion('p1', 45_000),
        // p2 sin valoración en servicio
        valoracion('p3', 55_000),
      ],
    });
    const { planesPensionesService } = await import('../planesPensionesService');
    const planes = await planesPensionesService.getAllPlanes();
    expect(planes).toHaveLength(3);
    const byId = new Map(planes.map((p) => [p.id, p]));
    expect(byId.get('p1')?.valorActual).toBe(45_000);
    expect(byId.get('p2')?.valorActual).toBe(20_000); // legacy preservado
    expect(byId.get('p3')?.valorActual).toBe(55_000);
  });

  it('getAllPlanes · respeta filtros y luego hidrata', async () => {
    await seedFixture({
      planes: [
        { ...plan('p1', 30_000), tipoAdministrativo: 'PPI' },
        { ...plan('p2', 20_000), tipoAdministrativo: 'PPE' },
      ],
      valoraciones: [valoracion('p1', 45_000), valoracion('p2', 25_000)],
    });
    const { planesPensionesService } = await import('../planesPensionesService');
    const planes = await planesPensionesService.getAllPlanes({ tipoAdministrativo: 'PPI' });
    expect(planes).toHaveLength(1);
    expect(planes[0].id).toBe('p1');
    expect(planes[0].valorActual).toBe(45_000);
  });

  it('getPlanesPorTipo · hidrata los planes del tipo solicitado', async () => {
    await seedFixture({
      planes: [
        { ...plan('p1', 30_000), tipoAdministrativo: 'PPE' },
        { ...plan('p2', 20_000), tipoAdministrativo: 'PPI' },
      ],
      valoraciones: [valoracion('p1', 45_000)],
    });
    const { planesPensionesService } = await import('../planesPensionesService');
    const planes = await planesPensionesService.getPlanesPorTipo('PPE');
    expect(planes).toHaveLength(1);
    expect(planes[0].valorActual).toBe(45_000);
  });

  it('valoración soft-deleted NO se aplica', async () => {
    await seedFixture({
      planes: [plan('p1', 30_000)],
      valoraciones: [valoracion('p1', 99_999, '2024-12-15T00:00:00Z')],
    });
    const { planesPensionesService } = await import('../planesPensionesService');
    const p = await planesPensionesService.getPlan('p1');
    expect(p?.valorActual).toBe(30_000); // legacy · soft-deleted ignorada
  });

  it('getValorActualConsolidado · refleja el valor hidratado', async () => {
    await seedFixture({
      planes: [plan('p1', 30_000)],
      valoraciones: [valoracion('p1', 45_000)],
    });
    const { planesPensionesService } = await import('../planesPensionesService');
    // `getValorActualConsolidado` llama internamente a `getPlan` que ya
    // hidrata · automáticamente refleja el valor del servicio.
    const valor = await planesPensionesService.getValorActualConsolidado('p1');
    expect(valor).toBe(45_000);
  });
});
