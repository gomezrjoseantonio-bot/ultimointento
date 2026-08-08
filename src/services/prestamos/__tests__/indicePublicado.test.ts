// De qué publicación sale el índice de una revisión.
//
// El día que el banco revisa, el número ya está publicado: lo que hace falta es
// saber a qué mes ir a buscarlo, y eso lo dice la escritura *(Jose · 8 ago
// 2026)*. Sin ello la pantalla sugería el euríbor de «Actualizar valores», que
// es el de hoy — para una revisión de agosto confirmada en octubre, ese número
// no tiene por qué parecerse al que aplicó.

import { publicacionDelIndice } from '../indicePublicado';

describe('el mes del que sale el índice', () => {
  it('con «el del mes anterior», el mes de antes', () => {
    expect(publicacionDelIndice({ indiceDesfaseMeses: 1 }, '2026-08-25')).toBe('2026-07');
  });

  it('y con «el del segundo mes anterior», dos', () => {
    expect(publicacionDelIndice({ indiceDesfaseMeses: 2 }, '2026-08-25')).toBe('2026-06');
  });

  // Cruzar el año es donde una resta de meses hecha a ojo se rompe.
  it('cruza el año sin despeinarse', () => {
    expect(publicacionDelIndice({ indiceDesfaseMeses: 1 }, '2027-01-25')).toBe('2026-12');
    expect(publicacionDelIndice({ indiceDesfaseMeses: 3 }, '2027-02-25')).toBe('2026-11');
  });

  // Un desfase de cero es legítimo · hay escrituras que toman el del propio mes.
  it('sin desfase, el mes de la propia revisión', () => {
    expect(publicacionDelIndice({ indiceDesfaseMeses: 0 }, '2026-08-25')).toBe('2026-08');
  });

  it('le vale una fecha con precisión de mes', () => {
    expect(publicacionDelIndice({ indiceDesfaseMeses: 1 }, '2026-08')).toBe('2026-07');
  });
});

// «La escritura no lo dice» y «el del mes anterior» son cosas distintas · de la
// segunda saldría un mes concreto que se lee igual de firme que uno real, y
// mandaría a alguien a mirar el euríbor de un mes que nadie le ha dicho.
describe('cuando no se sabe, no se dice', () => {
  it('sin desfase apuntado, nada', () => {
    expect(publicacionDelIndice({}, '2026-08-25')).toBeNull();
  });

  it('ni con un desfase que no es un número de meses', () => {
    expect(publicacionDelIndice({ indiceDesfaseMeses: 1.5 }, '2026-08-25')).toBeNull();
    expect(publicacionDelIndice({ indiceDesfaseMeses: -1 }, '2026-08-25')).toBeNull();
  });

  it('ni sin fecha de revisión', () => {
    expect(publicacionDelIndice({ indiceDesfaseMeses: 1 }, null)).toBeNull();
    expect(publicacionDelIndice({ indiceDesfaseMeses: 1 }, '')).toBeNull();
    expect(publicacionDelIndice({ indiceDesfaseMeses: 1 }, '2026')).toBeNull();
  });

  it('ni con una fecha que no lo es', () => {
    expect(publicacionDelIndice({ indiceDesfaseMeses: 1 }, 'no-es-fecha')).toBeNull();
  });
});
