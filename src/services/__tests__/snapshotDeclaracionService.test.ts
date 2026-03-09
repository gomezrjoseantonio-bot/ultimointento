import 'fake-indexeddb/auto';

import { initDB, SnapshotDeclaracion } from '../db';
import * as irpfCalculationService from '../irpfCalculationService';
import {
  crearSnapshotDeclaracion,
  crearSnapshotDeclaracionManual,
  listarSnapshotsDeclaracion,
  obtenerSnapshotDeclaracion,
  verificarIntegridadSnapshot,
} from '../snapshotDeclaracionService';

const EJERCICIO = 2024;

function buildDeclaracionMock() {
  return {
    ejercicio: EJERCICIO,
    baseGeneral: { total: 25000, rendimientosInmuebles: [] },
    baseAhorro: { total: 1200, capitalMobiliario: {}, gananciasYPerdidas: {} },
    reducciones: { ppEmpleado: 0, ppEmpresa: 0, ppIndividual: 0, planPensiones: 0, total: 0 },
    minimoPersonal: { contribuyente: 5550, descendientes: 0, ascendientes: 0, discapacidad: 0, total: 5550 },
    liquidacion: {
      baseImponibleGeneral: 19450,
      baseImponibleAhorro: 1200,
      cuotaBaseGeneral: 3500,
      cuotaBaseAhorro: 228,
      cuotaMinimosBaseGeneral: 900,
      cuotaIntegra: 2828,
      deduccionesDobleImposicion: 120,
      cuotaLiquida: 2708,
    },
    retenciones: { trabajo: 1000, autonomoM130: 0, capitalMobiliario: 50, total: 1050 },
    resultado: 1658,
    tipoEfectivo: 0.13,
    conciliacion: { ok: true },
  } as any;
}

async function clearStores() {
  const db = await initDB();
  await db.clear('snapshotsDeclaracion');
  await db.clear('arrastresIRPF');
}

async function seedArrastres() {
  const now = new Date().toISOString();
  const db = await initDB();

  const generatedId = await db.add('arrastresIRPF', {
    ejercicioOrigen: EJERCICIO,
    tipo: 'otros',
    importeOriginal: 100,
    importePendiente: 100,
    aplicaciones: [],
    estado: 'pendiente',
    createdAt: now,
    updatedAt: now,
  });

  const appliedId = await db.add('arrastresIRPF', {
    ejercicioOrigen: EJERCICIO - 1,
    tipo: 'otros',
    importeOriginal: 90,
    importePendiente: 0,
    aplicaciones: [{ ejercicio: EJERCICIO, importe: 90, fecha: now }],
    estado: 'aplicado_total',
    createdAt: now,
    updatedAt: now,
  });

  return { generatedId: Number(generatedId), appliedId: Number(appliedId) };
}

describe('snapshotDeclaracionService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await clearStores();
    jest.spyOn(irpfCalculationService, 'calcularDeclaracionIRPF').mockResolvedValue(buildDeclaracionMock());
  });

  test('create snapshot: persiste estructura completa', async () => {
    const { generatedId, appliedId } = await seedArrastres();

    const snapshot = await crearSnapshotDeclaracion(EJERCICIO, { incluirCasillasAEAT: true });

    expect(snapshot.id).toBeDefined();
    expect(snapshot.datos.baseGeneral.total).toBe(25000);
    expect(snapshot.datos.minimosPersonales.total).toBe(5550);
    expect(snapshot.datos.arrastresGenerados).toEqual([generatedId]);
    expect(snapshot.datos.arrastresAplicados).toEqual([appliedId]);
    expect(snapshot.casillasAEAT).toBeDefined();
    expect(irpfCalculationService.calcularDeclaracionIRPF).toHaveBeenCalledWith(EJERCICIO, { usarConciliacion: true });
  });

  test('idempotencia: segunda llamada sin force no duplica', async () => {
    const first = await crearSnapshotDeclaracion(EJERCICIO, { origen: 'cierre_automatico' });
    const second = await crearSnapshotDeclaracion(EJERCICIO, { origen: 'cierre_automatico' });

    expect(second.id).toBe(first.id);

    const listed = await listarSnapshotsDeclaracion();
    expect(listed).toHaveLength(1);
  });

  test('force: segunda llamada con force sí duplica', async () => {
    const first = await crearSnapshotDeclaracion(EJERCICIO, { origen: 'cierre_automatico' });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await crearSnapshotDeclaracion(EJERCICIO, { origen: 'cierre_automatico', force: true });

    expect(second.id).not.toBe(first.id);

    const listed = await listarSnapshotsDeclaracion();
    expect(listed).toHaveLength(2);
  });

  test('integridad: hash coincide tras crear snapshot', async () => {
    const snapshot = await crearSnapshotDeclaracion(EJERCICIO);
    const result = await verificarIntegridadSnapshot(snapshot.id as number);

    expect(snapshot.hash).toBeTruthy();
    expect(result.ok).toBe(true);
    expect(result.hashActual).toBe(result.hashGuardado);
  });

  test('listado y obtenerSnapshotDeclaracion: orden descendente por fecha y retorna el último', async () => {
    const older = await crearSnapshotDeclaracion(EJERCICIO, { origen: 'importacion_manual' });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const latest = await crearSnapshotDeclaracion(EJERCICIO, { origen: 'importacion_manual', force: true });

    const listed = await listarSnapshotsDeclaracion();
    expect(listed[0].id).toBe(latest.id);
    expect(listed[1].id).toBe(older.id);

    const ultimo = await obtenerSnapshotDeclaracion(EJERCICIO);
    expect(ultimo?.id).toBe(latest.id);
  });

  test('verificarIntegridadSnapshot detecta manipulación del payload', async () => {
    const snapshot = await crearSnapshotDeclaracion(EJERCICIO);
    const db = await initDB();
    const stored = (await db.get('snapshotsDeclaracion', snapshot.id as number)) as SnapshotDeclaracion;

    stored.datos.reducciones.total = 9999;
    await db.put('snapshotsDeclaracion', stored);

    const result = await verificarIntegridadSnapshot(snapshot.id as number);
    expect(result.ok).toBe(false);
  });

  test('crearSnapshotDeclaracionManual persiste casillas y arrastres importados offline', async () => {
    const snapshot = await crearSnapshotDeclaracionManual(EJERCICIO - 1, {
      casillasAEAT: { '0435': 18000, '0560': 2200, '0670': 150 },
      datos: {
        baseGeneral: { total: 18000 },
        minimosPersonales: { total: 5550 },
        liquidacion: { cuotaIntegra: 2200, cuotaLiquida: 2050, deduccionesDobleImposicion: 150 },
      },
      arrastresGenerados: [{ tipo: 'otros', ejercicioOrigen: EJERCICIO - 1, importePendiente: 340 }],
    });

    expect(snapshot.origen).toBe('importacion_manual');
    expect(snapshot.casillasAEAT?.['0435']).toBe(18000);
    expect(snapshot.datos.arrastresGenerados.length).toBe(1);

    const db = await initDB();
    const arrastres = await db.getAllFromIndex('arrastresIRPF', 'ejercicioOrigen', EJERCICIO - 1);
    expect(arrastres.length).toBe(1);
  });
});
