// V96 · E3.1b · el store `catalogoProveedores` se va.
//
// Nació en V95 y duró un commit: dejaba `familia`/`subtipo` en DOS sitios para
// la misma pregunta —«¿quién cobra y qué es?»— sin dar nada que `proveedores`
// no pudiera dar, y `proveedores` ya está indexado por NIF, que es justo la
// clave del catálogo.
//
// Ésta es la ÚNICA ruta destructiva del cambio y hasta aquí no tenía test: el
// test de estructura solo mira una base nueva, donde el store no llega a
// existir. Aquí se pre-crea la base en v95 CON el store y una fila dentro, se
// deja que `initDB()` la suba, y se comprueba que el store desaparece y que lo
// de al lado —los proveedores del usuario, con todo lo suyo— sigue intacto.
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { openDB } from 'idb';

const DB_NAME = 'AtlasHorizonDB';

async function sembrarV95() {
  const legacy = await openDB(DB_NAME, 95, {
    upgrade(db) {
      const catalogo = db.createObjectStore('catalogoProveedores', { keyPath: 'id', autoIncrement: true });
      catalogo.createIndex('clave', 'clave', { unique: true });
      catalogo.createIndex('nif', 'nif', { unique: false });
      db.createObjectStore('proveedores', { keyPath: 'nif' });
      db.createObjectStore('keyval');
    },
  });
  await legacy.put('catalogoProveedores', { id: 1, clave: 'nif:A81831067', nombre: 'WiZink', confirmaciones: 3 });
  // Un proveedor del usuario, con su casilla AEAT y lo que el motor aprendió.
  await legacy.put('proveedores', {
    nif: 'B33558172',
    tipos: ['reparacion'],
    familia: 'reparacion_mantenimiento',
    confirmaciones: 2,
    origen: 'cliente',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  legacy.close();
}

describe('V96 · se retira catalogoProveedores', () => {
  beforeEach(() => {
    jest.resetModules();
    (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  });

  it('sube a v96, borra el store y NO toca los proveedores del usuario', async () => {
    await sembrarV95();

    const dbModule = require('../db');
    const db = await dbModule.initDB();

    expect(db.version).toBe(96);
    expect(dbModule.DB_VERSION).toBe(96);
    // El store se fue.
    expect(Array.from(db.objectStoreNames as unknown as string[])).not.toContain('catalogoProveedores');
    // Y `proveedores` sigue con TODO lo suyo: su casilla AEAT, su familia, su
    // recuento. Borrar el store de al lado no puede llevarse esto por delante.
    const proveedor = await db.get('proveedores', 'B33558172');
    expect(proveedor).toMatchObject({
      nif: 'B33558172',
      tipos: ['reparacion'],
      familia: 'reparacion_mantenimiento',
      confirmaciones: 2,
      origen: 'cliente',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    db.close();
  });

  it('una base NUEVA no crea el store en ningún momento', async () => {
    const dbModule = require('../db');
    const db = await dbModule.initDB();
    expect(Array.from(db.objectStoreNames as unknown as string[])).not.toContain('catalogoProveedores');
    expect(db.objectStoreNames.contains('proveedores')).toBe(true);
    db.close();
  });
});
