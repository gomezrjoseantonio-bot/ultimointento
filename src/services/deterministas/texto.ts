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
  return palabras.every((p) => delBanco.some((t) => mismaPalabraEntera(t, p)));
}

const MINIMO_PARA_PREFIJO = 5;

/** Igual, o un recorte del banco («COMERCIALIZA» ↔ «COMERCIALIZACION»). */
export function mismaPalabraEntera(delBanco: string, buscada: string): boolean {
  if (delBanco === buscada) return true;
  if (delBanco.length < MINIMO_PARA_PREFIJO || buscada.length < MINIMO_PARA_PREFIJO) return false;
  return delBanco.startsWith(buscada) || buscada.startsWith(delBanco);
}
