import {
  filtrarVencen30d,
  filtrarVencen30a90d,
  filtrarContratosVencenEn,
} from '../filtrosVencimiento';
import type { Contract } from '../../../../services/db';

const HOY = new Date('2026-05-21T12:00:00Z');

const dayOffset = (days: number): string => {
  const d = new Date(Date.UTC(2026, 4, 21) + days * 24 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

const contract = (
  id: number,
  estado: Contract['estadoContrato'],
  fechaFin: string,
  overrides: Partial<Contract> = {},
): Contract => ({
  id,
  inmuebleId: 1,
  unidadTipo: 'vivienda',
  modalidad: 'habitual',
  inquilino: { nombre: 'J', apellidos: 'Sanz', dni: '', telefono: '', email: '' },
  fechaInicio: '2024-01-01',
  fechaFin,
  rentaMensual: 800,
  diaPago: 1,
  margenGraciaDias: 5,
  indexacion: 'none',
  historicoIndexaciones: [],
  fianzaMeses: 1,
  fianzaImporte: 800,
  fianzaEstado: 'retenida',
  cuentaCobroId: 1,
  estadoContrato: estado,
  ...overrides,
});

describe('filtrosVencimiento', () => {
  test('sin contratos · resultado vacío', () => {
    expect(filtrarVencen30d([], HOY)).toEqual([]);
    expect(filtrarVencen30a90d([], HOY)).toEqual([]);
  });

  test('contrato vence en 15 días · aparece en 30d, NO en 30-90d', () => {
    const c = contract(1, 'activo', dayOffset(15));
    expect(filtrarVencen30d([c], HOY)).toHaveLength(1);
    expect(filtrarVencen30a90d([c], HOY)).toHaveLength(0);
  });

  test('contrato vence en 45 días · NO en 30d, sí en 30-90d', () => {
    const c = contract(1, 'activo', dayOffset(45));
    expect(filtrarVencen30d([c], HOY)).toHaveLength(0);
    expect(filtrarVencen30a90d([c], HOY)).toHaveLength(1);
  });

  test('contrato vence en 100 días · ninguno', () => {
    const c = contract(1, 'activo', dayOffset(100));
    expect(filtrarVencen30d([c], HOY)).toHaveLength(0);
    expect(filtrarVencen30a90d([c], HOY)).toHaveLength(0);
  });

  test('contrato finalizado · ignorado', () => {
    const c = contract(1, 'finalizado', dayOffset(15));
    expect(filtrarVencen30d([c], HOY)).toHaveLength(0);
  });

  test('contrato indefinido (2099-12-31) · ignorado', () => {
    const c = contract(1, 'activo', '2099-12-31');
    expect(filtrarVencen30d([c], HOY)).toHaveLength(0);
    expect(filtrarVencen30a90d([c], HOY)).toHaveLength(0);
  });

  test('contrato ya vencido (ayer) · NO aparece en 30d', () => {
    const c = contract(1, 'activo', dayOffset(-1));
    expect(filtrarVencen30d([c], HOY)).toHaveLength(0);
  });

  test('múltiples contratos · ordenados ascendente por diasRestantes', () => {
    const cs = [
      contract(1, 'activo', dayOffset(25)),
      contract(2, 'activo', dayOffset(5)),
      contract(3, 'activo', dayOffset(15)),
    ];
    const r = filtrarVencen30d(cs, HOY);
    expect(r.map((c) => c.contrato.id)).toEqual([2, 3, 1]);
  });

  test('exclusividad de rangos · día 30 cuenta en 30d, día 31 en 30-90d', () => {
    const c30 = contract(10, 'activo', dayOffset(30));
    const c31 = contract(11, 'activo', dayOffset(31));
    expect(filtrarVencen30d([c30], HOY)).toHaveLength(1);
    expect(filtrarVencen30d([c31], HOY)).toHaveLength(0);
    expect(filtrarVencen30a90d([c31], HOY)).toHaveLength(1);
    expect(filtrarVencen30a90d([c30], HOY)).toHaveLength(0);
  });

  test('inquilinoNombre se compone de nombre + apellidos', () => {
    const c = contract(1, 'activo', dayOffset(10), {
      inquilino: { nombre: 'Laura', apellidos: 'Sanz', dni: '', telefono: '', email: '' },
    });
    const r = filtrarVencen30d([c], HOY);
    expect(r[0].inquilinoNombre).toBe('Laura Sanz');
  });

  test('filtrarContratosVencenEn rango arbitrario', () => {
    const c = contract(1, 'activo', dayOffset(45));
    expect(filtrarContratosVencenEn([c], 40, 50, HOY)).toHaveLength(1);
    expect(filtrarContratosVencenEn([c], 50, 60, HOY)).toHaveLength(0);
  });
});
