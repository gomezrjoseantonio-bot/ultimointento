// Regresión · importador de aportaciones históricas para planes de pensiones.
//
// Bug reportado: un extracto de plan de empleo (BBVA) con el desglose
// `importe_empresa` / `importe_individuo` pero SIN columna `importe` se
// previsualizaba como «0 aportaciones detectadas · N con error» y una tabla
// vacía —imposible de corregir— porque cada fila caía al ramo de posición
// normal y se descartaba en silencio como «importe no válido».
//
// Estas pruebas fijan el comportamiento correcto: la presencia del desglose
// empresa/individuo basta para reconocer la fila como aportación a un plan, de
// modo que se detecta (y se puede corregir/importar) aunque el plan todavía no
// exista.

import * as XLSX from 'xlsx';

const mockGetPosiciones = jest.fn();
const mockGetAllPlanes = jest.fn();

jest.mock('../db', () => ({
  __esModule: true,
  initDB: async () => ({ add: jest.fn() }),
}));
jest.mock('../inversionesService', () => ({
  __esModule: true,
  inversionesService: {
    getPosiciones: () => mockGetPosiciones(),
    addAportacion: jest.fn(),
  },
}));
jest.mock('../planesInversionService', () => ({
  __esModule: true,
  planesInversionService: {
    getAllPlanes: () => mockGetAllPlanes(),
  },
}));

import { previsualizarImportacionAportaciones } from '../inversionesAportacionesImportService';

const HEADER = [
  'posicion_id',
  'posicion_nombre',
  'entidad',
  'fecha',
  'importe',
  'importe_empresa',
  'importe_individuo',
  'notas',
];

function makeXlsx(rows: unknown[][]): File {
  const ws = XLSX.utils.aoa_to_sheet([HEADER, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Aportaciones');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array;
  return {
    name: 'aportaciones.xlsx',
    arrayBuffer: async () => buf,
  } as unknown as File;
}

// Fila estilo extracto BBVA: sin `importe`, con desglose empresa/individuo.
const filaPension = ['1', 'Plan de pensiones de empleo', 'BBVA', '2016-07-27', '', '127.61', '95.71', 'nota'];

beforeEach(() => {
  mockGetPosiciones.mockReset().mockResolvedValue([]);
  mockGetAllPlanes.mockReset().mockResolvedValue([]);
});

describe('previsualizarImportacionAportaciones · desglose de plan de pensiones', () => {
  it('detecta las filas con desglose empresa/individuo aunque el plan NO exista (no las descarta en silencio)', async () => {
    const file = makeXlsx([filaPension, [...filaPension.slice(0, 3), '2016-08-30', '', '127.61', '95.71', 'nota2']]);

    const preview = await previsualizarImportacionAportaciones(file);

    // Antes del fix: 0 detectadas / tabla vacía. Ahora: 2 filas surgen como
    // error corregible (el plan aún no existe), NO se pierden.
    expect(preview.totalAportacionesDetectadas).toBe(2);
    expect(preview.rows).toHaveLength(2);
    expect(preview.totalValidas).toBe(0);
    expect(preview.totalConError).toBe(2);
    expect(preview.rows[0].estado).toBe('error');
    // El importe mostrado es la suma del desglose (empresa + individuo).
    expect(preview.rows[0].importe).toBeCloseTo(223.32, 2);
    expect(preview.rows[0].importeEmpresa).toBeCloseTo(127.61, 2);
    expect(preview.rows[0].importeIndividuo).toBeCloseTo(95.71, 2);
  });

  it('marca las filas como válidas cuando existe un plan que coincide por nombre + gestora', async () => {
    mockGetAllPlanes.mockResolvedValue([
      {
        id: 'plan_1',
        nombre: 'Plan de pensiones de empleo',
        gestoraActual: 'BBVA',
        empresaPagadora: { nombre: 'BBVA' },
      },
    ]);
    const file = makeXlsx([filaPension]);

    const preview = await previsualizarImportacionAportaciones(file);

    expect(preview.totalValidas).toBe(1);
    expect(preview.rows[0].estado).toBe('valida');
    expect(preview.rows[0].importe).toBeCloseTo(223.32, 2);
  });

  it('no confunde una posición normal con importe simple (sin regresión)', async () => {
    mockGetPosiciones.mockResolvedValue([
      { id: 5, nombre: 'Fondo RV', entidad: 'BBVA', tipo: 'fondo' },
    ]);
    const file = makeXlsx([['5', 'Fondo RV', 'BBVA', '2024-02-15', '1500', '', '', 'compra']]);

    const preview = await previsualizarImportacionAportaciones(file);

    expect(preview.totalValidas).toBe(1);
    expect(preview.rows[0].estado).toBe('valida');
    expect(preview.rows[0].importe).toBe(1500);
    // Rama de posición normal · sin desglose de plan.
    expect(preview.rows[0].importeEmpresa).toBeUndefined();
  });
});
