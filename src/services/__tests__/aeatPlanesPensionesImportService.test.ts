// src/services/__tests__/aeatPlanesPensionesImportService.test.ts
// TAREA 13 v4 · Commit 4 (F) · tests del servicio de importación AEAT.

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

describe('aeatPlanesPensionesImportService', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  it('crea plan stub PPI cuando no hay planes y solo hay aportación de partícipe', async () => {
    const { importarAportacionesAEAT } = await import(
      '../aeatPlanesPensionesImportService'
    );
    const r = await importarAportacionesAEAT({
      personalDataId: 1,
      titular: 'yo',
      ejercicio: 2025,
      aportacionesTrabajador: 1500,
      contribucionesEmpresariales: 0,
    });

    expect(r.planId).toBeTruthy();
    expect(r.aportacionesCreadas).toHaveLength(1);
    expect(r.aportacionesCreadas[0].importeTitular).toBe(1500);
    expect(r.aportacionesCreadas[0].importeEmpresa).toBe(0);
    expect(r.aportacionesCreadas[0].origen).toBe('xml_aeat');
    expect(r.aportacionesCreadas[0].casillaAEAT).toBe('0426');
    expect(r.aportacionesCreadas[0].granularidad).toBe('anual');
    expect(r.warnings.some((w) => w.includes('plan stub'))).toBe(true);

    const { initDB } = await import('../db');
    const db = await initDB();
    const planes = (await (db as any).getAll('planesPensiones')) as any[];
    expect(planes).toHaveLength(1);
    expect(planes[0].tipoAdministrativo).toBe('PPI');
    expect(planes[0].origen).toBe('xml_aeat');
  });

  it('crea plan stub PPE cuando hay contribución empresarial', async () => {
    const { importarAportacionesAEAT } = await import(
      '../aeatPlanesPensionesImportService'
    );
    const r = await importarAportacionesAEAT({
      personalDataId: 1,
      titular: 'yo',
      ejercicio: 2025,
      aportacionesTrabajador: 1500,
      contribucionesEmpresariales: 5000,
    });
    expect(r.aportacionesCreadas).toHaveLength(2);
    const titular = r.aportacionesCreadas.find((a) => a.casillaAEAT === '0426');
    const empresa = r.aportacionesCreadas.find((a) => a.casillaAEAT === '0427');
    expect(titular?.importeTitular).toBe(1500);
    expect(empresa?.importeEmpresa).toBe(5000);

    const { initDB } = await import('../db');
    const db = await initDB();
    const planes = (await (db as any).getAll('planesPensiones')) as any[];
    expect(planes).toHaveLength(1);
    expect(planes[0].tipoAdministrativo).toBe('PPE');
  });

  it('reutiliza el plan existente del titular (PPE preferido si hay empresa)', async () => {
    const { initDB } = await import('../db');
    const db = await initDB();
    const ahora = new Date().toISOString();
    await (db as any).add('planesPensiones', {
      id: 'plan-orange',
      nombre: 'Plan PPE Orange',
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

    const { importarAportacionesAEAT } = await import(
      '../aeatPlanesPensionesImportService'
    );
    const r = await importarAportacionesAEAT({
      personalDataId: 1,
      titular: 'yo',
      ejercicio: 2025,
      aportacionesTrabajador: 1200,
      contribucionesEmpresariales: 4000,
    });
    expect(r.planId).toBe('plan-orange');
    expect(r.aportacionesCreadas).toHaveLength(2);

    const planes = (await (db as any).getAll('planesPensiones')) as any[];
    expect(planes).toHaveLength(1); // no se ha creado uno nuevo
  });

  it('idempotente · re-ejecutar para el mismo ejercicio no duplica aportaciones', async () => {
    const { importarAportacionesAEAT } = await import(
      '../aeatPlanesPensionesImportService'
    );
    const input = {
      personalDataId: 1,
      titular: 'yo' as const,
      ejercicio: 2025,
      aportacionesTrabajador: 1500,
      contribucionesEmpresariales: 0,
    };
    const r1 = await importarAportacionesAEAT(input);
    expect(r1.aportacionesCreadas).toHaveLength(1);

    const r2 = await importarAportacionesAEAT(input);
    expect(r2.aportacionesCreadas).toHaveLength(0);
    expect(
      r2.warnings.some((w) => w.includes('ya importada previamente')),
    ).toBe(true);

    const { initDB } = await import('../db');
    const db = await initDB();
    const aps = (await (db as any).getAll('aportacionesPlan')) as any[];
    expect(aps).toHaveLength(1);
  });

  it('respeta planIdExplicito si lo pasa el orchestrator', async () => {
    const { initDB } = await import('../db');
    const db = await initDB();
    const ahora = new Date().toISOString();
    await (db as any).add('planesPensiones', {
      id: 'plan-elegido-por-jose',
      nombre: 'Plan elegido por Jose',
      titular: 'yo',
      personalDataId: 1,
      tipoAdministrativo: 'PPI',
      gestoraActual: 'MyInvestor',
      fechaContratacion: '2017-01-15',
      estado: 'activo',
      origen: 'manual',
      fechaCreacion: ahora,
      fechaActualizacion: ahora,
    });

    const { importarAportacionesAEAT } = await import(
      '../aeatPlanesPensionesImportService'
    );
    const r = await importarAportacionesAEAT({
      personalDataId: 1,
      titular: 'yo',
      ejercicio: 2025,
      aportacionesTrabajador: 800,
      contribucionesEmpresariales: 0,
      planIdExplicito: 'plan-elegido-por-jose',
    });
    expect(r.planId).toBe('plan-elegido-por-jose');
    expect(r.aportacionesCreadas[0].planId).toBe('plan-elegido-por-jose');
  });

  it('inferirTipoDesdeCasilla mapea correctamente', async () => {
    const { inferirTipoDesdeCasilla } = await import(
      '../aeatPlanesPensionesImportService'
    );
    expect(inferirTipoDesdeCasilla('0470')).toBe('PPI');
    expect(inferirTipoDesdeCasilla('0471')).toBe('PPE');
    expect(inferirTipoDesdeCasilla('0472')).toBe('PPA');
    expect(inferirTipoDesdeCasilla('0474')).toBe('PPES');
    expect(inferirTipoDesdeCasilla('0469')).toBe('PPI'); // cónyuge
    expect(inferirTipoDesdeCasilla('xxxx')).toBe('PPI'); // default
  });
});
