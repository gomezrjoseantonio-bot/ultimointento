// ============================================================================
// Bizum · reconocer la línea y, sobre todo, QUIÉN está al otro lado
// ============================================================================
//
// Un Bizum llega al extracto como una transferencia cualquiera, y hasta ahora
// caía en el saco de "transferencia recibida" sin dueño. Pero el texto del
// banco SÍ trae el nombre —"BIZUM DE ADNAN PARWEZ"—, y ese nombre es lo que
// convierte una línea anónima en la renta de una habitación.
//
// Por eso esto hace dos cosas y no una: decir que es un Bizum, y sacar la
// contraparte. Lo primero es una etiqueta; lo segundo es el dato.
//
// Legalmente el Bizum va atado a UNA cuenta (un teléfono, una cuenta), y eso
// vive en `Account.bizum`. Aquí solo se lee el texto.
// ============================================================================

/** Sin tildes y en minúscula · para mirar, no para mostrar. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** `true` si la línea del extracto es un Bizum. */
export function pareceBizum(texto: string): boolean {
  return /\bbizum\b/.test(normalizar(texto ?? ''));
}

/**
 * Quién está al otro lado · `undefined` si el texto no lo dice.
 *
 * Los bancos lo escriben de varias formas —"BIZUM DE X", "BIZUM A FAVOR DE X",
 * "ENVIO BIZUM A X", "BIZUM RECIBIDO DE X"— y detrás del nombre puede venir el
 * concepto que puso quien lo mandó ("... CONCEPTO: ALQUILER AGOSTO").
 *
 * Se devuelve con las MAYÚSCULAS ORIGINALES: es un nombre de persona y va a
 * salir en pantalla, así que se respeta como venga del banco en vez de
 * normalizarlo — normalizar sirve para comparar, no para enseñar.
 *
 * Si no se puede leer con seguridad se devuelve `undefined` y no se inventa
 * nada: una fila sin nombre es mejor que una fila con el nombre equivocado.
 */
export function contraparteDeBizum(texto: string): string | undefined {
  const t = (texto ?? '').trim();
  if (!pareceBizum(t)) return undefined;

  // El nombre va detrás de la preposición que sigue a "bizum" (con o sin
  // "recibido"/"enviado" por medio). `.*?` es perezoso para quedarse con la
  // PRIMERA preposición y no con una que venga dentro del concepto.
  const m = t.match(
    /bizum\b.*?\b(?:a\s+favor\s+de|de|a|para)\s+(.+)$/i
  );
  if (!m) return undefined;

  const nombre = m[1]
    // Lo que el remitente escribió como concepto no es su nombre.
    .split(/\b(?:concepto|conc|ref|referencia|motivo)\b\s*:?/i)[0]
    // Restos de puntuación y números de referencia pegados al final.
    .replace(/[.,;:\-\s]+$/, '')
    .trim();

  // Un nombre de una sola letra o un número suelto no es un nombre.
  if (nombre.length < 2 || /^\d+$/.test(nombre)) return undefined;
  return nombre;
}
