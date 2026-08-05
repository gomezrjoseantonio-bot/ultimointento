// Qué carencia tiene un préstamo · VOCABULARIO §6 bis · ter.
//
// Lo que vigila esto es que pedir carencia haga algo. Había cuatro formas de
// decirlo y las dos que importaban no se hablaban: `carencia` / `carenciaMeses`
// se rellenaba en el alta y no la leía nadie, y `mesesSoloIntereses` la
// aplicaba el motor y no la escribía nadie. Quien pedía doce meses de carencia
// veía un cuadro sin carencia.

import { carenciaDe } from '../carencia';
import type { Prestamo } from '../../../types/prestamos';

const prestamo = (over: Partial<Prestamo> = {}): Prestamo =>
  ({
    plazoMesesTotal: 360,
    carencia: 'NINGUNA',
    esquemaPrimerRecibo: 'NORMAL',
    ...over,
  }) as unknown as Prestamo;

describe('lo que se pide es lo que sale', () => {
  it('doce meses de solo capital son doce meses de solo capital', () => {
    expect(carenciaDe(prestamo({ carencia: 'CAPITAL', carenciaMeses: 12 })))
      .toEqual({ tipo: 'CAPITAL', meses: 12 });
  });

  it('y veinticuatro totales, veinticuatro totales', () => {
    expect(carenciaDe(prestamo({ carencia: 'TOTAL', carenciaMeses: 24 })))
      .toEqual({ tipo: 'TOTAL', meses: 24 });
  });

  it('sin carencia no hay carencia', () => {
    expect(carenciaDe(prestamo())).toEqual({ tipo: 'NINGUNA', meses: 0 });
  });

  // Decir «carencia de capital, cero meses» es no tener carencia · dejarlo como
  // CAPITAL obligaría a todo el mundo a comprobar además los meses.
  it('cero meses es no tener carencia, aunque diga el tipo', () => {
    expect(carenciaDe(prestamo({ carencia: 'CAPITAL', carenciaMeses: 0 })))
      .toEqual({ tipo: 'NINGUNA', meses: 0 });
  });

  it.each([undefined, -3, NaN])('%s meses tampoco', (meses) => {
    expect(carenciaDe(prestamo({ carencia: 'TOTAL', carenciaMeses: meses as number })).tipo)
      .toBe('NINGUNA');
  });
});

// Un préstamo que nunca amortiza no es un préstamo: el cuadro terminaría
// debiendo lo mismo que el primer día —o más, si la carencia era total—, y de
// ese cuadro salen las previsiones de tesorería y los intereses del ejercicio.
describe('siempre queda una cuota que amortiza', () => {
  it('una carencia tan larga como el plazo se recorta', () => {
    expect(carenciaDe(prestamo({ plazoMesesTotal: 12, carencia: 'CAPITAL', carenciaMeses: 12 })))
      .toEqual({ tipo: 'CAPITAL', meses: 11 });
  });

  it('y una más larga todavía, también', () => {
    expect(carenciaDe(prestamo({ plazoMesesTotal: 12, carencia: 'TOTAL', carenciaMeses: 99 })).meses)
      .toBe(11);
  });

  it('con un plazo de un mes no cabe ninguna', () => {
    expect(carenciaDe(prestamo({ plazoMesesTotal: 1, carencia: 'CAPITAL', carenciaMeses: 6 })))
      .toEqual({ tipo: 'NINGUNA', meses: 0 });
  });
});

// La importación desde plantilla escribe el esquema del primer recibo, y «solo
// intereses» ahí es un mes de carencia de capital. Es la misma idea con otro
// nombre, así que se traduce en vez de mantener dos caminos.
describe('el esquema del primer recibo', () => {
  it('«solo intereses» es un mes de carencia de capital', () => {
    expect(carenciaDe(prestamo({ esquemaPrimerRecibo: 'SOLO_INTERESES' })))
      .toEqual({ tipo: 'CAPITAL', meses: 1 });
  });

  // Si el préstamo dice su carencia, manda ella · es el dato específico.
  it('pero una carencia dicha manda sobre él', () => {
    const p = prestamo({ esquemaPrimerRecibo: 'SOLO_INTERESES', carencia: 'TOTAL', carenciaMeses: 6 });

    expect(carenciaDe(p)).toEqual({ tipo: 'TOTAL', meses: 6 });
  });

  it('la prorrata no es una carencia', () => {
    expect(carenciaDe(prestamo({ esquemaPrimerRecibo: 'PRORRATA' })).tipo).toBe('NINGUNA');
  });
});
