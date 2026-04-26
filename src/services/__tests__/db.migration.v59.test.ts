/**
 * Tests para la migración V5.9.
 *
 * Cubre los 3 escenarios críticos del cierre forzoso del rename
 * objetivos_financieros → escenarios:
 *
 *   1. DB en V58 con `objetivos_financieros` poblado y `escenarios` con id=1
 *      → V59 mergea KPI macro faltantes y elimina el store viejo.
 *   2. DB en V58 sin `objetivos_financieros` (deploy nuevo)
 *      → V59 idempotente, no falla, no crea stores extra.
 *   3. DB ya en V59
 *      → re-abrir no relanza la migración ni recrea el store viejo.
 */

import 'fake-indexeddb/auto';
import { openDB } from 'idb';

const DB_NAME = 'AtlasHorizonDB';

// Reset del singleton dbPromise entre tests para forzar reconexión limpia.
async function wipeDB() {
  await new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve(true);
  });
}

beforeEach(async () => {
  jest.resetModules();
  await wipeDB();
});

describe('DB migration V5.9 — cierre objetivos_financieros', () => {
  it('mergea KPI macro del store viejo al escenario nuevo y elimina objetivos_financieros', async () => {
    // ── Arrange: DB en V58 con datos en objetivos_financieros
    //   y un escenario nuevo SIN algunos KPI macro.
    const dbV58 = await openDB(DB_NAME, 58, {
      upgrade(db) {
        db.createObjectStore('objetivos_financieros', { keyPath: 'id' });
        db.createObjectStore('escenarios', { keyPath: 'id' });
      },
    });

    await dbV58.put('objetivos_financieros', {
      id: 1,
      rentaPasivaObjetivo: 4500,
      patrimonioNetoObjetivo: 750000,
      cajaMinima: 15000,
      dtiMaximo: 30,
      ltvMaximo: 45,
      yieldMinimaCartera: 9,
      tasaAhorroMinima: 20,
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    await dbV58.put('escenarios', {
      id: 1,
      modoVivienda: 'propia',
      gastosVidaLibertadMensual: 3500,
      estrategia: 'agresivo',
      hitos: [],
      // NOTA: no metemos los KPI macro · deberían heredarse del viejo.
      updatedAt: '2026-01-15T00:00:00.000Z',
    });
    dbV58.close();

    // ── Act: importar db.ts e initDB → dispara V59
    const { initDB } = await import('../db');
    const db = await initDB();

    // ── Assert
    expect(db.version).toBe(59);
    const stores = Array.from(db.objectStoreNames);
    expect(stores).not.toContain('objetivos_financieros');
    expect(stores).toContain('escenarios');

    const escenario = await db.get('escenarios', 1);
    expect(escenario).toBeDefined();
    // Los campos del escenario nuevo se preservan
    expect(escenario.modoVivienda).toBe('propia');
    expect(escenario.estrategia).toBe('agresivo');
    expect(escenario.gastosVidaLibertadMensual).toBe(3500);
    // KPI macro heredados del store viejo
    expect(escenario.rentaPasivaObjetivo).toBe(4500);
    expect(escenario.patrimonioNetoObjetivo).toBe(750000);
    expect(escenario.cajaMinima).toBe(15000);
    expect(escenario.dtiMaximo).toBe(30);
    expect(escenario.ltvMaximo).toBe(45);
    expect(escenario.yieldMinimaCartera).toBe(9);
    expect(escenario.tasaAhorroMinima).toBe(20);
    expect(escenario.id).toBe(1);

    db.close();
  });

  it('preserva los KPI macro YA presentes en escenarios cuando ambos stores los tienen', async () => {
    // El usuario editó manualmente `escenarios` antes del fix V59.
    // V59 NO debe sobrescribir esos valores con los del store viejo.
    const dbV58 = await openDB(DB_NAME, 58, {
      upgrade(db) {
        db.createObjectStore('objetivos_financieros', { keyPath: 'id' });
        db.createObjectStore('escenarios', { keyPath: 'id' });
      },
    });

    await dbV58.put('objetivos_financieros', {
      id: 1,
      rentaPasivaObjetivo: 1000, // ← valor antiguo
      cajaMinima: 5000,
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    await dbV58.put('escenarios', {
      id: 1,
      modoVivienda: 'alquiler',
      gastosVidaLibertadMensual: 2500,
      estrategia: 'hibrido',
      hitos: [],
      rentaPasivaObjetivo: 5000, // ← valor que el usuario editó
      cajaMinima: 20000,
      updatedAt: '2026-02-01T00:00:00.000Z',
    });
    dbV58.close();

    const { initDB } = await import('../db');
    const db = await initDB();

    const escenario = await db.get('escenarios', 1);
    expect(escenario.rentaPasivaObjetivo).toBe(5000); // preservado
    expect(escenario.cajaMinima).toBe(20000); // preservado
    expect(Array.from(db.objectStoreNames)).not.toContain('objetivos_financieros');

    db.close();
  });

  it('es idempotente cuando el store viejo no existe (deploy nuevo)', async () => {
    // Simulamos un deploy nuevo donde V5.5 ya consiguió eliminar el store
    // viejo. La DB sale de V58 sin objetivos_financieros.
    const dbV58 = await openDB(DB_NAME, 58, {
      upgrade(db) {
        // SOLO escenarios — sin store viejo.
        db.createObjectStore('escenarios', { keyPath: 'id' });
      },
    });
    await dbV58.put('escenarios', {
      id: 1,
      modoVivienda: 'alquiler',
      gastosVidaLibertadMensual: 2500,
      estrategia: 'hibrido',
      hitos: [],
      updatedAt: '2026-02-01T00:00:00.000Z',
    });
    dbV58.close();

    const { initDB } = await import('../db');
    const db = await initDB();

    expect(db.version).toBe(59);
    expect(Array.from(db.objectStoreNames)).not.toContain('objetivos_financieros');
    expect(Array.from(db.objectStoreNames)).toContain('escenarios');

    db.close();
  });

  it('re-abrir una DB ya en V59 no relanza la migración ni recrea el store viejo', async () => {
    // Primer arranque: crea V59 desde cero.
    const { initDB } = await import('../db');
    const db1 = await initDB();
    expect(db1.version).toBe(59);
    expect(Array.from(db1.objectStoreNames)).not.toContain('objetivos_financieros');
    db1.close();

    // Segundo arranque: re-importar (con dbPromise reseteado vía resetModules).
    jest.resetModules();
    const { initDB: initDB2 } = await import('../db');
    const db2 = await initDB2();
    expect(db2.version).toBe(59);
    expect(Array.from(db2.objectStoreNames)).not.toContain('objetivos_financieros');
    db2.close();
  });
});

describe('window.atlasDB · exposición programática', () => {
  it('expone exportSnapshotJSON, listStores y getDBVersion en window', async () => {
    // El módulo `db.ts` ejecuta exposeAtlasDBHandle() al cargarse.
    await import('../db');

    const handle: any = (window as unknown as { atlasDB: any }).atlasDB;
    expect(handle).toBeDefined();
    expect(typeof handle.exportSnapshot).toBe('function');
    expect(typeof handle.exportSnapshotJSON).toBe('function');
    expect(typeof handle.importSnapshot).toBe('function');
    expect(typeof handle.getDBVersion).toBe('function');
    expect(typeof handle.listStores).toBe('function');
  });

  it('exportSnapshotJSON itera dinámicamente sobre todos los stores reales y reporta storeCount correcto', async () => {
    const dbModule = await import('../db');
    const db = await dbModule.initDB();
    const realCount = db.objectStoreNames.length;
    const realStores = Array.from(db.objectStoreNames);
    // No cerramos `db` aquí — el snapshot reusará la conexión singleton.

    const snapshot = await dbModule.exportSnapshotJSON();
    expect(snapshot.metadata.dbVersion).toBe(59);
    expect(snapshot.metadata.storeCount).toBe(realCount);
    expect(snapshot.metadata.stores).toEqual(realStores);
    // El store viejo NO debe aparecer
    expect(snapshot.metadata.stores).not.toContain('objetivos_financieros');
    expect(Object.keys(snapshot.stores)).toEqual(realStores);
  });
});
