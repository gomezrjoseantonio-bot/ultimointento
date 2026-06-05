import {
  filtrarContratos,
  normalizarTexto,
  FILTROS_INICIALES,
  type FiltrosActivos,
} from '../filtrosActivos';
import type { Contract } from '../../../../services/db';

const HOY = new Date('2026-05-21T00:00:00Z');

const dayOffset = (days: number): string => {
  const d = new Date(Date.UTC(2026, 4, 21) + days * 24 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

const make = (
  id: number,
  overrides: Partial<Contract> = {},
): Contract =>
  ({
    id,
    inmuebleId: 1,
    unidadTipo: 'vivienda',
    modalidad: 'habitual',
    inquilino: { nombre: 'Juan', apellidos: 'Calvo', dni: '12345678A', telefono: '600000000', email: 'juan@example.com' },
    fechaInicio: '2024-01-01',
    fechaFin: '2099-12-31',
    rentaMensual: 800,
    diaPago: 1,
    margenGraciaDias: 5,
    indexacion: 'none',
    historicoIndexaciones: [],
    fianzaMeses: 1,
    fianzaImporte: 800,
    fianzaEstado: 'retenida',
    cuentaCobroId: 1,
    estadoContrato: 'activo',
    firma: { metodo: 'digital', estado: 'firmado' },
    ...overrides,
  }) as Contract;

const filtros = (overrides: Partial<FiltrosActivos> = {}): FiltrosActivos => ({
  ...FILTROS_INICIALES,
  ...overrides,
});

describe('normalizarTexto', () => {
  test('quita acentos · pasa a minúsculas', () => {
    expect(normalizarTexto('Gómez Áñoñó')).toBe('gomez anono');
  });
});

describe('filtrarContratos · búsqueda', () => {
  const cs = [
    make(1, { inquilino: { nombre: 'Juan', apellidos: 'Calvo', dni: '12345678A', telefono: '', email: 'juan@gmail.com' } }),
    make(2, { inquilino: { nombre: 'María', apellidos: 'Gómez', dni: '99887766X', telefono: '', email: 'maria@yahoo.es' } }),
    make(3, { inquilino: { nombre: 'Laura', apellidos: 'Sanz', dni: '11122233Z', telefono: '', email: 'laura@gmail.com' } }),
  ];

  test('búsqueda vacía · devuelve todos', () => {
    expect(filtrarContratos(cs, filtros(), HOY)).toHaveLength(3);
  });

  test('búsqueda por nombre · case-insensitive', () => {
    const r = filtrarContratos(cs, filtros({ busqueda: 'calvo' }), HOY);
    expect(r.map((c) => c.id)).toEqual([1]);
  });

  test('búsqueda por DNI parcial', () => {
    const r = filtrarContratos(cs, filtros({ busqueda: '11122' }), HOY);
    expect(r.map((c) => c.id)).toEqual([3]);
  });

  test('búsqueda por email parcial encuentra varios', () => {
    const r = filtrarContratos(cs, filtros({ busqueda: '@gmail' }), HOY);
    expect(r.map((c) => c.id).sort()).toEqual([1, 3]);
  });

  test('búsqueda con acento · "Gómez" encuentra "Gomez" y viceversa', () => {
    expect(filtrarContratos(cs, filtros({ busqueda: 'Gómez' }), HOY).map((c) => c.id)).toEqual([2]);
    expect(filtrarContratos(cs, filtros({ busqueda: 'gomez' }), HOY).map((c) => c.id)).toEqual([2]);
  });

  test('búsqueda sin resultados devuelve array vacío', () => {
    expect(filtrarContratos(cs, filtros({ busqueda: 'zzz-no-existe' }), HOY)).toEqual([]);
  });
});

describe('filtrarContratos · tipo y estado', () => {
  const cs = [
    make(1, { modalidad: 'habitual' }),
    make(2, { modalidad: 'temporada' }),
    make(3, { modalidad: 'vacacional' }),
    make(4, { modalidad: 'habitual', fechaFin: dayOffset(15) }),
    make(5, { firma: undefined, fechaFirmaContrato: undefined }),
  ];

  test('filtro tipo larga · solo modalidad habitual', () => {
    const r = filtrarContratos(cs, filtros({ tipo: 'larga' }), HOY);
    expect(r.map((c) => c.id).sort()).toEqual([1, 4, 5]);
  });

  test('filtro tipo corta · temporada/vacacional', () => {
    const r = filtrarContratos(cs, filtros({ tipo: 'corta' }), HOY);
    expect(r.map((c) => c.id).sort()).toEqual([2, 3]);
  });

  test('filtro estado sin-firmar · solo contratos sin firma', () => {
    const r = filtrarContratos(cs, filtros({ estado: 'sin-firmar' }), HOY);
    expect(r.map((c) => c.id)).toEqual([5]);
  });

  test('filtro estado vence-30d', () => {
    const r = filtrarContratos(cs, filtros({ estado: 'vence-30d' }), HOY);
    expect(r.map((c) => c.id)).toEqual([4]);
  });

  test('combinación AND · tipo larga + búsqueda', () => {
    const cs2 = [
      make(1, { modalidad: 'habitual', inquilino: { ...cs[0].inquilino, nombre: 'Juan', apellidos: 'Calvo' } }),
      make(2, { modalidad: 'temporada', inquilino: { ...cs[0].inquilino, nombre: 'Juan', apellidos: 'Veraneo' } }),
    ];
    const r = filtrarContratos(cs2, filtros({ tipo: 'larga', busqueda: 'juan' }), HOY);
    expect(r.map((c) => c.id)).toEqual([1]);
  });
});

