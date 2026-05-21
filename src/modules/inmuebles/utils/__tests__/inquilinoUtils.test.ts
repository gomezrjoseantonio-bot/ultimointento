import {
  colorAvatarPorContrato,
  generarIniciales,
  getInquilinoNombre,
} from '../inquilinoUtils';
import type { Contract } from '../../../../services/db';

describe('generarIniciales', () => {
  test('nombre de 1 palabra → 2 primeras letras mayúsculas', () => {
    expect(generarIniciales('Calvo')).toBe('CA');
  });
  test('nombre de 2 palabras → inicial de cada palabra', () => {
    expect(generarIniciales('Juan Calvo')).toBe('JC');
  });
  test('nombre de 3+ palabras → primera + segunda inicial', () => {
    expect(generarIniciales('Juan Calvo Pérez')).toBe('JC');
  });
  test('string vacío → "·"', () => {
    expect(generarIniciales('')).toBe('·');
  });
  test('null/undefined → "·"', () => {
    expect(generarIniciales(null)).toBe('·');
    expect(generarIniciales(undefined)).toBe('·');
  });
  test('múltiples espacios entre palabras se ignoran', () => {
    expect(generarIniciales('  Juan   Calvo  ')).toBe('JC');
  });
});

describe('getInquilinoNombre', () => {
  const base: Contract = {
    inquilino: { nombre: 'Juan', apellidos: 'Calvo', dni: '', telefono: '', email: '' },
  } as Contract;

  test('concat nombre + apellidos', () => {
    expect(getInquilinoNombre(base)).toBe('Juan Calvo');
  });

  test('inquilino sin apellidos', () => {
    expect(
      getInquilinoNombre({
        inquilino: { nombre: 'Juan', apellidos: '', dni: '', telefono: '', email: '' },
      } as Contract),
    ).toBe('Juan');
  });

  test('inquilino vacío → "—"', () => {
    expect(
      getInquilinoNombre({
        inquilino: { nombre: '', apellidos: '', dni: '', telefono: '', email: '' },
      } as Contract),
    ).toBe('—');
  });
});

describe('colorAvatarPorContrato', () => {
  test('mismo id devuelve el mismo color (determinista)', () => {
    const c = { id: 7 } as Contract;
    expect(colorAvatarPorContrato(c)).toBe(colorAvatarPorContrato(c));
  });

  test('ids distintos pueden dar colores distintos', () => {
    const colors = new Set();
    for (let i = 0; i < 6; i += 1) {
      colors.add(colorAvatarPorContrato({ id: i } as Contract));
    }
    // hay 6 colores en la paleta · esperamos al menos 3 distintos en 6 ids
    expect(colors.size).toBeGreaterThanOrEqual(3);
  });

  test('contrato sin id usa hash 0', () => {
    expect(colorAvatarPorContrato({} as Contract)).toBe(colorAvatarPorContrato({ id: 0 } as Contract));
  });
});
