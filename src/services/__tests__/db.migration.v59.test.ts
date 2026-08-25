/**
 * Tests para la migración V5.9.
 *
 * Cubre el cierre del rename objetivos_financieros → escenarios en lo que sigue
 * siendo cierto tras retirar la limpieza legacy del upgrade (#1430):
 *
 *   1. DB en V58 sin `objetivos_financieros` (deploy nuevo)
 *      → abre a la versión vigente, no falla, no crea stores extra.
 *   2. DB ya migrada
 *      → re-abrir no resucita el store viejo.
 */

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
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
  // Almacenamiento nuevo por test (mismo patrón que el resto de suites de `db`).
  // Con el `wipeDB()` a secas, un test que fallaba antes de su `db.close()`
  // dejaba la conexión viva: `deleteDatabase` se quedaba bloqueado y el
  // siguiente `openDB(…, 58)` sobre una base ya en la versión vigente colgaba
  // la suite entera en vez de fallar.
  (globalThis as any).indexedDB = new IDBFactory();
  await wipeDB();
});

describe('DB migration V5.9 — cierre objetivos_financieros', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // RETIRADOS · los dos tests del merge V58 → V59 con el store viejo POBLADO.
  //
  // Comprobaban que al abrir una base V58 con `objetivos_financieros` lleno el
  // upgrade volcaba sus KPI macro en `escenarios` (sin pisar los ya editados a
  // mano) y borraba el store viejo.
  //
  // Ese bloque del upgrade ya no existe: #1430 («DBSchema · Fase 0 · … + borrar
  // limpieza legacy», 19 jul 2026) retiró del callback `upgrade` los 46 bloques
  // de limpieza y migración legacy, por decisión expresa (Adenda 1 opción B) y
  // en coherencia con la política de datos vigente: carga limpia, sin migración
  // ni backfill. Queda escrito en `db.ts:74-77`: «stores legacy borrados …  → su
  // limpieza del upgrade se retiró en Fase 0».
  //
  // Lo que sigue vivo —que una base sin el store viejo abre limpia y con
  // `escenarios`, y que reabrirla no lo resucita— es lo que verifican los dos
  // tests de abajo, que pasan.
  //
  // El producto es el correcto; lo obsoleto era el test.
  // ─────────────────────────────────────────────────────────────────────────

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

    const { initDB, DB_VERSION } = await import('../db');
    const db = await initDB();

    expect(db.version).toBe(DB_VERSION);
    expect(Array.from(db.objectStoreNames)).not.toContain('objetivos_financieros');
    expect(Array.from(db.objectStoreNames)).toContain('escenarios');

    db.close();
  });

  it('re-abrir una DB ya en V59 no relanza la migración ni recrea el store viejo', async () => {
    // Primer arranque: crea V59 desde cero.
    const { initDB, DB_VERSION } = await import('../db');
    const db1 = await initDB();
    expect(db1.version).toBe(DB_VERSION);
    expect(Array.from(db1.objectStoreNames)).not.toContain('objetivos_financieros');
    db1.close();

    // Segundo arranque: re-importar (con dbPromise reseteado vía resetModules).
    jest.resetModules();
    const { initDB: initDB2 } = await import('../db');
    const db2 = await initDB2();
    expect(db2.version).toBe(DB_VERSION);
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
    expect(snapshot.metadata.dbVersion).toBe(dbModule.DB_VERSION);
    expect(snapshot.metadata.storeCount).toBe(realCount);
    expect(snapshot.metadata.stores).toEqual(realStores);
    // El store viejo NO debe aparecer
    expect(snapshot.metadata.stores).not.toContain('objetivos_financieros');
    expect(Object.keys(snapshot.stores)).toEqual(realStores);
  });
});
