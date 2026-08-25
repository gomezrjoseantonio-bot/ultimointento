// src/services/__tests__/dbV62Migration.test.ts
// Tests for V62 migration: eliminate 11 duplicate/fossil stores

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

describe('DB V62 Migration', () => {
  beforeEach(() => {
    // Isolate storage between tests
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  it('should initialize database at the current DB_VERSION', async () => {
    const dbModule = await import('../db');
    const db = await dbModule.initDB();
    expect(db.version).toBe(dbModule.DB_VERSION);
    db.close();
  });

  it('should not contain the 11 eliminated stores', async () => {
    const dbModule = await import('../db');
    const db = await dbModule.initDB();
    
    const eliminatedStores = [
      'kpiConfigurations',
      'configuracion_fiscal',
      'treasuryRecommendations',
      'valoraciones_mensuales',
      'patrimonioSnapshots',
      'operacionesProveedor',
      'patronGastosPersonales',
      'gastosPersonalesReal',
      'opexRules',
      'rentaMensual',
      'ejerciciosFiscales',
    ];

    for (const storeName of eliminatedStores) {
      expect(db.objectStoreNames.contains(storeName)).toBe(false);
    }

    db.close();
  });

  it('should still contain essential stores', async () => {
    const dbModule = await import('../db');
    const db = await dbModule.initDB();
    
    const essentialStores = [
      'properties',
      'accounts',
      'movements',
      'treasuryEvents',
      'ingresos',
      'proveedores',
      'compromisosRecurrentes',
      'ejerciciosFiscalesCoord',
      // V74 · el store `valoraciones_historicas` se renombró a `valoracionesActivos`
      // (`db.ts:190` · `db/upgrade-a.ts:383`). El rename es el producto correcto;
      // esta lista se quedó con el nombre viejo.
      'valoracionesActivos',
      'keyval',
    ];

    for (const storeName of essentialStores) {
      expect(db.objectStoreNames.contains(storeName)).toBe(true);
    }

    db.close();
  });

  it('should be idempotent (opening twice stays at the current DB_VERSION)', async () => {
    const dbModule = await import('../db');
    
    const db1 = await dbModule.initDB();
    expect(db1.version).toBe(dbModule.DB_VERSION);
    db1.close();

    // Reset to force a new connection
    jest.resetModules();
    const dbModule2 = await import('../db');
    
    const db2 = await dbModule2.initDB();
    expect(db2.version).toBe(dbModule.DB_VERSION);
    db2.close();
  });

  // RETIRADO · «should successfully delete stores from a V61 DB».
  //
  // Comprobaba que al abrir una base V61 el upgrade BORRABA los 11 stores que V62
  // dejó de crear. Esa limpieza ya no existe: #1430 («DBSchema · Fase 0 … + borrar
  // limpieza legacy», 19 jul 2026) retiró del upgrade los 46 bloques de limpieza
  // legacy, entre ellos el `if (oldVersion < 62) { … deleteObjectStore(…) }`, por
  // decisión expresa (Adenda 1 opción B) y en coherencia con la política de datos
  // vigente: carga limpia, sin migración ni backfill. Una base fresca no llega a
  // crear esos stores —eso es lo que sigue verificando el test de arriba— y un
  // camino de upgrade desde V61 ya no se soporta.
  //
  // El producto es el correcto; lo obsoleto era el test.
});
