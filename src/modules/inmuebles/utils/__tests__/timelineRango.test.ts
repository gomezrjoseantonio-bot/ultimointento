import {
  calcularRangoFechas,
  calcularLeftPorcentaje,
  calcularWidthPorcentaje,
  intersectaConRango,
  rangoEfectivoContrato,
  contarUnidadesArrendables,
} from '../timelineRango';
import type { Contract, Property } from '../../../../services/db';

const HOY = new Date(Date.UTC(2026, 4, 21));

const c = (overrides: Partial<Contract> = {}): Contract =>
  ({
    id: 1,
    inmuebleId: 1,
    unidadTipo: 'vivienda',
    modalidad: 'habitual',
    inquilino: { nombre: 'A', apellidos: 'B', dni: '', telefono: '', email: '' },
    fechaInicio: '2026-05-01',
    fechaFin: '2026-08-01',
    rentaMensual: 800,
    diaPago: 1,
    margenGraciaDias: 5,
    indexacion: 'none',
    historicoIndexaciones: [],
    fianzaMeses: 1,
    fianzaImporte: 800,
    fianzaEstado: 'retenida',
    cuentaCobroId: 0,
    estadoContrato: 'activo',
    ...overrides,
  }) as Contract;

const prop = (overrides: Partial<Property> = {}): Property =>
  ({
    id: 1,
    alias: 'A',
    address: '',
    postalCode: '',
    province: '',
    municipality: '',
    ccaa: '',
    purchaseDate: '2020-01-01',
    squareMeters: 50,
    bedrooms: 1,
    transmissionRegime: 'usada',
    state: 'activo',
    acquisitionCosts: { price: 100000 },
    documents: [],
    ...overrides,
  }) as Property;

describe('calcularRangoFechas', () => {
  test('rango 6m · 1 mes atrás + 6 adelante = 8 meses', () => {
    const r = calcularRangoFechas('6m', HOY);
    expect(r.meses.length).toBe(8);
    expect(r.meses[0].mes).toBe(3); // abril (mes -1)
    expect(r.meses[0].ano).toBe(2026);
  });

  test('rango 3m · 5 meses', () => {
    const r = calcularRangoFechas('3m', HOY);
    expect(r.meses.length).toBe(5);
  });

  test('rango 12m · 14 meses', () => {
    const r = calcularRangoFechas('12m', HOY);
    expect(r.meses.length).toBe(14);
  });

  test('inicio es primer día del mes anterior', () => {
    const r = calcularRangoFechas('6m', HOY);
    expect(r.inicio.getUTCDate()).toBe(1);
    expect(r.inicio.getUTCMonth()).toBe(3); // abril
  });
});

describe('calcularLeftPorcentaje y calcularWidthPorcentaje', () => {
  const r = calcularRangoFechas('6m', HOY);

  test('fecha = inicio del rango · 0%', () => {
    expect(calcularLeftPorcentaje(r.inicio, r)).toBeCloseTo(0, 1);
  });

  test('fecha = fin del rango · 100%', () => {
    expect(calcularLeftPorcentaje(r.fin, r)).toBeCloseTo(100, 1);
  });

  test('barra que cubre todo el rango · widthPct = 100', () => {
    expect(calcularWidthPorcentaje(r.inicio, r.fin, r)).toBeCloseTo(100, 1);
  });

  test('barra que empieza antes del rango · se clamp a 0', () => {
    const antes = new Date(Date.UTC(2020, 0, 1));
    const dentro = new Date(Date.UTC(2026, 5, 1));
    const left = calcularLeftPorcentaje(antes, r);
    const width = calcularWidthPorcentaje(antes, dentro, r);
    expect(left).toBe(0);
    expect(width).toBeGreaterThan(0);
  });

  test('barra que termina después del rango · clamp a 100%', () => {
    const dentro = new Date(Date.UTC(2026, 5, 1));
    const despues = new Date(Date.UTC(2030, 0, 1));
    const width = calcularWidthPorcentaje(dentro, despues, r);
    expect(width).toBeLessThanOrEqual(100);
    expect(width).toBeGreaterThan(0);
  });
});

describe('intersectaConRango y rangoEfectivoContrato', () => {
  const r = calcularRangoFechas('6m', HOY);

  test('contrato dentro del rango · intersecta', () => {
    expect(intersectaConRango(c({ fechaInicio: '2026-06-01', fechaFin: '2026-09-01' }), r)).toBe(true);
  });

  test('contrato anterior al rango · no intersecta', () => {
    expect(intersectaConRango(c({ fechaInicio: '2020-01-01', fechaFin: '2020-12-31' }), r)).toBe(false);
  });

  test('contrato indefinido (2099-12-31) · efectivo hasta rangoFin', () => {
    const ef = rangoEfectivoContrato(c({ fechaFin: '2099-12-31' }), r);
    expect(ef).not.toBeNull();
    expect(ef!.fin.getTime()).toBe(r.fin.getTime());
  });
});

describe('contarUnidadesArrendables', () => {
  test('suma bedrooms de propiedades activas', () => {
    const ps = [prop({ bedrooms: 5 }), prop({ id: 2, bedrooms: 1 })];
    expect(contarUnidadesArrendables(ps)).toBe(6);
  });

  test('propiedades vendidas no cuentan', () => {
    const ps = [prop({ bedrooms: 5 }), prop({ id: 2, bedrooms: 2, state: 'vendido' })];
    expect(contarUnidadesArrendables(ps)).toBe(5);
  });

  test('bedrooms 0 cuenta como 1 (piso completo mínimo)', () => {
    const ps = [prop({ bedrooms: 0 })];
    expect(contarUnidadesArrendables(ps)).toBe(1);
  });
});
