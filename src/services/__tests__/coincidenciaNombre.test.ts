// ¿Es la misma persona? · el caso normal es que el nombre NO cuadre exacto.
//
// El banco manda "ADNAN PARWEZ" y el contrato dice "Adnan Parwez Khan". Si la
// comparación fuese literal, no casaría casi ningún Bizum con su renta. Y si
// fuese demasiado laxa, la renta de una habitación acabaría colgada del
// inquilino equivocado — que es peor que no casar nada.
//
// El candado guarda las dos orillas: que reconozca a la misma persona escrita
// de otra forma, y que NO afirme nada cuando sólo comparten una palabra.

import { nivelDeCoincidencia } from '../coincidenciaNombre';

describe('la misma persona escrita de otra forma', () => {
  it.each([
    ['ADNAN PARWEZ', 'Adnan Parwez Khan'],
    ['Adnan Parwez Khan', 'ADNAN PARWEZ'],
    ['MARIA LOPEZ', 'María López'],
    ['JOSE ANTONIO GOMEZ', 'Gómez, José Antonio'],
    ['MARIA DE LA TORRE GARCIA', 'Maria Torre Garcia'],
  ])('%s ≡ %s', (banco, contrato) => {
    expect(nivelDeCoincidencia(banco, contrato)).toBe('fuerte');
  });
});

describe('apunta, pero no señala', () => {
  // Una sola palabra en común no basta para afirmarlo: hay más de una Laura.
  it('sólo el nombre de pila es parcial', () => {
    expect(nivelDeCoincidencia('LAURA', 'Laura Sánchez')).toBe('parcial');
    expect(nivelDeCoincidencia('SANCHEZ', 'Laura Sánchez')).toBe('parcial');
  });
});

describe('antes nada que la persona equivocada', () => {
  it('dos desconocidos no se parecen', () => {
    expect(nivelDeCoincidencia('ADNAN PARWEZ', 'Laura Sánchez')).toBe('ninguna');
  });

  it('sin palabras que comparar no hay coincidencia', () => {
    expect(nivelDeCoincidencia('', 'Laura Sánchez')).toBe('ninguna');
    expect(nivelDeCoincidencia('00218832', 'Laura Sánchez')).toBe('ninguna');
  });

  // Una inicial suelta coincidiría con demasiada gente.
  it('las iniciales no cuentan como palabra', () => {
    expect(nivelDeCoincidencia('J. PEREZ', 'Juan Pérez')).toBe('parcial');
  });

  // Las partículas las lleva medio país.
  it('compartir sólo partículas no es compartir nada', () => {
    expect(nivelDeCoincidencia('DE LA TORRE', 'De los Santos')).toBe('ninguna');
  });
});
