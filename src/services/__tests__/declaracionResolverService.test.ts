import 'fake-indexeddb/auto';

import { initDB, SnapshotDeclaracion } from '../db';
import * as irpfCalculationService from '../irpfCalculationService';
import { obtenerDeclaracionParaEjercicio } from '../declaracionResolverService';

const EJERCICIO = 2024;

const declaracionMock = {
  ejercicio: EJERCICIO,
  baseGeneral: { total: 100, rendimientosInmuebles: [] },
  baseAhorro: { total: 0, capitalMobiliario: {}, gananciasYPerdidas: {} },
  reducciones: { total: 0 },
  minimoPersonal: { total: 5550 },
  liquidacion: { baseImponibleGeneral: 100, baseImponibleAhorro: 0, cuotaIntegra: 10, cuotaLiquida: 10, deduccionesDobleImposicion: 0 },
  retenciones: { total: 5 },
  resultado: 5,
  tipoEfectivo: 10,
} as any;

describe('declaracionResolverService', () => {
  beforeEach(async () => {
    jest.restoreAllMocks();
    const db = await initDB();
    await db.clear('snapshotsDeclaracion');
  });

  test('usa snapshot declarado cuando existe una declaración completa importada', async () => {
    const db = await initDB();
    await db.add('snapshotsDeclaracion', {
      ejercicio: EJERCICIO,
      fechaSnapshot: new Date().toISOString(),
      datos: {
        baseGeneral: declaracionMock.baseGeneral,
        baseAhorro: declaracionMock.baseAhorro,
        reducciones: declaracionMock.reducciones,
        minimosPersonales: declaracionMock.minimoPersonal,
        liquidacion: declaracionMock.liquidacion,
        arrastresGenerados: [],
        arrastresAplicados: [],
        declaracionCompleta: declaracionMock,
      },
      origen: 'importacion_manual',
      createdAt: new Date().toISOString(),
    } as SnapshotDeclaracion);

    const result = await obtenerDeclaracionParaEjercicio(EJERCICIO);

    expect(result.fuente).toBe('declarado');
    expect(result.declaracion.resultado).toBe(5);
  });

  test('recalcula en vivo cuando no hay snapshot declarado', async () => {
    jest.spyOn(irpfCalculationService, 'calcularDeclaracionIRPF').mockResolvedValue(declaracionMock);

    const result = await obtenerDeclaracionParaEjercicio(EJERCICIO - 1);

    expect(result.fuente).toBe('vivo');
    expect(irpfCalculationService.calcularDeclaracionIRPF).toHaveBeenCalledWith(EJERCICIO - 1);
  });
});
