// E3.3b · el CSV que no viene en UTF-8.
//
// El lector de CSV pedía UTF-8 siempre, y media banca española no lo usa: el
// export de Abanca viene en ISO-8859 y sus eñes llegaban como «A�ADIDO».
//
// En el fichero real de Jose son cinco líneas —cuatro «IMPTO. SOBRE EL VALOR
// AÑADIDO» del modelo 303 y un «Ahorro más»— porque Abanca escribe casi todo en
// ASCII. Pero el texto roto no se queda quieto: de él salen la clave de
// aprendizaje, el nombre de la contraparte y las palabras que busca el catálogo.
// El día que el cliente se apellide Muñoz, su nombre llega roto en TODAS sus
// líneas y ninguna de esas tres cosas funciona.

import { textoDelCsv } from '../bankParser';

/** Los mismos bytes que manda Abanca · ISO-8859, no UTF-8. */
const enLatin1 = (texto: string): ArrayBuffer => {
  const bytes = new Uint8Array(texto.length);
  for (let i = 0; i < texto.length; i++) bytes[i] = texto.charCodeAt(i) & 0xff;
  return bytes.buffer;
};

const enUtf8 = (texto: string): ArrayBuffer => new TextEncoder().encode(texto).buffer as ArrayBuffer;

describe('la codificación del CSV se prueba, no se supone', () => {
  it('un CSV en ISO-8859 se lee bien · las eñes dejan de romperse', () => {
    const linea = '30/01/2025;-2257,82;IMPTO. SOBRE EL VALOR AÑADIDO.AUTOL';

    expect(textoDelCsv(enLatin1(linea))).toBe(linea);
    // Y así es como llegaba antes · el rombo del carácter perdido.
    expect(new TextDecoder('utf-8').decode(enLatin1(linea))).toContain('�');
  });

  it('un apellido con eñe o tilde llega entero', () => {
    const linea = '21/03/2025;400;Transferencia De Muñoz Peña, Concepto Ahorro más';
    expect(textoDelCsv(enLatin1(linea))).toBe(linea);
  });

  it('un CSV que SÍ es UTF-8 se sigue leyendo como UTF-8', () => {
    // Lo de siempre no cambia · solo se prueba, y si pasa la prueba, manda.
    const linea = 'Tipo,Descripción,Importe\nRecargas,Recarga de *9623,35.00';
    expect(textoDelCsv(enUtf8(linea))).toBe(linea);
  });

  it('el euro y las comillas del banco no se pierden · windows-1252, no ISO puro', () => {
    // 0x80 es el € en windows-1252 y no existe en ISO-8859-1.
    const bytes = new Uint8Array([0x31, 0x30, 0x80]).buffer;
    expect(textoDelCsv(bytes)).toBe('10€');
  });

  it('un fichero vacío no rompe nada', () => {
    expect(textoDelCsv(new ArrayBuffer(0))).toBe('');
  });
});
