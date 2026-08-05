// Cuando cero no vale como respuesta · VOCABULARIO §6 bis · bis.
//
// Lo que vigila esto es que un dedazo no se convierta en un hecho. El valor del
// índice de una revisión se guarda como lo que dijo el banco, y `parseNum`
// devuelve 0 ante cualquier cosa: sin este filtro, escribir «abc» apuntaría que
// el Euríbor de ese año fue del 0 %, y de ahí salen la cuota, las previsiones
// de tesorería y los intereses del ejercicio.

import { esNumero } from '../numeros';

describe('lo que sí es un número', () => {
  it.each(['2', '2,164', '0', '-0,484', '1.234,56'])('«%s»', (v) => {
    expect(esNumero(v)).toBe(true);
  });
});

describe('lo que no lo es', () => {
  it.each(['', '   ', 'abc', '2,1,3', '%', '2 %'])('«%s»', (v) => {
    expect(esNumero(v)).toBe(false);
  });

  it('nada tampoco', () => {
    expect(esNumero(undefined as unknown as string)).toBe(false);
  });
});
