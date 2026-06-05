import { generarMeses24, calcularMapaTemporal } from '../mapaTemporalService';
import type { Contract, Property } from '../../../../services/db';

const HOY = new Date('2026-06-15T00:00:00Z');

const prop = (over: Partial<Property>): Property =>
  ({ id: 1, alias: 'X', bedrooms: 1, state: 'activo', modoExplotacion: 'piso_completo', ...over } as Property);

const contrato = (over: Partial<Contract>): Contract =>
  ({
    inmuebleId: 1,
    unidadTipo: 'vivienda',
    modalidad: 'habitual',
    inquilino: { nombre: 'T', apellidos: '', dni: '', telefono: '', email: '' },
    fechaInicio: '2025-01-01',
    fechaFin: '2099-12-31',
    rentaMensual: 1000,
    diaPago: 1,
    margenGraciaDias: 5,
    indexacion: 'none',
    historicoIndexaciones: [],
    fianzaMeses: 1,
    fianzaImporte: 1000,
    fianzaEstado: 'retenida',
    cuentaCobroId: 0,
    estadoContrato: 'activo',
    ...over,
  }) as Contract;

describe('generarMeses24', () => {
  it('produce 24 meses · 12 atrás + actual + 11 adelante · con marca del mes actual', () => {
    const meses = generarMeses24(HOY);
    expect(meses).toHaveLength(24);
    // El mes 13 (índice 12) es el actual (junio 2026).
    expect(meses[12].anio).toBe(2026);
    expect(meses[12].mes).toBe(5);
    expect(meses[0].anio).toBe(2025); // 12 meses atrás → jun 2025
    expect(meses[0].mes).toBe(5);
    expect(meses[23].anio).toBe(2027); // 11 meses adelante → may 2027
    expect(meses[23].mes).toBe(4);
  });
});

describe('calcularMapaTemporal', () => {
  it('piso completo · ocupado en el mes actual → celda pleno + esHoy', () => {
    const rows = calcularMapaTemporal([prop({})], [contrato({ id: 1 })], HOY);
    expect(rows).toHaveLength(1);
    const celdaHoy = rows[0].cells[12];
    expect(celdaHoy.esHoy).toBe(true);
    expect(celdaHoy.nivel).toBe('pleno');
  });

  it('mes anterior al inicio del contrato → vacío', () => {
    const rows = calcularMapaTemporal(
      [prop({})],
      [contrato({ id: 1, fechaInicio: '2026-06-01', fechaFin: '2099-12-31' })],
      HOY,
    );
    // 12 meses atrás (jun 2025) está antes del inicio → vacío.
    expect(rows[0].cells[0].nivel).toBe('vacio');
    expect(rows[0].cells[12].nivel).toBe('pleno');
  });

  it('por habitaciones · 1 de 4 ocupada → parcial', () => {
    const rows = calcularMapaTemporal(
      [prop({ modoExplotacion: 'por_habitaciones', bedrooms: 4 })],
      [contrato({ id: 1, unidadTipo: 'habitacion', habitacionId: 'H1' })],
      HOY,
    );
    expect(rows[0].cells[12].nivel).toBe('parcial');
  });

  it('marca warn en el mes de fin del contrato', () => {
    const rows = calcularMapaTemporal(
      [prop({})],
      [contrato({ id: 1, fechaInicio: '2025-01-01', fechaFin: '2026-06-20' })],
      HOY,
    );
    expect(rows[0].cells[12].warn).toBe(true);
  });
});
