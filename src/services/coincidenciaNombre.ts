// ============================================================================
// ¿Es la misma persona? · comparar el nombre del banco con el del contrato
// ============================================================================
//
// El banco manda "BIZUM DE ADNAN PARWEZ" y en el contrato pone "Adnan Parwez
// Khan". Son la misma persona y ninguna comparación literal lo ve: sobra un
// apellido, faltan las tildes, cambian las mayúsculas.
//
// Lo que sí aguanta es comparar por PALABRAS. Dos nombres que comparten el
// nombre de pila y al menos un apellido son, en la práctica, el mismo inquilino.
// Compartir sólo una palabra ("MARIA") no basta para afirmarlo, pero tampoco es
// nada: por eso hay dos niveles y no un sí/no. Quien llama decide qué peso le
// da a cada uno — aquí no se concilia nada, sólo se mide el parecido.
// ============================================================================

/** Partículas que no distinguen a nadie · "de la Torre" y "Torre" son la misma. */
const PARTICULAS = new Set([
  'de',
  'del',
  'la',
  'las',
  'lo',
  'los',
  'y',
  'da',
  'das',
  'do',
  'dos',
  'van',
  'von',
  'el',
]);

/**
 * El nombre partido en palabras comparables · sin tildes, sin mayúsculas, sin
 * puntuación y sin partículas.
 *
 * Se descartan las palabras de menos de tres letras porque una inicial suelta
 * ("J. Pérez") coincidiría con demasiada gente.
 */
function palabrasDe(nombre: string): Set<string> {
  const limpio = (nombre ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zñ]+/g, ' ');

  const palabras = limpio
    .split(' ')
    .filter((p) => p.length >= 3 && !PARTICULAS.has(p));

  return new Set(palabras);
}

export type NivelCoincidencia = 'ninguna' | 'parcial' | 'fuerte';

/**
 * Cuánto se parecen dos nombres de persona.
 *
 * - `fuerte`: comparten dos palabras o más — nombre de pila y algún apellido.
 *   Es lo que se espera de "ADNAN PARWEZ" contra "Adnan Parwez Khan".
 * - `parcial`: comparten exactamente una. "BIZUM A LAURA" contra "Laura
 *   Sánchez" cae aquí: apunta a ella, pero apuntaría igual a otra Laura.
 * - `ninguna`: no comparten nada, o alguno de los dos no trae palabras que
 *   comparar.
 *
 * No se mira el orden ni la posición: hay bancos que ponen el apellido delante.
 */
export function nivelDeCoincidencia(unNombre: string, otroNombre: string): NivelCoincidencia {
  const unas = palabrasDe(unNombre);
  const otras = palabrasDe(otroNombre);
  if (unas.size === 0 || otras.size === 0) return 'ninguna';

  let comunes = 0;
  for (const palabra of unas) if (otras.has(palabra)) comunes += 1;

  if (comunes >= 2) return 'fuerte';
  return comunes === 1 ? 'parcial' : 'ninguna';
}
