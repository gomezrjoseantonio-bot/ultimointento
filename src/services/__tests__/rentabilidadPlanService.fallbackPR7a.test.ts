// src/services/__tests__/rentabilidadPlanService.fallbackPR7a.test.ts
// T-VALORACIONES PR7a' · verifica que `getRentabilidadPorBloque` cae al
// servicio nuevo `valoracionesActivos` cuando `plan.valorActual` es
// undefined (plan importado que no actualizó el campo legacy).

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

const PLAN_ID = 'plan-fallback-test';

async function seedPlanSinValorActual() {
  const { initDB } = await import('../db');
  const { aportacionesPlanService } = await import('../aportacionesPlanService');
  const db = await initDB();
  const ahora = new Date().toISOString();

  // Plan sin `valorActual` legacy poblado · simula importación via wizard
  // que solo escribió a valoracionesActivos (no al campo legacy).
  await (db as any).add('planesPensiones', {
    id: PLAN_ID,
    nombre: 'Plan importado',
    titular: 'yo',
    personalDataId: 1,
    tipoAdministrativo: 'PPI',
    gestoraActual: 'MyInvestor',
    fechaContratacion: '2020-01-15',
    // valorActual omitido a propósito
    fechaUltimaValoracion: '2024-12-31',
    estado: 'activo',
    origen: 'manual',
    fechaCreacion: ahora,
    fechaActualizacion: ahora,
  });

  await aportacionesPlanService.crearAportacion({
    planId: PLAN_ID,
    fecha: '2020-01-15',
    ejercicioFiscal: 2020,
    importeTitular: 10_000,
    importeEmpresa: 0,
    origen: 'manual',
    granularidad: 'puntual',
  });

  // Valoración SOLO en el store nuevo (sin tocar `plan.valorActual`).
  await (db as any).add('valoracionesActivos', {
    activoId: PLAN_ID,
    tipoActivo: 'plan_pensiones',
    fecha: '2024-12-31',
    valor: 13_500,
    origen: 'manual',
    divisaOriginal: 'EUR',
    createdAt: ahora,
    updatedAt: ahora,
    deletedAt: null,
  });
}

describe('rentabilidadPlanService · fallback a valoracionesActivos cuando plan.valorActual undefined (PR7a)', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  it('getRentabilidadTotal · usa última valoración del servicio cuando plan.valorActual es undefined', async () => {
    await seedPlanSinValorActual();
    const { getRentabilidadTotal } = await import('../rentabilidadPlanService');
    const r = await getRentabilidadTotal(PLAN_ID);
    expect(r.valorActual).toBe(13_500);
    expect(r.capitalAportadoTotal).toBe(10_000);
    expect(r.plusvaliaAbsoluta).toBe(3_500);
  });

  it('getRentabilidadPorBloque · usa última valoración del servicio cuando plan.valorActual es undefined', async () => {
    await seedPlanSinValorActual();
    const { getRentabilidadPorBloque } = await import('../rentabilidadPlanService');
    const bloques = await getRentabilidadPorBloque(PLAN_ID);
    expect(bloques.length).toBeGreaterThanOrEqual(1);
    // Plan sin traspasos · 1 solo bloque · valor final = 13_500
    expect(bloques[bloques.length - 1].valorFin).toBe(13_500);
  });
});
