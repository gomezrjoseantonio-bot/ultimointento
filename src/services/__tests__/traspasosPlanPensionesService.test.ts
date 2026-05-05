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

    // 2. Valoración histórica creada
    const valoraciones = (await (db as any).getAll('valoraciones_historicas')) as any[];
    const v = valoraciones.find(
      (x) => x.tipo_activo === 'plan_pensiones' && String(x.activo_id) === planId,
    );
    expect(v).toBeDefined();
    expect(v.valor).toBe(56000);
    expect(v.fecha_valoracion).toBe('2021-03'); // YYYY-MM (composite index format)

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
