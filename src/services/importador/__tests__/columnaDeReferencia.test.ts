// El identificador del banco, en el importador que DE VERDAD corre.
//
// Las cabeceras son las literales del informe de BBVA — incluida la primera
// columna vacía y las dos que se llaman «Divisa».

import { columnaDeReferencia } from '../columnaDeReferencia';

/** El mismo normalizador que usa `BankParserService`. */
const normalizar = (t: string) =>
  t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();

const CABECERAS = ['', 'F.Valor', 'Fecha', 'Concepto', 'Movimiento', 'Importe', 'Divisa', 'Disponible', 'Divisa', 'Observaciones']
  .map(normalizar);

/** Lo que el detector se lleva antes: fecha, importe, concepto, saldo, divisa. */
const OCUPADAS = [1, 2, 3, 5, 6, 7, 8];

describe('la columna del identificador · extracto real de BBVA', () => {
  it('es Observaciones · la única que sirve para los dos casos', () => {
    expect(columnaDeReferencia(CABECERAS, OCUPADAS, normalizar)).toBe(9);
  });

  it('no roba una columna que ya tenga papel', () => {
    const i = columnaDeReferencia(CABECERAS, OCUPADAS, normalizar);
    expect(OCUPADAS).not.toContain(i);
  });

  it('si Observaciones ya la tiene otro, cae en Movimiento', () => {
    expect(columnaDeReferencia(CABECERAS, [...OCUPADAS, 9], normalizar)).toBe(4);
  });

  it('una columna «Referencia» de verdad gana a todas', () => {
    const con = ['fecha', 'concepto', 'importe', 'observaciones', 'referencia'];
    expect(columnaDeReferencia(con, [0, 1, 2], normalizar)).toBe(4);
  });

  it('un fichero sin ninguna de ellas no inventa una referencia', () => {
    expect(columnaDeReferencia(['fecha', 'concepto', 'importe'], [0, 1, 2], normalizar)).toBeUndefined();
  });

  it('con todo ocupado tampoco inventa', () => {
    expect(columnaDeReferencia(CABECERAS, [1, 2, 3, 4, 5, 6, 7, 8, 9], normalizar)).toBeUndefined();
  });
});
