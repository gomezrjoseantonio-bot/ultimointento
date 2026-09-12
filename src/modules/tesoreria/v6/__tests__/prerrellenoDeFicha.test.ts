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

  it('P1 · el botón de piso abre la ficha con ESE piso · y `null` es «es personal»', () => {
    expect(prerrellenoDeFicha(null, [linea(3, -30)], 7, { inmuebleId: 4 })?.inmuebleId).toBe(4);
    expect(prerrellenoDeFicha(null, [linea(3, -30)], 7, { inmuebleId: null })?.inmuebleId).toBeNull();
  });

  it('lo que el motor ya sabe de la línea (familia y subtipo) llega a la ficha · el usuario confirma', () => {
    const conEjes: LineaExtracto = {
      ...linea(5, -66.9),
      clasificacion: { naturaleza: 'gasto', familia: 'suministro', subtipo: 'luz', ambito: 'inmueble', inmuebleId: 9, origen: { naturaleza: 'concepto', familia: 'concepto', ambito: 'concepto' }, motivos: [] },
    };
    expect(prerrellenoDeFicha(null, [conEjes], 7)).toMatchObject({ familia: 'suministro', subtipo: 'luz', inmuebleId: 9 });
    // El piso elegido manda sobre el que el motor supuso.
    expect(prerrellenoDeFicha(null, [conEjes], 7, { inmuebleId: 4 })?.inmuebleId).toBe(4);
  });

  it('un interno no prerrellena familia · la ficha no clasifica traspasos', () => {
    const interno: LineaExtracto = {
      ...linea(6, -800),
      clasificacion: { naturaleza: 'movimiento_interno', familia: 'traspaso', subtipo: 'a_ahorro', ambito: 'personal', origen: { naturaleza: 'concepto', familia: 'concepto', ambito: 'defecto' }, motivos: [] },
    };
    expect(prerrellenoDeFicha(interno, null, 7)?.familia).toBeUndefined();
  });
});
