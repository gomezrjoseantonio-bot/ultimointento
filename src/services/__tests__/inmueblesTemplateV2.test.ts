/**
 * FIX onboarding · PUNTO 2 · plantilla de inmuebles espejo del formulario.
 *
 * Cubre (§3):
 *   · plantilla nueva · fila completa crea el inmueble con todos los campos
 *   · fila solo alias+tipo → crea con el resto vacío
 *   · plantilla vieja (12 columnas) sigue parseando (retrocompatibilidad)
 *   · fechas · celda Excel nativa · "15/06/2021" · "2021-06-15" → misma fecha
 *   · importes · "1.234,56" → 1234.56
 *   · revisión · 2 válidas + 1 inválida → confirmar crea solo las válidas
 */
import * as XLSX from 'xlsx';

const mockProperties: Array<Record<string, unknown>> = [];
let mockNextId = 1;

jest.mock('../db', () => ({
  __esModule: true,
  initDB: async () => ({
    getAll: async (store: string) => (store === 'properties' ? mockProperties : []),
    add: async (store: string, value: Record<string, unknown>) => {
      if (store !== 'properties') return undefined;
      const id = mockNextId++;
      mockProperties.push({ ...value, id });
      return id;
    },
  }),
}));

import { parseInmueblesTemplateXlsx } from '../inmueblesTemplateParserService';
import { revisarRows, crearInmueblesDesdeRows } from '../inmueblesImportCreationService';

/** Construye un File-like .xlsx en memoria a partir de una matriz. */
function makeFile(aoa: unknown[][]): File {
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Atlas');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array;
  return { arrayBuffer: async () => buf } as unknown as File;
}

const HEADER_NUEVA = [
  'Alias', 'Dirección', 'Tipo de inmueble (piso/parking/trastero/local/otro)', 'Referencia catastral',
  'Uso y alquiler', 'Alquiler por habitaciones (sí/no)', 'Nº habitaciones', 'Baños', 'm² útiles',
  'Urbana/rústica', '% propiedad', 'Anexo parking (sí/no)', 'Anexo trastero (sí/no)', 'Fecha compra',
  'Precio compra €', 'Gastos compra €', 'Aportación propia €', 'Importe financiado €',
  'Valor catastral €', 'Valor catastral construcción €', 'Valor catastral revisado (sí/no)',
];

const HEADER_VIEJA = [
  'Alias', 'Dirección', 'Referencia catastral', 'Modo explotación (completo/habitaciones)',
  'Nº habitaciones', 'Fecha compra', 'Precio compra €', 'Gastos compra €', 'Aportación propia €',
  'Importe financiado €', 'Valor catastral €', 'Valor catastral construcción €',
];

beforeEach(() => {
  mockProperties.length = 0;
  mockNextId = 1;
});

describe('plantilla nueva · espejo del formulario', () => {
  it('fila completa parsea todos los campos', async () => {
    const file = makeFile([
      HEADER_NUEVA,
      ['Piso Centro', 'Calle Mayor 10', 'piso', 'RC1', 'larga_estancia', 'no', 3, 2, 90, 'urbana', 100, 'sí', 'no',
        new Date(2021, 5, 15), 100000, 12000, 32000, 80000, 60000, 42000, 'sí'],
    ]);
    const [row] = await parseInmueblesTemplateXlsx(file);
    expect(row.tipoActivo).toBe('piso');
    expect(row.usoTipo).toBe('larga_estancia');
    expect(row.m2).toBe(90);
    expect(row.banos).toBe(2);
    expect(row.tieneParking).toBe(true);
    expect(row.tieneTrastero).toBe(false);
    expect(row.porcentajePropiedad).toBe(100);
    expect(row.valorCatastralRevisado).toBe(true);
    expect(row.fechaCompra).toBe('2021-06-15');
  });

  it('fila completa crea Property con todos los campos persistidos', async () => {
    const file = makeFile([
      HEADER_NUEVA,
      ['Piso Centro', 'Calle Mayor 10', 'piso', 'RC1', 'turistico', 'sí', 3, 2, 95, 'urbana', 50, 'sí', 'no',
        new Date(2021, 5, 15), 100000, 12000, 32000, 80000, 60000, 42000, 'sí'],
    ]);
    const rows = await parseInmueblesTemplateXlsx(file);
    const res = await crearInmueblesDesdeRows(rows);
    expect(res.creados).toBe(1);
    const p = mockProperties[0] as Record<string, any>;
    expect(p.tipoActivo).toBe('piso');
    expect(p.squareMeters).toBe(95);
    expect(p.bathrooms).toBe(2);
    expect(p.usoTipo).toBe('turistico');
    expect(p.porcentajePropiedad).toBe(50);
    expect(p.anexos.tieneParking).toBe(true);
    expect(p.alquilerPorHabitaciones.activo).toBe(true);
    expect(p.fiscalData.cadastralRevised).toBe(true);
  });

  it('fila solo con alias + tipo crea con el resto vacío', async () => {
    const file = makeFile([HEADER_NUEVA, ['Trastero 3', '', 'trastero']]);
    const rows = await parseInmueblesTemplateXlsx(file);
    expect(rows).toHaveLength(1);
    const res = await crearInmueblesDesdeRows(rows);
    expect(res.creados).toBe(1);
    const p = mockProperties[0] as Record<string, any>;
    expect(p.tipoActivo).toBe('trastero');
    expect(p.alias).toBe('Trastero 3');
    expect(p.squareMeters).toBe(0);
    expect(p.acquisitionCosts.price).toBe(0);
  });
});

describe('retrocompatibilidad · plantilla vieja de 12 columnas', () => {
  it('sigue parseando y creando', async () => {
    const file = makeFile([
      HEADER_VIEJA,
      ['Piso Viejo', 'Calle Vieja 1', 'RC9', 'completo', 2, new Date(2020, 0, 10), 90000, 9000, 20000, 70000, 50000, 35000],
    ]);
    const rows = await parseInmueblesTemplateXlsx(file);
    expect(rows).toHaveLength(1);
    expect(rows[0].alias).toBe('Piso Viejo');
    expect(rows[0].modoExplotacion).toBe('piso_completo');
    expect(rows[0].precioCompra).toBe(90000);
    expect(rows[0].importeFinanciado).toBe(70000);
    expect(rows[0].tipoActivo).toBe('piso'); // por defecto · la vieja no trae tipo
  });
});

describe('formatos es-ES (§2.7)', () => {
  it('fecha · celda nativa, DD/MM/AAAA e ISO producen la misma fecha', async () => {
    const file = makeFile([
      HEADER_NUEVA,
      ['A', '', 'piso', '', '', '', '', '', '', '', '', '', '', new Date(2021, 5, 15), 1, 0, 0, 0, 0, 0, ''],
      ['B', '', 'piso', '', '', '', '', '', '', '', '', '', '', '15/06/2021', 1, 0, 0, 0, 0, 0, ''],
      ['C', '', 'piso', '', '', '', '', '', '', '', '', '', '', '2021-06-15', 1, 0, 0, 0, 0, 0, ''],
    ]);
    const rows = await parseInmueblesTemplateXlsx(file);
    expect(rows.map((r) => r.fechaCompra)).toEqual(['2021-06-15', '2021-06-15', '2021-06-15']);
  });

  it('importe "1.234,56" parsea como 1234.56', async () => {
    const file = makeFile([HEADER_NUEVA, ['A', '', 'piso', '', '', '', '', '', '', '', '', '', '', '', '1.234,56', 0, 0, 0, 0, 0, '']]);
    const [row] = await parseInmueblesTemplateXlsx(file);
    expect(row.precioCompra).toBe(1234.56);
  });
});

describe('revisión · válidas vs incidencias', () => {
  it('2 válidas + 1 inválida → confirmar crea solo las válidas', async () => {
    const file = makeFile([
      HEADER_NUEVA,
      ['Piso A', 'Dir A', 'piso', '', '', '', '', '', '', '', '', '', '', '', 100000, 0, 0, 0, 0, 0, ''],
      ['', '', 'piso', '', '', '', '', '', '', '', '', '', '', '', 50000, 0, 0, 0, 0, 0, ''], // precio pero sin alias ni dirección → inválida
      ['Piso C', '', 'piso', '', '', '', '', '', '', '', '', '', '', '', 120000, 0, 0, 0, 0, 0, ''],
    ]);
    const rows = await parseInmueblesTemplateXlsx(file);
    const revs = revisarRows(rows);
    expect(revs.filter((r) => r.valido)).toHaveLength(2);
    expect(revs.filter((r) => !r.valido)).toHaveLength(1);

    const res = await crearInmueblesDesdeRows(rows);
    expect(res.creados).toBe(2);
    expect(res.errores).toHaveLength(1);
  });

  it('idempotencia por dirección · no duplica un inmueble ya existente con esa dirección', async () => {
    mockProperties.push({ id: 99, alias: 'Existente', address: 'Calle Repetida 1' });
    // Fila sin alias · identificada por dirección coincidente → se salta.
    const file = makeFile([HEADER_NUEVA, ['', 'Calle Repetida 1', 'piso', '', '', '', '', '', '', '', '', '', '', '', 100000, 0, 0, 0, 0, 0, '']]);
    const rows = await parseInmueblesTemplateXlsx(file);
    const res = await crearInmueblesDesdeRows(rows);
    expect(res.creados).toBe(0);
    expect(res.saltados).toBe(1);
  });
});
