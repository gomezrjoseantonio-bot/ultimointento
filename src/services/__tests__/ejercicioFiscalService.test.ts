import 'fake-indexeddb/auto';

import { initDB } from '../db';
import * as irpfCalculationService from '../irpfCalculationService';
import {
  cerrarEjercicio,
  declararEjercicio,
  deleteEjercicio,
  getEjercicio,
  getOrCreateEjercicio,
  reabrirEjercicio,
  updateResumen,
} from '../ejercicioFiscalService';

const EJERCICIO = 2024;

function buildDeclaracionMock() {
  return {
    ejercicio: EJERCICIO,
    liquidacion: {
      baseImponibleGeneral: 12000.567,
      baseImponibleAhorro: 3500.333,
      cuotaIntegra: 1800.899,
      deduccionesDobleImposicion: 125.259,
    },
    retenciones: {
      total: 1400.115,
    },
    resultado: 275.455,
  } as any;
}

async function clearEjercicios() {
  const db = await initDB();
  await db.clear('ejerciciosFiscales');
}

describe('ejercicioFiscalService', () => {
  beforeEach(async () => {
    jest.restoreAllMocks();
    await clearEjercicios();
  });

  test('getOrCreateEjercicio crea ejercicio nuevo si no existe', async () => {
    const result = await getOrCreateEjercicio(EJERCICIO);

    expect(result.año).toBe(EJERCICIO);
    expect(result.estado).toBe('vivo');
    expect(result.origen).toBe('calculado');

    const persisted = await getEjercicio(EJERCICIO);
    expect(persisted).toBeDefined();
    expect(persisted?.año).toBe(EJERCICIO);
  });

  test('getOrCreateEjercicio retorna existente si ya hay', async () => {
    const created = await getOrCreateEjercicio(EJERCICIO);
    const found = await getOrCreateEjercicio(EJERCICIO);

    expect(found.id).toBe(created.id);
    expect(found.createdAt).toBe(created.createdAt);
  });

  test('updateResumen rellena el campo resumen desde el motor IRPF', async () => {
    jest.spyOn(irpfCalculationService, 'calcularDeclaracionIRPF').mockResolvedValue(buildDeclaracionMock());

    const updated = await updateResumen(EJERCICIO);

    expect(updated.resumen).toEqual({
      baseImponibleGeneral: 12000.57,
      baseImponibleAhorro: 3500.33,
      cuotaIntegra: 1800.9,
      deducciones: 125.26,
      retencionesYPagos: 1400.12,
      resultado: 275.46,
    });
  });

  test('cerrarEjercicio cambia estado de vivo a cerrado', async () => {
    jest.spyOn(irpfCalculationService, 'calcularDeclaracionIRPF').mockResolvedValue(buildDeclaracionMock());

    const cerrado = await cerrarEjercicio(EJERCICIO);

    expect(cerrado.estado).toBe('cerrado');
    expect(cerrado.fechaCierre).toBeDefined();
  });

  test('cerrarEjercicio lanza error si estado no es vivo', async () => {
    jest.spyOn(irpfCalculationService, 'calcularDeclaracionIRPF').mockResolvedValue(buildDeclaracionMock());
    await cerrarEjercicio(EJERCICIO);

    await expect(cerrarEjercicio(EJERCICIO)).rejects.toThrow('No se puede cerrar');
  });

  test('reabrirEjercicio cambia estado de cerrado a vivo', async () => {
    jest.spyOn(irpfCalculationService, 'calcularDeclaracionIRPF').mockResolvedValue(buildDeclaracionMock());
    await cerrarEjercicio(EJERCICIO);

    const reabierto = await reabrirEjercicio(EJERCICIO);

    expect(reabierto.estado).toBe('vivo');
    expect(reabierto.fechaCierre).toBeUndefined();
  });

  test('declararEjercicio cambia estado de cerrado a declarado', async () => {
    jest.spyOn(irpfCalculationService, 'calcularDeclaracionIRPF').mockResolvedValue(buildDeclaracionMock());
    await cerrarEjercicio(EJERCICIO);

    const declarado = await declararEjercicio(EJERCICIO);

    expect(declarado.estado).toBe('declarado');
    expect(declarado.fechaDeclaracion).toBeDefined();
  });

  test('declararEjercicio lanza error si estado es vivo (debe cerrarse primero)', async () => {
    await getOrCreateEjercicio(EJERCICIO);

    await expect(declararEjercicio(EJERCICIO)).rejects.toThrow('Primero debe cerrarse');
  });

  test('deleteEjercicio solo funciona si estado es vivo', async () => {
    await getOrCreateEjercicio(EJERCICIO);

    await deleteEjercicio(EJERCICIO);

    const result = await getEjercicio(EJERCICIO);
    expect(result).toBeUndefined();
  });

  test('deleteEjercicio lanza error si estado es cerrado o declarado', async () => {
    jest.spyOn(irpfCalculationService, 'calcularDeclaracionIRPF').mockResolvedValue(buildDeclaracionMock());

    await cerrarEjercicio(EJERCICIO);
    await expect(deleteEjercicio(EJERCICIO)).rejects.toThrow('No se puede borrar');

    await declararEjercicio(EJERCICIO);
    await expect(deleteEjercicio(EJERCICIO)).rejects.toThrow('No se puede borrar');
  });
});
