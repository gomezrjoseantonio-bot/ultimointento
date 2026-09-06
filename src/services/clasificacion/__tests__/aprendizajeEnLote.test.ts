// E2.4.2 · Paso 2 · clasificar UNA línea de Víctor resuelve las demás de Víctor
// del mismo lote · misma clave de aprendizaje, mismo signo, sin decidir.

import { hermanasDeAprendizaje, claveDeLinea } from '../aprendizajeEnLote';

const linea = (lineaId: number, textoBanco: string, importe: number, referencia?: string) => ({ lineaId, textoBanco, importe, referencia });

describe('hermanasDeAprendizaje', () => {
  const lote = [
    linea(3, 'Bizum A Favor De Victor Garcia Concepto Cena', -20),
    linea(50, 'Bizum A Favor De Victor Garcia Concepto Regalo', -35),
    linea(200, 'Bizum A Favor De Victor Garcia', -12.5),
    linea(9, 'Bizum De Victor Garcia', 40),
    linea(11, 'Bizum A Favor De Maria Lopez', -20),
  ];

  it('las de Víctor con el mismo signo · no la propia ni la de María ni el abono', () => {
    const h = hermanasDeAprendizaje(lote[0], lote, () => true);
    expect(h.map((l) => l.lineaId).sort((a, b) => a - b)).toEqual([50, 200]);
  });

  it('una ya decidida no se toca', () => {
    const h = hermanasDeAprendizaje(lote[0], lote, (id) => id !== 200);
    expect(h.map((l) => l.lineaId)).toEqual([50]);
  });

  it('con identificador (CUPS) la clave separa dos pisos con el mismo texto', () => {
    const a = linea(1, 'IBERDROLA CLIENTES', -48, 'ES0031406137800001JX0F');
    const b = linea(2, 'IBERDROLA CLIENTES', -51, 'ES0031406137800001JX0F');
    const otro = linea(3, 'IBERDROLA CLIENTES', -30, 'ES0031400000000009ZZ0A');
    expect(claveDeLinea(a)).toBe(claveDeLinea(b));
    expect(hermanasDeAprendizaje(a, [a, b, otro], () => true).map((l) => l.lineaId)).toEqual([2]);
  });
});
