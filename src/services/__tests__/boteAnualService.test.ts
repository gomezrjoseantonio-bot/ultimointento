// V78 · refactor modelo alquileres v3 · tests del servicio del Camino 2 (botes anuales).
//
// Cubre CRUD + acumulación, vinculación/desvinculación con recálculo de estado, y la
// heurística de sugerencias. Pre-crea la DB en v77 y deja que initDB la suba a v78 (mismo
// motivo que dbV78AlquileresMigration.test: evita los bloques de migración legacy `< 53`
// incompatibles con fake-indexeddb).
import 'fake-indexeddb/auto';
import { openDB } from 'idb';

const DB_NAME = 'AtlasHorizonDB';

async function seedV77(contracts: any[] = []) {
  const legacy = await openDB(DB_NAME, 77, {
    upgrade(db) {
      db.createObjectStore('properties', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('contracts', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('treasuryEvents', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('keyval');
    },
  });
  for (const c of contracts) await legacy.put('contracts', c);
  legacy.close();
}

describe('boteAnualService · V78 Camino 2', () => {
  beforeEach(() => {
    // DB limpia entre tests: usamos la IDBFactory GLOBAL (registrada por
    // fake-indexeddb/auto). Requerir una instancia fresca de fake-indexeddb daría
    // clases FDBRequest distintas de globalThis.IDBRequest, y `idb` no envolvería los
    // requests (rompe `.then`). resetModules limpia el singleton dbPromise de db.ts.
    jest.resetModules();
    (globalThis as any).indexedDB = new IDBFactory();
  });

  it('crea, acumula múltiples bloques y respeta el índice único (inmueble·año)', async () => {
    await seedV77();
    const { boteAnualService } = require('../boteAnualService');

    const b1 = await boteAnualService.crearOActualizarBote({
      inmuebleId: 5, año: 2024, importeDeclarado: 10000, díasDeclarados: 200,
      nifsDetectados: ['12345678Z'], tiposArrendamientoOriginales: ['vivienda'],
    });
    expect(b1.id).toBeDefined();
    expect(b1.saldoPendiente).toBe(10000);
    expect(b1.estado).toBe('pendiente_total');

    // Segundo bloque del mismo (inmueble·año) → acumula, NO crea otro
    const b2 = await boteAnualService.crearOActualizarBote({
      inmuebleId: 5, año: 2024, importeDeclarado: 2500, díasDeclarados: 200,
      nifsDetectados: ['87654321X'], tiposArrendamientoOriginales: ['no_vivienda'],
    });
    expect(b2.id).toBe(b1.id);
    expect(b2.importeDeclarado).toBe(12500);
    expect(b2.díasDeclarados).toBe(366); // capado
    expect(b2.nifsDetectados.sort()).toEqual(['12345678Z', '87654321X']);
    expect(b2.tiposArrendamientoOriginales.sort()).toEqual(['no_vivienda', 'vivienda']);

    const todos = await boteAnualService.listarBotes();
    expect(todos).toHaveLength(1);
  });

  it('vincular recalcula estado: parcial → cerrado → sobre_asignado, y desvincular revierte', async () => {
    await seedV77();
    const { boteAnualService } = require('../boteAnualService');
    const bote = await boteAnualService.crearOActualizarBote({
      inmuebleId: 1, año: 2023, importeDeclarado: 1000, díasDeclarados: 365,
    });

    let r = await boteAnualService.vincularContract(bote.id, 100, 400, 'manual_usuario');
    expect(r.importeAsignado).toBe(400);
    expect(r.saldoPendiente).toBe(600);
    expect(r.estado).toBe('parcial');

    // Segundo contrato cierra el bote exacto
    r = await boteAnualService.vincularContract(bote.id, 101, 600);
    expect(r.importeAsignado).toBe(1000);
    expect(r.saldoPendiente).toBe(0);
    expect(r.estado).toBe('cerrado');

    // Re-asignar el primer link por encima → sobre_asignado
    r = await boteAnualService.vincularContract(bote.id, 100, 900);
    expect(r.importeAsignado).toBe(1500);
    expect(r.estado).toBe('sobre_asignado');

    // Desvincular el segundo → vuelve a parcial
    r = await boteAnualService.desvincularContract(bote.id, 101);
    expect(r.importeAsignado).toBe(900);
    expect(r.estado).toBe('parcial');
    expect(r.contractsVinculados).toHaveLength(1);
  });

  it('sugerirContracts puntúa por NIF + meses solapados y capa el importe al saldo', async () => {
    await seedV77([
      // Coincide NIF + solapa todo 2024
      {
        id: 100, inmuebleId: 5, estadoContrato: 'activo',
        fechaInicio: '2024-01-01', fechaFin: '2024-12-31', rentaMensual: 1000,
        inquilino: { nombre: '', apellidos: '', dni: '12345678Z', telefono: '', email: '', cotitulares: [] },
      },
      // Mismo inmueble, solapa medio año, sin coincidencia de NIF
      {
        id: 101, inmuebleId: 5, estadoContrato: 'finalizado',
        fechaInicio: '2024-07-01', fechaFin: '2024-12-31', rentaMensual: 500,
        inquilino: { nombre: '', apellidos: '', dni: '99999999A', telefono: '', email: '', cotitulares: [] },
      },
      // Otro inmueble → excluido
      {
        id: 102, inmuebleId: 9, estadoContrato: 'activo',
        fechaInicio: '2024-01-01', fechaFin: '2024-12-31', rentaMensual: 800,
        inquilino: { nombre: '', apellidos: '', dni: '12345678Z', telefono: '', email: '' },
      },
      // Mismo inmueble pero sin solape temporal con 2024 → excluido
      {
        id: 103, inmuebleId: 5, estadoContrato: 'finalizado',
        fechaInicio: '2022-01-01', fechaFin: '2022-12-31', rentaMensual: 700,
        inquilino: { nombre: '', apellidos: '', dni: '11111111H', telefono: '', email: '' },
      },
    ]);
    const { boteAnualService } = require('../boteAnualService');
    const bote = await boteAnualService.crearOActualizarBote({
      inmuebleId: 5, año: 2024, importeDeclarado: 10000, díasDeclarados: 365,
      nifsDetectados: ['12345678Z'],
    });

    const sugs = await boteAnualService.sugerirContracts(bote.id);
    expect(sugs.map((s: any) => s.contractId)).toEqual([100, 101]); // 102 y 103 excluidos

    // El de NIF coincidente va primero, con score alto
    expect(sugs[0].contractId).toBe(100);
    expect(sugs[0].nifCoincide).toBe(true);
    expect(sugs[0].mesesSolapados).toBe(12);
    expect(sugs[0].importeSugerido).toBe(10000); // 12×1000=12000 capado al saldo 10000

    // El segundo: sin NIF, 6 meses, importe 6×500=3000
    expect(sugs[1].contractId).toBe(101);
    expect(sugs[1].nifCoincide).toBe(false);
    expect(sugs[1].mesesSolapados).toBe(6);
    expect(sugs[1].importeSugerido).toBe(3000);

    // Los ya vinculados desaparecen de las sugerencias
    await boteAnualService.vincularContract(bote.id, 100, 10000, 'sugerencia_atlas');
    const sugs2 = await boteAnualService.sugerirContracts(bote.id);
    expect(sugs2.map((s: any) => s.contractId)).toEqual([101]);
  });

  it('getBote / listarPorInmueble / eliminarBote', async () => {
    await seedV77();
    const { boteAnualService } = require('../boteAnualService');
    await boteAnualService.crearOActualizarBote({ inmuebleId: 3, año: 2022, importeDeclarado: 500, díasDeclarados: 100 });
    await boteAnualService.crearOActualizarBote({ inmuebleId: 3, año: 2024, importeDeclarado: 800, díasDeclarados: 100 });

    const porInmueble = await boteAnualService.listarPorInmueble(3);
    expect(porInmueble.map((b: any) => b.año)).toEqual([2024, 2022]); // orden desc

    const uno = await boteAnualService.getBote(3, 2022);
    expect(uno?.importeDeclarado).toBe(500);

    await boteAnualService.eliminarBote(uno!.id);
    expect(await boteAnualService.getBote(3, 2022)).toBeUndefined();
    expect(await boteAnualService.listarPorInmueble(3)).toHaveLength(1);
  });
});
