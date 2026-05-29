// src/services/__tests__/dbV77Migration.test.ts
// Wizard import XML V2 · pilar 1 · V77 migration.
// Migración suave: añade campos opcionales a `properties` (subtipoVivienda,
// anexos.plazasParking, explotacion{estadoOperativo, unidadesArrendables}).
// Decisión de sesión: los 5 stores fiscales NO se eliminan (tienen lectores vivos).

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

const TEST_DB_NAME = 'AtlasHorizonDB';

/** Crea una DB en v76 con una properties store mínima + inmuebles legacy. */
async function seedV76DBWith(properties: any[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open(TEST_DB_NAME, 76);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('keyval')) db.createObjectStore('keyval');
      if (!db.objectStoreNames.contains('properties')) {
        const s = db.createObjectStore('properties', { keyPath: 'id', autoIncrement: true });
        s.createIndex('alias', 'alias', { unique: false });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      if (properties.length === 0) {
        db.close();
        resolve();
        return;
      }
      const tx = db.transaction(['properties'], 'readwrite');
      for (const p of properties) tx.objectStore('properties').add(p);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

describe('DB V77 Migration · wizard import XML V2 · pilar 1', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    (globalThis as any).localStorage = {
      _store: {} as Record<string, string>,
      getItem(k: string) { return this._store[k] ?? null; },
      setItem(k: string, v: string) { this._store[k] = v; },
      removeItem(k: string) { delete this._store[k]; },
      clear() { this._store = {}; },
    };
    jest.resetModules();
  });

  it('inicializa la DB en versión >= 77', async () => {
    const dbModule = await import('../db');
    const db = await dbModule.initDB();
    expect(db.version).toBeGreaterThanOrEqual(77);
    db.close();
  });

  it('migración suave · inmueble pre-V77 sobrevive con campos nuevos undefined', async () => {
    await seedV76DBWith([
      { id: 1, alias: 'Piso pre-V77', state: 'activo', tipoActivo: 'piso', anexos: { tieneParking: true, tieneTrastero: false } },
    ]);

    const dbModule = await import('../db');
    const db = await dbModule.initDB();
    const props = (await (db as any).getAll('properties')) as any[];

    expect(props).toHaveLength(1);
    // Campos nuevos · undefined en data preexistente (migración no inicializa)
    expect(props[0].subtipoVivienda).toBeUndefined();
    expect(props[0].explotacion).toBeUndefined();
    expect(props[0].anexos.plazasParking).toBeUndefined();
    // Campos existentes · intactos
    expect(props[0].tipoActivo).toBe('piso');
    expect(props[0].anexos.tieneParking).toBe(true);
    db.close();
  });

  it('persiste los campos nuevos V77 cuando se escriben', async () => {
    const dbModule = await import('../db');
    const db = await dbModule.initDB();

    const id = await (db as any).add('properties', {
      alias: 'Piso V77',
      state: 'activo',
      tipoActivo: 'otro',
      subtipoVivienda: 'chalet',
      anexos: { tieneParking: true, tieneTrastero: true, plazasParking: 2 },
      explotacion: { estadoOperativo: 'operativo', unidadesArrendables: 3 },
    });

    const saved = (await (db as any).get('properties', id)) as any;
    expect(saved.subtipoVivienda).toBe('chalet');
    expect(saved.anexos.plazasParking).toBe(2);
    expect(saved.explotacion.estadoOperativo).toBe('operativo');
    expect(saved.explotacion.unidadesArrendables).toBe(3);
    db.close();
  });

  it('los 5 stores fiscales NO se eliminan (decisión: tienen lectores vivos)', async () => {
    const dbModule = await import('../db');
    const db = await dbModule.initDB();
    const stores = Array.from(db.objectStoreNames);
    expect(stores).toContain('snapshotsDeclaracion');
    expect(stores).toContain('resultadosEjercicio');
    expect(stores).toContain('arrastresIRPF');
    expect(stores).toContain('aeatCarryForwards');
    expect(stores).toContain('perdidasPatrimonialesAhorro');
    db.close();
  });

  it('idempotencia · abrir dos veces no rompe nada (sigue en v77)', async () => {
    const dbModule = await import('../db');
    const db1 = await dbModule.initDB();
    expect(db1.version).toBeGreaterThanOrEqual(77);
    db1.close();
    jest.resetModules();
    const dbModule2 = await import('../db');
    const db2 = await dbModule2.initDB();
    expect(db2.version).toBeGreaterThanOrEqual(77);
    db2.close();
  });
});
