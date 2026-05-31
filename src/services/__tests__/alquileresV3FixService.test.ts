// V78.1 (fix post-deploy H2) · test de repoblación de nifsDetectados desde la declaración archivada.
//
// Verifica que `repoblarNifsBotesDesdeArchivo`:
//   · mergea los NIFs del XML archivado en el bote del (inmueble·año) cuando el inmueble es
//     por_habitaciones/mixto
//   · NO toca botes de inmuebles piso_completo (sus NIFs fueron a contratos identificados)
//   · es idempotente (segunda pasada no cambia nada)
//   · defensivo: crearOActualizarBote persiste nifsDetectados (no se pierden)
import 'fake-indexeddb/auto';
import { openDB } from 'idb';

const DB_NAME = 'AtlasHorizonDB';

async function seedV77(properties: any[], coords: any[]) {
  const legacy = await openDB(DB_NAME, 77, {
    upgrade(db) {
      db.createObjectStore('properties', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('contracts', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('treasuryEvents', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('ejerciciosFiscalesCoord', { keyPath: 'año' });
      db.createObjectStore('keyval');
    },
  });
  for (const p of properties) await legacy.put('properties', p);
  for (const c of coords) await legacy.put('ejerciciosFiscalesCoord', c);
  legacy.close();
}

const declArchivada = (ejercicio: number, inmuebles: any[]) => ({
  año: ejercicio,
  aeat: { declaracionCompleta: { meta: { ejercicio }, inmuebles } },
});

describe('repoblarNifsBotesDesdeArchivo · fix H2 (Opción B)', () => {
  beforeEach(() => {
    jest.resetModules();
    (globalThis as any).indexedDB = new IDBFactory();
  });

  it('mergea NIFs del archivo en botes mixto/por_habitaciones y respeta piso_completo', async () => {
    await seedV77(
      [
        { id: 4, alias: 'FA32', cadastralReference: 'FA32', modoExplotacion: 'mixto' },
        { id: 7, alias: 'Hab', cadastralReference: 'HAB7', modoExplotacion: 'por_habitaciones' },
        { id: 1, alias: 'CB', cadastralReference: 'CB1', modoExplotacion: 'piso_completo' },
      ],
      [
        declArchivada(2024, [
          { refCatastral: 'FA32', arrendamientos: [
            { nifArrendatarios: ['Y5617860D', '71682787K'] },
            { nifArrendatarios: [] },
          ] },
          { refCatastral: 'HAB7', arrendamientos: [{ nifArrendatarios: ['11111111H'] }] },
          { refCatastral: 'CB1', arrendamientos: [{ nifArrendatarios: ['99999999A'] }] },
        ]),
      ],
    );

    const { initDB } = require('../db');
    const { boteAnualService } = require('../boteAnualService');
    const { repoblarNifsBotesDesdeArchivo } = require('../alquileresV3FixService');
    const db = await initDB();

    // Botes existentes con nifsDetectados vacío (simula los 7 botes de Jose)
    await boteAnualService.crearOActualizarBote({ inmuebleId: 4, año: 2024, importeDeclarado: 19675, díasDeclarados: 366, nifsDetectados: [] });
    await boteAnualService.crearOActualizarBote({ inmuebleId: 7, año: 2024, importeDeclarado: 6000, díasDeclarados: 365, nifsDetectados: [] });
    await boteAnualService.crearOActualizarBote({ inmuebleId: 1, año: 2024, importeDeclarado: 4000, díasDeclarados: 365, nifsDetectados: [] });

    const n = await repoblarNifsBotesDesdeArchivo(db);
    expect(n).toBe(2); // FA32 y HAB7 · NO el piso_completo

    expect((await boteAnualService.getBote(4, 2024)).nifsDetectados.sort()).toEqual(['71682787K', 'Y5617860D']);
    expect((await boteAnualService.getBote(7, 2024)).nifsDetectados).toEqual(['11111111H']);
    // piso_completo intacto (sus NIFs van a contrato identificado, no al bote)
    expect((await boteAnualService.getBote(1, 2024)).nifsDetectados).toEqual([]);

    // Idempotente
    expect(await repoblarNifsBotesDesdeArchivo(db)).toBe(0);
  });

  it('defensivo · crearOActualizarBote persiste nifsDetectados en alta', async () => {
    await seedV77([{ id: 9, alias: 'X', cadastralReference: 'X9', modoExplotacion: 'por_habitaciones' }], []);
    const { boteAnualService } = require('../boteAnualService');
    await boteAnualService.crearOActualizarBote({
      inmuebleId: 9, año: 2023, importeDeclarado: 5000, díasDeclarados: 300,
      nifsDetectados: ['12345678Z'],
    });
    expect((await boteAnualService.getBote(9, 2023)).nifsDetectados).toEqual(['12345678Z']);
  });
});
