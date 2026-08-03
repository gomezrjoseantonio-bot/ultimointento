// La forma común de las condiciones que se verifican · VOCABULARIO §6 ter.
//
// Lo que vigila esto es la ventana: si el tramo que se mira está corrido, la
// respuesta puede ser «no cumples» de algo que sí se cumplió, y eso se paga en
// el recibo de la hipoteca.

import { ventanaDeEvaluacion, veredictoDelImporte } from '../cumplimiento';

describe('la ventana en la que se mide', () => {
  it('seis meses acabados el 3 de agosto empiezan el 4 de febrero', () => {
    expect(ventanaDeEvaluacion('2026-08-03', 6)).toEqual({
      desde: '2026-02-04',
      hasta: '2026-08-03',
    });
  });

  // El día siguiente, no el mismo: encadenando dos ventanas de seis meses, el
  // 3 de febrero contaría en las dos.
  it('el día que abre no se solapa con la ventana anterior', () => {
    const primera = ventanaDeEvaluacion('2026-02-03', 6);
    const segunda = ventanaDeEvaluacion('2026-08-03', 6);

    expect(primera.hasta < segunda.desde).toBe(true);
  });

  it('cruza el fin de año hacia atrás', () => {
    expect(ventanaDeEvaluacion('2026-03-15', 6).desde).toBe('2025-09-16');
  });

  // Restar seis meses al 31 de agosto aterriza en un "31 de febrero". Sin
  // recortar, `Date` lo empuja al 3 de marzo y se comería tres días de gasto.
  it('restar meses no se sale por el final de febrero', () => {
    expect(ventanaDeEvaluacion('2026-08-31', 6).desde).toBe('2026-03-01');
  });

  it('doce meses son un año justo', () => {
    expect(ventanaDeEvaluacion('2026-08-03', 12).desde).toBe('2025-08-04');
  });

  // Una ventana de cero meses no puede probar nada, y leerla como vacía se
  // confundiría con "no cumples" — que es una respuesta distinta.
  it('cero meses se lee como uno, no como ninguno', () => {
    expect(ventanaDeEvaluacion('2026-08-03', 0)).toEqual(ventanaDeEvaluacion('2026-08-03', 1));
  });
});

describe('alcanzar el umbral', () => {
  it('llegar justo cumple', () => {
    expect(veredictoDelImporte(3000, 3000)).toBe('cumple');
  });

  it('quedarse corto no cumple', () => {
    expect(veredictoDelImporte(2999, 3000)).toBe('no_cumple');
  });

  // Varios importes que suman exactamente 3.000 € pueden dar 2999.9999999996.
  // Nadie —ni el banco— entendería que eso sea incumplir. Pero la holgura es
  // medio céntimo, no un céntimo libre: un euro de menos sigue siendo de menos.
  it('la coma flotante no quita una bonificación, un céntimo sí', () => {
    expect(veredictoDelImporte(2999.9999999996, 3000)).toBe('cumple');
    expect(veredictoDelImporte(2999.99, 3000)).toBe('no_cumple');
  });
});
