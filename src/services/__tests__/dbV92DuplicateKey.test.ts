// V92 · E1.6 · limpieza tras el corte · el índice `duplicate-key` se va.
//
// Nació en H8 «para detectar duplicados» y nunca tuvo un lector (grep de
// alcance a cero en src/ · el import deduplica por `hashMovement` en memoria).
// El test pre-crea la base en v91 CON el índice, como la tiene Jose, y deja que
// `initDB()` la suba a v92: el índice desaparece y los otros cuatro del store
// `movements` se conservan, con sus datos.
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { openDB } from 'idb';

const DB_NAME = 'AtlasHorizonDB';

async function seedV91ConIndice() {
  const legacy = await openDB(DB_NAME, 91, {
    upgrade(db) {
      const movements = db.createObjectStore('movements', { keyPath: 'id', autoIncrement: true });
      movements.createIndex('accountId', 'accountId', { unique: false });
      movements.createIndex('date', 'date', { unique: false });
      movements.createIndex('status', 'status', { unique: false });
      movements.createIndex('importBatch', 'importBatch', { unique: false });
      movements.createIndex('duplicate-key', ['accountId', 'date', 'amount', 'description'], { unique: false });
      db.createObjectStore('keyval');
    },
  });
  await legacy.put('movements', { id: 7, accountId: 42, date: '2026-09-01', amount: -98.44, description: 'Recibo' });
  legacy.close();
}

describe('V92 · retirar el índice duplicate-key de movements', () => {
  beforeEach(() => {
    jest.resetModules();
    (globalThis as any).indexedDB = new IDBFactory();
  });

  it('sube a v92, borra el índice y conserva los otros cuatro y los datos', async () => {
    await seedV91ConIndice();

    const dbModule = require('../db');
    const db = await dbModule.initDB();
    expect(db.version).toBe(92);
    expect(dbModule.DB_VERSION).toBe(92);

    const indices = Array.from(db.transaction('movements').store.indexNames as DOMStringList).sort();
    expect(indices).toEqual(['accountId', 'date', 'importBatch', 'status']);
    expect(await db.get('movements', 7)).toMatchObject({ accountId: 42, amount: -98.44 });
    db.close();
  });

  it('una base nueva nace ya sin el índice', async () => {
    const dbModule = require('../db');
    const db = await dbModule.initDB();
    const indices = Array.from(db.transaction('movements').store.indexNames as DOMStringList).sort();
    expect(indices).toEqual(['accountId', 'date', 'importBatch', 'status']);
    db.close();
  });
});
