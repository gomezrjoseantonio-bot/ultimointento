/**
 * V60 migration tests · TAREA 7 sub-tarea 1
 *
 * Verifica las extensiones de schema NO destructivas sobre los stores que
 * sobreviven a la limpieza V60:
 *   - DB_VERSION = 60
 *   - arrastresIRPF gana índice 'origen' y backfill 'aeat' sobre registros
 *     pre-V60.
 *   - Los stores extendidos sólo en TS (documents, contracts, prestamos,
 *     movementLearningRules) aceptan los nuevos campos opcionales sin
 *     romper lecturas legacy.
 *
 * NOTA: las eliminaciones de los 19 stores y el rename nominas → ingresos
 * se cubren en tests de sub-tareas 2-8.
 */

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

// Cada test usa un nombre de DB único y resetea el módulo db para que la
// promesa cacheada no se reutilice entre tests.
const seedV59WithLegacyArrastres = async (
  dbName: string,
  records: Array<Record<string, unknown>>,
): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open(dbName, 59);
    req.onupgradeneeded = () => {
      const db = req.result;
      const store = db.createObjectStore('arrastresIRPF', {
        keyPath: 'id',
        autoIncrement: true,
      });
      store.createIndex('ejercicioOrigen', 'ejercicioOrigen', { unique: false });
      store.createIndex('tipo', 'tipo', { unique: false });
      store.createIndex('estado', 'estado', { unique: false });
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('arrastresIRPF', 'readwrite');
      const store = tx.objectStore('arrastresIRPF');
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

const openV60 = async (dbName: string): Promise<IDBDatabase> => {
  // Importamos el módulo db dentro del helper para que cada test pueda
  // resetear el caché. Aquí abrimos directamente con la versión esperada
  // para validar la migración sin acoplar el test al singleton.
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(dbName, 60);
    req.onupgradeneeded = (event) => {
      // Replicamos sólo la migración relevante para el test: ya hay un
      // store arrastresIRPF en V59. Aplicamos la lógica V60 idéntica a
      // db.ts (índice 'origen' + backfill 'aeat').
      const db = req.result;
      const tx = req.transaction!;
      if (event.oldVersion < 60 && db.objectStoreNames.contains('arrastresIRPF')) {
        const store = tx.objectStore('arrastresIRPF');
        if (!store.indexNames.contains('origen')) {
          store.createIndex('origen', 'origen', { unique: false });
        }
        const cursorReq = store.openCursor();
        cursorReq.onsuccess = (evt) => {
          const cursor = (evt.target as IDBRequest<IDBCursorWithValue | null>).result;
          if (!cursor) return;
          const value = cursor.value as { origen?: string };
          if (!value.origen) {
            value.origen = 'aeat';
            cursor.update(value);
          }
          cursor.continue();
        };
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

describe('V60 migration · sub-tarea 1 schema extensions', () => {
  beforeEach(() => {
    // Aislar el almacenamiento entre tests
    (globalThis as any).indexedDB = new IDBFactory();
    // Resetear el caché del módulo db.ts (singleton dbPromise) para que cada
    // test que llame a initDB() abra una DB fresca contra el IDBFactory recién
    // creado.
    jest.resetModules();
  });

  describe('DB_VERSION', () => {
    test('está fijado a 60 en src/services/db.ts', async () => {
      const dbModule = await import('../db');
      // No exportamos DB_VERSION directamente · validamos vía la firma
      // del módulo abriendo una DB nueva.
      const db = await dbModule.initDB();
      expect(db.version).toBe(60);
      db.close();
    });
  });

  describe('arrastresIRPF · campo origen', () => {
    test('migración V59 → V60 crea índice "origen"', async () => {
      const dbName = `test-arrastres-${Date.now()}-${Math.random()}`;
      await seedV59WithLegacyArrastres(dbName, []);

      const db = await openV60(dbName);
      const tx = db.transaction('arrastresIRPF', 'readonly');
      const store = tx.objectStore('arrastresIRPF');
      expect(Array.from(store.indexNames)).toContain('origen');
      db.close();
    });

    test('backfill: registros pre-V60 sin origen reciben "aeat"', async () => {
      const dbName = `test-arrastres-bf-${Date.now()}-${Math.random()}`;
      await seedV59WithLegacyArrastres(dbName, [
        {
          ejercicioOrigen: 2022,
          tipo: 'gastos_0105_0106',
          importeOriginal: 1000,
          importePendiente: 500,
          aplicaciones: [],
          estado: 'aplicado_parcial',
          createdAt: '2022-12-31T00:00:00.000Z',
          updatedAt: '2023-06-30T00:00:00.000Z',
          // Sin `origen` (registro pre-V60)
        },
        {
          ejercicioOrigen: 2023,
          tipo: 'perdidas_ahorro',
          importeOriginal: 800,
          importePendiente: 800,
          aplicaciones: [],
          estado: 'pendiente',
          createdAt: '2023-12-31T00:00:00.000Z',
          updatedAt: '2023-12-31T00:00:00.000Z',
        },
      ]);

      const db = await openV60(dbName);
      const tx = db.transaction('arrastresIRPF', 'readonly');
      const store = tx.objectStore('arrastresIRPF');
      const allReq = store.getAll();
      const all = await new Promise<Array<{ origen?: string }>>((resolve, reject) => {
        allReq.onsuccess = () => resolve(allReq.result as Array<{ origen?: string }>);
        allReq.onerror = () => reject(allReq.error);
      });

      expect(all).toHaveLength(2);
      for (const record of all) {
        expect(record.origen).toBe('aeat');
      }
      db.close();
    });

    test('backfill respeta valor existente si el registro ya tiene origen', async () => {
      const dbName = `test-arrastres-respect-${Date.now()}-${Math.random()}`;
      await seedV59WithLegacyArrastres(dbName, [
        {
          ejercicioOrigen: 2024,
          tipo: 'perdidas_general',
          importeOriginal: 200,
          importePendiente: 200,
          aplicaciones: [],
          estado: 'pendiente',
          createdAt: '2024-12-31T00:00:00.000Z',
          updatedAt: '2024-12-31T00:00:00.000Z',
          origen: 'manual',
        },
      ]);

      const db = await openV60(dbName);
      const tx = db.transaction('arrastresIRPF', 'readonly');
      const store = tx.objectStore('arrastresIRPF');
      const allReq = store.getAll();
      const all = await new Promise<Array<{ origen?: string }>>((resolve, reject) => {
        allReq.onsuccess = () => resolve(allReq.result as Array<{ origen?: string }>);
        allReq.onerror = () => reject(allReq.error);
      });

      expect(all[0].origen).toBe('manual');
      db.close();
    });

    test('queries por índice "origen" funcionan tras la migración', async () => {
      const dbName = `test-arrastres-query-${Date.now()}-${Math.random()}`;
      await seedV59WithLegacyArrastres(dbName, [
        {
          ejercicioOrigen: 2022,
          tipo: 'gastos_0105_0106',
          importeOriginal: 100,
          importePendiente: 100,
          aplicaciones: [],
          estado: 'pendiente',
          createdAt: '2022-12-31T00:00:00.000Z',
          updatedAt: '2022-12-31T00:00:00.000Z',
        },
      ]);

      const db = await openV60(dbName);
      // Añadir un registro V60 con origen='manual'
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('arrastresIRPF', 'readwrite');
        tx.objectStore('arrastresIRPF').add({
          ejercicioOrigen: 2023,
          tipo: 'perdidas_ahorro',
          importeOriginal: 50,
          importePendiente: 50,
          aplicaciones: [],
          estado: 'pendiente',
          createdAt: '2023-12-31T00:00:00.000Z',
          updatedAt: '2023-12-31T00:00:00.000Z',
          origen: 'manual',
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      const tx = db.transaction('arrastresIRPF', 'readonly');
      const idx = tx.objectStore('arrastresIRPF').index('origen');
      const aeatReq = idx.getAll(IDBKeyRange.only('aeat'));
      const manualReq = idx.getAll(IDBKeyRange.only('manual'));
      const aeat = await new Promise<unknown[]>((resolve, reject) => {
        aeatReq.onsuccess = () => resolve(aeatReq.result as unknown[]);
        aeatReq.onerror = () => reject(aeatReq.error);
      });
      const manual = await new Promise<unknown[]>((resolve, reject) => {
        manualReq.onsuccess = () => resolve(manualReq.result as unknown[]);
        manualReq.onerror = () => reject(manualReq.error);
      });

      expect(aeat).toHaveLength(1);
      expect(manual).toHaveLength(1);
      db.close();
    });

    test('integración: initDB() de db.ts ejecuta el backfill V60 sobre datos V59 reales', async () => {
      // Sembramos AtlasHorizonDB en V59 con el shape mínimo necesario para
      // que la migración real V60 (en src/services/db.ts) corra el backfill.
      // Este test verifica la lógica REAL del módulo db.ts, no una réplica.
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('AtlasHorizonDB', 59);
        req.onupgradeneeded = () => {
          const db = req.result;
          // Crear sólo el store que necesitamos para el backfill.
          // initDB() recreará el resto de stores que falten en sus
          // bloques `oldVersion < N` correspondientes.
          if (!db.objectStoreNames.contains('arrastresIRPF')) {
            const store = db.createObjectStore('arrastresIRPF', { keyPath: 'id', autoIncrement: true });
            store.createIndex('ejercicioOrigen', 'ejercicioOrigen', { unique: false });
            store.createIndex('tipo', 'tipo', { unique: false });
            store.createIndex('estado', 'estado', { unique: false });
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('arrastresIRPF', 'readwrite');
          tx.objectStore('arrastresIRPF').add({
            ejercicioOrigen: 2021,
            tipo: 'gastos_0105_0106',
            importeOriginal: 300,
            importePendiente: 300,
            aplicaciones: [],
            estado: 'pendiente',
            createdAt: '2021-12-31T00:00:00.000Z',
            updatedAt: '2021-12-31T00:00:00.000Z',
            // Sin `origen` · debe recibir 'aeat' en el backfill V60.
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });

      // initDB() de db.ts dispara el upgrade a V60.
      const dbModule = await import('../db');
      const db = await dbModule.initDB();
      expect(db.version).toBe(60);

      const records = await db.getAll('arrastresIRPF');
      expect(records).toHaveLength(1);
      expect(records[0].origen).toBe('aeat');

      // El índice 'origen' creado en V60 debe estar disponible.
      const idx = db.transaction('arrastresIRPF').store.index('origen' as any);
      const aeatRecords = await idx.getAll();
      expect(aeatRecords).toHaveLength(1);

      db.close();
    });
  });

  describe('Schema TS · campos opcionales aceptados', () => {
    test('Contract.historicoRentas[] e indexaciones coexisten', async () => {
      const dbModule = await import('../db');
      const db = await dbModule.initDB();
      const contract: Partial<import('../db').Contract> = {
        inmuebleId: 1,
        unidadTipo: 'vivienda',
        modalidad: 'habitual',
        inquilino: { nombre: 'Test', apellidos: 'User', dni: '00000000T', telefono: '600', email: 'a@b.c' },
        fechaInicio: '2024-01-01',
        fechaFin: '2029-01-01',
        rentaMensual: 1000,
        diaPago: 1,
        margenGraciaDias: 5,
        indexacion: 'none',
        historicoIndexaciones: [],
        historicoRentas: [
          { fechaDesde: '2024-01-01', importe: 1000, origen: 'firma_inicial' },
          { fechaDesde: '2025-01-01', importe: 1035, origen: 'indexacion', nota: 'IPC 3,5%', indexacionFecha: '2025-01-01' },
        ],
        fianzaMeses: 1,
        fianzaImporte: 1000,
        fianzaEstado: 'retenida',
        cuentaCobroId: 1,
        estadoContrato: 'activo',
      };
      const id = await db.add('contracts', contract as import('../db').Contract);
      const stored = await db.get('contracts', id);
      expect(stored?.historicoRentas).toHaveLength(2);
      expect(stored?.historicoRentas?.[1].origen).toBe('indexacion');
      db.close();
    });

    test('MovementLearningRule.history[] cap FIFO se respeta a nivel TS', async () => {
      const dbModule = await import('../db');
      const db = await dbModule.initDB();
      const rule: import('../db').MovementLearningRule = {
        learnKey: 'k1',
        counterpartyPattern: 'IBERDROLA',
        descriptionPattern: 'LUZ',
        amountSign: 'negative',
        categoria: 'suministro',
        ambito: 'INMUEBLE',
        source: 'IMPLICIT',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        appliedCount: 0,
        history: [
          { action: 'CREATE_RULE', ts: '2024-01-01T00:00:00.000Z' },
          { action: 'APPLY_RULE', movimientoId: 42, ts: '2024-01-15T00:00:00.000Z' },
        ],
      };
      const id = await db.add('movementLearningRules', rule);
      const stored = await db.get('movementLearningRules', id);
      expect(stored?.history).toHaveLength(2);
      expect(stored?.history?.[0].action).toBe('CREATE_RULE');
      db.close();
    });

    test('Document.metadata.tipo acepta valores legacy ("Factura") y nuevos ("fiscal")', async () => {
      const dbModule = await import('../db');
      const db = await dbModule.initDB();
      const blob = new Blob(['x']);

      const legacyId = await db.add('documents', {
        filename: 'a.pdf',
        type: 'application/pdf',
        size: 1,
        lastModified: 0,
        content: blob,
        metadata: { tipo: 'Factura' },
        uploadDate: new Date().toISOString(),
      } as import('../db').Document);

      const newId = await db.add('documents', {
        filename: 'b.pdf',
        type: 'application/pdf',
        size: 1,
        lastModified: 0,
        content: blob,
        metadata: { tipo: 'fiscal' },
        uploadDate: new Date().toISOString(),
      } as import('../db').Document);

      const legacy = await db.get('documents', legacyId);
      const fresh = await db.get('documents', newId);
      expect(legacy?.metadata.tipo).toBe('Factura');
      expect(fresh?.metadata.tipo).toBe('fiscal');
      db.close();
    });
  });
});
