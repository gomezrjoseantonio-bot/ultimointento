import {
  avatarInfoPorContrato,
  colorAvatarPorContrato,
  generarIniciales,
  getInquilinoNombre,
} from '../inquilinoUtils';
import type { Contract } from '../../../../services/db';

const conNombre = (nombre: string, apellidos: string, over: Partial<Contract> = {}): Contract =>
  ({
    inquilino: { nombre, apellidos, dni: '', telefono: '', email: '' },
    ...over,
  }) as Contract;

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
  test('mismo nombre devuelve el mismo color (determinista por nombre)', () => {
    const a = conNombre('Juan', 'Calvo', { id: 7 });
    const b = conNombre('Juan', 'Calvo', { id: 999 });
    // El color depende del nombre, NO del id · el mismo inquilino mantiene color.
    expect(colorAvatarPorContrato(a)).toBe(colorAvatarPorContrato(b));
  });

  test('nombres distintos pueden dar colores distintos', () => {
    const nombres: Array<[string, string]> = [
      ['Juan', 'Calvo'],
      ['María', 'Gómez'],
      ['Laura', 'Sanz'],
      ['Pedro', 'Ruiz'],
      ['Ana', 'López'],
      ['Luis', 'Díaz'],
    ];
    const colors = new Set(nombres.map(([n, a]) => colorAvatarPorContrato(conNombre(n, a))));
    expect(colors.size).toBeGreaterThanOrEqual(3);
  });
});

describe('avatarInfoPorContrato', () => {
  test('documentoFirmado === false → unsigned (sin color de paleta)', () => {
    const info = avatarInfoPorContrato(conNombre('Juan', 'Calvo', { documentoFirmado: false }));
    expect(info.unsigned).toBe(true);
    expect(info.iniciales).toBe('JC');
  });

  test('documentoFirmado === true → firmado con color de paleta', () => {
    const info = avatarInfoPorContrato(conNombre('Juan', 'Calvo', { documentoFirmado: true }));
    expect(info.unsigned).toBe(false);
    expect(info.color).toMatch(/var\(--atlas-v5-c\d\)/);
  });

  test('documentoFirmado ausente (legacy) → tratado como firmado', () => {
    const info = avatarInfoPorContrato(conNombre('Ana', 'López'));
    expect(info.unsigned).toBe(false);
  });
});
