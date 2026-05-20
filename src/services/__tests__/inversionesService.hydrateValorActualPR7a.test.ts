// src/services/__tests__/inversionesService.hydrateValorActualPR7a.test.ts
// T-VALORACIONES PR7a'''' · verifica que `inversionesService.getPosiciones`
// hidrata `valor_actual` con la última valoración del servicio nuevo
// (`valoracionesActivos`) cuando está disponible · fallback al campo
// legacy si no hay valoración en el servicio.

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

describe('inversionesService · hydrateValorActual via valoracionesActivos (PR7a\'\'\'\')', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  async function seedFixture(opts: { inversiones?: any[]; valoraciones?: any[] }) {
    const dbModule = await import('../db');
    const db = await dbModule.initDB();
    for (const i of opts.inversiones ?? []) await (db as any).put('inversiones', i);
    for (const v of opts.valoraciones ?? []) await (db as any).add('valoracionesActivos', v);
  }

  const valoracion = (activoId: string, tipoActivo: string, valor: number) => ({
    activoId,
    tipoActivo,
    fecha: '2024-12-01',
    valor,
    origen: 'manual',
    divisaOriginal: 'EUR',
    createdAt: '2024-12-01T00:00:00Z',
    updatedAt: '2024-12-01T00:00:00Z',
    deletedAt: null,
  });

  const inversion = (id: number, tipo: string, valor_actual: number, total_aportado: number) => ({
    id,
    nombre: `Inversion ${id}`,
    tipo,
    entidad: 'X',
    valor_actual,
    fecha_valoracion: '2024-01-01',
    activo: true,
    aportaciones: [],
    total_aportado,
    rentabilidad_euros: valor_actual - total_aportado,
    rentabilidad_porcentaje: total_aportado > 0 ? ((valor_actual - total_aportado) / total_aportado) * 100 : 0,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  });

  it('getPosiciones · valoración en servicio sobreescribe valor_actual legacy', async () => {
    await seedFixture({
      inversiones: [inversion(1, 'etf', 5000, 4000)],
      valoraciones: [valoracion('1', 'inversion', 12_000)],
    });
    const { inversionesService } = await import('../inversionesService');
    const posiciones = await inversionesService.getPosiciones();
    expect(posiciones).toHaveLength(1);
    expect(posiciones[0].valor_actual).toBe(12_000);
    expect(posiciones[0].rentabilidad_euros).toBe(8000); // recalculado · 12k - 4k
    expect(posiciones[0].rentabilidad_porcentaje).toBe(200); // 8k/4k * 100
  });

  it('getPosiciones · sin valoración en servicio mantiene valor_actual legacy', async () => {
    await seedFixture({
      inversiones: [inversion(2, 'fondo_inversion', 3500, 3000)],
      valoraciones: [],
    });
    const { inversionesService } = await import('../inversionesService');
    const posiciones = await inversionesService.getPosiciones();
    expect(posiciones[0].valor_actual).toBe(3500); // legacy preservado
    expect(posiciones[0].rentabilidad_euros).toBe(500);
  });

  it('getPosiciones · mixed · cada posición hidratada independientemente', async () => {
    await seedFixture({
      inversiones: [
        inversion(1, 'etf', 5000, 4000),
        inversion(2, 'fondo_inversion', 3500, 3000),
      ],
      valoraciones: [valoracion('1', 'inversion', 12_000)],
    });
    const { inversionesService } = await import('../inversionesService');
    const posiciones = await inversionesService.getPosiciones();
    const p1 = posiciones.find((p) => p.id === 1)!;
    const p2 = posiciones.find((p) => p.id === 2)!;
    expect(p1.valor_actual).toBe(12_000);
    expect(p2.valor_actual).toBe(3500);
  });

  it('getAllPosiciones · hidrata tanto activas como cerradas', async () => {
    await seedFixture({
      inversiones: [
        inversion(1, 'etf', 5000, 4000),
        { ...inversion(2, 'etf', 1000, 1000), activo: false },
      ],
      valoraciones: [
        valoracion('1', 'inversion', 12_000),
        valoracion('2', 'inversion', 800),
      ],
    });
    const { inversionesService } = await import('../inversionesService');
    const { activas, cerradas } = await inversionesService.getAllPosiciones();
    expect(activas).toHaveLength(1);
    expect(cerradas).toHaveLength(1);
    expect(activas[0].valor_actual).toBe(12_000);
    expect(cerradas[0].valor_actual).toBe(800);
  });

  it('valoración soft-deleted NO se aplica (servicio la ignora)', async () => {
    await seedFixture({
      inversiones: [inversion(1, 'etf', 5000, 4000)],
      valoraciones: [
        { ...valoracion('1', 'inversion', 99_999), deletedAt: '2024-12-15T00:00:00Z' },
      ],
    });
    const { inversionesService } = await import('../inversionesService');
    const posiciones = await inversionesService.getPosiciones();
    expect(posiciones[0].valor_actual).toBe(5000); // legacy · valoración borrada ignorada
  });
});
