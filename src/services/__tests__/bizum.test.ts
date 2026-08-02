// Bizum · lo que importa no es la etiqueta, es el NOMBRE.
//
// Una línea "BIZUM DE ADNAN PARWEZ" caía en el saco de "transferencia recibida"
// sin dueño. Con el nombre leído, esa línea puede casar con la renta de una
// habitación; sin él, sigue siendo anónima.
//
// Por eso el candado insiste en dos cosas: que saque el nombre de todas las
// formas en que lo escriben los bancos, y que devuelva `undefined` antes que un
// nombre equivocado — una fila sin nombre es mejor que una fila que miente.

import { pareceBizum, contraparteDeBizum } from '../bizum';

describe('reconocer que es un Bizum', () => {
  it.each([
    'BIZUM DE ADNAN PARWEZ',
    'Bizum recibido de Maria',
    'ENVIO BIZUM A JUAN',
    'bizum',
  ])('%s', (t) => expect(pareceBizum(t)).toBe(true));

  it.each(['TRANSFERENCIA RECIBIDA', 'RECIBO IBERDROLA', 'BIZUMBA SL', ''])(
    '%s no lo es',
    (t) => expect(pareceBizum(t)).toBe(false)
  );
});

describe('quién está al otro lado', () => {
  it.each([
    ['BIZUM DE ADNAN PARWEZ', 'ADNAN PARWEZ'],
    ['BIZUM RECIBIDO DE MARIA LOPEZ', 'MARIA LOPEZ'],
    ['BIZUM A FAVOR DE JUAN PEREZ', 'JUAN PEREZ'],
    ['ENVIO BIZUM A LAURA', 'LAURA'],
    ['Bizum para Pedro', 'Pedro'],
  ])('%s → %s', (texto, esperado) => {
    expect(contraparteDeBizum(texto)).toBe(esperado);
  });

  // Se enseña tal cual lo manda el banco · normalizar sirve para comparar, no
  // para pintar el nombre de una persona.
  it('respeta las mayúsculas del banco', () => {
    expect(contraparteDeBizum('bizum de Adnan Parwez')).toBe('Adnan Parwez');
  });

  // Lo que el remitente escribió como concepto no es su nombre.
  it('corta antes del concepto que puso el remitente', () => {
    expect(contraparteDeBizum('BIZUM DE ADNAN PARWEZ CONCEPTO: ALQUILER AGOSTO')).toBe(
      'ADNAN PARWEZ'
    );
    expect(contraparteDeBizum('BIZUM DE MARIA, REF: 88213')).toBe('MARIA');
  });
});

describe('antes nada que un nombre equivocado', () => {
  it('sin preposición no se adivina', () => {
    expect(contraparteDeBizum('BIZUM 00218832')).toBeUndefined();
  });

  it('un número suelto no es un nombre', () => {
    expect(contraparteDeBizum('BIZUM DE 4433')).toBeUndefined();
  });

  it('si no es un Bizum, no hay contraparte que sacar', () => {
    expect(contraparteDeBizum('TRANSFERENCIA DE ADNAN PARWEZ')).toBeUndefined();
  });
});
