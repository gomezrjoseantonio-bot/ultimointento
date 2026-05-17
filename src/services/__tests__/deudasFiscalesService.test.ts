/**
 * Tests SPEC-CC-FISCAL-UI-REPLACE-v1 · sub-tarea 1 · hueco 4.
 * Cubre el store `deudasFiscales` (V71) y el servicio `deudasFiscalesService`.
 */

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

const TOLERANCIA = 0.01;

describe('deudasFiscalesService · SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 1 hueco 4', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  it('store deudasFiscales existe (V71 migration aplicada)', async () => {
    const { initDB } = await import('../db');
    const db = await initDB();
    expect(db.objectStoreNames.contains('deudasFiscales')).toBe(true);
    // Aserción >= en lugar de === para no romper en bumps de DB_VERSION
    // posteriores (mismo patrón que valoracionesService.indexV69.test.ts).
    // T-INVERSIONES-DETALLE-PP-v1 PR 2 bumpea a v72 sin tocar el store.
    expect(db.version).toBeGreaterThanOrEqual(71);
    db.close();
  });

  it('getTotalAbierto() = 0 sin seed (store recién creado vacío)', async () => {
    const { getTotalAbierto } = await import('../deudasFiscalesService');
    const total = await getTotalAbierto();
    expect(Math.abs(total - 0)).toBeLessThanOrEqual(TOLERANCIA);
  });

  it('getDeudas() devuelve array vacío sin seed', async () => {
    const { getDeudas } = await import('../deudasFiscalesService');
    const deudas = await getDeudas();
    expect(deudas).toEqual([]);
  });

  it('getDeudasAbiertas() devuelve array vacío sin seed', async () => {
    const { getDeudasAbiertas } = await import('../deudasFiscalesService');
    const abiertas = await getDeudasAbiertas();
    expect(abiertas).toEqual([]);
  });

  it('crearDeuda persiste con id autoincrement + timestamps', async () => {
    const { crearDeuda, getDeudaById } = await import('../deudasFiscalesService');
    const creada = await crearDeuda({
      modelo: '303',
      ejercicio: 2024,
      periodo: '3T',
      principal: 1000,
      recargoTipo: 'voluntario',
      recargoImporte: 0,
      total: 1000,
      estado: 'voluntario',
    });
    expect(creada.id).toBeDefined();
    expect(creada.createdAt).toBeTruthy();
    expect(creada.updatedAt).toBeTruthy();

    const persisted = await getDeudaById(creada.id as number);
    expect(persisted).not.toBeNull();
    expect(persisted!.principal).toBe(1000);
  });

  it('getTotalAbierto() suma deudas en estados abiertos', async () => {
    const { crearDeuda, getTotalAbierto } = await import('../deudasFiscalesService');
    await crearDeuda({
      modelo: '303', ejercicio: 2024, periodo: '3T',
      principal: 1000, recargoTipo: 'voluntario', recargoImporte: 0,
      total: 1000, estado: 'voluntario',
    });
    await crearDeuda({
      modelo: '100', ejercicio: 2023, periodo: 'anual',
      principal: 500, recargoTipo: 'ejecutivo_5', recargoImporte: 25,
      total: 525, estado: 'ejecutivo',
    });
    await crearDeuda({
      modelo: '130', ejercicio: 2022, periodo: '4T',
      principal: 200, recargoTipo: 'voluntario', recargoImporte: 0,
      total: 200, estado: 'pagada',
      pagadaEl: '2023-01-15',
    });
    const total = await getTotalAbierto();
    expect(Math.abs(total - 1525)).toBeLessThanOrEqual(TOLERANCIA);
  });

  it('marcarPagada() cambia estado y persiste fechaPago', async () => {
    const { crearDeuda, marcarPagada, getTotalAbierto } = await import('../deudasFiscalesService');
    const creada = await crearDeuda({
      modelo: '303', ejercicio: 2024, periodo: '2T',
      principal: 800, recargoTipo: 'voluntario', recargoImporte: 0,
      total: 800, estado: 'voluntario',
    });
    const pagada = await marcarPagada(creada.id as number, '2024-08-15');
    expect(pagada.estado).toBe('pagada');
    expect(pagada.pagadaEl).toBe('2024-08-15');

    const total = await getTotalAbierto();
    expect(total).toBe(0);
  });

  it('actualizarRecargo() cambia el estado de la deuda', async () => {
    const { crearDeuda, actualizarRecargo } = await import('../deudasFiscalesService');
    const creada = await crearDeuda({
      modelo: '303', ejercicio: 2024, periodo: '1T',
      principal: 500, recargoTipo: 'voluntario', recargoImporte: 0,
      total: 500, estado: 'voluntario',
    });
    const apremio = await actualizarRecargo(creada.id as number, 'apremio');
    expect(apremio.estado).toBe('apremio');
  });

  it('getDeudas({estado}) filtra por estado', async () => {
    const { crearDeuda, getDeudas } = await import('../deudasFiscalesService');
    await crearDeuda({
      modelo: '303', ejercicio: 2024, periodo: '3T',
      principal: 1000, recargoTipo: 'voluntario', recargoImporte: 0,
      total: 1000, estado: 'voluntario',
    });
    await crearDeuda({
      modelo: '100', ejercicio: 2023, periodo: 'anual',
      principal: 500, recargoTipo: 'voluntario', recargoImporte: 0,
      total: 500, estado: 'pagada',
      pagadaEl: '2023-12-01',
    });
    const voluntarias = await getDeudas({ estado: 'voluntario' });
    expect(voluntarias).toHaveLength(1);
    expect(voluntarias[0].modelo).toBe('303');
  });
});
