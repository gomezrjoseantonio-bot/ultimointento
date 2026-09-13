// Comparar el texto del banco con el que escribió el usuario.
//
// El banco no escribe como una persona: quita tildes, mete la eñe como N, corta
// a cuarenta caracteres, mezcla mayúsculas y rellena con números de referencia.
// «NOMINA ORANGE ESPAÑA SAU» llega como «NOMINA ORANGE ESPANA SAU 08/2026».
//
// Por eso no se compara igualdad sino CONTENCIÓN de todas las palabras: el texto
// del banco tiene que llevar todas las del concepto guardado, en cualquier orden
// y con lo que quiera alrededor. Es estricto en lo que exige (todas) y laxo en
// lo que tolera (el ruido que añade el banco).

/** Sin tildes, sin puntuación, en mayúsculas y con un solo espacio. */
export function normalizarTexto(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

/**
 * ¿El texto del banco lleva todas las palabras del concepto?
 *
 * Las de una y dos letras se descartan: «DE», «SA», «Y» aparecen en medio
 * extracto y no identifican a nadie. Si tras el descarte no queda ninguna
 * palabra, no se reconoce: un concepto que solo dice «SA» no identifica nada.
 */
export function contieneConcepto(textoBancoNormalizado: string, concepto: string): boolean {
  const palabras = normalizarTexto(concepto)
    .split(' ')
    .filter((p) => p.length > 2);
  if (palabras.length === 0) return false;
  // E2.4.2 · regla dura 1 · por PALABRA ENTERA, nunca substring: «ONCE» no
  // está en «CONCEPTO» ni «GAS» en «GASTO». La única tolerancia es el recorte
  // del banco (cinco letras o más y una es prefijo de la otra).
  const delBanco = textoBancoNormalizado.split(' ').filter((p) => p.length > 0);
  return palabras.every((p) =>
    delBanco.some((t, i) => mismaPalabraEntera(t, p, i === delBanco.length - 1)),
  );
}

const MINIMO_PARA_PREFIJO = 5;

/**
 * Igual, o un RECORTE del banco («COMERCIALIZA» ↔ «COMERCIALIZACION»).
 *
 * E3.3 · §P2 · la tolerancia al recorte era simétrica y sin sitio, y por ahí se
 * colaban dos cosas que no son un recorte:
 *
 *   · «TRANSFERENCIA A CB Santa Catalina» se leía como el seguro de decesos
 *     SANTALUCIA, porque SANTA es prefijo de SANTALUCIA;
 *   · «COMPRAVENTA» se leía como el método COMPRA, porque COMPRA es prefijo de
 *     COMPRAVENTA — y una compraventa de un piso no es un pago con tarjeta.
 *
 * Un recorte de verdad tiene dos señas, y ahora se exigen las dos:
 *
 *   · deja la palabra MÁS CORTA, nunca más larga (eso mata «COMPRAVENTA»);
 *   · ocurre donde el banco corta el campo, o sea AL FINAL del texto (eso mata
 *     «SANTA», que va en medio de «Santa Catalina»).
 *
 * `esLaUltimaDelTexto` lo dice quien recorre las palabras, que es el único que
 * sabe en qué posición va cada una.
 */
export function mismaPalabraEntera(delBanco: string, buscada: string, esLaUltimaDelTexto = false): boolean {
  if (delBanco === buscada) return true;
  if (!esLaUltimaDelTexto) return false;
  if (delBanco.length < MINIMO_PARA_PREFIJO || buscada.length < MINIMO_PARA_PREFIJO) return false;
  return delBanco.length < buscada.length && buscada.startsWith(delBanco);
}
