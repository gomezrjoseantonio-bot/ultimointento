// V78 · refactor modelo alquileres v3 · test de schema + migración de datos.
//
// Verifica (Commit 2 de la spec):
//   · DB_VERSION subió a 78 y el store `botesAnualesSinIdentificar` existe con índices
//   · Paso B · Property.modoExplotacion se deriva del legacy alquilerPorHabitaciones.activo
//   · Paso C · Contract.inquilino.cotitulares se inicializa a []
//   · Paso D · Contracts huérfanos sin_identificar se eliminan + treasuryEvents en cascada
//   · La migración es idempotente (flag en keyval) y respeta datos ya correctos
//   · El store botes acepta un round-trip con los campos v3
//
// Nota: el test pre-crea la DB en v77 y deja que `initDB()` la suba a v78. Esto reproduce
// el camino real de producción (Jose ya está en v77) y además evita los bloques de
// migración legacy `< 53` que usan `rawStore.openCursor().then()`, incompatible con
// fake-indexeddb (landmine preexistente · fuera del alcance de esta tarea).
import 'fake-indexeddb/auto';
import { openDB } from 'idb';

const DB_NAME = 'AtlasHorizonDB';

async function seedV77() {
  const legacy = await openDB(DB_NAME, 77, {
    upgrade(db) {
      db.createObjectStore('properties', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('contracts', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('treasuryEvents', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('keyval');
    },
  });
  await legacy.put('properties', { id: 1, alias: 'P1', alquilerPorHabitaciones: { activo: true } });
  await legacy.put('properties', { id: 2, alias: 'P2', alquilerPorHabitaciones: { activo: false } });
  await legacy.put('properties', { id: 3, alias: 'P3' }); // sin info → piso_completo
  await legacy.put('contracts', {
    id: 10, estadoContrato: 'activo',
    inquilino: { nombre: '', apellidos: '', dni: 'NIF-A', telefono: '', email: '' },
  });
  await legacy.put('contracts', {
    id: 11, estadoContrato: 'sin_identificar',
    inquilino: { nombre: '', apellidos: '', dni: '', telefono: '', email: '' },
  });
  await legacy.put('treasuryEvents', { id: 100, type: 'income', sourceType: 'contrato', sourceId: 11, amount: 500 });
  await legacy.put('treasuryEvents', { id: 101, type: 'income', sourceType: 'contrato', sourceId: 10, amount: 600 });
  legacy.close();
}

describe('V78 · migración modelo alquileres v3', () => {
  beforeEach(() => {
    // DB limpia entre tests vía la IDBFactory GLOBAL (registrada por fake-indexeddb/auto);
    // requerir una instancia fresca rompería el wrapping de `idb`. resetModules limpia el
    // singleton dbPromise de db.ts.
    jest.resetModules();
    (globalThis as any).indexedDB = new IDBFactory();
  });

  it('crea store, deriva modoExplotacion, init cotitulares, borra huérfanos + treasuryEvents', async () => {
    await seedV77();

    // initDB abre v78 → upgrade (crea store) + hook post-upgrade (migra datos)
    const { initDB } = require('../db');
    const db = await initDB();

    // ── Schema ──
    expect(db.objectStoreNames.contains('botesAnualesSinIdentificar')).toBe(true);
    const tx = db.transaction('botesAnualesSinIdentificar', 'readonly');
    const idxNames = Array.from(tx.objectStore('botesAnualesSinIdentificar').indexNames);
    expect(idxNames).toEqual(expect.arrayContaining(['inmuebleId', 'inmuebleId-año', 'estado']));
    await tx.done;

    // ── Paso B · modoExplotacion derivado ──
    expect((await db.get('properties', 1)).modoExplotacion).toBe('por_habitaciones');
    expect((await db.get('properties', 2)).modoExplotacion).toBe('piso_completo');
    expect((await db.get('properties', 3)).modoExplotacion).toBe('piso_completo');

    // ── Paso C · cotitulares inicializado en contrato vivo ──
    expect((await db.get('contracts', 10)).inquilino.cotitulares).toEqual([]);

    // ── Paso D · huérfano eliminado + cascada treasuryEvents ──
    expect(await db.get('contracts', 11)).toBeUndefined();
    expect(await db.get('treasuryEvents', 100)).toBeUndefined(); // cascada del huérfano
    expect(await db.get('treasuryEvents', 101)).toBeDefined();    // del contrato vivo · intacto

    // ── Idempotencia ──
    expect(await db.get('keyval', 'migration_v78_alquileres')).toBe('completed');

    // ── Round-trip del store botes con campos v3 ──
    const ahora = new Date().toISOString();
    const boteId = await db.add('botesAnualesSinIdentificar', {
      inmuebleId: 7, año: 2024, importeDeclarado: 17710, díasDeclarados: 365,
      nifsDetectados: [], tiposArrendamientoOriginales: ['vivienda'],
      importeAsignado: 0, saldoPendiente: 17710, estado: 'pendiente_total',
      contractsVinculados: [], fuente: 'xml_aeat',
      fechaImportación: ahora, fechaUltimaModificación: ahora,
    });
    const stored = await db.getFromIndex('botesAnualesSinIdentificar', 'inmuebleId-año', [7, 2024]);
    expect(stored?.id).toBe(boteId);
    expect(stored?.importeDeclarado).toBe(17710);
    expect(stored?.estado).toBe('pendiente_total');
  });
});
