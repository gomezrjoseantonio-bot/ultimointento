// src/services/__tests__/traspasosPlanPensionesService.test.ts
// TAREA 13 v4 · Commit 1 (B+C): valorTraspaso + side-effects
//
// Verifica que registrarTraspaso:
//   1. Persiste el traspaso con valorTraspaso.
//   2. Actualiza planesPensiones.gestoraActual + isinActual + valorActual.
//   3. Crea entrada en valoraciones_historicas con fechaEjecucion + valorTraspaso.
//   4. Aplica nuevoTipoAdministrativo y nuevaPoliticaInversion al plan si vienen.

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

describe('traspasosPlanPensionesService · registrarTraspaso · side-effects', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  async function seedPlan(planId: string) {
    const { initDB } = await import('../db');
    const db = await initDB();
    const ahora = new Date().toISOString();
    await (db as any).add('planesPensiones', {
      id: planId,
      nombre: 'Plan jubilación 2017',
      titular: 'yo',
      personalDataId: 1,
      tipoAdministrativo: 'PPI',
      gestoraActual: 'ING',
      isinActual: 'ES0000000001',
      fechaContratacion: '2017-01-15',
      valorActual: 45000,
      estado: 'activo',
      origen: 'manual',
      fechaCreacion: ahora,
      fechaActualizacion: ahora,
    });
  }

  it('persists valorTraspaso and updates plan + valoraciones_historicas', async () => {
    const planId = 'plan-jose-uuid';
    await seedPlan(planId);

    const { traspasosPlanPensionesService } = await import(
      '../traspasosPlanPensionesService'
    );
    await traspasosPlanPensionesService.registrarTraspaso({
      planId,
      fechaEjecucion: '2021-03-22',
      gestoraOrigen: 'ING',
      gestoraDestino: 'Indexa',
      isinOrigen: 'ES0000000001',
      isinDestino: 'ES0000000002',
      valorTraspaso: 56000,
      importeTraspasado: 56000,
      esTotal: true,
    });

    const { initDB } = await import('../db');
    const db = await initDB();

    // 1. Plan actualizado
    const plan = (await (db as any).get('planesPensiones', planId)) as any;
    expect(plan.gestoraActual).toBe('Indexa');
    expect(plan.isinActual).toBe('ES0000000002');
    expect(plan.valorActual).toBe(56000);
    expect(plan.fechaUltimaValoracion).toBe('2021-03-22');

    // 2. Valoración histórica creada (T-VALORACIONES PR2: store renombrado v74)
    const valoraciones = (await (db as any).getAll('valoracionesActivos')) as any[];
    const v = valoraciones.find(
      (x) => x.tipoActivo === 'plan_pensiones' && String(x.activoId) === planId,
    );
    expect(v).toBeDefined();
    expect(v.valor).toBe(56000);
    expect(v.fecha).toBe('2021-03-01'); // YYYY-MM-DD (granularidad v74)

    // 3. Traspaso en store
    const traspasos = (await (db as any).getAll('traspasosPlanPensiones')) as any[];
    expect(traspasos).toHaveLength(1);
    expect(traspasos[0].valorTraspaso).toBe(56000);
    expect(traspasos[0].gestoraOrigen).toBe('ING');
    expect(traspasos[0].gestoraDestino).toBe('Indexa');
  });

  it('applies nuevoTipoAdministrativo and nuevaPoliticaInversion to the plan', async () => {
    const planId = 'plan-cambio-tipo';
    await seedPlan(planId);

    const { traspasosPlanPensionesService } = await import(
      '../traspasosPlanPensionesService'
    );
    await traspasosPlanPensionesService.registrarTraspaso({
      planId,
      fechaEjecucion: '2025-06-10',
      gestoraOrigen: 'Indexa',
      gestoraDestino: 'MyInvestor',
      valorTraspaso: 86000,
      importeTraspasado: 86000,
      esTotal: true,
      cambioTipoAdministrativo: true,
      nuevoTipoAdministrativo: 'PPA',
      nuevaPoliticaInversion: 'garantizado',
    });

    const { initDB } = await import('../db');
    const db = await initDB();
    const plan = (await (db as any).get('planesPensiones', planId)) as any;
    expect(plan.tipoAdministrativo).toBe('PPA');
    expect(plan.politicaInversion).toBe('garantizado');
  });
});

// INVERSIONES V1 · Fase 1 · lectura polimórfica por activo (índice activoId)
describe('traspasosPlanPensionesService · getTraspasosPorActivo', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  async function addTraspaso(t: Record<string, unknown>) {
    const { initDB } = await import('../db');
    const db = await initDB();
    const ahora = new Date().toISOString();
    await (db as any).add('traspasosPlanPensiones', {
      importeTraspasado: 0,
      esTotal: true,
      gestoraOrigen: 'A',
      gestoraDestino: 'B',
      fechaCreacion: ahora,
      fechaActualizacion: ahora,
      ...t,
    });
  }

  it('lee traspasos de un plan por el índice activoId, ordenados por fechaEjecucion', async () => {
    await addTraspaso({ planId: 'plan-1', activoId: 'plan-1', tipoActivo: 'plan_pensiones', fechaEjecucion: '2022-05-01' });
    await addTraspaso({ planId: 'plan-1', activoId: 'plan-1', tipoActivo: 'plan_pensiones', fechaEjecucion: '2020-01-01' });
    await addTraspaso({ planId: 'plan-2', activoId: 'plan-2', tipoActivo: 'plan_pensiones', fechaEjecucion: '2021-01-01' });

    const { traspasosPlanPensionesService } = await import('../traspasosPlanPensionesService');
    const res = await traspasosPlanPensionesService.getTraspasosPorActivo('plan-1', 'plan_pensiones');

    expect(res.map((t) => t.fechaEjecucion)).toEqual(['2020-01-01', '2022-05-01']);
    expect(res.every((t) => t.activoId === 'plan-1')).toBe(true);
  });

  it('distingue por tipoActivo: un fondo no devuelve traspasos de plan con el mismo activoId', async () => {
    // Mismo id textual pero distinto tipoActivo · no deben mezclarse.
    await addTraspaso({ planId: 'x', activoId: 'x', tipoActivo: 'plan_pensiones', fechaEjecucion: '2022-01-01' });
    await addTraspaso({ planId: 'x', activoId: 'x', tipoActivo: 'fondo_inversion', fechaEjecucion: '2023-01-01' });

    const { traspasosPlanPensionesService } = await import('../traspasosPlanPensionesService');
    const fondo = await traspasosPlanPensionesService.getTraspasosPorActivo('x', 'fondo_inversion');
    const plan = await traspasosPlanPensionesService.getTraspasosPorActivo('x', 'plan_pensiones');

    expect(fondo).toHaveLength(1);
    expect(fondo[0].tipoActivo).toBe('fondo_inversion');
    expect(plan).toHaveLength(1);
    expect(plan[0].tipoActivo).toBe('plan_pensiones');
  });

  it('red de seguridad legacy: encuentra traspasos de plan sin activoId (backfill no corrido) vía planId', async () => {
    // Simula un traspaso legacy anterior al backfill: sin activoId ni tipoActivo.
    await addTraspaso({ planId: 'plan-legacy', fechaEjecucion: '2019-09-09' });

    const { traspasosPlanPensionesService } = await import('../traspasosPlanPensionesService');
    const res = await traspasosPlanPensionesService.getTraspasosPorActivo('plan-legacy', 'plan_pensiones');

    expect(res).toHaveLength(1);
    expect(res[0].planId).toBe('plan-legacy');
    expect(res[0].activoId).toBeUndefined();
  });

  it('devuelve vacío para un activo sin traspasos', async () => {
    await addTraspaso({ planId: 'otro', activoId: 'otro', tipoActivo: 'plan_pensiones', fechaEjecucion: '2022-01-01' });

    const { traspasosPlanPensionesService } = await import('../traspasosPlanPensionesService');
    const res = await traspasosPlanPensionesService.getTraspasosPorActivo('fondo-inexistente', 'fondo_inversion');

    expect(res).toEqual([]);
  });
});
