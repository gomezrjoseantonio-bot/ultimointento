// "1,000.00" no es un número inválido: es mil, escrito a la inglesa.
//
// Excel formatea así las celdas cuando el fichero viene con configuración
// en-US (el xls de Santander), y el parser de extractos lo leía como texto.
// La coma se tomaba por decimal, detrás había seis dígitos, y el importe se
// rechazaba entero. No hay ambigüedad: en español la coma decimal nunca va
// seguida de un punto, así que comas que agrupan de tres en tres seguidas de
// un punto con decimales solo pueden ser de millar.

import { parseEsNumber } from '../numberUtils';

const valor = (s: string) => parseEsNumber(s).value;

describe('coma de millar a la inglesa · "1,000.00"', () => {
  it('mil, con y sin signo', () => {
    expect(valor('1,000.00')).toBe(1000);
    expect(valor('-1,350.00')).toBe(-1350);
    expect(valor('3,943.31')).toBeCloseTo(3943.31, 2);
  });

  it('varios grupos de millar', () => {
    expect(valor('78,500.00')).toBe(78500);
    expect(valor('1,234,567.89')).toBeCloseTo(1234567.89, 2);
  });

  it('un solo decimal detrás del punto también vale', () => {
    expect(valor('2,635.4')).toBeCloseTo(2635.4, 2);
  });
});

describe('y el español no se toca', () => {
  it('la coma sigue siendo el decimal cuando no hay punto detrás', () => {
    expect(valor('1.234,56')).toBeCloseTo(1234.56, 2);
    expect(valor('34,56')).toBeCloseTo(34.56, 2);
    expect(valor('-684,36')).toBeCloseTo(-684.36, 2);
  });

  it('grupos que no son de tres no se toman por millar', () => {
    // Esto no es inglés (los grupos no son de tres): sigue siendo inválido.
    expect(valor('1,00.00')).toBeNull();
    expect(valor('12,3456.00')).toBeNull();
  });

  it('solo puntos: la regla de siempre', () => {
    expect(valor('285.4')).toBeCloseTo(285.4, 2);
    expect(valor('1.234.567')).toBe(1234567);
  });
});
