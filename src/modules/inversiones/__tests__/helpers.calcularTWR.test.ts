// Tests · §7.3 calcularTWR + formatRentPctOrDash · T-INVERSIONES-V5 PR 5.

import { calcularTWR, formatRentPctOrDash } from '../helpers';

describe('calcularTWR · guards anti-NaN/outlier (§7.3)', () => {
  it('total_aportado=0 → null (división por cero)', () => {
    expect(calcularTWR(0, 1000)).toBeNull();
  });

  it('total_aportado<0 → null', () => {
    expect(calcularTWR(-100, 200)).toBeNull();
  });

  it('NaN → null', () => {
    expect(calcularTWR(NaN, 100)).toBeNull();
    expect(calcularTWR(100, NaN)).toBeNull();
  });

  it('outlier |twr| > 500% → null', () => {
    // valor_actual = 7000, aportado = 1000 → twr = 600 % → null
    expect(calcularTWR(1000, 7000)).toBeNull();
    // valor_actual = 0, aportado = 1000 → twr = -100 % → válido
    expect(calcularTWR(1000, 0)).toBe(-100);
  });

  it('cálculo correcto en rango sano', () => {
    expect(calcularTWR(1000, 1100)).toBe(10);
    expect(calcularTWR(1000, 900)).toBe(-10);
    expect(calcularTWR(50_000, 60_000)).toBe(20);
  });
});

describe('formatRentPctOrDash', () => {
  it('null → "—"', () => {
    expect(formatRentPctOrDash(null)).toBe('—');
  });

  it('undefined → "—"', () => {
    expect(formatRentPctOrDash(undefined)).toBe('—');
  });

  it('NaN → "—"', () => {
    expect(formatRentPctOrDash(NaN)).toBe('—');
  });

  it('número finito → formato % con signo', () => {
    expect(formatRentPctOrDash(0)).toBe('0.00%');
    expect(formatRentPctOrDash(5.5)).toBe('+5.50%');
    expect(formatRentPctOrDash(-3.21)).toBe('-3.21%');
  });
});
