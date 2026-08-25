// src/services/__tests__/dbV65Migration.test.ts
// Tests for V65 migration (TAREA 13): módulo planes de pensiones.
//   · planesPensiones (nuevo store UUID keyPath)
//   · aportacionesPlan (nuevo store UUID keyPath)
//   · traspasosPlanPensiones (nuevo store autoIncrement)
//   · planesPensionInversion (eliminado)
//   · traspasosPlanes (eliminado)

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

const TEST_DB_NAME = 'AtlasHorizonDB';

describe('DB V65 Migration · TAREA 13 · módulo planes de pensiones', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  it('should initialize database at the current DB_VERSION', async () => {
    const dbModule = await import('../db');
    const db = await dbModule.initDB();
    expect(db.version).toBe(dbModule.DB_VERSION);
    db.close();
  });

  it('should not contain planesPensionInversion or traspasosPlanes on fresh install', async () => {
    const dbModule = await import('../db');
    const db = await dbModule.initDB();

    expect(db.objectStoreNames.contains('planesPensionInversion')).toBe(false);
    expect(db.objectStoreNames.contains('traspasosPlanes')).toBe(false);

    db.close();
  });

  it('should contain planesPensiones, aportacionesPlan, traspasosPlanPensiones', async () => {
    const dbModule = await import('../db');
    const db = await dbModule.initDB();

    expect(db.objectStoreNames.contains('planesPensiones')).toBe(true);
    expect(db.objectStoreNames.contains('aportacionesPlan')).toBe(true);
    expect(db.objectStoreNames.contains('traspasosPlanPensiones')).toBe(true);

    db.close();
  });

  it('should be idempotent (opening twice stays at the current DB_VERSION)', async () => {
    const dbModule = await import('../db');

    const db1 = await dbModule.initDB();
    expect(db1.version).toBe(dbModule.DB_VERSION);
    db1.close();

    jest.resetModules();
    const dbModule2 = await import('../db');

    const db2 = await dbModule2.initDB();
    expect(db2.version).toBe(dbModule.DB_VERSION);
    db2.close();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // RETIRADO · los tests del camino de upgrade desde una base V64.
  //
  // Comprobaban que al abrir una base V64 el upgrade BORRABA `planesPensionInversion`
  // y trasvasaba sus planes a `planesPensiones` infiriendo el tipo administrativo
  // (PPI / PPE).
  //
  // Ese bloque del upgrade ya no existe: #1430 («DBSchema · Fase 0 · … + borrar
  // limpieza legacy», 19 jul 2026) retiró del callback `upgrade` los 46 bloques
  // de limpieza y migración legacy, por decisión expresa (Adenda 1 opción B) y
  // en coherencia con la política de datos vigente: carga limpia, sin migración
  // ni backfill. Queda escrito en `db.ts:74-77`: «stores legacy borrados … → su
  // limpieza del upgrade se retiró en Fase 0».
  //
  // Lo que sigue vivo —que una base FRESCA nace con los stores destino y sin los
  // legacy— es exactamente lo que verifican los tests de arriba, que pasan.
  //
  // El producto es el correcto; lo obsoleto era el test.
  // ─────────────────────────────────────────────────────────────────────────
});
