// Lo que trae la ficha al abrirse desde el extracto · una línea, o la primera
// de varias, y nada si no hay ninguna.

import { prerrellenoDeFicha } from '../prerrellenoDeFicha';
import type { LineaExtracto } from '../extractoSesion';

const linea = (id: number, importe: number): LineaExtracto => ({
  lineaId: id,
  hashLinea: `h${id}`,
  textoBanco: `Recibo ${id}`,
  fecha: `2026-09-0${id}`,
  importe,
  veredicto: 'resolver',
});

describe('el prerrelleno de la ficha', () => {
  it('desde una línea · el signo dice el tipo', () => {
    expect(prerrellenoDeFicha(linea(1, -40), null, 7)).toEqual({
      tipo: 'gasto', concepto: 'Recibo 1', importe: -40, fecha: '2026-09-01', cuentaId: 7,
    });
    expect(prerrellenoDeFicha(linea(2, 650), null, null)?.tipo).toBe('ingreso');
  });

  it('desde varias · la primera, y solo para que no salga en blanco', () => {
    expect(prerrellenoDeFicha(null, [linea(3, -30), linea(4, -25)], 7)?.concepto).toBe('Recibo 3');
  });

  it('sin ninguna no hay prerrelleno', () => {
    expect(prerrellenoDeFicha(null, null, 7)).toBeUndefined();
    expect(prerrellenoDeFicha(null, [], 7)).toBeUndefined();
  });
});
