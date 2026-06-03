// REORG Contratos · Commit 2 · migración suave del flag `documentoFirmado` (sin DB bump).
//
// Verifica que `backfillDocumentoFirmado`:
//   · marca false los importados sin firma (sin_firmar / rentila / plantilla_atlas / xml_aeat)
//   · marca true los manuales (sin origen de importación)
//   · respeta una firma registrada (firma.estado='firmado' o fechaFirmaContrato) → true
//   · NO pisa un documentoFirmado ya definido (idempotente)
//   · una segunda pasada no modifica nada
import 'fake-indexeddb/auto';
import { openDB, type IDBPDatabase } from 'idb';
import { backfillDocumentoFirmado } from '../alquileresV3FixService';

const DB_NAME = 'BackfillDocFirmadoTestDB';

async function seedContracts(contratos: any[]): Promise<IDBPDatabase<any>> {
  const db = await openDB(DB_NAME, 1, {
    upgrade(d) {
      d.createObjectStore('contracts', { keyPath: 'id', autoIncrement: true });
    },
  });
  for (const c of contratos) await db.put('contracts', c);
  return db;
}

describe('backfillDocumentoFirmado · migración suave', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
  });

  it('asigna documentoFirmado por origen y firma, y es idempotente', async () => {
    const db = await seedContracts([
      { id: 1, estadoContrato: 'sin_firmar' },                               // importado sin firma → false
      { id: 2, estadoContrato: 'activo', origenImportacion: 'rentila' },     // rentila → false
      { id: 3, estadoContrato: 'activo', origenImportacion: 'plantilla_atlas' }, // plantilla → false
      { id: 4, estadoContrato: 'activo', ejerciciosFiscales: { 2024: { fuente: 'xml_aeat' } } }, // AEAT → false
      { id: 5, estadoContrato: 'activo' },                                   // manual → true
      { id: 6, estadoContrato: 'sin_firmar', firma: { estado: 'firmado' } }, // firmado pese a sin_firmar → true
      { id: 7, estadoContrato: 'activo', origenImportacion: 'rentila', fechaFirmaContrato: '2024-03-01' }, // firma manual → true
      { id: 8, estadoContrato: 'sin_firmar', documentoFirmado: true },       // ya definido → no se toca
    ]);

    const n = await backfillDocumentoFirmado(db);
    expect(n).toBe(7); // los 7 sin documentoFirmado definido (id 8 se salta)

    const byId = new Map<number, any>();
    for (const c of await db.getAll('contracts')) byId.set(c.id, c);

    expect(byId.get(1).documentoFirmado).toBe(false);
    expect(byId.get(2).documentoFirmado).toBe(false);
    expect(byId.get(3).documentoFirmado).toBe(false);
    expect(byId.get(4).documentoFirmado).toBe(false);
    expect(byId.get(5).documentoFirmado).toBe(true);
    expect(byId.get(6).documentoFirmado).toBe(true);
    expect(byId.get(7).documentoFirmado).toBe(true);
    expect(byId.get(8).documentoFirmado).toBe(true); // intacto

    // Segunda pasada · idempotente
    expect(await backfillDocumentoFirmado(db)).toBe(0);
    db.close();
  });

  it('deja documentoFirmado definido (boolean) en TODOS los contratos existentes', async () => {
    const db = await seedContracts([
      { id: 1, estadoContrato: 'sin_firmar' },
      { id: 2, estadoContrato: 'finalizado' },
      { id: 3, estadoContrato: 'activo', origenImportacion: 'rentila' },
    ]);
    await backfillDocumentoFirmado(db);
    for (const c of await db.getAll('contracts')) {
      expect(typeof c.documentoFirmado).toBe('boolean');
    }
    db.close();
  });
});
