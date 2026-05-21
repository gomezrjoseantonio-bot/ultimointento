// T-FICHA-PP-PULIDO v1 · Bug #1 · tests del resolver de TER.
//
// Prioridades · override manual > catálogo curado > desconocido.

import { resolveTerPlan } from '../planesPensionesService';
import type { PlanPensiones } from '../../types/planesPensiones';

function makePlan(overrides: Partial<PlanPensiones>): PlanPensiones {
  return {
    id: 'p-1',
    nombre: 'Plan Test',
    titular: 'yo',
    personalDataId: 1,
    tipoAdministrativo: 'PPI',
    gestoraActual: '',
    fechaContratacion: '2020-01-01',
    estado: 'activo',
    fechaCreacion: '2020-01-01T00:00:00.000Z',
    fechaActualizacion: '2020-01-01T00:00:00.000Z',
    origen: 'manual',
    ...overrides,
  };
}

describe('resolveTerPlan · prioridades', () => {
  test('override manual prevalece sobre catálogo', () => {
    const plan = makePlan({
      gestoraActual: 'BBVA',
      nombre: 'Plan Orange',
      terOverride: 0.85,
    });
    const r = resolveTerPlan(plan);
    expect(r.ter).toBe(0.85);
    expect(r.fuente).toBe('manual');
  });

  test('catálogo · Plan Orange BBVA · 1,50 %', () => {
    const plan = makePlan({
      gestoraActual: 'BBVA',
      nombre: 'Plan Orange',
    });
    const r = resolveTerPlan(plan);
    expect(r.ter).toBe(1.5);
    expect(r.fuente).toBe('catalogo');
    expect(r.catalogoEntry?.fuente).toBe('bbva.es');
  });

  test('catálogo · myinvestor Indexado Global · 0,43 %', () => {
    const plan = makePlan({
      gestoraActual: 'myinvestor',
      nombre: 'Indexado Global',
    });
    const r = resolveTerPlan(plan);
    expect(r.ter).toBe(0.43);
    expect(r.fuente).toBe('catalogo');
  });

  test('plan desconocido · null + fuente "desconocido"', () => {
    const plan = makePlan({
      gestoraActual: 'Banco Inventado',
      nombre: 'Plan Misterioso',
    });
    const r = resolveTerPlan(plan);
    expect(r.ter).toBeNull();
    expect(r.fuente).toBe('desconocido');
  });

  test('override = 0 · se acepta (TER 0 %)', () => {
    const plan = makePlan({
      gestoraActual: 'BBVA',
      nombre: 'Plan Orange',
      terOverride: 0,
    });
    const r = resolveTerPlan(plan);
    expect(r.ter).toBe(0);
    expect(r.fuente).toBe('manual');
  });

  test('override negativo · se ignora · cae al catálogo', () => {
    const plan = makePlan({
      gestoraActual: 'BBVA',
      nombre: 'Plan Orange',
      terOverride: -1 as number,
    });
    const r = resolveTerPlan(plan);
    expect(r.ter).toBe(1.5);
    expect(r.fuente).toBe('catalogo');
  });

  test('plan null · null sin lanzar', () => {
    const r = resolveTerPlan(null);
    expect(r.ter).toBeNull();
    expect(r.fuente).toBe('desconocido');
  });

  test('normalización · "MYINVESTOR" + "Indexado Global" → catálogo OK', () => {
    const plan = makePlan({
      gestoraActual: 'MYINVESTOR',
      nombre: 'Indexado Global',
    });
    const r = resolveTerPlan(plan);
    expect(r.ter).toBe(0.43);
    expect(r.fuente).toBe('catalogo');
  });
});
