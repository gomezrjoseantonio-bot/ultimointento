// src/services/__tests__/valoracionesService.indexV69.test.ts
// T-VALORACIONES PR2 · v74+ · verifica que las queries legacy del servicio
// (getEvolucionActivo / getValoracionMasReciente / getUltimaValoracionHastaMes)
// siguen devolviendo el shape `ValoracionHistorica` (snake_case, fecha YYYY-MM)
// tras el refactor interno al store nuevo `valoracionesActivos` (camelCase,
// fecha YYYY-MM-DD).

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

const PLAN_UUID = 'plan-jose-uuid';
const PLAN_OTRO = 'plan-otro';
const INMUEBLE_ID = 7;

async function seedValoraciones() {
  const { initDB } = await import('../db');
  const db = await initDB();
  const now = new Date().toISOString();

  // 5 valoraciones del plan PLAN_UUID + ruido (otro plan + inmueble)
  const filas = [
    { tipoActivo: 'plan_pensiones', activoId: PLAN_UUID, fecha: '2017-01-01', valor: 45000 },
    { tipoActivo: 'plan_pensiones', activoId: PLAN_UUID, fecha: '2021-03-01', valor: 56000 },
    { tipoActivo: 'plan_pensiones', activoId: PLAN_UUID, fecha: '2025-06-01', valor: 86000 },
    { tipoActivo: 'plan_pensiones', activoId: PLAN_UUID, fecha: '2026-04-01', valor: 96000 },
    { tipoActivo: 'plan_pensiones', activoId: PLAN_OTRO, fecha: '2024-01-01', valor: 10000 },
    { tipoActivo: 'inmueble', activoId: String(INMUEBLE_ID), fecha: '2023-12-01', valor: 250000 },
    { tipoActivo: 'inmueble', activoId: String(INMUEBLE_ID), fecha: '2024-12-01', valor: 270000 },
  ];
  for (const f of filas) {
    await (db as any).add('valoracionesActivos', {
      tipoActivo: f.tipoActivo,
      activoId: f.activoId,
      fecha: f.fecha,
      valor: f.valor,
      origen: 'manual',
      divisaOriginal: 'EUR',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }
}

describe('valoracionesService · queries legacy sobre valoracionesActivos (v74)', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  it('DB en v74+ con valoracionesActivos y los índices esperados', async () => {
    const { initDB } = await import('../db');
    const db = await initDB();
    expect(db.version).toBeGreaterThanOrEqual(74);
    const tx = db.transaction('valoracionesActivos');
    const store = tx.objectStore('valoracionesActivos');
    expect(Array.from(store.indexNames)).toContain('idx_activo');
    expect(Array.from(store.indexNames)).toContain('idx_activo_fecha');
    expect(Array.from(store.indexNames)).toContain('idx_tipo');
    db.close();
  });

  it('getEvolucionActivo · solo valoraciones del plan correcto, ordenadas asc, shape legacy', async () => {
    await seedValoraciones();
    const { valoracionesService } = await import('../valoracionesService');
    const r = await valoracionesService.getEvolucionActivo(
      'plan_pensiones',
      PLAN_UUID as unknown as number,
    );
    expect(r).toHaveLength(4);
    // shape legacy: campo fecha_valoracion en YYYY-MM (no YYYY-MM-DD)
    expect(r.map((v) => v.fecha_valoracion)).toEqual([
      '2017-01',
      '2021-03',
      '2025-06',
      '2026-04',
    ]);
    expect(r.every((v) => String(v.activo_id) === PLAN_UUID)).toBe(true);
    expect(r.every((v) => v.tipo_activo === 'plan_pensiones')).toBe(true);
  });

  it('getValoracionMasReciente plan UUID · devuelve la última (shape legacy)', async () => {
    await seedValoraciones();
    const { valoracionesService } = await import('../valoracionesService');
    const r = await valoracionesService.getValoracionMasReciente(
      'plan_pensiones',
      PLAN_UUID,
    );
    expect(r).toBeDefined();
    expect(r!.fecha_valoracion).toBe('2026-04');
    expect(r!.valor).toBe(96000);
  });

  it('getValoracionMasReciente inmueble id numérico · funciona igual', async () => {
    await seedValoraciones();
    const { valoracionesService } = await import('../valoracionesService');
    const r = await valoracionesService.getValoracionMasReciente(
      'inmueble',
      INMUEBLE_ID,
    );
    expect(r).toBeDefined();
    expect(r!.fecha_valoracion).toBe('2024-12');
    expect(r!.valor).toBe(270000);
  });

  it('getUltimaValoracionHastaMes · respeta el corte de fecha YYYY-MM', async () => {
    await seedValoraciones();
    const { valoracionesService } = await import('../valoracionesService');
    const r = await valoracionesService.getUltimaValoracionHastaMes(
      'plan_pensiones',
      PLAN_UUID as unknown as number,
      '2025-06',
    );
    expect(r).toBeDefined();
    expect(r!.fecha_valoracion).toBe('2025-06');
    expect(r!.valor).toBe(86000);
  });

  it('Equivalencia con full-scan · misma cardinalidad y mismos ids', async () => {
    await seedValoraciones();
    const { valoracionesService } = await import('../valoracionesService');
    const { initDB } = await import('../db');
    const db = await initDB();

    const all = (await (db as any).getAll('valoracionesActivos')) as any[];
    const referencia = all
      .filter((v) => v.tipoActivo === 'plan_pensiones' && String(v.activoId) === PLAN_UUID && !v.deletedAt)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    const conServicio = await valoracionesService.getEvolucionActivo(
      'plan_pensiones',
      PLAN_UUID as unknown as number,
    );

    expect(conServicio.length).toBe(referencia.length);
    expect(conServicio.map((v) => v.id).sort()).toEqual(
      referencia.map((v) => v.id).sort(),
    );
  });

  it('soft-deleted valoraciones NO aparecen en las queries del servicio', async () => {
    await seedValoraciones();
    const { initDB } = await import('../db');
    const db = await initDB();

    // Marcar la valoración de 2025-06 como borrada
    const all = (await (db as any).getAll('valoracionesActivos')) as any[];
    const target = all.find((v) => v.activoId === PLAN_UUID && v.fecha === '2025-06-01');
    expect(target).toBeDefined();
    await (db as any).put('valoracionesActivos', { ...target, deletedAt: new Date().toISOString() });

    const { valoracionesService } = await import('../valoracionesService');
    const r = await valoracionesService.getEvolucionActivo(
      'plan_pensiones',
      PLAN_UUID as unknown as number,
    );
    expect(r).toHaveLength(3);
    expect(r.map((v) => v.fecha_valoracion)).toEqual(['2017-01', '2021-03', '2026-04']);
  });
});
