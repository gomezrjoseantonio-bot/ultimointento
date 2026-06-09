// FIX PUNTO 4 (P12) · el extracto IDENTIFICA su cuenta · la cabecera trae
// IBAN · banco · titular · saldo y fecha. Estos tests cubren el parser puro de
// cabecera (la lectura de File es un envoltorio fino encima).
import { parseHeaderGrid, normalizeFechaCabecera } from '../extractoHeaderService';

describe('extractoHeaderService · normalizeFechaCabecera (TZ-safe · P3/P12)', () => {
  it('dd/mm/yyyy → YYYY-MM-DD sin desplazar el día', () => {
    expect(normalizeFechaCabecera('09/06/2026')).toBe('2026-06-09');
    expect(normalizeFechaCabecera('Saldo a 1/2/2026')).toBe('2026-02-01');
  });
  it('acepta yyyy-mm-dd y años de 2 dígitos', () => {
    expect(normalizeFechaCabecera('2026-06-09')).toBe('2026-06-09');
    expect(normalizeFechaCabecera('09/06/26')).toBe('2026-06-09');
  });
  it('devuelve undefined si no hay fecha reconocible', () => {
    expect(normalizeFechaCabecera('sin fecha')).toBeUndefined();
  });
});

describe('extractoHeaderService · parseHeaderGrid (cabecera Santander)', () => {
  // Cabecera verificada · "CUENTA SANTANDER" · IBAN · Titular · Saldo · fecha.
  const grid = [
    ['CUENTA SANTANDER'],
    ['IBAN', 'ES34 0049 1500 0502 0005 1332'],
    ['Titular', 'Jose Antonio Gomez'],
    ['Saldo', '36.550,00 EUR'],
    ['Fecha', '09/06/2026'],
    [],
    ['Fecha valor', 'Concepto', 'Importe'],
  ];

  it('extrae IBAN normalizado, banco, titular, saldo y fecha', () => {
    const h = parseHeaderGrid(grid);
    expect(h.iban).toBe('ES3400491500050200051332');
    expect(h.banco).toMatch(/Santander/i);
    expect(h.titular).toBe('Jose Antonio Gomez');
    expect(h.saldo).toBeCloseTo(36550, 2);
    expect(h.fecha).toBe('2026-06-09');
  });

  it('saldo y fecha también si vienen en la misma celda que la etiqueta', () => {
    const h = parseHeaderGrid([
      ['Cuenta Santander · ES34 0049 1500 0502 0005 1332'],
      ['Saldo: 1.234,56 EUR  ·  Fecha: 01/03/2026'],
    ]);
    expect(h.iban).toBe('ES3400491500050200051332');
    expect(h.saldo).toBeCloseTo(1234.56, 2);
    expect(h.fecha).toBe('2026-03-01');
  });

  it('sin IBAN reconocible → resultado sin iban (el importador cae al respaldo)', () => {
    const h = parseHeaderGrid([
      ['Movimientos del mes'],
      ['Fecha', 'Concepto', 'Importe'],
      ['01/06/2026', 'Compra', '-12,00'],
    ]);
    expect(h.iban).toBeUndefined();
  });

  it('IBAN inválido (dígito de control roto) no se acepta', () => {
    const h = parseHeaderGrid([['IBAN', 'ES99 0049 1500 0502 0005 1332']]);
    expect(h.iban).toBeUndefined();
  });
});
