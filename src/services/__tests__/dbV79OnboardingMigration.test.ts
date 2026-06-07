/**
 * V79 · onboarding día 0 · test de schema + migración no destructiva (Commit 2).
 *
 * Verifica (§3.1 · §5 · C2):
 *   · DB_VERSION subió a 79
 *   · Property.estructuraCompra (campo raíz nuevo · decisión Jose) admite los 3
 *     campos (aportacionPropia, importeFinanciado, prestamoVinculadoId:string)
 *     en round-trip
 *   · La migración es NO DESTRUCTIVA: properties existentes sin el campo nuevo
 *     sobreviven intactas (queda undefined · no se reescribe nada)
 *
 * Patrón (igual que dbV78AlquileresMigration.test): pre-crea la DB en v78 y deja
 * que `initDB()` la suba a v79. El flag `migration_v78_alquileres` se marca en el
 * seed para que el hook post-upgrade de v78 no toque las properties (foco en v79).
 */
import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { IDBFactory } from 'fake-indexeddb';

const DB_NAME = 'AtlasHorizonDB';

async function seedV78() {
  const legacy = await openDB(DB_NAME, 78, {
    upgrade(db) {
      db.createObjectStore('properties', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('contracts', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('treasuryEvents', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('keyval');
    },
  });
  // Property legacy sin onerosoAcquisition.
  await legacy.put('properties', { id: 1, alias: 'Legacy sin compra' });
  // Property con costes de adquisición previos · sin estructuraCompra.
  await legacy.put('properties', {
    id: 2,
    alias: 'Compra vieja',
    acquisitionCosts: { price: 200000, notary: 2000 },
  });
  // Evita que el hook post-upgrade de v78 reescriba las properties.
  await legacy.put('keyval', 'completed', 'migration_v78_alquileres');
  legacy.close();
}

describe('V79 · estructura de compra en Property (onboarding día 0)', () => {
  beforeEach(() => {
    jest.resetModules();
    (globalThis as any).indexedDB = new IDBFactory();
  });

  it('sube DB_VERSION a 79 sin destruir properties existentes', async () => {
    await seedV78();

    const { initDB } = require('../db');
    const db = await initDB();

    expect(db.version).toBe(79);

    // ── No destructivo ──
    const p1 = await db.get('properties', 1);
    expect(p1.alias).toBe('Legacy sin compra');
    expect(p1.onerosoAcquisition).toBeUndefined();

    const p2 = await db.get('properties', 2);
    expect(p2.acquisitionCosts.price).toBe(200000);
    // El campo nuevo no se inventa en datos existentes.
    expect(p2.estructuraCompra).toBeUndefined();
  });

  it('round-trip de la estructura de compra (campo raíz nuevo)', async () => {
    await seedV78();

    const { initDB } = require('../db');
    const db = await initDB();

    await db.put('properties', {
      id: 3,
      alias: 'Compra financiada',
      acquisitionCosts: { price: 300000 },
      estructuraCompra: {
        aportacionPropia: 90000,
        importeFinanciado: 240000,
        prestamoVinculadoId: 'prest-uuid-abc', // string (uuid · decisión Jose D1)
      },
    });

    const p3 = await db.get('properties', 3);
    expect(p3.estructuraCompra).toEqual({
      aportacionPropia: 90000,
      importeFinanciado: 240000,
      prestamoVinculadoId: 'prest-uuid-abc',
    });
    expect(typeof p3.estructuraCompra.prestamoVinculadoId).toBe('string');
  });
});
