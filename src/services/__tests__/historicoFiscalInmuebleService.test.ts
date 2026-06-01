// V78.1 (Commit 5) · tests de la lectura cruzada del histórico fiscal del inmueble.
import 'fake-indexeddb/auto';
import { openDB } from 'idb';

const DB_NAME = 'AtlasHorizonDB';

async function seedV77(contracts: any[] = [], botes: any[] = []) {
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
  if (botes.length) {
    const { boteAnualService } = require('../boteAnualService');
    for (const b of botes) {
      const creado = await boteAnualService.crearOActualizarBote({
        inmuebleId: b.inmuebleId, año: b.año, importeDeclarado: b.importeDeclarado,
        díasDeclarados: b.díasDeclarados ?? 365, nifsDetectados: b.nifsDetectados ?? [],
      });
      for (const l of b.links ?? []) {
        await boteAnualService.vincularContract(creado.id, l.contractId, l.importe, 'manual_usuario');
      }
    }
  }
}

describe('obtenerHistoricoFiscalInmueble', () => {
  beforeEach(() => {
    jest.resetModules();
    (globalThis as any).indexedDB = new IDBFactory();
  });

  it('inmueble solo con botes · ordena desc y resuelve estado/vinculados', async () => {
    await seedV77(
      [{ id: 8, inmuebleId: 4, inquilino: { nombre: 'JOSEPH', apellidos: 'PALMA', dni: '', telefono: '', email: '' } }],
      [
        { inmuebleId: 4, año: 2024, importeDeclarado: 10000, links: [{ contractId: 8, importe: 10000 }] },
        { inmuebleId: 4, año: 2023, importeDeclarado: 5000 },
      ],
    );
    const { obtenerHistoricoFiscalInmueble } = require('../historicoFiscalInmuebleService');
    const rows = await obtenerHistoricoFiscalInmueble(4);
    expect(rows.map((r: any) => r.año)).toEqual([2024, 2023]);
    expect(rows[0].bote.estado).toBe('cerrado');
    expect(rows[0].bote.contractsVinculados).toHaveLength(1);
    expect(rows[1].bote.estado).toBe('pendiente_total');
    expect(rows[1].contractsCamino1).toHaveLength(0);
  });

  it('inmueble solo con Contracts Camino 1 · agrupa por año del ejercicio fiscal', async () => {
    await seedV77([
      {
        id: 30, inmuebleId: 7,
        inquilino: { nombre: 'AROA', apellidos: '', dni: '11111111H', telefono: '', email: '' },
        ejerciciosFiscales: {
          2022: { estado: 'declarado', importeDeclarado: 5380, fuente: 'manual' },
          2023: { estado: 'declarado', importeDeclarado: 6000, fuente: 'manual' },
        },
      },
    ]);
    const { obtenerHistoricoFiscalInmueble } = require('../historicoFiscalInmuebleService');
    const rows = await obtenerHistoricoFiscalInmueble(7);
    expect(rows.map((r: any) => r.año)).toEqual([2023, 2022]);
    expect(rows[0].bote).toBeUndefined();
    expect(rows[0].contractsCamino1).toHaveLength(1);
    expect(rows[0].contractsCamino1[0].ejercicio.importeDeclarado).toBe(6000);
  });

  it('inmueble mixto · un año con bote y otro con Contract Camino 1', async () => {
    await seedV77(
      [
        {
          id: 50, inmuebleId: 9,
          inquilino: { nombre: 'IVAN', apellidos: 'GOMEZ', dni: '22222222J', telefono: '', email: '' },
          ejerciciosFiscales: { 2021: { estado: 'declarado', importeDeclarado: 3600 } },
        },
      ],
      [{ inmuebleId: 9, año: 2024, importeDeclarado: 17710 }],
    );
    const { obtenerHistoricoFiscalInmueble } = require('../historicoFiscalInmuebleService');
    const rows = await obtenerHistoricoFiscalInmueble(9);
    expect(rows.map((r: any) => r.año)).toEqual([2024, 2021]);
    expect(rows[0].bote.importeDeclarado).toBe(17710);
    expect(rows[1].contractsCamino1[0].contract.inquilino.nombre).toBe('IVAN');
  });

  it('inmueble sin datos → array vacío', async () => {
    await seedV77();
    const { obtenerHistoricoFiscalInmueble } = require('../historicoFiscalInmuebleService');
    expect(await obtenerHistoricoFiscalInmueble(99)).toEqual([]);
  });
});
