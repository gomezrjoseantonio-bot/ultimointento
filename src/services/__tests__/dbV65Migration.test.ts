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

  it('should initialize database at version 65', async () => {
    const dbModule = await import('../db');
    const db = await dbModule.initDB();
    expect(db.version).toBe(65);
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

  it('should be idempotent (opening twice stays at version 65)', async () => {
    const dbModule = await import('../db');

    const db1 = await dbModule.initDB();
    expect(db1.version).toBe(65);
    db1.close();

    jest.resetModules();
    const dbModule2 = await import('../db');

    const db2 = await dbModule2.initDB();
    expect(db2.version).toBe(65);
    db2.close();
  });

  it('should migrate inversiones[tipo=plan_pensiones] to planesPensiones and infer PPI', async () => {
    // Create a V64 DB with a plan_pensiones in inversiones
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(TEST_DB_NAME, 64);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('keyval')) {
          db.createObjectStore('keyval');
        }
        if (!db.objectStoreNames.contains('ingresos')) {
          const s = db.createObjectStore('ingresos', { keyPath: 'id', autoIncrement: true });
          s.createIndex('personalDataId', 'personalDataId', { unique: false });
          s.createIndex('tipo', 'tipo', { unique: false });
        }
        if (!db.objectStoreNames.contains('prestamos')) {
          db.createObjectStore('prestamos', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('inversiones')) {
          const s = db.createObjectStore('inversiones', { keyPath: 'id', autoIncrement: true });
          s.createIndex('tipo', 'tipo', { unique: false });
          s.createIndex('activo', 'activo', { unique: false });
          s.createIndex('entidad', 'entidad', { unique: false });
        }
        if (!db.objectStoreNames.contains('planesPensionInversion')) {
          const s = db.createObjectStore('planesPensionInversion', { keyPath: 'id', autoIncrement: true });
          s.createIndex('personalDataId', 'personalDataId', { unique: false });
          s.createIndex('tipo', 'tipo', { unique: false });
          s.createIndex('titularidad', 'titularidad', { unique: false });
          s.createIndex('esHistorico', 'esHistorico', { unique: false });
          s.createIndex('fechaActualizacion', 'fechaActualizacion', { unique: false });
        }
        if (!db.objectStoreNames.contains('traspasosPlanes')) {
          const s = db.createObjectStore('traspasosPlanes', { keyPath: 'id', autoIncrement: true });
          s.createIndex('personalDataId', 'personalDataId', { unique: false });
          s.createIndex('planOrigenId', 'planOrigenId', { unique: false });
          s.createIndex('planDestinoId', 'planDestinoId', { unique: false });
          s.createIndex('fecha', 'fecha', { unique: false });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(['inversiones'], 'readwrite');
        tx.objectStore('inversiones').add({
          nombre: 'Mi plan individual',
          tipo: 'plan_pensiones',
          entidad: 'CaixaBank Vida',
          valor_actual: 5000,
          total_aportado: 4500,
          activo: true,
          personalDataId: 1,
          aportaciones: [
            { id: 1, fecha: '2023-06-01', importe: 1500, tipo: 'aportacion' },
            { id: 2, fecha: '2024-06-01', importe: 1500, tipo: 'aportacion' },
          ],
          created_at: '2023-01-01T00:00:00Z',
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });

    const dbModule = await import('../db');
    const db65 = await dbModule.initDB();

    expect(db65.version).toBe(65);
    expect(db65.objectStoreNames.contains('planesPensionInversion')).toBe(false);
    expect(db65.objectStoreNames.contains('traspasosPlanes')).toBe(false);

    const planes = (await db65.getAll('planesPensiones')) as any[];
    expect(planes.length).toBeGreaterThanOrEqual(1);
    const planMigrado = planes.find((p: any) => p.nombre === 'Mi plan individual');
    expect(planMigrado).toBeDefined();
    expect(planMigrado.tipoAdministrativo).toBe('PPI');
    expect(planMigrado.gestoraActual).toBe('CaixaBank Vida');

    db65.close();
  });

  it('should infer PPE when empresa data is present in planesPensionInversion', async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(TEST_DB_NAME, 64);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('keyval')) db.createObjectStore('keyval');
        if (!db.objectStoreNames.contains('ingresos')) {
          const s = db.createObjectStore('ingresos', { keyPath: 'id', autoIncrement: true });
          s.createIndex('personalDataId', 'personalDataId', { unique: false });
          s.createIndex('tipo', 'tipo', { unique: false });
        }
        if (!db.objectStoreNames.contains('prestamos')) db.createObjectStore('prestamos', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('inversiones')) {
          const s = db.createObjectStore('inversiones', { keyPath: 'id', autoIncrement: true });
          s.createIndex('tipo', 'tipo', { unique: false });
          s.createIndex('activo', 'activo', { unique: false });
          s.createIndex('entidad', 'entidad', { unique: false });
        }
        if (!db.objectStoreNames.contains('planesPensionInversion')) {
          const s = db.createObjectStore('planesPensionInversion', { keyPath: 'id', autoIncrement: true });
          s.createIndex('personalDataId', 'personalDataId', { unique: false });
          s.createIndex('tipo', 'tipo', { unique: false });
          s.createIndex('titularidad', 'titularidad', { unique: false });
          s.createIndex('esHistorico', 'esHistorico', { unique: false });
          s.createIndex('fechaActualizacion', 'fechaActualizacion', { unique: false });
        }
        if (!db.objectStoreNames.contains('traspasosPlanes')) {
          const s = db.createObjectStore('traspasosPlanes', { keyPath: 'id', autoIncrement: true });
          s.createIndex('personalDataId', 'personalDataId', { unique: false });
          s.createIndex('planOrigenId', 'planOrigenId', { unique: false });
          s.createIndex('planDestinoId', 'planDestinoId', { unique: false });
          s.createIndex('fecha', 'fecha', { unique: false });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(['planesPensionInversion'], 'readwrite');
        tx.objectStore('planesPensionInversion').add({
          personalDataId: 1,
          nombre: 'Plan empleo empresa',
          tipo: 'plan-pensiones',
          empresaNif: 'A12345678',
          empresaNombre: 'Empresa Test SL',
          aportacionesRealizadas: 8000,
          valorCompra: 0,
          valorActual: 9000,
          titularidad: 'yo',
          esHistorico: false,
          historialAportaciones: {
            '2023': { titular: 4000, empresa: 4000, total: 8000, fuente: 'xml_aeat' },
          },
          fechaCreacion: '2023-01-01T00:00:00Z',
          fechaActualizacion: '2023-12-31T00:00:00Z',
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });

    const dbModule = await import('../db');
    const db65 = await dbModule.initDB();

    expect(db65.version).toBe(65);

    const planes = (await db65.getAll('planesPensiones')) as any[];
    const planPPE = planes.find((p: any) => p.nombre === 'Plan empleo empresa');
    expect(planPPE).toBeDefined();
    expect(planPPE.tipoAdministrativo).toBe('PPE');
    expect(planPPE.subtipoPPE).toBe('empleador_unico');

    // Verificar aportaciones migradas
    const aportaciones = (await db65.getAll('aportacionesPlan')) as any[];
    const aps = aportaciones.filter((a: any) => a.planId === planPPE.id);
    expect(aps.length).toBeGreaterThanOrEqual(1);
    const ap2023 = aps.find((a: any) => a.ejercicioFiscal === 2023);
    expect(ap2023).toBeDefined();
    expect(ap2023.importeTitular).toBe(4000);
    expect(ap2023.importeEmpresa).toBe(4000);

    db65.close();
  });

  it('should migrate traspasosPlanes to traspasosPlanPensiones', async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(TEST_DB_NAME, 64);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('keyval')) db.createObjectStore('keyval');
        if (!db.objectStoreNames.contains('ingresos')) {
          const s = db.createObjectStore('ingresos', { keyPath: 'id', autoIncrement: true });
          s.createIndex('personalDataId', 'personalDataId', { unique: false });
          s.createIndex('tipo', 'tipo', { unique: false });
        }
        if (!db.objectStoreNames.contains('prestamos')) db.createObjectStore('prestamos', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('inversiones')) {
          const s = db.createObjectStore('inversiones', { keyPath: 'id', autoIncrement: true });
          s.createIndex('tipo', 'tipo', { unique: false });
          s.createIndex('activo', 'activo', { unique: false });
          s.createIndex('entidad', 'entidad', { unique: false });
        }
        if (!db.objectStoreNames.contains('planesPensionInversion')) {
          const s = db.createObjectStore('planesPensionInversion', { keyPath: 'id', autoIncrement: true });
          s.createIndex('personalDataId', 'personalDataId', { unique: false });
          s.createIndex('tipo', 'tipo', { unique: false });
          s.createIndex('titularidad', 'titularidad', { unique: false });
          s.createIndex('esHistorico', 'esHistorico', { unique: false });
          s.createIndex('fechaActualizacion', 'fechaActualizacion', { unique: false });
        }
        if (!db.objectStoreNames.contains('traspasosPlanes')) {
          const s = db.createObjectStore('traspasosPlanes', { keyPath: 'id', autoIncrement: true });
          s.createIndex('personalDataId', 'personalDataId', { unique: false });
          s.createIndex('planOrigenId', 'planOrigenId', { unique: false });
          s.createIndex('planDestinoId', 'planDestinoId', { unique: false });
          s.createIndex('fecha', 'fecha', { unique: false });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(['traspasosPlanes'], 'readwrite');
        tx.objectStore('traspasosPlanes').add({
          personalDataId: 1,
          planOrigenId: 1,
          planDestinoId: 2,
          planOrigenNombre: 'Plan A',
          planDestinoNombre: 'Plan B',
          planOrigenEntidad: 'Gestora A',
          planDestinoEntidad: 'Gestora B',
          fecha: '2023-06-15',
          importe: 5000,
          esTotal: false,
          fechaCreacion: '2023-06-15T12:00:00Z',
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });

    const dbModule = await import('../db');
    const db65 = await dbModule.initDB();

    expect(db65.version).toBe(65);
    expect(db65.objectStoreNames.contains('traspasosPlanes')).toBe(false);

    const traspasos = (await db65.getAll('traspasosPlanPensiones')) as any[];
    expect(traspasos.length).toBeGreaterThanOrEqual(1);
    const t = traspasos[0];
    expect(t.fechaEjecucion).toBe('2023-06-15');
    expect(t.gestoraOrigen).toBe('Gestora A');
    expect(t.gestoraDestino).toBe('Gestora B');
    expect(t.importeTraspasado).toBe(5000);

    db65.close();
  });
});
