// Lector universal del extracto de tarjeta · las dos vías (IA y SheetJS)
// desembocan en la misma lista de líneas, ya normalizada.

import {
  importeEspañol,
  esPdf,
  lineasDeIA,
  lineasDeMovimientos,
} from '../extractoTarjeta';
import type { ParsedMovement } from '../../../types/bankProfiles';

const file = (name: string, type = ''): File =>
  new File(['x'], name, { type });

describe('importe español a número', () => {
  it('con miles y decimales', () => {
    expect(importeEspañol('1.667,13')).toBe(1667.13);
  });
  it('sin miles', () => {
    expect(importeEspañol('20,89')).toBe(20.89);
  });
});

describe('esPdf', () => {
  it('reconoce el PDF por tipo MIME', () => {
    expect(esPdf(file('x', 'application/pdf'))).toBe(true);
  });
  it('reconoce el PDF por extensión', () => {
    expect(esPdf(file('extracto.PDF'))).toBe(true);
  });
  it('un xls no es PDF', () => {
    expect(esPdf(file('export.xls'))).toBe(false);
  });
});

describe('lineasDeIA · lo que devuelve el modelo', () => {
  it('normaliza fecha, concepto e importe', () => {
    const l = lineasDeIA({
      lineas: [{ fecha: '2026-07-04', concepto: 'EXPENDEDURIA 6', importe: 53.5 }],
    });
    expect(l).toEqual([{ fecha: '2026-07-04', concepto: 'EXPENDEDURIA 6', importe: 53.5 }]);
  });

  it('acepta también un array pelado y fechas DD/MM/YYYY', () => {
    const l = lineasDeIA([{ fecha: '20/06/2026', concepto: 'UBER', importe: '20,89' as unknown as number }]);
    // El importe llega como string numérico español mal formado: se descarta si
    // no es número. `Number('20,89')` es NaN → fuera.
    expect(l).toEqual([]);
  });

  it('descarta líneas sin fecha, sin concepto o de importe 0', () => {
    const l = lineasDeIA({
      lineas: [
        { fecha: '', concepto: 'X', importe: 5 },
        { fecha: '2026-07-04', concepto: '', importe: 5 },
        { fecha: '2026-07-04', concepto: 'X', importe: 0 },
        { fecha: '2026-07-04', concepto: 'OK', importe: -12.5 },
      ],
    });
    expect(l).toEqual([{ fecha: '2026-07-04', concepto: 'OK', importe: -12.5 }]);
  });

  it('un extraído sin líneas devuelve vacío', () => {
    expect(lineasDeIA('no es json')).toEqual([]);
    expect(lineasDeIA({})).toEqual([]);
  });
});

describe('lineasDeMovimientos · lo que saca SheetJS (xls/csv)', () => {
  const mov = (date: Date, amount: number, description: string): ParsedMovement => ({
    date,
    amount,
    description,
  });

  it('adapta la forma del ParsedMovement a la línea', () => {
    const l = lineasDeMovimientos([mov(new Date('2026-07-04T00:00:00Z'), -53.5, 'EXPENDEDURIA 6')]);
    expect(l).toEqual([{ fecha: '2026-07-04', concepto: 'EXPENDEDURIA 6', importe: -53.5 }]);
  });

  it('salta filas sin fecha, sin concepto o de importe 0', () => {
    const l = lineasDeMovimientos([
      mov(new Date('2026-07-04T00:00:00Z'), 0, 'ruido'),
      mov(new Date('2026-07-05T00:00:00Z'), 10, ''),
      mov(new Date('2026-07-06T00:00:00Z'), 10, 'BUENA'),
    ]);
    expect(l).toEqual([{ fecha: '2026-07-06', concepto: 'BUENA', importe: 10 }]);
  });
});
