// V78 · refactor modelo alquileres v3 · tests del ruteo Camino 1 / Camino 2 del import XML.
//
// Cubre:
//   · decidirRutaArrendamiento (función pura) · toda la tabla de decisión
//   · rutearArrendamientos (integración) · crea contratos identificados (con cotitulares)
//     para piso_completo+NIF, y botes agregados por (inmueble·año) para el resto.
//
// Pre-crea la DB en v77 (evita los bloques de migración legacy `< 53` incompatibles con
// fake-indexeddb) con los stores que tocan el orquestador y crearOActualizarContrato.
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

/** Construye un DeclaracionCompleta mínimo para el orquestador (sólo usa meta+inmuebles). */
function declConArrendamientos(
  ejercicio: number,
  inmuebles: Array<{ refCatastral: string; arrendamientos: any[] }>,
): any {
  return {
    meta: { ejercicio },
    inmuebles: inmuebles.map((i) => ({
      refCatastral: i.refCatastral,
      esAccesorioDe: undefined,
      arrendamientos: i.arrendamientos,
    })),
  };
}

describe('decidirRutaArrendamiento · tabla de decisión', () => {
  it('aplica la regla modoExplotacion × nº NIFs', () => {
    const { decidirRutaArrendamiento } = require('../declaracionDistributorService');
    expect(decidirRutaArrendamiento('piso_completo', 2)).toBe('camino1');
    expect(decidirRutaArrendamiento('piso_completo', 1)).toBe('camino1');
    expect(decidirRutaArrendamiento('piso_completo', 0)).toBe('camino2');
    expect(decidirRutaArrendamiento('por_habitaciones', 1)).toBe('camino2');
    expect(decidirRutaArrendamiento('por_habitaciones', 0)).toBe('camino2');
    expect(decidirRutaArrendamiento('mixto', 3)).toBe('camino2');
    // Inmueble sin modoExplotacion → piso_completo
    expect(decidirRutaArrendamiento(undefined, 1)).toBe('camino1');
    expect(decidirRutaArrendamiento(undefined, 0)).toBe('camino2');
  });
});

describe('rutearArrendamientos · integración', () => {
  beforeEach(() => {
    jest.resetModules();
    (globalThis as any).indexedDB = new IDBFactory();
  });

  it('rutea cada arrendamiento al camino correcto y agrega los botes por inmueble', async () => {
    await seedV77([
      { id: 1, alias: 'PisoComp', cadastralReference: 'RC1', modoExplotacion: 'piso_completo' },
      { id: 2, alias: 'SinNif', cadastralReference: 'RC2', modoExplotacion: 'piso_completo' },
      { id: 3, alias: 'Habitaciones', cadastralReference: 'RC3', modoExplotacion: 'por_habitaciones' },
      { id: 4, alias: 'Mixto', cadastralReference: 'RC4', modoExplotacion: 'mixto' },
      { id: 5, alias: 'Local', cadastralReference: 'RC5', modoExplotacion: 'piso_completo' },
    ]);

    const { rutearArrendamientos } = require('../declaracionDistributorService');
    const { boteAnualService } = require('../boteAnualService');
    const { initDB } = require('../db');

    const porRefCatastral = new Map<string, any>([
      ['RC1', { id: 1, modoExplotacion: 'piso_completo' }],
      ['RC2', { id: 2, modoExplotacion: 'piso_completo' }],
      ['RC3', { id: 3, modoExplotacion: 'por_habitaciones' }],
      ['RC4', { id: 4, modoExplotacion: 'mixto' }],
      ['RC5', { id: 5, modoExplotacion: 'piso_completo' }],
    ]);

    const decl = declConArrendamientos(2024, [
      // RC1 · piso completo con 2 NIFs (vivienda) → Camino 1, 1 contrato con cotitular
      { refCatastral: 'RC1', arrendamientos: [
        { tipoArrendamiento: 'vivienda', nifArrendatarios: ['12345678Z', '87654321X'], ingresos: 12000, diasArrendado: 365, fechaContrato: '2024-01-01' },
      ] },
      // RC2 · piso completo SIN NIF → Camino 2 bote
      { refCatastral: 'RC2', arrendamientos: [
        { tipoArrendamiento: 'vivienda', nifArrendatarios: [], ingresos: 8000, diasArrendado: 300 },
      ] },
      // RC3 · por habitaciones con 1 NIF → Camino 2 bote (NIF al metadato)
      { refCatastral: 'RC3', arrendamientos: [
        { tipoArrendamiento: 'vivienda', nifArrendatarios: ['11111111H'], ingresos: 6000, diasArrendado: 365 },
      ] },
      // RC4 · mixto · 2 bloques (uno con NIF, otro sin) → ambos a bote, AGREGADOS
      { refCatastral: 'RC4', arrendamientos: [
        { tipoArrendamiento: 'vivienda', nifArrendatarios: ['22222222J'], ingresos: 5000, diasArrendado: 180 },
        { tipoArrendamiento: 'no_vivienda', nifArrendatarios: [], ingresos: 3000, diasArrendado: 120 },
      ] },
      // RC5 · piso completo · no_vivienda CON NIF → Camino 1 (la identificación manda)
      { refCatastral: 'RC5', arrendamientos: [
        { tipoArrendamiento: 'no_vivienda', nifArrendatarios: ['B12345678'], ingresos: 9000, diasArrendado: 365 },
      ] },
    ]);

    const res = await rutearArrendamientos(decl, porRefCatastral);
    expect(res.contratos).toBe(2); // RC1 y RC5
    expect(res.botes).toBe(3);     // RC2, RC3, RC4

    const db = await initDB();
    const contracts = (await db.getAll('contracts')) as any[];

    // RC1 · contrato con cotitular
    const c1 = contracts.filter((c) => c.inmuebleId === 1);
    expect(c1).toHaveLength(1);
    expect(c1[0].inquilino.dni).toBe('12345678Z');
    expect(c1[0].inquilino.cotitulares).toEqual(['87654321X']);
    expect(c1[0].estadoContrato).toBe('activo');
    expect(c1[0].ejerciciosFiscales[2024].importeDeclarado).toBe(12000);

    // RC5 · contrato no_vivienda con NIF único → cotitulares []
    const c5 = contracts.filter((c) => c.inmuebleId === 5);
    expect(c5).toHaveLength(1);
    expect(c5[0].inquilino.dni).toBe('B12345678');
    expect(c5[0].inquilino.cotitulares).toEqual([]);

    // No se crea ningún contrato para los inmuebles bote
    expect(contracts.filter((c) => [2, 3, 4].includes(c.inmuebleId))).toHaveLength(0);

    // Botes
    const b2 = await boteAnualService.getBote(2, 2024);
    expect(b2?.importeDeclarado).toBe(8000);
    expect(b2?.nifsDetectados).toEqual([]);
    expect(b2?.estado).toBe('pendiente_total');

    const b3 = await boteAnualService.getBote(3, 2024);
    expect(b3?.importeDeclarado).toBe(6000);
    expect(b3?.nifsDetectados).toEqual(['11111111H']);

    // RC4 · agregado de los 2 bloques
    const b4 = await boteAnualService.getBote(4, 2024);
    expect(b4?.importeDeclarado).toBe(8000); // 5000 + 3000
    expect(b4?.díasDeclarados).toBe(300);    // 180 + 120
    expect(b4?.nifsDetectados).toEqual(['22222222J']);
    expect(b4?.tiposArrendamientoOriginales.sort()).toEqual(['no_vivienda', 'vivienda']);
  });

  it('re-importar el mismo ejercicio es idempotente (replace, no duplica)', async () => {
    await seedV77([{ id: 1, alias: 'SinNif', cadastralReference: 'RC1', modoExplotacion: 'piso_completo' }]);
    const { rutearArrendamientos } = require('../declaracionDistributorService');
    const { boteAnualService } = require('../boteAnualService');

    const porRef = new Map<string, any>([['RC1', { id: 1, modoExplotacion: 'piso_completo' }]]);
    const decl = declConArrendamientos(2024, [
      { refCatastral: 'RC1', arrendamientos: [{ tipoArrendamiento: 'vivienda', nifArrendatarios: [], ingresos: 8000, diasArrendado: 300 }] },
    ]);

    await rutearArrendamientos(decl, porRef);
    await rutearArrendamientos(decl, porRef); // segundo import del mismo ejercicio

    const todos = await boteAnualService.listarBotes();
    expect(todos).toHaveLength(1);
    expect(todos[0].importeDeclarado).toBe(8000); // replace · no 16000
  });
});
