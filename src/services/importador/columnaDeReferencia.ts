// Qué columna del extracto lleva el identificador · para el importador REAL.
//
// Vive aquí porque el detector de columnas del importador REAL
// (`BankParserService`) se dejaba fuera las dos columnas que llevan el
// identificador. Hubo un intento anterior de arreglar esto en otro detector
// —`bankProfilesService.mapHeaders`— que no corría en este camino; ese módulo
// se ha borrado en la 2.0.2 junto con el parser que lo usaba, para que nadie
// vuelva a arreglar el sitio equivocado.
//
// El mecanismo del fallo: cada columna se consume con el PRIMER tipo cuyo alias
// casa, y en la tabla `description` va antes que `reference`. Con las cabeceras
// de BBVA:
//
//   Concepto      → description (alias 0 · gana)
//   Movimiento    → description (alias 12 · pierde, pero la columna se consume)
//   Observaciones → description (alias 8 · pierde, pero la columna se consume)
//
// Las dos columnas donde vive `0182-5322-27-0830842450` acababan descartadas sin
// que nadie las reclamara para `reference`.
//
// Esta pasada va DESPUÉS y solo sobre columnas que no se llevó nadie: no puede
// cambiar ninguna asignación que ya funcionara.

/**
 * Preferencia para el identificador, en ORDEN.
 *
 * Lo canónico primero: quien traiga una columna «Referencia» la sigue usando.
 * Detrás, las que en la práctica llevan el dato aunque no se llamen así.
 *
 * `observaciones` va antes que `movimiento` porque es la única que sirve para
 * los dos casos reales: en el recibo de Bankinter, `Movimiento` trae el nº de
 * recibo —que cambia cada mes— y `Observaciones` el nombre del prestamista,
 * que no.
 */
export const ALIAS_REFERENCIA: readonly string[] = [
  'referencia',
  'ref',
  // E2.4.2 · Sabadell numera las dos suyas · la 1 lleva el NIF del emisor y
  // la 2 el CUPS o el nº de contrato (lo que dice de qué piso es el recibo).
  'referencia 1',
  'referencia 2',
  'ref 1',
  'ref 2',
  'numero operacion',
  'número operación',
  'num operacion',
  'núm operación',
  'id operacion',
  'id operación',
  'reference',
  'observaciones',
  'concepto ampliado',
  'detalle operacion',
  'detalle operación',
  'movimiento',
  'mas datos',
  'más datos',
  // E2.4.2 · ING escribe en «Comentario» lo que el usuario anotó al pagar
  // («panelista») y Revolut dice en «Type» si fue una recarga (TOPUP), un
  // pago con tarjeta o una transferencia · señal de método y de traspaso.
  'comentario',
  'comentarios',
  'type',
  'tipo',
];

/**
 * El índice de la columna que lleva el identificador, o `undefined`.
 *
 * `cabeceras` llegan YA normalizadas (minúsculas, sin tildes ni puntuación), que
 * es como las tiene el detector cuando llama aquí.
 *
 * Devuelve `undefined` cuando no hay ninguna: un fichero sin esa columna no gana
 * una referencia inventada.
 */
export function columnaDeReferencia(
  cabecerasNormalizadas: readonly string[],
  yaOcupadas: readonly number[],
  normalizar: (s: string) => string,
): number | undefined {
  const ocupadas = new Set(yaOcupadas);
  for (const alias of ALIAS_REFERENCIA) {
    const buscado = normalizar(alias);
    for (let i = 0; i < cabecerasNormalizadas.length; i++) {
      if (ocupadas.has(i)) continue;
      if (cabecerasNormalizadas[i] !== buscado) continue;
      return i;
    }
  }
  return undefined;
}

/**
 * E2.4.2 · TODAS las demás columnas con identificador, en el orden de
 * `ALIAS_REFERENCIA`, sin las ya ocupadas. Para los bancos que traen dos
 * (Sabadell «Referencia 1» + «Referencia 2») o un comentario aparte (ING).
 * Vacío si no hay ninguna más.
 */
export function columnasDeReferencia(
  cabecerasNormalizadas: readonly string[],
  yaOcupadas: readonly number[],
  normalizar: (s: string) => string,
): number[] {
  const ocupadas = new Set(yaOcupadas);
  const salida: number[] = [];
  for (const alias of ALIAS_REFERENCIA) {
    const buscado = normalizar(alias);
    for (let i = 0; i < cabecerasNormalizadas.length; i++) {
      if (ocupadas.has(i) || salida.includes(i)) continue;
      if (cabecerasNormalizadas[i] !== buscado) continue;
      salida.push(i);
    }
  }
  return salida;
}
