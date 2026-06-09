// Commit 7 · tests de la creación efectiva de Contracts desde ContractDraft.
// Verifica estado SIN FIRMAR, decisiones de duplicados, alta de inmueble nuevo
// y el disparo de sugerencias de bote (postContractCreated).
import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import type { ContractDraft } from '../contractDraftService';

const DB_NAME = 'AtlasHorizonDB';

const prop = (id: number, alias: string) => ({
  id, alias, globalAlias: '', address: `${alias} dirección`,
  postalCode: '', province: '', municipality: '', ccaa: '',
  purchaseDate: '2020-01-01', squareMeters: 50, bedrooms: 2,
  transmissionRegime: 'usada', state: 'activo',
  acquisitionCosts: { price: 0 }, documents: [],
});

async function seedV77(properties: any[] = [], contracts: any[] = []) {
  const legacy = await openDB(DB_NAME, 77, {
    upgrade(db) {
      db.createObjectStore('properties', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('contracts', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('treasuryEvents', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('keyval');
    },
  });
  for (const p of properties) await legacy.put('properties', p);
  for (const c of contracts) await legacy.put('contracts', c);
  legacy.close();
}

const makeDraft = (o: Partial<ContractDraft>): ContractDraft => ({
  filaOriginal: 1,
  ficheroOrigen: 'activos.xlsx',
  origen: 'rentila',
  inmuebleRaw: 'P1',
  inmuebleIdSugerido: 1,
  inmuebleIdConfirmado: 1,
  inquilinoNombre: 'JUAN PEREZ LOPEZ',
  inquilinoCotitulares: [],
  inquilinoDni: null,
  inquilinoEmail: null,
  inquilinoTelefono: null,
  inquilinoExistenteId: null,
  modalidadAtlas: 'habitual',
  fechaInicio: '2024-01-01',
  fechaFin: '2028-12-31',
  rentaMensual: 400,
  fianza: 400,
  habitacionParseada: null,
  habitacionConfirmada: null,
  seccion: 'listos',
  motivoSeccion: '',
  decisionDuplicado: null,
  ...o,
});

const propModo = (id: number, alias: string, modo: 'piso_completo' | 'por_habitaciones') => ({
  ...prop(id, alias),
  modoExplotacion: modo,
});

describe('crearContractsDesdeDrafts', () => {
  beforeEach(() => {
    jest.resetModules();
    (globalThis as any).indexedDB = new IDBFactory();
  });

  it('crea Contracts SIN FIRMAR con origenImportacion y dispara sugerencias de bote', async () => {
    await seedV77([prop(1, 'P1')]);
    const { boteAnualService } = require('../boteAnualService');
    const { crearContractsDesdeDrafts } = require('../contractImportCreationService');
    const { initDB } = require('../db');

    const bote = await boteAnualService.crearOActualizarBote({
      inmuebleId: 1, año: 2024, importeDeclarado: 4800, díasDeclarados: 366,
    });

    const r = await crearContractsDesdeDrafts([
      makeDraft({ filaOriginal: 2, inquilinoNombre: 'A B' }),
      makeDraft({ filaOriginal: 3, inquilinoNombre: 'C D', inquilinoCotitulares: ['E F'] }),
    ]);

    expect(r.creados).toBe(2);
    expect(r.inquilinosNuevos).toBe(2);
    expect(r.rentaMensualTotal).toBe(800);
    expect(r.botesConSugerencia).toContain(bote.id);

    const db = await initDB();
    const contratos = await db.getAll('contracts');
    expect(contratos).toHaveLength(2);
    contratos.forEach((c: any) => {
      expect(c.estadoContrato).toBe('sin_firmar');
      expect(c.status).toBe('upcoming');
      expect(c.origenImportacion).toBe('rentila');
    });
    // Cotitulares preservados.
    const conCotitular = contratos.find((c: any) => c.inquilino.cotitulares?.length);
    expect(conCotitular?.inquilino.cotitulares).toEqual(['E F']);
  });

  it('respeta las decisiones de duplicados (omitir / fusionar / crear_nuevo)', async () => {
    const existente = {
      id: 100, inmuebleId: 2, estadoContrato: 'finalizado', status: 'terminated',
      modalidad: 'habitual', fechaInicio: '2022-01-01', fechaFin: '2023-12-31',
      rentaMensual: 420, monthlyRent: 420, diaPago: 1, margenGraciaDias: 5,
      indexacion: 'none', historicoIndexaciones: [], fianzaMeses: 1, fianzaImporte: 420,
      fianzaEstado: 'retenida', cuentaCobroId: 0, documents: [],
      inquilino: { nombre: 'IVAN DANIEL GOMEZ', apellidos: 'RAMIREZ', dni: '53639208B', email: '', telefono: '', cotitulares: [] },
    };
    await seedV77([prop(2, 'P2')], [existente]);
    const { crearContractsDesdeDrafts } = require('../contractImportCreationService');
    const { initDB } = require('../db');

    const r = await crearContractsDesdeDrafts([
      makeDraft({ filaOriginal: 2, inmuebleIdSugerido: 2, inmuebleIdConfirmado: 2, seccion: 'duplicados', inquilinoExistenteId: 100, decisionDuplicado: 'omitir' }),
      makeDraft({ filaOriginal: 3, inmuebleIdSugerido: 2, inmuebleIdConfirmado: 2, seccion: 'duplicados', inquilinoExistenteId: 100, decisionDuplicado: 'fusionar', inquilinoEmail: 'ivan@nuevo.com' }),
      makeDraft({ filaOriginal: 4, inmuebleIdSugerido: 2, inmuebleIdConfirmado: 2, seccion: 'duplicados', inquilinoExistenteId: 100, decisionDuplicado: 'crear_nuevo', inquilinoNombre: 'IVAN GOMEZ' }),
    ]);

    expect(r.omitidos).toBe(1);
    expect(r.fusionados).toBe(1);
    expect(r.creados).toBe(1);

    const db = await initDB();
    const contratos = await db.getAll('contracts');
    // El existente sigue + 1 nuevo (crear_nuevo). Omitir y fusionar no crean.
    expect(contratos).toHaveLength(2);
    // Fusionar rellenó el email del existente (estaba vacío).
    const fusionado = await db.get('contracts', 100);
    expect(fusionado.inquilino.email).toBe('ivan@nuevo.com');
  });

  it('agrega los botes con sugerencia de varios inmuebles', async () => {
    await seedV77([prop(1, 'P1'), prop(2, 'P2'), prop(3, 'P3'), prop(4, 'P4')]);
    const { boteAnualService } = require('../boteAnualService');
    const { crearContractsDesdeDrafts } = require('../contractImportCreationService');

    const b1 = await boteAnualService.crearOActualizarBote({ inmuebleId: 1, año: 2024, importeDeclarado: 4800, díasDeclarados: 366 });
    const b2 = await boteAnualService.crearOActualizarBote({ inmuebleId: 2, año: 2024, importeDeclarado: 4800, díasDeclarados: 366 });
    const b3 = await boteAnualService.crearOActualizarBote({ inmuebleId: 3, año: 2024, importeDeclarado: 4800, díasDeclarados: 366 });
    await boteAnualService.crearOActualizarBote({ inmuebleId: 4, año: 2024, importeDeclarado: 4800, díasDeclarados: 366 });

    const r = await crearContractsDesdeDrafts([
      makeDraft({ filaOriginal: 2, inmuebleIdSugerido: 1, inmuebleIdConfirmado: 1 }),
      makeDraft({ filaOriginal: 3, inmuebleIdSugerido: 2, inmuebleIdConfirmado: 2 }),
      makeDraft({ filaOriginal: 4, inmuebleIdSugerido: 3, inmuebleIdConfirmado: 3 }),
    ]);

    expect(r.creados).toBe(3);
    // Inmuebles 1·2·3 tienen contrato con solape; el 4 no.
    expect(r.botesConSugerencia.sort()).toEqual([b1.id, b2.id, b3.id].sort());
    expect(r.inmueblesAfectados.sort()).toEqual([1, 2, 3]);
  });

  it('§1.3 · por_habitaciones + HX parseado → asigna habitación HX', async () => {
    await seedV77([propModo(1, 'FA32', 'por_habitaciones')]);
    const { crearContractsDesdeDrafts } = require('../contractImportCreationService');
    const { initDB } = require('../db');

    await crearContractsDesdeDrafts([makeDraft({ habitacionParseada: 2 })]);

    const db = await initDB();
    const [c] = await db.getAll('contracts');
    expect(c.unidadTipo).toBe('habitacion');
    expect(c.habitacionId).toBe('H2');
  });

  it('§1.3 · por_habitaciones sin HX → habitación PENDIENTE (habitacionId vacío)', async () => {
    await seedV77([propModo(1, 'FA32', 'por_habitaciones')]);
    const { crearContractsDesdeDrafts } = require('../contractImportCreationService');
    const { initDB } = require('../db');

    await crearContractsDesdeDrafts([makeDraft({ habitacionParseada: null })]);

    const db = await initDB();
    const [c] = await db.getAll('contracts');
    expect(c.unidadTipo).toBe('habitacion');
    expect(c.habitacionId).toBeUndefined();
  });

  it('§1.3 · piso_completo → vivienda · ignora cualquier HX', async () => {
    await seedV77([propModo(1, 'Sant Joan', 'piso_completo')]);
    const { crearContractsDesdeDrafts } = require('../contractImportCreationService');
    const { initDB } = require('../db');

    await crearContractsDesdeDrafts([makeDraft({ habitacionParseada: 3 })]);

    const db = await initDB();
    const [c] = await db.getAll('contracts');
    expect(c.unidadTipo).toBe('vivienda');
    expect(c.habitacionId).toBeUndefined();
  });

  it('FIX habitaciones · inmueble SIN configurar + HX → habitación + marca el inmueble "por habitaciones"', async () => {
    // Caso Fuertes Acevedo (pantallazo Jose): el inmueble no tiene modoExplotacion
    // (prop() lo deja undefined). Antes salía "vivienda/Piso completo"; ahora la
    // habitación de Rentila se respeta y el inmueble queda marcado por habitaciones.
    await seedV77([prop(1, 'Fuertes Acevedo')]);
    const { crearContractsDesdeDrafts } = require('../contractImportCreationService');
    const { initDB } = require('../db');

    await crearContractsDesdeDrafts([
      makeDraft({ habitacionParseada: 2 }),
      makeDraft({ filaOriginal: 2, habitacionParseada: 5 }),
    ]);

    const db = await initDB();
    const contracts = await db.getAll('contracts');
    expect(contracts.every((c: any) => c.unidadTipo === 'habitacion')).toBe(true);
    expect(contracts.map((c: any) => c.habitacionId).sort()).toEqual(['H2', 'H5']);

    const propActualizado = await db.get('properties', 1);
    expect(propActualizado.modoExplotacion).toBe('por_habitaciones');
    // nº de habitaciones = mayor habitación vista (5).
    expect(propActualizado.alquilerPorHabitaciones).toEqual({ activo: true, numeroHabitaciones: 5 });
  });

  it('FIX habitaciones · piso_completo explícito NO se marca por habitaciones aunque venga HX', async () => {
    await seedV77([propModo(1, 'Sant Joan', 'piso_completo')]);
    const { crearContractsDesdeDrafts } = require('../contractImportCreationService');
    const { initDB } = require('../db');

    await crearContractsDesdeDrafts([makeDraft({ habitacionParseada: 3 })]);

    const db = await initDB();
    const propActualizado = await db.get('properties', 1);
    expect(propActualizado.modoExplotacion).toBe('piso_completo'); // intacto
  });

  it('crea un inmueble nuevo cuando el draft lo pide', async () => {
    await seedV77();
    const { crearContractsDesdeDrafts } = require('../contractImportCreationService');
    const { initDB } = require('../db');

    const r = await crearContractsDesdeDrafts([
      makeDraft({ seccion: 'revisar', crearInmuebleNuevo: true, inmuebleIdSugerido: null, inmuebleIdConfirmado: null, inmuebleRaw: 'NUEVO PISO OVIEDO' }),
    ]);

    expect(r.creados).toBe(1);
    const db = await initDB();
    const props = await db.getAll('properties');
    expect(props).toHaveLength(1);
    expect(props[0].alias).toBe('NUEVO PISO OVIEDO');
    const contratos = await db.getAll('contracts');
    expect(contratos[0].inmuebleId).toBe(props[0].id);
  });
});
