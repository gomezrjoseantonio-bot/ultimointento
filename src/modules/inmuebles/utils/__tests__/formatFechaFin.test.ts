import { esFechaIndefinida, formatFechaFinContrato } from '../formatFechaFin';

describe('esFechaIndefinida', () => {
  test('fecha sentinel 2099-12-31 → true', () => {
    expect(esFechaIndefinida('2099-12-31')).toBe(true);
  });

  test('fecha sentinel con sufijo ISO → true', () => {
    expect(esFechaIndefinida('2099-12-31T00:00:00.000Z')).toBe(true);
  });

  test('flag indefinido prevalece sobre fecha real', () => {
    expect(esFechaIndefinida('2026-05-15', true)).toBe(true);
  });

  test('fecha real con flag false → false', () => {
    expect(esFechaIndefinida('2026-05-15', false)).toBe(false);
  });

  test('null → true (indefinida)', () => {
    expect(esFechaIndefinida(null)).toBe(true);
  });

  test('undefined → true (indefinida)', () => {
    expect(esFechaIndefinida(undefined)).toBe(true);
  });

  test('fecha real cualquiera → false', () => {
    expect(esFechaIndefinida('2026-05-15')).toBe(false);
    expect(esFechaIndefinida('2030-01-01')).toBe(false);
  });
});

describe('formatFechaFinContrato', () => {
  test('fecha sentinel 2099-12-31 → "Indefinido"', () => {
    expect(formatFechaFinContrato('2099-12-31')).toBe('Indefinido');
  });

  test('fecha sentinel con sufijo ISO → "Indefinido"', () => {
    expect(formatFechaFinContrato('2099-12-31T00:00:00.000Z')).toBe('Indefinido');
  });

  test('null → "Indefinido"', () => {
    expect(formatFechaFinContrato(null)).toBe('Indefinido');
  });

  test('flag indefinido prevalece sobre fecha real → "Indefinido"', () => {
    expect(formatFechaFinContrato('2026-05-15', true)).toBe('Indefinido');
  });

  test('fecha real con formateador inyectado lo usa', () => {
    const fmt = (f: string) => `FORMATTED:${f}`;
    expect(formatFechaFinContrato('2026-05-15', undefined, fmt)).toBe('FORMATTED:2026-05-15');
  });

  test('fecha real sin formateador usa Intl es-ES short', () => {
    const result = formatFechaFinContrato('2026-05-15');
    expect(result).not.toBe('Indefinido');
    expect(result).toMatch(/2026/);
  });

  test('fecha inválida devuelve fallback seguro', () => {
    expect(formatFechaFinContrato('no-es-fecha')).toBe('Fecha inválida');
  });

  test('string ISO con hora mantiene la fecha civil', () => {
    const result = formatFechaFinContrato('2026-05-15T23:59:59.000Z');
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2026/);
  });
});
