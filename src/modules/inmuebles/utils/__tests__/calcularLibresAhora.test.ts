import { calcularLibresAhora } from '../calcularLibresAhora';
import type { Contract, Property } from '../../../../services/db';

const HOY = new Date('2026-05-21T00:00:00Z');

const property = (id: number, alias: string, bedrooms: number): Property => ({
  id,
  alias,
  address: '',
  postalCode: '',
  province: '',
  municipality: '',
  ccaa: '',
  purchaseDate: '2020-01-01',
  squareMeters: 50,
  bedrooms,
  transmissionRegime: 'usada',
  state: 'activo',
  acquisitionCosts: { price: 100000 },
  documents: [],
});

const contract = (
  id: number,
  inmuebleId: number,
  estado: Contract['estadoContrato'],
  overrides: Partial<Contract> = {},
): Contract => ({
  id,
  inmuebleId,
  unidadTipo: 'habitacion',
  modalidad: 'habitual',
  inquilino: { nombre: 'X', apellidos: 'Y', dni: '', telefono: '', email: '' },
  fechaInicio: '2024-01-01',
  fechaFin: '2099-12-31',
  rentaMensual: 600,
  diaPago: 1,
  margenGraciaDias: 5,
  indexacion: 'none',
  historicoIndexaciones: [],
  fianzaMeses: 1,
  fianzaImporte: 600,
  fianzaEstado: 'retenida',
  cuentaCobroId: 1,
  estadoContrato: estado,
  ...overrides,
});

describe('calcularLibresAhora', () => {
  test('sin propiedades · libres = 0', () => {
    const r = calcularLibresAhora([], [], HOY);
    expect(r.total).toBe(0);
    expect(r.unidades).toEqual([]);
  });

  test('1 propiedad con 3 habitaciones · 2 contratos activos · libres = 1', () => {
    const props = [property(1, 'Casa A', 3)];
    const contratos = [
      contract(1, 1, 'activo'),
      contract(2, 1, 'activo'),
    ];
    const r = calcularLibresAhora(contratos, props, HOY);
    expect(r.total).toBe(1);
    expect(r.unidades).toHaveLength(1);
    expect(r.unidades[0].inmuebleAlias).toBe('Casa A');
  });

  test('1 propiedad con 3 habitaciones · 0 contratos · libres = 3', () => {
    const props = [property(1, 'Casa A', 3)];
    const r = calcularLibresAhora([], props, HOY);
    expect(r.total).toBe(3);
    expect(r.unidades).toHaveLength(3);
  });

  test('2 propiedades · contratos repartidos · libres correctos por propiedad', () => {
    const props = [property(1, 'A', 2), property(2, 'B', 3)];
    const contratos = [contract(1, 1, 'activo'), contract(2, 2, 'activo')];
    const r = calcularLibresAhora(contratos, props, HOY);
    expect(r.total).toBe(3);
    expect(r.unidades.filter((u) => u.inmuebleId === 1)).toHaveLength(1);
    expect(r.unidades.filter((u) => u.inmuebleId === 2)).toHaveLength(2);
  });

  test('contratos finalizados se ignoran (solo activos ocupan)', () => {
    const props = [property(1, 'A', 2)];
    const contratos = [contract(1, 1, 'finalizado'), contract(2, 1, 'activo')];
    const r = calcularLibresAhora(contratos, props, HOY);
    expect(r.total).toBe(1);
  });

  test('contrato indefinido (2099-12-31) cuenta como ocupante activo', () => {
    const props = [property(1, 'A', 2)];
    const contratos = [
      contract(1, 1, 'activo', { fechaFin: '2099-12-31' }),
      contract(2, 1, 'activo', { fechaFin: '2099-12-31' }),
    ];
    const r = calcularLibresAhora(contratos, props, HOY);
    expect(r.total).toBe(0);
  });

  test('diasLibre se calcula desde último contrato finalizado', () => {
    const props = [property(1, 'A', 2)];
    const contratos = [
      contract(1, 1, 'activo'),
      contract(2, 1, 'finalizado', { fechaFin: '2026-05-01' }),
    ];
    const r = calcularLibresAhora(contratos, props, HOY);
    expect(r.total).toBe(1);
    expect(r.unidades[0].diasLibre).toBe(20);
  });

  test('propiedad inactiva (vendida) se ignora', () => {
    const props = [{ ...property(1, 'A', 2), state: 'vendido' as const }];
    const r = calcularLibresAhora([], props, HOY);
    expect(r.total).toBe(0);
  });
});
