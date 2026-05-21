// src/services/__tests__/dbV75Migration.test.ts
// T-VALORACIONES PR7b · V75 migration · pre-purge sync + purga campos
// legacy en properties / inversiones / planesPensiones.

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

const TEST_DB_NAME = 'AtlasHorizonDB';

/**
 * Crea una DB en v74 con activos legacy + opcionalmente valoraciones
 * en el store nuevo. Reproduce el estado post-PR1 pero pre-PR7b.
 */
async function seedV74DBWith(opts: {
  properties?: any[];
  inversiones?: any[];
  planesPensiones?: any[];
  valoracionesActivos?: any[];
}): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open(TEST_DB_NAME, 74);
    req.onupgradeneeded = () => {
      const db = req.result;
      // Stores mínimos para que el upgrade no rompa.
      if (!db.objectStoreNames.contains('keyval')) db.createObjectStore('keyval');
      if (!db.objectStoreNames.contains('properties')) {
        const s = db.createObjectStore('properties', { keyPath: 'id', autoIncrement: true });
        s.createIndex('alias', 'alias', { unique: false });
      }
      if (!db.objectStoreNames.contains('inversiones')) {
        const s = db.createObjectStore('inversiones', { keyPath: 'id', autoIncrement: true });
        s.createIndex('tipo', 'tipo', { unique: false });
        s.createIndex('activo', 'activo', { unique: false });
        s.createIndex('entidad', 'entidad', { unique: false });
      }
      if (!db.objectStoreNames.contains('planesPensiones')) {
        const s = db.createObjectStore('planesPensiones', { keyPath: 'id' });
        s.createIndex('estado', 'estado', { unique: false });
      }
      if (!db.objectStoreNames.contains('valoracionesActivos')) {
        const s = db.createObjectStore('valoracionesActivos', { keyPath: 'id', autoIncrement: true });
        s.createIndex('idx_activo', 'activoId', { unique: false });
        s.createIndex('idx_activo_fecha', ['activoId', 'fecha'], { unique: false });
        s.createIndex('idx_tipo', 'tipoActivo', { unique: false });
        s.createIndex('idx_fecha', 'fecha', { unique: false });
        s.createIndex('idx_anchor_fiscal', ['esAnchorFiscal', 'activoId'], { unique: false });
        s.createIndex('idx_tipo_subtipo', ['tipoActivo', 'subtipoInversion'], { unique: false });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      const stores: string[] = [];
      if (opts.properties) stores.push('properties');
      if (opts.inversiones) stores.push('inversiones');
      if (opts.planesPensiones) stores.push('planesPensiones');
      if (opts.valoracionesActivos) stores.push('valoracionesActivos');
      if (stores.length === 0) {
        db.close();
        resolve();
        return;
      }
      const tx = db.transaction(stores as any, 'readwrite');
      for (const p of opts.properties ?? []) tx.objectStore('properties').add(p);
      for (const i of opts.inversiones ?? []) tx.objectStore('inversiones').add(i);
      for (const pl of opts.planesPensiones ?? []) tx.objectStore('planesPensiones').add(pl);
      for (const v of opts.valoracionesActivos ?? []) tx.objectStore('valoracionesActivos').add(v);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

describe('DB V75 Migration · T-VALORACIONES PR7b · purga campos legacy', () => {
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

  it('inicializa la DB en versión >= 75', async () => {
    const dbModule = await import('../db');
    const db = await dbModule.initDB();
    expect(db.version).toBeGreaterThanOrEqual(75);
    db.close();
  });

  it('upgrade v74→v75 · purga valor_actual y valorActual de properties', async () => {
    await seedV74DBWith({
      properties: [
        { id: 1, alias: 'Piso', state: 'activo', valor_actual: 250_000, valorCatastral: 100_000, precioCompra: 200_000 },
      ],
      valoracionesActivos: [
        {
          activoId: '1',
          tipoActivo: 'inmueble',
          fecha: '2024-12-01',
          valor: 250_000,
          origen: 'manual',
          divisaOriginal: 'EUR',
          createdAt: '2024-12-01T00:00:00Z',
          updatedAt: '2024-12-01T00:00:00Z',
          deletedAt: null,
        },
      ],
    });

    const dbModule = await import('../db');
    const db = await dbModule.initDB();
    const props = (await (db as any).getAll('properties')) as any[];

    expect(props).toHaveLength(1);
    expect(props[0].valor_actual).toBeUndefined();
    expect(props[0].valorActual).toBeUndefined();
    // Campos fiscales · NO purgados
    expect(props[0].valorCatastral).toBe(100_000);
    expect(props[0].precioCompra).toBe(200_000);
    db.close();
  });

  it('upgrade v74→v75 · purga valor_actual y cotizacion de inversiones', async () => {
    await seedV74DBWith({
      inversiones: [
        {
          id: 1, nombre: 'ETF', tipo: 'etf', entidad: 'X', activo: true,
          valor_actual: 5000, cotizacion: 100, precioUnitario: 10,
          aportaciones: [], total_aportado: 4000,
          rentabilidad_euros: 1000, rentabilidad_porcentaje: 25,
          created_at: '', updated_at: '',
          precio_medio_compra: 95, // fiscal · NO purgar
        },
      ],
      valoracionesActivos: [
        {
          activoId: '1', tipoActivo: 'inversion',
          fecha: '2024-12-01', valor: 5000, origen: 'manual', divisaOriginal: 'EUR',
          createdAt: '', updatedAt: '', deletedAt: null,
        },
      ],
    });
    const dbModule = await import('../db');
    const db = await dbModule.initDB();
    const all = (await (db as any).getAll('inversiones')) as any[];
    expect(all[0].valor_actual).toBeUndefined();
    expect(all[0].cotizacion).toBeUndefined();
    expect(all[0].precioUnitario).toBeUndefined();
    expect(all[0].precio_medio_compra).toBe(95); // fiscal · conservado
    db.close();
  });

  it('upgrade v74→v75 · purga valorActual de planesPensiones', async () => {
    await seedV74DBWith({
      planesPensiones: [
        { id: 'p1', nombre: 'Plan', estado: 'activo', valorActual: 30_000, valorConsolidado: 30_000, fechaContratacion: '2020-01-15', tipoAdministrativo: 'PPI', titular: 'yo', personalDataId: 1 },
      ],
      valoracionesActivos: [
        {
          activoId: 'p1', tipoActivo: 'plan_pensiones',
          fecha: '2024-12-01', valor: 30_000, origen: 'manual', divisaOriginal: 'EUR',
          createdAt: '', updatedAt: '', deletedAt: null,
        },
      ],
    });
    const dbModule = await import('../db');
    const db = await dbModule.initDB();
    const all = (await (db as any).getAll('planesPensiones')) as any[];
    expect(all[0].valorActual).toBeUndefined();
    expect(all[0].valorConsolidado).toBeUndefined();
    // Campos NO de valoración · conservados
    expect(all[0].fechaContratacion).toBe('2020-01-15');
    expect(all[0].tipoAdministrativo).toBe('PPI');
    db.close();
  });

  it('pre-purge sync · crea valoración para activo con valor legacy sin entrada en servicio', async () => {
    await seedV74DBWith({
      properties: [
        { id: 5, alias: 'Piso sin valoración', state: 'activo', valor_actual: 180_000 },
      ],
      // SIN valoración en el servicio → debe crearse por pre-purge sync
    });
    const dbModule = await import('../db');
    const db = await dbModule.initDB();

    // Tras el upgrade · el campo legacy se purgó pero hay valoración nueva
    const props = (await (db as any).getAll('properties')) as any[];
    expect(props[0].valor_actual).toBeUndefined();

    const valoraciones = (await (db as any).getAll('valoracionesActivos')) as any[];
    expect(valoraciones).toHaveLength(1);
    expect(valoraciones[0].activoId).toBe('5');
    expect(valoraciones[0].tipoActivo).toBe('inmueble');
    expect(valoraciones[0].valor).toBe(180_000);
    expect(valoraciones[0].notas).toContain('Sync pre-purge v75');
    db.close();
  });

  it('pre-purge sync · NO duplica · activo con valoración previa se respeta', async () => {
    await seedV74DBWith({
      properties: [
        { id: 5, alias: 'Piso', state: 'activo', valor_actual: 180_000 },
      ],
      valoracionesActivos: [
        {
          activoId: '5', tipoActivo: 'inmueble',
          fecha: '2024-12-01', valor: 200_000, // diferente al legacy · valoración manual
          origen: 'manual', divisaOriginal: 'EUR',
          createdAt: '', updatedAt: '', deletedAt: null,
        },
      ],
    });
    const dbModule = await import('../db');
    const db = await dbModule.initDB();

    const valoraciones = (await (db as any).getAll('valoracionesActivos')) as any[];
    expect(valoraciones).toHaveLength(1); // no duplicado
    expect(valoraciones[0].valor).toBe(200_000); // respeta la manual
    db.close();
  });

  it('pre-purge sync · inmueble vendido NO se sincroniza', async () => {
    await seedV74DBWith({
      properties: [
        { id: 7, alias: 'Vendido', state: 'vendido', valor_actual: 100_000 },
      ],
    });
    const dbModule = await import('../db');
    const db = await dbModule.initDB();

    const valoraciones = (await (db as any).getAll('valoracionesActivos')) as any[];
    expect(valoraciones).toHaveLength(0);
    db.close();
  });

  it('pre-purge sync · inversion legacy con tipo plan_pensiones se sincroniza como plan', async () => {
    await seedV74DBWith({
      inversiones: [
        {
          id: 9, nombre: 'Plan legacy en inversiones', tipo: 'plan_pensiones',
          activo: true, valor_actual: 25_000,
          entidad: 'X', aportaciones: [], total_aportado: 20_000,
          rentabilidad_euros: 5000, rentabilidad_porcentaje: 25,
          created_at: '', updated_at: '',
        },
      ],
    });
    const dbModule = await import('../db');
    const db = await dbModule.initDB();
    const valoraciones = (await (db as any).getAll('valoracionesActivos')) as any[];
    expect(valoraciones).toHaveLength(1);
    expect(valoraciones[0].tipoActivo).toBe('plan_pensiones');
    expect(valoraciones[0].valor).toBe(25_000);
    db.close();
  });

  it('snapshot localStorage pre-v75 con counts', async () => {
    await seedV74DBWith({
      properties: [
        { id: 1, alias: 'A', state: 'activo', valor_actual: 100_000 },
        { id: 2, alias: 'B', state: 'activo', valor_actual: 200_000 },
      ],
    });
    const dbModule = await import('../db');
    const db = await dbModule.initDB();
    const snapshotRaw = localStorage.getItem('atlas_db_snapshot_pre_v75');
    expect(snapshotRaw).not.toBeNull();
    const snapshot = JSON.parse(snapshotRaw!);
    expect(snapshot.version).toBe(74);
    expect(snapshot.propertiesCount).toBe(2);
    db.close();
  });

  it('idempotencia · abrir dos veces no rompe nada (sigue en v75)', async () => {
    const dbModule = await import('../db');
    const db1 = await dbModule.initDB();
    expect(db1.version).toBeGreaterThanOrEqual(75);
    db1.close();
    jest.resetModules();
    const dbModule2 = await import('../db');
    const db2 = await dbModule2.initDB();
    expect(db2.version).toBeGreaterThanOrEqual(75);
    db2.close();
  });
});
