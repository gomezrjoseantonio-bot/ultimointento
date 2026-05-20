// src/services/__tests__/dbV74Migration.test.ts
// T-VALORACIONES PR1 · V74 Migration · rename `valoraciones_historicas` →
// `valoracionesActivos` con transformación de schema:
//   · snake_case → camelCase
//   · fecha YYYY-MM → YYYY-MM-01
//   · activo_id number|string → string
//   · origen 'importacion' → 'import_csv', 'api_externa' → 'api_gestora'
//   · 5 índices nuevos

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

const TEST_DB_NAME = 'AtlasHorizonDB';

/**
 * Crea una DB en v73 con el store `valoraciones_historicas` antiguo y los
 * registros pasados como semilla. Solo crea los stores mínimos necesarios
 * para que el upgrade a v74 no rompa por dependencias laterales.
 */
async function seedV73DBWith(
  records: Array<Record<string, unknown>>,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open(TEST_DB_NAME, 73);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('keyval')) {
        db.createObjectStore('keyval');
      }
      if (!db.objectStoreNames.contains('valoraciones_historicas')) {
        const s = db.createObjectStore('valoraciones_historicas', {
          keyPath: 'id',
          autoIncrement: true,
        });
        s.createIndex('tipo_activo', 'tipo_activo', { unique: false });
        s.createIndex('activo_id', 'activo_id', { unique: false });
        s.createIndex('fecha_valoracion', 'fecha_valoracion', { unique: false });
        s.createIndex('tipo-activo-fecha', ['tipo_activo', 'activo_id', 'fecha_valoracion'], {
          unique: false,
        });
        s.createIndex('tipo-activo', ['tipo_activo', 'activo_id'], { unique: false });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      if (records.length === 0) {
        db.close();
        resolve();
        return;
      }
      const tx = db.transaction(['valoraciones_historicas'], 'readwrite');
      const store = tx.objectStore('valoraciones_historicas');
      for (const r of records) {
        store.add(r);
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

describe('DB V74 Migration · T-VALORACIONES PR1 · valoracionesActivos', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    (globalThis as any).localStorage = {
      _store: {} as Record<string, string>,
      getItem(k: string) {
        return this._store[k] ?? null;
      },
      setItem(k: string, v: string) {
        this._store[k] = v;
      },
      removeItem(k: string) {
        delete this._store[k];
      },
      clear() {
        this._store = {};
      },
    };
    jest.resetModules();
  });

  it('inicializa la DB en versión 74', async () => {
    const dbModule = await import('../db');
    const db = await dbModule.initDB();
    expect(db.version).toBe(74);
    db.close();
  });

  it('fresh install · crea valoracionesActivos · NO crea valoraciones_historicas', async () => {
    const dbModule = await import('../db');
    const db = await dbModule.initDB();

    expect(db.objectStoreNames.contains('valoracionesActivos')).toBe(true);
    expect(db.objectStoreNames.contains('valoraciones_historicas')).toBe(false);

    db.close();
  });

  it('fresh install · valoracionesActivos tiene 6 índices con los nombres esperados', async () => {
    const dbModule = await import('../db');
    const db = await dbModule.initDB();

    const tx = db.transaction('valoracionesActivos', 'readonly');
    const store = tx.objectStore('valoracionesActivos');
    expect(store.keyPath).toBe('id');
    expect(store.autoIncrement).toBe(true);
    expect(store.indexNames.contains('idx_activo')).toBe(true);
    expect(store.indexNames.contains('idx_activo_fecha')).toBe(true);
    expect(store.indexNames.contains('idx_tipo')).toBe(true);
    expect(store.indexNames.contains('idx_fecha')).toBe(true);
    expect(store.indexNames.contains('idx_anchor_fiscal')).toBe(true);
    expect(store.indexNames.contains('idx_tipo_subtipo')).toBe(true);

    db.close();
  });

  it('upgrade v73→v74 · borra valoraciones_historicas tras migrar los datos', async () => {
    await seedV73DBWith([
      {
        tipo_activo: 'inmueble',
        activo_id: 42,
        activo_nombre: 'Piso Madrid',
        fecha_valoracion: '2024-03',
        valor: 250000,
        origen: 'manual',
        created_at: '2024-03-15T10:00:00Z',
        updated_at: '2024-03-15T10:00:00Z',
      },
    ]);

    const dbModule = await import('../db');
    const db74 = await dbModule.initDB();

    expect(db74.version).toBe(74);
    expect(db74.objectStoreNames.contains('valoraciones_historicas')).toBe(false);
    expect(db74.objectStoreNames.contains('valoracionesActivos')).toBe(true);

    db74.close();
  });

  it('upgrade v73→v74 · transforma snake_case → camelCase y fecha YYYY-MM → YYYY-MM-01', async () => {
    await seedV73DBWith([
      {
        tipo_activo: 'inversion',
        activo_id: 7,
        activo_nombre: 'Fondo Indexa',
        fecha_valoracion: '2024-06',
        valor: 12345.67,
        origen: 'importacion',
        notas: 'Original',
        created_at: '2024-06-30T23:59:00Z',
        updated_at: '2024-07-01T08:00:00Z',
      },
    ]);

    const dbModule = await import('../db');
    const db74 = await dbModule.initDB();
    const all = (await db74.getAll('valoracionesActivos')) as any[];

    expect(all).toHaveLength(1);
    const v = all[0];
    expect(v.activoId).toBe('7');                    // string
    expect(typeof v.activoId).toBe('string');
    expect(v.tipoActivo).toBe('inversion');
    expect(v.fecha).toBe('2024-06-01');              // YYYY-MM-DD
    expect(v.valor).toBe(12345.67);
    expect(v.divisaOriginal).toBe('EUR');
    expect(v.origen).toBe('import_csv');             // 'importacion' → 'import_csv'
    expect(v.notas).toContain('Original');
    expect(v.notas).toContain('Migrado v73→v74');
    expect(v.notas).toContain('Fondo Indexa');
    expect(v.esAnchorFiscal).toBe(false);
    expect(v.createdAt).toBe('2024-06-30T23:59:00Z');
    expect(typeof v.updatedAt).toBe('string');
    expect(v.deletedAt).toBeNull();

    db74.close();
  });

  it('upgrade v73→v74 · normaliza activo_id (number|string) a string en todos los casos', async () => {
    await seedV73DBWith([
      { tipo_activo: 'inmueble', activo_id: 42, fecha_valoracion: '2024-01', valor: 100, origen: 'manual', created_at: '', updated_at: '' },
      { tipo_activo: 'plan_pensiones', activo_id: 'uuid-abc-123', fecha_valoracion: '2024-02', valor: 200, origen: 'manual', created_at: '', updated_at: '' },
      { tipo_activo: 'inversion', activo_id: '99', fecha_valoracion: '2024-03', valor: 300, origen: 'manual', created_at: '', updated_at: '' },
    ]);

    const dbModule = await import('../db');
    const db74 = await dbModule.initDB();
    const all = (await db74.getAll('valoracionesActivos')) as any[];

    expect(all).toHaveLength(3);
    for (const v of all) {
      expect(typeof v.activoId).toBe('string');
    }
    const ids = all.map((v) => v.activoId).sort();
    expect(ids).toEqual(['42', '99', 'uuid-abc-123']);

    db74.close();
  });

  it('upgrade v73→v74 · mapea correctamente origen (manual/importacion/api_externa)', async () => {
    await seedV73DBWith([
      { tipo_activo: 'inmueble', activo_id: 1, fecha_valoracion: '2024-01', valor: 100, origen: 'manual', created_at: '', updated_at: '' },
      { tipo_activo: 'inmueble', activo_id: 2, fecha_valoracion: '2024-01', valor: 100, origen: 'importacion', created_at: '', updated_at: '' },
      { tipo_activo: 'inmueble', activo_id: 3, fecha_valoracion: '2024-01', valor: 100, origen: 'api_externa', created_at: '', updated_at: '' },
      { tipo_activo: 'inmueble', activo_id: 4, fecha_valoracion: '2024-01', valor: 100, origen: 'desconocido' as any, created_at: '', updated_at: '' },
    ]);

    const dbModule = await import('../db');
    const db74 = await dbModule.initDB();
    const all = (await db74.getAll('valoracionesActivos')) as any[];

    const byActivo = new Map(all.map((v) => [v.activoId, v]));
    expect(byActivo.get('1').origen).toBe('manual');
    expect(byActivo.get('2').origen).toBe('import_csv');
    expect(byActivo.get('3').origen).toBe('api_gestora');
    expect(byActivo.get('4').origen).toBe('seed_migracion_v74'); // fallback

    db74.close();
  });

  it('upgrade v73→v74 · preserva el COUNT exacto de registros (datos no se pierden)', async () => {
    const records: Array<Record<string, unknown>> = [];
    for (let i = 0; i < 50; i++) {
      records.push({
        tipo_activo: ['inmueble', 'inversion', 'plan_pensiones'][i % 3],
        activo_id: i,
        fecha_valoracion: `2024-${String((i % 12) + 1).padStart(2, '0')}`,
        valor: 1000 + i,
        origen: 'manual',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      });
    }
    await seedV73DBWith(records);

    const dbModule = await import('../db');
    const db74 = await dbModule.initDB();
    const all = (await db74.getAll('valoracionesActivos')) as any[];

    expect(all).toHaveLength(50);
    db74.close();
  });

  it('upgrade v73→v74 · guarda snapshot en localStorage antes de migrar', async () => {
    await seedV73DBWith([
      {
        tipo_activo: 'inmueble',
        activo_id: 1,
        fecha_valoracion: '2024-01',
        valor: 100,
        origen: 'manual',
        created_at: '',
        updated_at: '',
      },
    ]);

    const dbModule = await import('../db');
    const db74 = await dbModule.initDB();

    const snapshotRaw = localStorage.getItem('atlas_db_snapshot_pre_v74');
    expect(snapshotRaw).not.toBeNull();
    const snapshot = JSON.parse(snapshotRaw!);
    expect(snapshot.version).toBe(73);
    expect(snapshot.recordsCount).toBe(1);
    expect(snapshot.records).toHaveLength(1);
    expect(snapshot.records[0].tipo_activo).toBe('inmueble');
    expect(typeof snapshot.timestamp).toBe('string');

    db74.close();
  });

  it('idempotencia · abrir dos veces no rompe nada (sigue en v74)', async () => {
    const dbModule = await import('../db');
    const db1 = await dbModule.initDB();
    expect(db1.version).toBe(74);
    db1.close();

    jest.resetModules();
    const dbModule2 = await import('../db');
    const db2 = await dbModule2.initDB();
    expect(db2.version).toBe(74);
    expect(db2.objectStoreNames.contains('valoracionesActivos')).toBe(true);
    expect(db2.objectStoreNames.contains('valoraciones_historicas')).toBe(false);
    db2.close();
  });

  it('upgrade v73→v74 · registro con fecha ya en YYYY-MM-DD se preserva sin cambios', async () => {
    await seedV73DBWith([
      {
        tipo_activo: 'inmueble',
        activo_id: 1,
        fecha_valoracion: '2024-03-15', // ya completa
        valor: 100,
        origen: 'manual',
        created_at: '',
        updated_at: '',
      },
    ]);

    const dbModule = await import('../db');
    const db74 = await dbModule.initDB();
    const all = (await db74.getAll('valoracionesActivos')) as any[];

    expect(all).toHaveLength(1);
    expect(all[0].fecha).toBe('2024-03-15');
    db74.close();
  });

  it('upgrade v73→v74 vacío · no crea registros pero borra el store viejo', async () => {
    await seedV73DBWith([]); // 0 registros

    const dbModule = await import('../db');
    const db74 = await dbModule.initDB();

    expect(db74.objectStoreNames.contains('valoraciones_historicas')).toBe(false);
    expect(db74.objectStoreNames.contains('valoracionesActivos')).toBe(true);
    const all = (await db74.getAll('valoracionesActivos')) as any[];
    expect(all).toHaveLength(0);

    db74.close();
  });
});
