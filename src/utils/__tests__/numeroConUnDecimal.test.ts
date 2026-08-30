// Un importe con UN solo decimal se estaba multiplicando por diez.
//
// `-285,40 €` —la cuota del préstamo de BBVA— entraba en la base como `-2854`.
// No es un redondeo: es que el punto se leía como separador de MILES.
//
// La regla que lo causaba (`numberUtils.ts`): con solo puntos, se consideraba
// decimal si había EXACTAMENTE 2 dígitos detrás; cualquier otra cosa, miles.
//   "25.17" → 2 dígitos → decimal   → 25,17   ✅
//   "285.4" → 1 dígito  → ¡miles!   → 2854    ❌
//
// Un separador de miles agrupa SIEMPRE de tres en tres. "285.4" no puede ser
// doscientos ochenta y cinco mil cuatro: eso se escribe "285.004". Que detrás
// del punto haya uno, dos o cuatro dígitos es exactamente lo que descarta que
// sea un separador de miles.

import { parseEsNumber } from '../numberUtils';

const valor = (s: string) => parseEsNumber(s).value;

describe('el punto es separador de miles solo si agrupa de tres en tres', () => {
  it('un decimal: 285.4 son doscientos ochenta y cinco con cuarenta', () => {
    expect(valor('285.4')).toBeCloseTo(285.4, 4);
    expect(valor('-285.4')).toBeCloseTo(-285.4, 4);
  });

  it('la cuota real del extracto de BBVA', () => {
    // La línea literal: `Cargo por amortizacion de prestamo/credito`.
    expect(valor('-285.4')).not.toBe(-2854);
  });

  it('cuatro decimales tampoco son miles · se redondea a céntimos, que es lo correcto', () => {
    // No es 2.854.567: el punto sigue siendo decimal. Que después se redondee a
    // dos decimales es la regla de dinero de siempre (`maxDecimals`), no parte
    // de este arreglo.
    expect(valor('285.4567')).toBeCloseTo(285.46, 2);
    expect(valor('285.4567')).not.toBe(2854567);
  });
});

describe('y lo que ya funcionaba sigue igual', () => {
  it('dos decimales · el caso que sí acertaba', () => {
    expect(valor('25.17')).toBeCloseTo(25.17, 4);
    expect(valor('-262.98')).toBeCloseTo(-262.98, 4);
  });

  it('miles de verdad · grupos de tres', () => {
    expect(valor('1.234')).toBe(1234);
    expect(valor('1.234.567')).toBe(1234567);
  });

  it('sin punto ni coma', () => {
    expect(valor('-190')).toBe(-190);
    expect(valor('1200')).toBe(1200);
  });

  it('formato español con coma decimal', () => {
    expect(valor('1.234,56')).toBeCloseTo(1234.56, 4);
    expect(valor('34,56')).toBeCloseTo(34.56, 4);
    expect(valor('-50,25')).toBeCloseTo(-50.25, 4);
    expect(valor('156,78 €')).toBeCloseTo(156.78, 4);
  });
});
