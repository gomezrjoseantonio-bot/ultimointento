// El último tramo del identificador · de la celda al movimiento.
//
// Sale a su propio fichero por un motivo concreto: `csvParserService` no se
// puede importar en un test —usa `import.meta.env` (`:79`) y jest no lo
// transforma—, así que mientras esta lectura viviera dentro, el tramo final del
// recorrido no lo cubría ningún test y solo se podía comprobar a mano, en el
// navegador y con datos reales delante. Aquí sí se prueba.
//
// Es deliberadamente tonta. Toda la decisión —qué columna es la buena— está en
// `bankProfilesService.mapHeaders`; esto solo lee la celda que aquella eligió.

/**
 * El texto con el que el banco identifica la operación.
 *
 * `undefined` cuando no hay columna, cuando la fila no llega hasta ella o cuando
 * está vacía. Nunca cadena vacía: un `reference: ''` parecería un identificador
 * que existe y está en blanco, y lo que pasa es que no hay.
 */
export function referenciaDeLaFila(
  row: readonly unknown[],
  mapping: Record<string, number>,
): string | undefined {
  const i = mapping.reference;
  if (i === undefined) return undefined;
  const celda = row[i];
  if (celda === undefined || celda === null) return undefined;
  const texto = String(celda).trim();
  return texto === '' ? undefined : texto;
}
