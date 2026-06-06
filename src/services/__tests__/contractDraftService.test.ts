// Commit 4 · tests del normalizador a ContractDraft: mapeo de tipos, cotitulares,
// fuzzy match de inmuebles, detección de duplicados y clasificación (caso Jose).
import {
  MAPEO_TIPO_RENTILA_ATLAS,
  mapTipoRentilaToAtlas,
  mapTipoAtlasToModalidad,
  detectarCotitulares,
  sugerirInmueble,
  inferirHabitacion,
  detectarDuplicado,
  normalizarRentila,
  agruparPorSeccion,
} from '../contractDraftService';
import { Property, Contract } from '../db';
import { RentilaRow } from '../rentilaParserService';

const properties = ([
  { id: 1, alias: 'CB Sant Fruitós', address: 'Carrer Major 1, Sant Fruitós de Bages', cadastralReference: '7949807TP6074N0006YM' },
  { id: 2, alias: "Sant Joan d'En Coll", address: "Carrer Sant Joan d'En Coll 5, Manresa", cadastralReference: '1234567AB1234C1234DE' },
  { id: 3, alias: 'T48', address: 'Tenderina 48, Oviedo', cadastralReference: '' },
] as unknown) as Property[];

const existingContracts = ([
  { id: 100, inmuebleId: 2, inquilino: { nombre: 'IVAN DANIEL GOMEZ', apellidos: 'RAMIREZ', dni: '53639208B' } },
] as unknown) as Contract[];

const rentilaRow = (overrides: Partial<RentilaRow>): RentilaRow => ({
  filaOriginal: 2,
  ficheroOrigen: 'activos.xlsx',
  id: null,
  propiedad: '',
  tipo: 'Contrato de arrendamiento de vivienda',
  inicioAlquiler: '2024-01-01',
  finAlquiler: '2028-12-31',
  inquilino: '',
  alquiler: 500,
  gastos: 0,
  iva: null,
  fianza: 500,
  otrosGastos: 0,
  ...overrides,
});

describe('MAPEO_TIPO_RENTILA_ATLAS', () => {
  it('tiene las 5 entradas', () => {
    expect(Object.keys(MAPEO_TIPO_RENTILA_ATLAS)).toHaveLength(5);
  });

  it('mapea correctamente los 5 tipos cortos', () => {
    expect(mapTipoRentilaToAtlas('vivienda')).toBe('habitual');
    expect(mapTipoRentilaToAtlas('habitación')).toBe('habitual');
    expect(mapTipoRentilaToAtlas('habitación temporada')).toBe('vacacional');
    expect(mapTipoRentilaToAtlas('temporada')).toBe('vacacional');
    expect(mapTipoRentilaToAtlas('Otro')).toBe('habitual');
  });

  it('tolera las frases largas de Rentila', () => {
    expect(mapTipoRentilaToAtlas('Contrato de arrendamiento de vivienda')).toBe('habitual');
    expect(mapTipoRentilaToAtlas('Contrato de arrendamiento de temporada')).toBe('vacacional');
  });

  it('mapea los tipos de la plantilla ATLAS', () => {
    expect(mapTipoAtlasToModalidad('Vivienda LAU')).toBe('habitual');
    expect(mapTipoAtlasToModalidad('Habitación larga')).toBe('habitual');
    expect(mapTipoAtlasToModalidad('Vivienda temporada')).toBe('vacacional');
    expect(mapTipoAtlasToModalidad('Vacacional')).toBe('vacacional');
  });
});

describe('detectarCotitulares', () => {
  it('separa "A, B" en principal + 1 cotitular', () => {
    const r = detectarCotitulares('JORGE ANDERSON RIOS POSADA, SANDRA CHALARCA');
    expect(r.principal).toBe('JORGE ANDERSON RIOS POSADA');
    expect(r.cotitulares).toEqual(['SANDRA CHALARCA']);
  });

  it('separa "A, B, C" en principal + 2 cotitulares', () => {
    const r = detectarCotitulares('A, B, C');
    expect(r.principal).toBe('A');
    expect(r.cotitulares).toEqual(['B', 'C']);
  });

  it('sin comas → 0 cotitulares', () => {
    const r = detectarCotitulares('CONCEPCION RAMIREZ GUERERO');
    expect(r.principal).toBe('CONCEPCION RAMIREZ GUERERO');
    expect(r.cotitulares).toEqual([]);
  });
});

describe('sugerirInmueble', () => {
  it('match exacto por referencia catastral → confianza 1.0', () => {
    const r = sugerirInmueble('Piso - 7949807TP6074N0006YM', properties);
    expect(r.inmuebleId).toBe(1);
    expect(r.confianza).toBe(1.0);
  });

  it('CB Sant Fruitós · "1-SANT FRUITOS" → confianza alta', () => {
    const r = sugerirInmueble('1-SANT FRUITOS', properties);
    expect(r.inmuebleId).toBe(1);
    expect(r.confianza).toBeGreaterThanOrEqual(0.7);
  });

  it('"2-MANRESA" → Sant Joan d\'En Coll (confianza alta por dirección)', () => {
    const r = sugerirInmueble('2-MANRESA', properties);
    expect(r.inmuebleId).toBe(2);
    expect(r.confianza).toBeGreaterThanOrEqual(0.7);
  });

  it('"01-OVD-NICOLAI" → desconocido (confianza baja)', () => {
    const r = sugerirInmueble('01-OVD-NICOLAI', properties);
    expect(r.confianza).toBeLessThan(0.7);
  });
});

// Casos reportados por Jose · sensibilidad del fuzzy match de direcciones.
describe('sugerirInmueble · casos reales (sensibilidad direcciones)', () => {
  // Réplica de cómo crea las fichas el import de la declaración AEAT:
  // address = calle · province = MUNICIPIO (splitAddress → province: municipality).
  const props = ([
    { id: 10, alias: 'Piso Oviedo', address: 'Calle Fuertes Acevedo 32, 1 Dr', province: 'Oviedo' },
    { id: 11, alias: 'CB Sant Fruitós', address: 'Carrer de Carles Buïgas 12', province: 'Sant Fruitós de Bages' },
    { id: 12, alias: 'Tenderina 48', address: 'Calle Tenderina 48', province: 'Oviedo' },
    { id: 13, alias: 'Tenderina 64 4I', address: 'Calle Tenderina 64, 4 Izq', province: 'Oviedo' },
    // Dos inmuebles en Manresa: el piso y un parking accesorio (municipio en province).
    { id: 14, alias: "Sant Joan d'En Coll", address: "Carrer Sant Joan d'En Coll 5", province: 'Manresa' },
    { id: 15, alias: 'Parking Vic', address: 'Carretera de Vic 100', province: 'Manresa' },
  ] as unknown) as Property[];

  it('"4-ACEVEDO-H1" asimila a "Fuertes Acevedo" (ignora el sufijo de habitación)', () => {
    const r = sugerirInmueble('4-ACEVEDO-H1', props);
    expect(r.inmuebleId).toBe(10);
    expect(r.confianza).toBeGreaterThanOrEqual(0.7);
  });

  it('"1-SANT FRUITOS" asimila a "Carles Buïgas, Sant Fruitós"', () => {
    const r = sugerirInmueble('1-SANT FRUITOS', props);
    expect(r.inmuebleId).toBe(11);
    expect(r.confianza).toBeGreaterThanOrEqual(0.7);
  });

  it('"6-TENDERINA, 64 4I -004" distingue Tenderina 64 de Tenderina 48', () => {
    const r = sugerirInmueble('6-TENDERINA, 64 4I -004 - 0654104TP7005S0010PP', props);
    expect(r.inmuebleId).toBe(13);
    expect(r.confianza).toBeGreaterThanOrEqual(0.7);
  });

  it('"2-MANRESA" con piso Y parking en Manresa → ambiguo → a revisar (no auto-asigna el parking)', () => {
    const r = sugerirInmueble('2-MANRESA', props);
    // Confianza por debajo del umbral ⇒ el wizard lo manda a "revisar".
    expect(r.confianza).toBeLessThan(0.7);
  });

  it('typo/acento leve sigue casando ("acevdo" → Acevedo)', () => {
    const r = sugerirInmueble('ACEVDO', props);
    expect(r.inmuebleId).toBe(10);
  });
});

describe('detectarDuplicado', () => {
  it('detecta duplicado por NIF en el mismo inmueble', () => {
    const r = detectarDuplicado(
      { inmuebleIdSugerido: 2, inquilinoDni: '53639208B', inquilinoNombre: 'CUALQUIERA' },
      existingContracts,
    );
    expect(r?.existenteId).toBe(100);
    expect(r?.motivo).toContain('53639208B');
  });

  it('detecta duplicado por nombre fuzzy en el mismo inmueble (caso IVAN GOMEZ)', () => {
    const r = detectarDuplicado(
      { inmuebleIdSugerido: 2, inquilinoDni: null, inquilinoNombre: 'IVAN DANIEL GOMEZ RAMIREZ' },
      existingContracts,
    );
    expect(r?.existenteId).toBe(100);
  });

  it('no hay duplicado si el nombre no coincide', () => {
    const r = detectarDuplicado(
      { inmuebleIdSugerido: 2, inquilinoDni: null, inquilinoNombre: 'PEPE LOPEZ' },
      existingContracts,
    );
    expect(r).toBeNull();
  });

  it('no hay duplicado si es otro inmueble', () => {
    const r = detectarDuplicado(
      { inmuebleIdSugerido: 1, inquilinoDni: '53639208B', inquilinoNombre: 'IVAN DANIEL GOMEZ RAMIREZ' },
      existingContracts,
    );
    expect(r).toBeNull();
  });
});

describe('normalizarRentila · clasificación caso Jose', () => {
  it('clasifica en listos / revisar / duplicados', () => {
    const rows: RentilaRow[] = [
      rentilaRow({ filaOriginal: 2, propiedad: '1-SANT FRUITOS', inquilino: 'CONCEPCION RAMIREZ GUERERO' }),
      rentilaRow({ filaOriginal: 3, propiedad: '01-OVD-NICOLAI', inquilino: 'PEDRO SANTOS' }),
      rentilaRow({ filaOriginal: 4, propiedad: '2-MANRESA', inquilino: 'IVAN DANIEL GOMEZ RAMIREZ', alquiler: 430 }),
      rentilaRow({ filaOriginal: 5, propiedad: '1-SANT FRUITOS', inquilino: 'JORGE ANDERSON RIOS POSADA, SANDRA CHALARCA' }),
    ];

    const drafts = normalizarRentila(rows, properties, existingContracts);
    const { listos, revisar, duplicados } = agruparPorSeccion(drafts);

    expect(listos.map((d) => d.inmuebleRaw)).toEqual(['1-SANT FRUITOS', '1-SANT FRUITOS']);
    expect(revisar.map((d) => d.inmuebleRaw)).toEqual(['01-OVD-NICOLAI']);
    expect(duplicados.map((d) => d.inmuebleRaw)).toEqual(['2-MANRESA']);

    // El duplicado nace con decisión 'omitir' y referencia al contrato existente.
    expect(duplicados[0].decisionDuplicado).toBe('omitir');
    expect(duplicados[0].inquilinoExistenteId).toBe(100);

    // Los listos mapean el inmueble y no traen DNI (Rentila no lo exporta).
    expect(listos[0].inmuebleIdConfirmado).toBe(1);
    expect(listos[0].inquilinoDni).toBeNull();

    // Cotitulares detectados en la cuarta fila.
    const conCotitulares = drafts.find((d) => d.inquilinoNombre === 'JORGE ANDERSON RIOS POSADA');
    expect(conCotitulares?.inquilinoCotitulares).toEqual(['SANDRA CHALARCA']);
  });
});

// Caso Jose · "60 contratos por habitaciones" · inteligencia de habitación y planta.
describe('inferirHabitacion · inteligencia de habitación', () => {
  const tenderina64I = ({
    id: 13, alias: 'Tenderina 64 4I', address: 'Calle Tenderina 64, 4 Izq', province: 'Oviedo',
    modoExplotacion: 'por_habitaciones', explotacion: { unidadesArrendables: 4 },
  } as unknown) as Property;
  const acevedo = ({
    id: 10, alias: 'Piso Oviedo', address: 'Calle Fuertes Acevedo 32, 1 Dr', province: 'Oviedo',
    modoExplotacion: 'por_habitaciones', explotacion: { unidadesArrendables: 5 },
  } as unknown) as Property;
  const pisoCompleto = ({
    id: 12, alias: 'Tenderina 48', address: 'Calle Tenderina 48', province: 'Oviedo',
    modoExplotacion: 'piso_completo',
  } as unknown) as Property;

  it('sufijo HX explícito → ese número (formato Acevedo)', () => {
    expect(inferirHabitacion('4-ACEVEDO-H2', acevedo)).toBe(2);
    expect(inferirHabitacion('4-ACEVEDO-H5', acevedo)).toBe(5);
  });

  it('código de unidad zero-padded → habitación (formato Tenderina "-004")', () => {
    expect(inferirHabitacion('6-TENDERINA, 64 4I -004 - 0654104TP7005S0010PP', tenderina64I)).toBe(4);
    expect(inferirHabitacion('6-TENDERINA, 64 4I -001 - 0654104TP7005S0010PP', tenderina64I)).toBe(1);
    expect(inferirHabitacion('6-TENDERINA, 64 4I -003', tenderina64I)).toBe(3);
  });

  it('NO confunde la planta ("4I") con la habitación', () => {
    // El "4" de "4I" es planta, no habitación; la habitación es el código "001".
    expect(inferirHabitacion('6-TENDERINA, 64 4I -001', tenderina64I)).toBe(1);
  });

  it('piso completo → null (no se asigna habitación)', () => {
    expect(inferirHabitacion('3-TENDERINA 48', pisoCompleto)).toBeNull();
  });

  it('código fuera del nº de habitaciones → null (se pedirá)', () => {
    expect(inferirHabitacion('6-TENDERINA, 64 4I -009', tenderina64I)).toBeNull();
  });

  it('sin inmueble resuelto y sin HX → null', () => {
    expect(inferirHabitacion('2-MANRESA', null)).toBeNull();
  });
});

describe('sugerirInmueble · planta Iz/Dr (notación 4I/4D)', () => {
  const props = ([
    { id: 13, alias: 'Tenderina 64 4 Iz', address: 'Calle Tenderina 64, 4 Izq, Oviedo' },
    { id: 14, alias: 'Tenderina 64 4 Dr', address: 'Calle Tenderina 64, 4 Dcha, Oviedo' },
  ] as unknown) as Property[];

  it('"64 4I" → piso Izquierda · "64 4D" → piso Derecha (sin ambigüedad)', () => {
    const iz = sugerirInmueble('6-TENDERINA, 64 4I -001', props);
    expect(iz.inmuebleId).toBe(13);
    expect(iz.confianza).toBeGreaterThanOrEqual(0.7);

    const dr = sugerirInmueble('5-TENDERINA, 64 4D -002', props);
    expect(dr.inmuebleId).toBe(14);
    expect(dr.confianza).toBeGreaterThanOrEqual(0.7);
  });
});

describe('normalizarRentila · habitación auto en por_habitaciones (end-to-end)', () => {
  it('asigna la habitación desde "-004" sin pedirla', () => {
    const props = ([{
      id: 13, alias: 'Tenderina 64 4I', address: 'Calle Tenderina 64, 4 Izq', province: 'Oviedo',
      cadastralReference: '0654104TP7005S0010PP',
      modoExplotacion: 'por_habitaciones', explotacion: { unidadesArrendables: 4 },
    }] as unknown) as Property[];
    const row = rentilaRow({
      propiedad: '6-TENDERINA, 64 4I -004 - 0654104TP7005S0010PP',
      inquilino: 'MARIA PERNICA',
    });
    const [draft] = normalizarRentila([row], props, []);
    expect(draft.inmuebleIdConfirmado).toBe(13);
    expect(draft.habitacionParseada).toBe(4);
  });
});

// Caso Jose · "2-MANRESA" empataba piso vs parking → revisar. Si el parking está
// declarado como ACCESORIO del piso (vínculo AEAT), deja de competir y casa el piso.
describe('sugerirInmueble · excluye inmuebles accesorios (parking/trastero)', () => {
  const props = ([
    { id: 14, alias: "Sant Joan d'En Coll", address: "Carrer Sant Joan d'En Coll 5", province: 'Manresa', cadastralReference: '1234567AB1234C1234DE' },
    { id: 15, alias: 'Parking Manresa', address: "Carrer Sant Joan d'En Coll 5 parking", province: 'Manresa', cadastralReference: '7949807TP6074N0006YM' },
  ] as unknown) as Property[];

  it('sin info de accesorio → ambiguo → a revisar (comportamiento previo)', () => {
    const r = sugerirInmueble('2-MANRESA', props);
    expect(r.confianza).toBeLessThan(0.7);
  });

  it('con el parking marcado como accesorio → en empate de nombre gana el PISO', () => {
    const r = sugerirInmueble('2-MANRESA', props, new Set([15]));
    expect(r.inmuebleId).toBe(14);
    expect(r.confianza).toBeGreaterThanOrEqual(0.7);
  });

  it('RC explícita al accesorio SÍ lo asigna (ese año se alquila suelto · accesoriedad por ejercicio)', () => {
    const r = sugerirInmueble('Parking - 7949807TP6074N0006YM', props, new Set([15]));
    expect(r.inmuebleId).toBe(15);
    expect(r.confianza).toBe(1.0);
  });
});
