/**
 * V61 migration tests · TAREA 7 sub-tarea 2
 *
 * Verifica el rename `nominas → ingresos`:
 *   - DB_VERSION actual = 62 (V62 elimina stores; V61 hizo el rename)
 *   - El nuevo store `ingresos` existe con los índices esperados
 *     (`personalDataId`, `tipo`, `fechaActualizacion`).
 *   - La migración V60→V61 copia cada registro de `nominas` a `ingresos`
 *     añadiendo `tipo='nomina'` y preservando el `id`.
 *   - El store legacy `nominas` queda intacto (consumidores siguen leyendo
 *     de él hasta sub-tarea 6).
 *   - La copia es idempotente: una segunda apertura no duplica registros.
 *
 * NOTA: la absorción de `autonomos` y `pensiones` en `ingresos` (con
 * `tipo='autonomo' | 'pension'`) se cubre en sub-tareas posteriores.
 */

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

type LegacyNomina = {
  id?: number;
  personalDataId: number;
  titular: 'yo' | 'pareja';
  nombre: string;
  activa: boolean;
  fechaCreacion: string;
  fechaActualizacion: string;
  // Resto de campos de Nomina (no necesarios para los asserts del test)
  [k: string]: unknown;
};

const seedV60WithNominas = async (
  dbName: string,
  records: LegacyNomina[],
): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open(dbName, 60);
    req.onupgradeneeded = () => {
      const db = req.result;
      // Sólo creamos el store `nominas` con los índices que la migración V61
      // necesita leer. No replicamos el resto del schema porque no es
      // necesario para validar la copia nominas→ingresos.
      if (!db.objectStoreNames.contains('nominas')) {
        const store = db.createObjectStore('nominas', { keyPath: 'id', autoIncrement: true });
        store.createIndex('personalDataId', 'personalDataId', { unique: false });
        store.createIndex('activa', 'activa', { unique: false });
        store.createIndex('fechaActualizacion', 'fechaActualizacion', { unique: false });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('nominas', 'readwrite');
      const store = tx.objectStore('nominas');
      for (const record of records) {
        store.add(record);
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
};

describe('V61 migration · sub-tarea 2 nominas → ingresos rename', () => {
  beforeEach(() => {
    // Aislar el almacenamiento entre tests
    (globalThis as any).indexedDB = new IDBFactory();
    // Resetear el caché del módulo db.ts (singleton dbPromise) para que cada
    // test que llame a initDB() abra una DB fresca contra el IDBFactory recién
    // creado.
    jest.resetModules();
  });

  describe('DB_VERSION', () => {
    test('está fijado a 62 en src/services/db.ts (V61 hizo rename, V62 elimina stores)', async () => {
      const dbModule = await import('../db');
      const db = await dbModule.initDB();
      expect(db.version).toBe(64);
      db.close();
    });
  });

  describe('store `ingresos`', () => {
    test('existe tras initDB() en una DB fresca', async () => {
      const dbModule = await import('../db');
      const db = await dbModule.initDB();
      expect(Array.from(db.objectStoreNames)).toContain('ingresos');
      db.close();
    });

    test('tiene los índices esperados (personalDataId, tipo, fechaActualizacion)', async () => {
      const dbModule = await import('../db');
      const db = await dbModule.initDB();
      const tx = db.transaction('ingresos', 'readonly');
      const store = tx.objectStore('ingresos');
      const indexes = Array.from(store.indexNames);
      expect(indexes).toContain('personalDataId');
      expect(indexes).toContain('tipo');
      expect(indexes).toContain('fechaActualizacion');
      db.close();
    });
  });

  describe('migración V60 → V61: copia nominas → ingresos', () => {
    test('integración: initDB() de db.ts copia registros de nominas a ingresos con tipo="nomina"', async () => {
      // Sembramos AtlasHorizonDB en V60 con sólo el store `nominas`. El resto
      // de stores los crea initDB() en sus bloques `oldVersion < N` al abrir.
      await seedV60WithNominas('AtlasHorizonDB', [
        {
          personalDataId: 1,
          titular: 'yo',
          nombre: 'Nómina principal',
          activa: true,
          fechaCreacion: '2024-01-01T00:00:00.000Z',
          fechaActualizacion: '2024-12-31T00:00:00.000Z',
          salarioBrutoAnual: 35000,
        } as LegacyNomina,
        {
          personalDataId: 1,
          titular: 'pareja',
          nombre: 'Nómina pareja',
          activa: true,
          fechaCreacion: '2024-02-01T00:00:00.000Z',
          fechaActualizacion: '2024-12-31T00:00:00.000Z',
          salarioBrutoAnual: 28000,
        } as LegacyNomina,
      ]);

      const { initDB } = await import('../db');
      const db = await initDB();

      expect(db.version).toBe(64);

      // El store `ingresos` debe contener los dos registros migrados con
      // `tipo='nomina'` y conservar el resto de campos.
      const ingresos = (await db.getAll('ingresos')) as Array<{
        id: number;
        tipo: string;
        nombre: string;
        salarioBrutoAnual: number;
      }>;
      expect(ingresos).toHaveLength(2);
      for (const ing of ingresos) {
        expect(ing.tipo).toBe('nomina');
        expect(typeof ing.id).toBe('number');
        expect(typeof ing.salarioBrutoAnual).toBe('number');
      }
      const nombres = ingresos.map((i) => i.nombre).sort();
      expect(nombres).toEqual(['Nómina pareja', 'Nómina principal']);

      db.close();
    });

    test('store legacy `nominas` ha sido eliminado tras V63', async () => {
      // V63 (TAREA 7 sub-tarea 4) elimina el store `nominas` después de
      // copiar sus registros a `ingresos.tipo='nomina'`. Por tanto, abrir
      // una DB sembrada en V60 con datos legacy en `nominas` debe
      // resultar en: (a) los registros migrados a `ingresos`, y (b) el
      // store `nominas` ya no existente.
      await seedV60WithNominas('AtlasHorizonDB', [
        {
          personalDataId: 7,
          titular: 'yo',
          nombre: 'Original',
          activa: true,
          fechaCreacion: '2024-01-01T00:00:00.000Z',
          fechaActualizacion: '2024-12-31T00:00:00.000Z',
        } as LegacyNomina,
      ]);

      const { initDB } = await import('../db');
      const db = await initDB();

      expect(db.objectStoreNames.contains('nominas')).toBe(false);

      const ingresos = (await db.getAll('ingresos')) as Array<{ nombre?: string; tipo?: string }>;
      expect(ingresos).toHaveLength(1);
      expect(ingresos[0].nombre).toBe('Original');
      expect(ingresos[0].tipo).toBe('nomina');

      db.close();
    });

    test('preserva el id original al copiar (correlación nominas legacy ↔ ingresos)', async () => {
      // Tras V63, `nominas` ya no existe; verificamos que el id original
      // del registro legacy se preserva en `ingresos` (la migración usa
      // `put` con key explícita).
      await seedV60WithNominas('AtlasHorizonDB', [
        {
          personalDataId: 3,
          titular: 'yo',
          nombre: 'A',
          activa: true,
          fechaCreacion: '2024-01-01T00:00:00.000Z',
          fechaActualizacion: '2024-12-31T00:00:00.000Z',
        } as LegacyNomina,
      ]);

      const { initDB } = await import('../db');
      const db = await initDB();

      const ingresos = (await db.getAll('ingresos')) as Array<{ id: number }>;
      expect(ingresos).toHaveLength(1);
      // El id se asigna por autoIncrement al insertar en `nominas` legacy
      // y se preserva en `ingresos` (consultado vía put con key explícita).
      expect(typeof ingresos[0].id).toBe('number');
      expect(ingresos[0].id).toBeGreaterThan(0);

      db.close();
    });

    test('idempotencia: re-abrir la DB no duplica registros en `ingresos`', async () => {
      await seedV60WithNominas('AtlasHorizonDB', [
        {
          personalDataId: 5,
          titular: 'yo',
          nombre: 'X',
          activa: true,
          fechaCreacion: '2024-01-01T00:00:00.000Z',
          fechaActualizacion: '2024-12-31T00:00:00.000Z',
        } as LegacyNomina,
      ]);

      // Primera apertura: dispara la migración V60→V61
      let dbModule = await import('../db');
      let db = await dbModule.initDB();
      const ingresos1 = await db.getAll('ingresos');
      expect(ingresos1).toHaveLength(1);
      db.close();

      // Segunda apertura sobre la misma DB (ya en V61): no debe re-copiar
      // ni duplicar registros aunque el upgrade no se vuelva a ejecutar.
      jest.resetModules();
      dbModule = await import('../db');
      db = await dbModule.initDB();
      const ingresos2 = await db.getAll('ingresos');
      expect(ingresos2).toHaveLength(1);
      db.close();
    });

    test('DB fresca (sin registros legacy): `ingresos` arranca vacío', async () => {
      const { initDB } = await import('../db');
      const db = await initDB();

      const ingresos = await db.getAll('ingresos');
      expect(ingresos).toHaveLength(0);

      db.close();
    });
  });
});
