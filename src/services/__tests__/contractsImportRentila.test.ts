// V78.1 (Extra 2) · hook post-create del import Rentila.
//
// Cubre la decisión acordada (alcance "solo cotitulares, sin tocar fechaFin"):
//   · altas Rentila inicializan inquilino.cotitulares = []
//   · re-import NO machaca cotitulares existentes (merge-safe)
//   · fechaFin se toma del fichero tal cual (Rentila es autoritativa · NO se aplica LAU +5y)
import 'fake-indexeddb/auto';

const DB_NAME = 'AtlasHorizonDB';

async function seedProperty() {
  const { openDB } = require('idb');
  const db = await openDB(DB_NAME, 78, {
    upgrade(d: any) {
      d.createObjectStore('properties', { keyPath: 'id', autoIncrement: true });
      d.createObjectStore('contracts', { keyPath: 'id', autoIncrement: true });
      d.createObjectStore('accounts', { keyPath: 'id', autoIncrement: true });
      d.createObjectStore('keyval');
    },
  });
  await db.put('properties', { id: 1, alias: 'Piso Centro', cadastralReference: 'X1' });
  await db.put('accounts', { id: 9, activa: true, status: 'ACTIVE' });
  db.close();
}

const baseRow = {
  propiedad: 'Piso Centro',
  tipo: 'habitual',
  inicioAlquiler: '2024-03-01',
  finAlquiler: '2026-02-28', // fecha de fin REAL del fichero
  nombreCompania: 'Ana López',
  alquiler: 800,
};

describe('importContractsFromRentilaRows · hook cotitulares (Extra 2)', () => {
  beforeEach(() => {
    jest.resetModules();
    (globalThis as any).indexedDB = new IDBFactory();
  });

  it('altas: inicializa cotitulares=[] y respeta la fechaFin del fichero (sin LAU)', async () => {
    await seedProperty();
    const { importContractsFromRentilaRows } = require('../contractsImportService');
    const { openDB } = require('idb');

    const res = await importContractsFromRentilaRows([baseRow], 9);
    expect(res.imported).toBe(1);

    const db = await openDB(DB_NAME, 78);
    const all = await db.getAll('contracts');
    expect(all).toHaveLength(1);
    expect(all[0].inquilino.cotitulares).toEqual([]);
    // fechaFin se conserva del fichero · NO se sustituye por inicio+5y (2029-03-01)
    expect(all[0].fechaFin).toBe('2026-02-28');
  });

  it('re-import: NO machaca cotitulares existentes', async () => {
    await seedProperty();
    const { importContractsFromRentilaRows } = require('../contractsImportService');
    const { openDB } = require('idb');

    // alta inicial + añadir un cotitular a mano
    await importContractsFromRentilaRows([baseRow], 9);
    let db = await openDB(DB_NAME, 78);
    const created = (await db.getAll('contracts'))[0];
    created.inquilino.cotitulares = ['12345678Z'];
    await db.put('contracts', created);
    db.close();

    // re-import de la misma fila (mismo inmueble+nombre+inicio → rama update)
    const res = await importContractsFromRentilaRows([{ ...baseRow, alquiler: 850 }], 9);
    expect(res.updated).toBe(1);

    db = await openDB(DB_NAME, 78);
    const after = (await db.getAll('contracts'))[0];
    expect(after.inquilino.cotitulares).toEqual(['12345678Z']); // preservado
    expect(after.rentaMensual).toBe(850); // el resto del payload sí se actualiza
    db.close();
  });
});
