/**
 * V79 · onboarding día 0 · test de schema + migración no destructiva (Commit 2).
 *
 * Verifica (§3.1 · §5 · C2):
 *   · DB_VERSION subió a 79
 *   · Property.onerosoAcquisition admite los 3 campos nuevos (aportacionPropia,
 *     importeFinanciado, prestamoVinculadoId:string) en round-trip
 *   · La migración es NO DESTRUCTIVA: properties existentes sin los campos nuevos
 *     sobreviven intactas (los campos quedan undefined · no se reescribe nada)
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
  // Property con onerosoAcquisition en la forma vieja (solo amount + expenses).
  await legacy.put('properties', {
    id: 2,
    alias: 'Compra vieja',
    onerosoAcquisition: { acquisitionAmount: 200000, acquisitionExpenses: 20000 },
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
    expect(p2.onerosoAcquisition.acquisitionAmount).toBe(200000);
    expect(p2.onerosoAcquisition.acquisitionExpenses).toBe(20000);
    // Los campos nuevos no se inventan en datos existentes.
    expect(p2.onerosoAcquisition.aportacionPropia).toBeUndefined();
    expect(p2.onerosoAcquisition.importeFinanciado).toBeUndefined();
    expect(p2.onerosoAcquisition.prestamoVinculadoId).toBeUndefined();
  });

  it('round-trip de los 3 campos nuevos de estructura de compra', async () => {
    await seedV78();

    const { initDB } = require('../db');
    const db = await initDB();

    await db.put('properties', {
      id: 3,
      alias: 'Compra financiada',
      onerosoAcquisition: {
        acquisitionAmount: 300000,
        acquisitionExpenses: 30000,
        aportacionPropia: 90000,
        importeFinanciado: 240000,
        prestamoVinculadoId: 'prest-uuid-abc', // string (uuid · decisión Jose D1)
      },
    });

    const p3 = await db.get('properties', 3);
    expect(p3.onerosoAcquisition).toEqual({
      acquisitionAmount: 300000,
      acquisitionExpenses: 30000,
      aportacionPropia: 90000,
      importeFinanciado: 240000,
      prestamoVinculadoId: 'prest-uuid-abc',
    });
    expect(typeof p3.onerosoAcquisition.prestamoVinculadoId).toBe('string');
  });
});
