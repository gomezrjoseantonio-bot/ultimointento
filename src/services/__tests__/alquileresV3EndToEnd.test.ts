// V78.1 (Commit 7 · verificación end-to-end) · ciclo de vida completo del modelo alquileres v3.
//
// Ata en un único flujo, con los servicios REALES (sin mocks), los fixes de los commits 2-5:
//   · H1 (C2) · import mixto (FA32) auto-corrige modoExplotacion a `mixto` y NO crea contrato;
//              piso_completo+NIF sí crea contrato Camino 1.
//   · H2 (C3) · el bote del inmueble mixto retiene los NIFs declarados.
//   · Extra1 (C4) · el contrato habitual Camino 1 recibe fechaFin LAU (inicio+5y, futuro).
//   · H3/UI (C5) · conciliación: sugerirContracts encuentra el contrato del inmueble por
//              habitaciones, vincularContract descuenta del saldo y deja el bote `cerrado`.
//
// Pre-crea la DB en v77 (igual que rutearArrendamientos.test) para evitar las migraciones
// legacy < 53 incompatibles con fake-indexeddb.
import 'fake-indexeddb/auto';
import { openDB } from 'idb';

const DB_NAME = 'AtlasHorizonDB';

async function seedV77(properties: any[]) {
  const legacy = await openDB(DB_NAME, 77, {
    upgrade(db) {
      db.createObjectStore('properties', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('contracts', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('accounts', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('treasuryEvents', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('keyval');
    },
  });
  for (const p of properties) await legacy.put('properties', p);
  legacy.close();
}

function decl(ejercicio: number, inmuebles: Array<{ refCatastral: string; arrendamientos: any[] }>): any {
  return {
    meta: { ejercicio },
    inmuebles: inmuebles.map((i) => ({ refCatastral: i.refCatastral, esAccesorioDe: undefined, arrendamientos: i.arrendamientos })),
  };
}

describe('alquileres v3 · verificación end-to-end (commits 2-5)', () => {
  beforeEach(() => {
    jest.resetModules();
    (globalThis as any).indexedDB = new IDBFactory();
  });

  it('import mixto+piso+habitaciones → contrato LAU + bote con NIFs → conciliación a cerrado', async () => {
    const ESTE_AÑO = new Date().getFullYear(); // contrato reciente → LAU cae en el futuro

    await seedV77([
      // FA32 · mixto real (boolean legacy + persistido por_habitaciones, estado post self-heal)
      { id: 4, alias: 'FA32', cadastralReference: 'FA32', modoExplotacion: 'por_habitaciones', alquilerPorHabitaciones: { activo: true } },
      // Piso completo con inquilino identificado → Camino 1 (habitual → LAU)
      { id: 1, alias: 'CB', cadastralReference: 'CB1', modoExplotacion: 'piso_completo' },
      // Por habitaciones · genera bote y luego lo conciliamos con un contrato real
      { id: 3, alias: 'Hab', cadastralReference: 'HAB3', modoExplotacion: 'por_habitaciones' },
    ]);

    const { rutearArrendamientos } = require('../declaracionDistributorService');
    const { boteAnualService } = require('../boteAnualService');
    const { saveContract } = require('../contractService');
    const { FECHA_FIN_INDEFINIDO } = require('../contractService');
    const { initDB } = require('../db');

    const porRef = new Map<string, any>([
      ['FA32', { id: 4, modoExplotacion: 'por_habitaciones', alquilerPorHabitaciones: { activo: true } }],
      ['CB1', { id: 1, modoExplotacion: 'piso_completo' }],
      ['HAB3', { id: 3, modoExplotacion: 'por_habitaciones' }],
    ]);

    const d = decl(ESTE_AÑO, [
      // FA32 mixto · TAR1 vivienda 2 NIFs + TAR2 no_vivienda sin NIF → TODO al bote
      { refCatastral: 'FA32', arrendamientos: [
        { tipoArrendamiento: 'vivienda', nifArrendatarios: ['Y5617860D', '71682787K'], ingresos: 8550, diasArrendado: 365 },
        { tipoArrendamiento: 'no_vivienda', nifArrendatarios: [], ingresos: 11125, diasArrendado: 200 },
      ] },
      // CB · piso completo · vivienda 1 NIF → Camino 1, habitual → LAU
      { refCatastral: 'CB1', arrendamientos: [
        { tipoArrendamiento: 'vivienda', nifArrendatarios: ['00000001A'], ingresos: 12000, diasArrendado: 365, fechaContrato: `${ESTE_AÑO}-02-01` },
      ] },
      // HAB3 · por habitaciones · 1 NIF → bote
      { refCatastral: 'HAB3', arrendamientos: [
        { tipoArrendamiento: 'vivienda', nifArrendatarios: ['33333333C'], ingresos: 6000, diasArrendado: 365 },
      ] },
    ]);

    // ── Import ───────────────────────────────────────────────────────────────
    const res = await rutearArrendamientos(d, porRef);
    expect(res.contratos).toBe(1);     // solo CB
    expect(res.botes).toBe(2);         // FA32 + HAB3
    expect(res.modoCorregido).toBe(1); // FA32 → mixto

    const db = await initDB();

    // ── H1 · FA32 auto-corregido a mixto, sin contrato ────────────────────────
    expect((await db.get('properties', 4)).modoExplotacion).toBe('mixto');
    const contracts1 = (await db.getAll('contracts')) as any[];
    expect(contracts1.filter((c) => c.inmuebleId === 4)).toHaveLength(0);

    // ── H2 · bote FA32 con todo el importe y los 2 NIFs de TAR1 ────────────────
    const boteFA32 = await boteAnualService.getBote(4, ESTE_AÑO);
    expect(boteFA32.importeDeclarado).toBe(19675);
    expect(boteFA32.nifsDetectados.sort()).toEqual(['71682787K', 'Y5617860D']);

    // ── Extra1 · contrato CB habitual con fechaFin LAU (inicio+5y, futuro) ─────
    const cb = contracts1.find((c) => c.inmuebleId === 1);
    expect(cb.inquilino.dni).toBe('00000001A');
    expect(cb.modalidad).toBe('habitual');
    expect(cb.fechaFin).toBe(`${ESTE_AÑO + 5}-02-01`);
    expect(cb.fechaFin).not.toBe(FECHA_FIN_INDEFINIDO);
    expect(cb.rentaMensual).toBe(1000); // round(12000/12) · sin dividir entre NIFs

    // ── H3/UI · conciliación del bote HAB3 ─────────────────────────────────────
    const boteHab = await boteAnualService.getBote(3, ESTE_AÑO);
    expect(boteHab.estado).toBe('pendiente_total');
    expect(boteHab.saldoPendiente).toBe(6000);

    // Existe un contrato real para HAB3 que cubre el año (NIF coincidente con el bote)
    const contratoHabId = await saveContract({
      inmuebleId: 3,
      unidadTipo: 'habitacion',
      modalidad: 'temporada',
      inquilino: { nombre: 'Inq', apellidos: 'Hab', dni: '33333333C', telefono: '', email: '', cotitulares: [] },
      fechaInicio: `${ESTE_AÑO}-01-01`,
      fechaFin: `${ESTE_AÑO}-12-31`,
      rentaMensual: 500,
      diaPago: 1,
      margenGraciaDias: 5,
      indexacion: 'none',
      historicoIndexaciones: [],
      fianzaMeses: 1,
      fianzaImporte: 500,
      fianzaEstado: 'retenida',
      cuentaCobroId: 0,
      estadoContrato: 'activo',
      propertyId: 3,
      startDate: `${ESTE_AÑO}-01-01`,
      endDate: `${ESTE_AÑO}-12-31`,
      monthlyRent: 500,
      paymentDay: 1,
      status: 'active',
      documents: [],
    });

    // sugerirContracts encuentra el contrato y prioriza por NIF coincidente
    const sugerencias = await boteAnualService.sugerirContracts(boteHab.id);
    expect(sugerencias.length).toBeGreaterThanOrEqual(1);
    const sug = sugerencias.find((s: any) => s.contractId === contratoHabId);
    expect(sug).toBeDefined();
    expect(sug.nifCoincide).toBe(true);

    // Vincular el saldo completo → bote cerrado
    const tras = await boteAnualService.vincularContract(boteHab.id, contratoHabId, 6000, 'manual_usuario');
    expect(tras.importeAsignado).toBe(6000);
    expect(tras.saldoPendiente).toBe(0);
    expect(tras.estado).toBe('cerrado');

    // Desvincular revierte a pendiente_total (idempotencia inversa)
    const revert = await boteAnualService.desvincularContract(boteHab.id, contratoHabId);
    expect(revert.saldoPendiente).toBe(6000);
    expect(revert.estado).toBe('pendiente_total');
  });
});
