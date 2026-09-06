// ============================================================================
// E2.4.2 · Palabras con LÍMITE DE PALABRA · nunca substring
// ============================================================================
//
// Regla dura 1 (destilada de 4.000 registros reales): «once» casaba dentro de
// «c-once-pto» y clasificó 373 movimientos como cuota de la ONCE. Igual «gas»
// dentro de «gasto», «luz» dentro de «Andaluz», «loto» dentro de «piloto».
//
// Aquí una palabra clave solo casa como PALABRA ENTERA del texto del banco,
// normalizado (`normalizarTexto`: sin tildes, mayúsculas, solo A-Z0-9 y
// espacios). Una frase («CUOTA PRESTAMO») casa como secuencia de palabras
// enteras. No hay `includes` en ningún sitio de este fichero a propósito.
//
// La única tolerancia es el RECORTE del banco: «IBERDROLA COMERCIALIZACION»
// llega como «IBERDROLA COMERCIALIZA» porque el concepto se corta a cuarenta
// caracteres. Dos palabras de cinco o más letras cuentan como la misma si una
// es prefijo de la otra; a menos de cinco no, que es justo donde «gas/gasto» y
// «once/concepto» se cuelan.
// ============================================================================

import { mismaPalabraEntera, normalizarTexto } from '../deterministas/texto';

export { normalizarTexto };

/** Las palabras del texto normalizado · sin vacías. */
export function palabrasDe(textoNormalizado: string): string[] {
  return textoNormalizado.split(' ').filter((p) => p.length > 0);
}

/** ¿Son la misma palabra, contando el recorte del banco? · vive en `deterministas/texto`. */
export const mismaPalabra = mismaPalabraEntera;

/**
 * ¿El texto lleva esta palabra ENTERA (o esta frase, como secuencia de
 * palabras enteras)? Los dos lados se normalizan igual.
 */
export function tienePalabra(texto: string, palabraOFrase: string): boolean {
  const del = palabrasDe(normalizarTexto(texto));
  const buscadas = palabrasDe(normalizarTexto(palabraOFrase));
  if (buscadas.length === 0 || del.length === 0) return false;
  for (let i = 0; i + buscadas.length <= del.length; i++) {
    let ok = true;
    for (let j = 0; j < buscadas.length; j++) {
      if (!mismaPalabra(del[i + j], buscadas[j])) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

/** ¿Lleva ALGUNA de estas palabras o frases? */
export function tieneAlguna(texto: string, lista: readonly string[]): boolean {
  return lista.some((p) => tienePalabra(texto, p));
}

/** La primera de la lista que casa · para decir POR QUÉ. */
export function cualCasa(texto: string, lista: readonly string[]): string | undefined {
  return lista.find((p) => tienePalabra(texto, p));
}
