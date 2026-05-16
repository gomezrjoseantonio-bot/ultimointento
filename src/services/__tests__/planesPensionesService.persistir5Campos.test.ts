// TAREA 13 v4 · Acción 2 (D4) · tests de persistencia roundtrip de los 5
// campos formales que el wizard `PlanFormV5` ahora captura:
//   subtipoPPE · subtipoPPES · politicaInversion · empresaPagadora ·
//   participeConDiscapacidad.
//
// El schema ya soporta todos ellos como opcionales (sin bump DB). Estos tests
// validan que createPlan/getPlan los persiste y devuelve sin alterar.

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

describe('planesPensionesService · persistencia 5 campos formales (Acción 2 D4)', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  it('PPE empleador único · roundtrip con empresaPagadora + politicaInversion + discapacidad', async () => {
    const { planesPensionesService } = await import('../planesPensionesService');
    const creado = await planesPensionesService.createPlan({
      personalDataId: 1,
      nombre: 'PPE Orange',
      titular: 'yo',
      tipoAdministrativo: 'PPE',
      subtipoPPE: 'empleador_unico',
      politicaInversion: 'renta_mixta',
      participeConDiscapacidad: true,
      empresaPagadora: { cif: 'A82009812', nombre: 'Orange España S.A.U.' },
      gestoraActual: 'Orange',
      fechaContratacion: '2020-01-01',
      estado: 'activo',
      origen: 'manual',
    });

    expect(creado.id).toBeTruthy();
    const leido = await planesPensionesService.getPlan(creado.id);
    expect(leido).toBeDefined();
    expect(leido!.subtipoPPE).toBe('empleador_unico');
    expect(leido!.subtipoPPES).toBeUndefined();
    expect(leido!.politicaInversion).toBe('renta_mixta');
    expect(leido!.participeConDiscapacidad).toBe(true);
    expect(leido!.empresaPagadora).toEqual({ cif: 'A82009812', nombre: 'Orange España S.A.U.' });
  });

  it('PPES autonomos · subtipoPPES persistido · sin empresaPagadora', async () => {
    const { planesPensionesService } = await import('../planesPensionesService');
    const creado = await planesPensionesService.createPlan({
      personalDataId: 1,
      nombre: 'PPES Autónomos Renta 4',
      titular: 'yo',
      tipoAdministrativo: 'PPES',
      subtipoPPES: 'autonomos',
      politicaInversion: 'renta_variable',
      gestoraActual: 'Renta 4',
      fechaContratacion: '2024-06-01',
      estado: 'activo',
      origen: 'manual',
    });

    const leido = await planesPensionesService.getPlan(creado.id);
    expect(leido!.subtipoPPES).toBe('autonomos');
    expect(leido!.subtipoPPE).toBeUndefined();
    expect(leido!.politicaInversion).toBe('renta_variable');
    expect(leido!.empresaPagadora).toBeUndefined();
    expect(leido!.participeConDiscapacidad).toBeUndefined();
  });

  it('PPI con participeConDiscapacidad=true · tope efectivo pasa de 1500 a 24250', async () => {
    const { planesPensionesService } = await import('../planesPensionesService');
    const { limitesFiscalesPlanesService } = await import('../limitesFiscalesPlanesService');

    const plan = await planesPensionesService.createPlan({
      personalDataId: 1,
      nombre: 'PPI Discapacidad',
      titular: 'yo',
      tipoAdministrativo: 'PPI',
      participeConDiscapacidad: true,
      gestoraActual: 'ING',
      fechaContratacion: '2020-01-01',
      estado: 'activo',
      origen: 'manual',
    });

    // El plan persistido se entrega a getLimitesPorTipo con el flag · debe
    // devolver el tope especial 24.250 € (art. 52.1.c LIRPF) en lugar del
    // 1.500 € genérico de PPI.
    const limites = limitesFiscalesPlanesService.getLimitesPorTipo(
      plan.tipoAdministrativo,
      plan.subtipoPPE,
      plan.subtipoPPES,
      plan.participeConDiscapacidad,
    );
    expect(limites.limiteEconomico).toBe(24250);

    // Comparativa · mismo plan sin discapacidad mantiene tope 1500.
    const planSinDiscap = await planesPensionesService.createPlan({
      personalDataId: 1,
      nombre: 'PPI Normal',
      titular: 'yo',
      tipoAdministrativo: 'PPI',
      gestoraActual: 'ING',
      fechaContratacion: '2020-01-01',
      estado: 'activo',
      origen: 'manual',
    });
    const limitesNormal = limitesFiscalesPlanesService.getLimitesPorTipo(
      planSinDiscap.tipoAdministrativo,
      planSinDiscap.subtipoPPE,
      planSinDiscap.subtipoPPES,
      planSinDiscap.participeConDiscapacidad,
    );
    expect(limitesNormal.limiteEconomico).toBe(1500);
  });
});
