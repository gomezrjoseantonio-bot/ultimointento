// V78.1 · tests del helper de presentación de Contracts.
import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { contractDisplayName } from '../contractDisplay';

const DB_NAME = 'AtlasHorizonDB';

describe('contractDisplayName · función pura', () => {
  it('devuelve nombre + apellidos cuando existen', () => {
    expect(
      contractDisplayName(
        { inquilino: { nombre: 'JOSEPH', apellidos: 'PALMA GARCIA', dni: '', telefono: '', email: '' } } as any,
        8,
      ),
    ).toBe('JOSEPH PALMA GARCIA');
  });

  it('recorta espacios cuando solo hay nombre o solo apellidos', () => {
    expect(
      contractDisplayName({ inquilino: { nombre: 'AROA', apellidos: '', dni: '', telefono: '', email: '' } } as any, 1),
    ).toBe('AROA');
    expect(
      contractDisplayName({ inquilino: { nombre: '', apellidos: 'GOMEZ', dni: '', telefono: '', email: '' } } as any, 1),
    ).toBe('GOMEZ');
  });

  it('cae a DNI cuando no hay nombre ni apellidos', () => {
    expect(
      contractDisplayName(
        { inquilino: { nombre: '', apellidos: '', dni: '12345678Z', telefono: '', email: '' } } as any,
        25,
      ),
    ).toBe('DNI 12345678Z');
  });

  it('cae a Contrato #id cuando no hay nombre ni DNI', () => {
    expect(
      contractDisplayName({ inquilino: { nombre: '', apellidos: '', dni: '', telefono: '', email: '' } } as any, 42),
    ).toBe('Contrato #42');
  });

  it('cae a Contrato #id cuando el contract es undefined o null', () => {
    expect(contractDisplayName(undefined, 7)).toBe('Contrato #7');
    expect(contractDisplayName(null, 9)).toBe('Contrato #9');
  });
});

describe('resolveContractName / getContractsMap · lookup en BD', () => {
  beforeEach(() => {
    jest.resetModules();
    (globalThis as any).indexedDB = new IDBFactory();
  });

  async function seedV77(contracts: any[]) {
    const legacy = await openDB(DB_NAME, 77, {
      upgrade(db) {
        db.createObjectStore('properties', { keyPath: 'id', autoIncrement: true });
        db.createObjectStore('contracts', { keyPath: 'id', autoIncrement: true });
        db.createObjectStore('treasuryEvents', { keyPath: 'id', autoIncrement: true });
        db.createObjectStore('keyval');
      },
    });
    for (const c of contracts) await legacy.put('contracts', c);
    legacy.close();
  }

  it('resuelve el nombre del Contract existente y usa fallback si no existe', async () => {
    await seedV77([
      { id: 8, inquilino: { nombre: 'JOSEPH', apellidos: 'PALMA GARCIA', dni: '', telefono: '', email: '' } },
    ]);
    const { resolveContractName } = require('../contractDisplay');
    expect(await resolveContractName(8)).toBe('JOSEPH PALMA GARCIA');
    expect(await resolveContractName(999)).toBe('Contrato #999');
  });

  it('getContractsMap carga solo los ids existentes', async () => {
    await seedV77([
      { id: 8, inquilino: { nombre: 'JOSEPH', apellidos: 'PALMA', dni: '', telefono: '', email: '' } },
      { id: 25, inquilino: { nombre: 'ANDRES', apellidos: 'TERAN', dni: '', telefono: '', email: '' } },
    ]);
    const { getContractsMap } = require('../contractDisplay');
    const map = await getContractsMap([8, 25, 999, 8]);
    expect(map.size).toBe(2);
    expect(map.get(8)?.inquilino.nombre).toBe('JOSEPH');
    expect(map.get(25)?.inquilino.nombre).toBe('ANDRES');
    expect(map.has(999)).toBe(false);
  });
});
