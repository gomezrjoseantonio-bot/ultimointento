// src/services/__tests__/valoracionesService.indexV69.test.ts
// TAREA 13 v4 · Commit 3 (C4) · verificar que las queries que ahora usan el
// índice `tipo-activo` (V69) devuelven los mismos resultados que el legacy
// `getAll + filter` para los patrones tipo+id e tipo+id+fecha.

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

const PLAN_UUID = 'plan-jose-uuid';
const PLAN_OTRO = 'plan-otro';
const INMUEBLE_ID = 7;

async function seedValoraciones() {
  const { initDB } = await import('../db');
  const db = await initDB();

  // 5 valoraciones del plan PLAN_UUID
  const filas = [
    { tipo: 'plan_pensiones', activo: PLAN_UUID, fecha: '2017-01', valor: 45000 },
    { tipo: 'plan_pensiones', activo: PLAN_UUID, fecha: '2021-03', valor: 56000 },
    { tipo: 'plan_pensiones', activo: PLAN_UUID, fecha: '2025-06', valor: 86000 },
    { tipo: 'plan_pensiones', activo: PLAN_UUID, fecha: '2026-04', valor: 96000 },
    { tipo: 'plan_pensiones', activo: PLAN_OTRO, fecha: '2024-01', valor: 10000 }, // ruido · plan distinto
    { tipo: 'inmueble', activo: INMUEBLE_ID, fecha: '2023-12', valor: 250000 }, // ruido · tipo distinto
    { tipo: 'inmueble', activo: INMUEBLE_ID, fecha: '2024-12', valor: 270000 },
  ];
  for (const f of filas) {
    await (db as any).add('valoraciones_historicas', {
      tipo_activo: f.tipo,
      activo_id: f.activo,
      activo_nombre: 'X',
      fecha_valoracion: f.fecha,
      valor: f.valor,
      origen: 'manual',
      created_at: '2025-01-01',
      updated_at: '2025-01-01',
    });
  }
}

describe('valoracionesService · queries con índice tipo-activo (V69)', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  it('DB inicializa en V69 con índice `tipo-activo`', async () => {
    const { initDB } = await import('../db');
    const db = await initDB();
    expect(db.version).toBe(69);
    const tx = db.transaction('valoraciones_historicas');
    const store = tx.objectStore('valoraciones_historicas');
    expect(Array.from(store.indexNames)).toContain('tipo-activo');
    expect(Array.from(store.indexNames)).toContain('tipo-activo-fecha'); // ya existía
    db.close();
  });

  it('getEvolucionActivo plan UUID · devuelve solo valoraciones del plan correcto, ordenadas asc', async () => {
    await seedValoraciones();
    const { valoracionesService } = await import('../valoracionesService');
    const r = await valoracionesService.getEvolucionActivo(
      'plan_pensiones',
      PLAN_UUID as unknown as number,
    );
    expect(r).toHaveLength(4);
    expect(r.map((v) => v.fecha_valoracion)).toEqual([
      '2017-01',
      '2021-03',
      '2025-06',
      '2026-04',
    ]);
    expect(r.every((v) => v.activo_id === PLAN_UUID)).toBe(true);
  });

  it('getValoracionMasReciente plan UUID · devuelve la última', async () => {
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

  it('getUltimaValoracionHastaMes · respeta el corte de fecha', async () => {
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

    // Reference: getAll + filter (la lógica antes del índice)
    const all = (await (db as any).getAll('valoraciones_historicas')) as any[];
    const referencia = all
      .filter((v) => v.tipo_activo === 'plan_pensiones' && String(v.activo_id) === PLAN_UUID)
      .sort((a, b) => a.fecha_valoracion.localeCompare(b.fecha_valoracion));

    const conIndice = await valoracionesService.getEvolucionActivo(
      'plan_pensiones',
      PLAN_UUID as unknown as number,
    );

    expect(conIndice.length).toBe(referencia.length);
    expect(conIndice.map((v) => v.id).sort()).toEqual(
      referencia.map((v) => v.id).sort(),
    );
  });
});
