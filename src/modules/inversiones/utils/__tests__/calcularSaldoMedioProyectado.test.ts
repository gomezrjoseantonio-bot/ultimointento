import {
  calcularSaldoMedioProyectado,
  obtenerTwrEsperado,
  TWR_FALLBACK_NOMINAL,
} from '../calcularSaldoMedioProyectado';

describe('calcularSaldoMedioProyectado · fórmula trapezoidal', () => {
  test('valorActual=100k · 20 años · TWR 5% · saldo medio ≈ 182.665 €', () => {
    const saldo = calcularSaldoMedioProyectado(100_000, 20, 0.05);
    // valor final = 100_000 × 1.05^20 ≈ 265_329.77 → medio ≈ 182.664,89
    expect(saldo).toBeGreaterThan(182_664);
    expect(saldo).toBeLessThan(182_666);
  });

  test('valorActual=0 · devuelve 0', () => {
    expect(calcularSaldoMedioProyectado(0, 20, 0.05)).toBe(0);
  });

  test('anosHastaRescate=0 · devuelve el valor actual', () => {
    expect(calcularSaldoMedioProyectado(100_000, 0, 0.05)).toBe(100_000);
  });

  test('TWR negativo · saldo medio < valor actual', () => {
    const saldo = calcularSaldoMedioProyectado(100_000, 20, -0.02);
    expect(saldo).toBeLessThan(100_000);
    expect(saldo).toBeGreaterThan(0);
  });

  test('TWR cero · saldo medio = valor actual', () => {
    expect(calcularSaldoMedioProyectado(100_000, 20, 0)).toBe(100_000);
  });
});

describe('obtenerTwrEsperado · prioridad histórico → fallback', () => {
  test('TWR histórico razonable · se usa tal cual', () => {
    expect(obtenerTwrEsperado(0.062)).toBe(0.062);
  });

  test('TWR histórico null · fallback nominal', () => {
    expect(obtenerTwrEsperado(null)).toBe(TWR_FALLBACK_NOMINAL);
  });

  test('TWR fuera de rango (positivo) · fallback', () => {
    expect(obtenerTwrEsperado(0.5)).toBe(TWR_FALLBACK_NOMINAL);
  });

  test('TWR fuera de rango (negativo) · fallback', () => {
    expect(obtenerTwrEsperado(-0.5)).toBe(TWR_FALLBACK_NOMINAL);
  });

  test('TWR NaN · fallback', () => {
    expect(obtenerTwrEsperado(Number.NaN)).toBe(TWR_FALLBACK_NOMINAL);
  });
});
