import {
  colorPorNumeroHabitacion,
  habitacionNumeroDe,
  resolverColorHabitacion,
} from '../timelineColores';
import type { Contract } from '../../../../services/db';

describe('colorPorNumeroHabitacion', () => {
  test('1..5 → verde/roja/amarilla/azul/negra', () => {
    expect(colorPorNumeroHabitacion(1)).toBe('verde');
    expect(colorPorNumeroHabitacion(2)).toBe('roja');
    expect(colorPorNumeroHabitacion(3)).toBe('amarilla');
    expect(colorPorNumeroHabitacion(4)).toBe('azul');
    expect(colorPorNumeroHabitacion(5)).toBe('negra');
  });

  test('ciclo de 5 colores para >5 habitaciones', () => {
    expect(colorPorNumeroHabitacion(6)).toBe('verde');
    expect(colorPorNumeroHabitacion(10)).toBe('negra');
  });

  test('valores inválidos · fallback verde', () => {
    expect(colorPorNumeroHabitacion(0)).toBe('verde');
    expect(colorPorNumeroHabitacion(-1)).toBe('verde');
    expect(colorPorNumeroHabitacion(NaN)).toBe('verde');
  });
});

describe('habitacionNumeroDe', () => {
  const c = (habitacionId?: string): Contract =>
    ({ habitacionId } as Contract);

  test('"hab-3" → 3', () => {
    expect(habitacionNumeroDe(c('hab-3'))).toBe(3);
  });

  test('"habitacion-1" → 1', () => {
    expect(habitacionNumeroDe(c('habitacion-1'))).toBe(1);
  });

  test('"5" sólo · 5', () => {
    expect(habitacionNumeroDe(c('5'))).toBe(5);
  });

  test('sin habitacionId · null', () => {
    expect(habitacionNumeroDe(c(undefined))).toBe(null);
  });

  test('string sin dígitos · null', () => {
    expect(habitacionNumeroDe(c('main'))).toBe(null);
  });
});

describe('resolverColorHabitacion', () => {
  test('contrato con hab-2 → roja', () => {
    expect(
      resolverColorHabitacion({ habitacionId: 'hab-2' } as Contract),
    ).toBe('roja');
  });

  test('contrato sin habitacionId · verde por defecto', () => {
    expect(resolverColorHabitacion({} as Contract)).toBe('verde');
  });
});
