// V78.1 (Commit 6 · pulido flujo matching) · E2E del bote transitorio + histórico fiscal.
//
// Ata con servicios REALES el ciclo: vincular contratos a un bote hasta cerrarlo y comprobar
//   · que el bote 'cerrado' DESAPARECE de la lista visible de "Por conciliar"
//     (el mismo filtro estado !== 'cerrado' que aplica el tab), pero SIGUE en BD;
//   · que el histórico fiscal del inmueble lo lee igual (cerrado incluido) con sus vinculados;
//   · sobre-asignación accidental → estado 'sobre_asignado' (visible aún en la lista);
//   · inmueble solo Camino 1 (sin botes) → histórico fiscal desde ejerciciosFiscales.
//
// Pre-crea la DB en v77 para evitar migraciones legacy < 53 incompatibles con fake-indexeddb.
import 'fake-indexeddb/auto';
import { openDB } from 'idb';

const DB_NAME = 'AtlasHorizonDB';

async function seedV77(contracts: any[] = []) {
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

/** Réplica del filtro de visibilidad de la pestaña "Por conciliar". */
const visiblesEnPorConciliar = (botes: any[]) => botes.filter((b) => b.estado !== 'cerrado');

describe('E2E · bote transitorio + histórico fiscal del inmueble', () => {
  beforeEach(() => {
    jest.resetModules();
    (globalThis as any).indexedDB = new IDBFactory();
  });

  it('E1 · vincular hasta cerrar → desaparece de "Por conciliar" pero queda en histórico fiscal', async () => {
    await seedV77([
      {
        id: 48, inmuebleId: 14, estadoContrato: 'activo',
        fechaInicio: '2024-01-01', fechaFin: '2024-12-31', rentaMensual: 1235,
        inquilino: { nombre: 'ALISSER', apellidos: 'PEREZ', dni: '99999999A', telefono: '', email: '' },
      },
    ]);
    const { boteAnualService } = require('../boteAnualService');
    const { obtenerHistoricoFiscalInmueble } = require('../historicoFiscalInmuebleService');

    const bote = await boteAnualService.crearOActualizarBote({
      inmuebleId: 14, año: 2024, importeDeclarado: 14820, díasDeclarados: 366,
    });
    expect(bote.estado).toBe('pendiente_total');

    // ALISSER cubre el ejercicio entero (1.235 × 12 = 14.820) → cierra el bote.
    const r = await boteAnualService.vincularContract(bote.id, 48, 14820, 'manual_usuario');
    expect(r.estado).toBe('cerrado');
    expect(r.saldoPendiente).toBe(0);

    // Desaparece de la lista visible, pero sigue en BD.
    const todos = await boteAnualService.listarBotes();
    expect(todos).toHaveLength(1);
    expect(visiblesEnPorConciliar(todos)).toHaveLength(0);

    // El histórico fiscal del inmueble SÍ lo lee (cerrado incluido) con sus vinculados.
    const historico = await obtenerHistoricoFiscalInmueble(14);
    expect(historico).toHaveLength(1);
    expect(historico[0].año).toBe(2024);
    expect(historico[0].bote.estado).toBe('cerrado');
    expect(historico[0].bote.importeDeclarado).toBe(14820);
    expect(historico[0].bote.contractsVinculados).toHaveLength(1);
    expect(historico[0].bote.contractsVinculados[0].contractId).toBe(48);
  });

  it('E2 · sobre-asignación accidental → sobre_asignado, sigue visible; quitar revierte', async () => {
    await seedV77();
    const { boteAnualService } = require('../boteAnualService');

    const bote = await boteAnualService.crearOActualizarBote({
      inmuebleId: 4, año: 2024, importeDeclarado: 19675, díasDeclarados: 366,
    });
    await boteAnualService.vincularContract(bote.id, 8, 12000, 'manual_usuario');
    let r = await boteAnualService.vincularContract(bote.id, 25, 8000, 'manual_usuario'); // 20.000 > 19.675
    expect(r.estado).toBe('sobre_asignado');

    const todos = await boteAnualService.listarBotes();
    expect(visiblesEnPorConciliar(todos)).toHaveLength(1); // sobre_asignado SÍ se ve

    r = await boteAnualService.desvincularContract(bote.id, 25);
    expect(r.estado).toBe('parcial');
  });

  it('E3 · inmueble sin botes (solo Camino 1) → histórico fiscal desde ejerciciosFiscales', async () => {
    await seedV77([
      {
        id: 60, inmuebleId: 21,
        inquilino: { nombre: 'CONCEPCION', apellidos: 'RUIZ', dni: '33333333P', telefono: '', email: '' },
        ejerciciosFiscales: {
          2022: { estado: 'declarado', importeDeclarado: 5380, nifsDetectados: ['33333333P'] },
          2023: { estado: 'declarado', importeDeclarado: 6200, nifsDetectados: ['33333333P'] },
        },
      },
    ]);
    const { obtenerHistoricoFiscalInmueble } = require('../historicoFiscalInmuebleService');
    const historico = await obtenerHistoricoFiscalInmueble(21);
    expect(historico.map((r: any) => r.año)).toEqual([2023, 2022]);
    expect(historico.every((r: any) => r.bote === undefined)).toBe(true);
    expect(historico[0].contractsCamino1[0].contract.inquilino.nombre).toBe('CONCEPCION');
    expect(historico[1].contractsCamino1[0].ejercicio.importeDeclarado).toBe(5380);
  });
});
