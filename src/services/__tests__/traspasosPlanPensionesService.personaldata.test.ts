// src/services/__tests__/traspasosPlanPensionesService.personaldata.test.ts
// TAREA 13 v4 · Commit 1 (C9) · tests de `getTraspasosPorPersonalData` y
// `eliminarTraspaso` (historial agregado a nivel hogar).

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

describe('traspasosPlanPensionesService · agregado por personalData', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  async function seedPlanYTraspaso(
    planId: string,
    personalDataId: number,
    fechaEjecucion: string,
    valor: number,
  ) {
    const { initDB } = await import('../db');
    const { traspasosPlanPensionesService } = await import('../traspasosPlanPensionesService');
    const db = await initDB();
    const ahora = new Date().toISOString();
    await (db as any).add('planesPensiones', {
      id: planId,
      nombre: `Plan ${planId}`,
      titular: 'yo',
      personalDataId,
      tipoAdministrativo: 'PPI',
      gestoraActual: 'ING',
      fechaContratacion: '2020-01-01',
      estado: 'activo',
      origen: 'manual',
      fechaCreacion: ahora,
      fechaActualizacion: ahora,
    });
    return traspasosPlanPensionesService.registrarTraspaso({
      planId,
      fechaEjecucion,
      gestoraOrigen: 'ING',
      gestoraDestino: 'Indexa',
      valorTraspaso: valor,
      importeTraspasado: valor,
      esTotal: true,
    });
  }

  it('devuelve solo traspasos de planes del personalDataId · ordenados desc', async () => {
    await seedPlanYTraspaso('plan-yo-1', 1, '2024-03-15', 50000);
    await seedPlanYTraspaso('plan-yo-2', 1, '2025-06-10', 60000);
    await seedPlanYTraspaso('plan-pareja', 2, '2024-12-01', 30000);

    const { traspasosPlanPensionesService } = await import('../traspasosPlanPensionesService');
    const traspasosYo = await traspasosPlanPensionesService.getTraspasosPorPersonalData(1);
    expect(traspasosYo).toHaveLength(2);
    expect(traspasosYo[0].fechaEjecucion).toBe('2025-06-10'); // más reciente primero
    expect(traspasosYo[1].fechaEjecucion).toBe('2024-03-15');

    const traspasosPareja = await traspasosPlanPensionesService.getTraspasosPorPersonalData(2);
    expect(traspasosPareja).toHaveLength(1);
    expect(traspasosPareja[0].planId).toBe('plan-pareja');
  });

  it('eliminarTraspaso · borra del store', async () => {
    const t = await seedPlanYTraspaso('plan-x', 1, '2024-01-01', 1000);
    const { traspasosPlanPensionesService } = await import('../traspasosPlanPensionesService');
    expect(t.id).toBeDefined();
    await traspasosPlanPensionesService.eliminarTraspaso(t.id as number);

    const { initDB } = await import('../db');
    const db = await initDB();
    const all = (await (db as any).getAll('traspasosPlanPensiones')) as any[];
    expect(all).toHaveLength(0);
  });

  it('personalData sin planes · array vacío', async () => {
    const { traspasosPlanPensionesService } = await import('../traspasosPlanPensionesService');
    const r = await traspasosPlanPensionesService.getTraspasosPorPersonalData(999);
    expect(r).toEqual([]);
  });
});
