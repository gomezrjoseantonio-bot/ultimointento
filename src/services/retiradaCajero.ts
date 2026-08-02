// ============================================================================
// ¿Esta línea del extracto es una retirada de efectivo?
// ============================================================================
//
// Sacar del cajero NO es un gasto: el dinero no se va, cambia de sitio. Pero en
// el extracto llega como un cargo más, así que hay que reconocerlo por el texto
// del banco para poder ofrecer lo que de verdad es — una transferencia interna
// a la cuenta de Efectivo.
//
// Esto solo PROPONE. Un reintegro puede ser también dinero que sacas para
// llevártelo a otro sitio, y adivinarlo mal movería dinero entre cuentas sin
// que nadie lo haya dicho: quien decide es el usuario, en §4.7.
// ============================================================================

/**
 * Los textos con los que los bancos españoles nombran una salida de efectivo.
 *
 * `REINTEGRO` es el término de caja de toda la vida y el más común; el resto
 * son las redes de cajeros (4B · ServiRed · Euro 6000 · Telebanco) y las
 * variantes de "disposición".
 *
 * Van sin acentos ni signos a propósito: el texto se normaliza antes de mirar,
 * porque los extractos llegan en mayúsculas, sin tildes y con la puntuación que
 * a cada banco le parece.
 */
const HUELLAS = [
  /\breintegro\b/,
  /\bdisposicion\b.*\b(cajero|efectivo)\b/,
  /\bdisp\b.*\bcajero\b/,
  /\bretirada\b.*\b(cajero|efectivo)\b/,
  /\bcajero\s*(automatico)?\b/,
  /\btelebanco\b/,
  /\bservired\b/,
  /\beuro\s*6000\b/,
  /\b4b\b/,
];

/** Sin tildes, en minúscula y con la puntuación convertida en espacios. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * `true` si la línea parece una retirada de efectivo.
 *
 * El importe tiene que ser NEGATIVO: un ingreso en cajero también lleva la
 * palabra "cajero" y es exactamente lo contrario — dinero que entra. Proponer
 * ahí un traspaso a efectivo lo dejaría al revés.
 */
export function pareceRetiradaDeCajero(texto: string, importe: number): boolean {
  if (importe >= 0) return false;
  const t = normalizar(texto ?? '');
  if (!t) return false;
  return HUELLAS.some((h) => h.test(t));
}
