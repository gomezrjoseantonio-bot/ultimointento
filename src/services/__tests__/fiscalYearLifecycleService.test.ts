import 'fake-indexeddb/auto';

import { initDB } from '../db';
import * as conciliationService from '../fiscalConciliationService';
import * as ejercicioFiscalService from '../ejercicioFiscalService';
import * as snapshotService from '../snapshotDeclaracionService';
import {
  cerrarEjercicioValidado,
  importarDeclaracionEjercicio,
  revisarCierreEjercicio,
} from '../fiscalYearLifecycleService';

const EJERCICIO = 2024;

describe('fiscalYearLifecycleService', () => {
  beforeEach(async () => {
    jest.restoreAllMocks();
    const db = await initDB();
    await db.clear('ejerciciosFiscalesCoord');
    await db.clear('snapshotsDeclaracion');
  });

  test('revisarCierreEjercicio marca error crítico si cobertura de punteo es insuficiente', async () => {
    jest.spyOn(conciliationService, 'conciliarEjercicioFiscal').mockResolvedValue({
      ejercicio: EJERCICIO,
      generatedAt: new Date().toISOString(),
      lineas: [],
      resumen: {
        totalEstimado: 1000,
        totalReal: 200,
        totalDesviacion: -800,
        coberturaPunteo: 10,
        mesesConReal: 1,
        mesesTotales: 10,
      },
      porCategoria: {},
    });

    const revision = await revisarCierreEjercicio(EJERCICIO, { minCoberturaPunteo: 70 });
    expect(revision.puedeCerrar).toBe(false);
    expect(revision.incoherencias.some((i) => i.tipo === 'cobertura_punteo')).toBe(true);
  });

  test('cerrarEjercicioValidado cierra y asocia snapshot', async () => {
    jest.spyOn(conciliationService, 'conciliarEjercicioFiscal').mockResolvedValue({
      ejercicio: EJERCICIO,
      generatedAt: new Date().toISOString(),
      lineas: [],
      resumen: {
        totalEstimado: 1000,
        totalReal: 980,
        totalDesviacion: -20,
        coberturaPunteo: 95,
        mesesConReal: 19,
        mesesTotales: 20,
      },
      porCategoria: {},
    });

    jest.spyOn(ejercicioFiscalService, 'cerrarEjercicio').mockResolvedValue({
      año: EJERCICIO,
      estado: 'cerrado',
      origen: 'calculado',
      fechaCierre: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    jest.spyOn(snapshotService, 'crearSnapshotDeclaracion').mockResolvedValue({
      id: 33,
      ejercicio: EJERCICIO,
      fechaSnapshot: new Date().toISOString(),
      datos: {
        baseGeneral: {},
        baseAhorro: {},
        reducciones: {},
        minimosPersonales: {},
        liquidacion: {},
        arrastresGenerados: [],
        arrastresAplicados: [],
      },
      origen: 'cierre_automatico',
      createdAt: new Date().toISOString(),
    });

    const out = await cerrarEjercicioValidado(EJERCICIO);
    expect(out.estado).toBe('cerrado');
    expect(out.snapshotId).toBe(33);
  });

  test('importarDeclaracionEjercicio deja ejercicio declarado con origen importado/mixto', async () => {
    jest.spyOn(snapshotService, 'crearSnapshotDeclaracionManual').mockResolvedValue({
      id: 77,
      ejercicio: EJERCICIO - 1,
      fechaSnapshot: new Date().toISOString(),
      datos: {
        baseGeneral: {},
        baseAhorro: {},
        reducciones: {},
        minimosPersonales: {},
        liquidacion: {},
        arrastresGenerados: [],
        arrastresAplicados: [],
      },
      casillasAEAT: { '0435': 1000 },
      origen: 'importacion_manual',
      createdAt: new Date().toISOString(),
    });

    const result = await importarDeclaracionEjercicio(EJERCICIO - 1, {
      casillasAEAT: { '0435': 1000 },
    });

    expect(result.snapshotId).toBe(77);
    expect(result.ejercicioFiscal.estado).toBe('declarado');
    expect(['importado', 'mixto']).toContain(result.ejercicioFiscal.origen);
  });
});
