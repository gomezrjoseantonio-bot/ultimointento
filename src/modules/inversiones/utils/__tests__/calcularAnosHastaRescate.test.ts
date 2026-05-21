import {
  calcularAnosHastaRescate,
  EDAD_ACTUAL_DEFAULT,
  EDAD_OBJETIVO_RESCATE_DEFAULT,
} from '../calcularAnosHastaRescate';

const FECHA_REF = new Date('2026-05-21T00:00:00Z');

describe('calcularAnosHastaRescate', () => {
  test('escenario completo · usa edad objetivo y fecha de nacimiento reales', () => {
    const r = calcularAnosHastaRescate(
      { edadObjetivoRescate: 65 },
      '1980-05-15',
      FECHA_REF,
    );
    // 2026 - 1980 ≈ 46 → 65 - 46 = 19
    expect(r.anos).toBe(19);
    expect(r.esEstimacionPorDefecto).toBe(false);
  });

  test('sin escenario y sin fecha · defaults 65/45 → 20 años con flag', () => {
    const r = calcularAnosHastaRescate(null, null, FECHA_REF);
    expect(r.anos).toBe(EDAD_OBJETIVO_RESCATE_DEFAULT - EDAD_ACTUAL_DEFAULT);
    expect(r.esEstimacionPorDefecto).toBe(true);
  });

  test('escenario con edad objetivo pero sin fecha de nacimiento · default 45', () => {
    const r = calcularAnosHastaRescate(
      { edadObjetivoRescate: 70 },
      null,
      FECHA_REF,
    );
    expect(r.anos).toBe(70 - EDAD_ACTUAL_DEFAULT);
    expect(r.esEstimacionPorDefecto).toBe(true);
  });

  test('edad actual ya superior a objetivo · clamp a mínimo 1 año', () => {
    const r = calcularAnosHastaRescate(
      { edadObjetivoRescate: 65 },
      '1950-01-01',
      FECHA_REF,
    );
    expect(r.anos).toBe(1);
    expect(r.esEstimacionPorDefecto).toBe(false);
  });

  test('escenario sin edad objetivo pero con fecha de nacimiento · fallback 65', () => {
    const r = calcularAnosHastaRescate(
      { edadObjetivoRescate: undefined },
      '1990-05-15',
      FECHA_REF,
    );
    // edad actual ≈ 36 → 65 - 36 = 29
    expect(r.anos).toBe(29);
    // No es default · la fecha real está presente.
    expect(r.esEstimacionPorDefecto).toBe(false);
  });

  test('fecha de nacimiento inválida · cae a default 45 y marca estimación', () => {
    const r = calcularAnosHastaRescate(
      { edadObjetivoRescate: 65 },
      'no-es-una-fecha',
      FECHA_REF,
    );
    expect(r.anos).toBe(20);
    expect(r.esEstimacionPorDefecto).toBe(true);
  });
});
