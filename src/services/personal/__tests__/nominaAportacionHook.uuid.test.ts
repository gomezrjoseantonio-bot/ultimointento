// src/services/personal/__tests__/nominaAportacionHook.uuid.test.ts
// TAREA 13 v4 · Commit 3 (E) · NominaWizard guarda productoDestinoId como
// UUID string. Verificamos que el hook resuelve esa referencia y crea la
// aportación correctamente, sin recurrir al fallback `empresaPagadora.ingresoIdVinculado`.

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

describe('nominaAportacionHook · resolución por UUID string (post-Commit 3)', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  it('crea aportacionesPlan a partir de productoDestinoId UUID string', async () => {
    const planId = 'plan-orange-bbva-uuid';
    const { initDB } = await import('../../db');
    const db = await initDB();
    const ahora = new Date().toISOString();

    // Plan PPE Orange
    await (db as any).add('planesPensiones', {
      id: planId,
      nombre: 'Plan empleo Orange',
      titular: 'yo',
      personalDataId: 1,
      tipoAdministrativo: 'PPE',
      subtipoPPE: 'empleador_unico',
      gestoraActual: 'BBVA',
      fechaContratacion: '2020-01-01',
      empresaPagadora: { cif: 'A82009812', nombre: 'Orange España S.A.U.' },
      estado: 'activo',
      origen: 'manual',
      fechaCreacion: ahora,
      fechaActualizacion: ahora,
    });

    const { onNominaConfirmada } = await import('../nominaAportacionHook');

    const evento: any = {
      id: 999,
      sourceId: 7,
      sourceType: 'nomina',
      status: 'confirmed',
      predictedDate: '2026-01-31',
      actualDate: '2026-01-31',
    };

    const nomina: any = {
      id: 7,
      tipo: 'nomina',
      titular: 'yo',
      salarioBrutoAnual: 60000,
      planPensiones: {
        // ★ Lo que ahora guarda el wizard: UUID string en productoDestinoId.
        productoDestinoId: planId,
        productoDestinoNombre: 'Plan empleo Orange',
        aportacionEmpleado: { tipo: 'importe' as const, valor: 100 },
        aportacionEmpresa: { tipo: 'importe' as const, valor: 200 },
      },
    };

    await onNominaConfirmada(evento, nomina);

    const aportaciones = (await (db as any).getAll('aportacionesPlan')) as any[];
    expect(aportaciones).toHaveLength(1);
    expect(aportaciones[0].planId).toBe(planId);
    expect(aportaciones[0].importeTitular).toBe(100);
    expect(aportaciones[0].importeEmpresa).toBe(200);
    expect(aportaciones[0].origen).toBe('nomina_vinculada');
    expect(aportaciones[0].granularidad).toBe('mensual');
  });

  it('idempotente · no duplica si se invoca dos veces para el mismo evento', async () => {
    const planId = 'plan-x';
    const { initDB } = await import('../../db');
    const db = await initDB();
    const ahora = new Date().toISOString();
    await (db as any).add('planesPensiones', {
      id: planId,
      nombre: 'Plan X',
      titular: 'yo',
      personalDataId: 1,
      tipoAdministrativo: 'PPE',
      gestoraActual: 'BBVA',
      fechaContratacion: '2020-01-01',
      estado: 'activo',
      origen: 'manual',
      fechaCreacion: ahora,
      fechaActualizacion: ahora,
    });

    const { onNominaConfirmada } = await import('../nominaAportacionHook');
    const evento: any = {
      id: 1,
      sourceId: 1,
      sourceType: 'nomina',
      status: 'confirmed',
      predictedDate: '2026-02-28',
      actualDate: '2026-02-28',
    };
    const nomina: any = {
      id: 1,
      tipo: 'nomina',
      titular: 'yo',
      salarioBrutoAnual: 30000,
      planPensiones: {
        productoDestinoId: planId,
        aportacionEmpleado: { tipo: 'importe' as const, valor: 50 },
        aportacionEmpresa: { tipo: 'importe' as const, valor: 0 },
      },
    };
    await onNominaConfirmada(evento, nomina);
    await onNominaConfirmada(evento, nomina);
    const aportaciones = (await (db as any).getAll('aportacionesPlan')) as any[];
    expect(aportaciones).toHaveLength(1);
  });
});
