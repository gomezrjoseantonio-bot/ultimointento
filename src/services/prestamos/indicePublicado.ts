// ============================================================================
// De qué publicación sale el índice de una revisión · §6 ter
// ============================================================================
//
// El índice de una revisión **no es el euríbor del día**, ni el de hoy. Es un
// valor ya publicado, y la escritura dice cuál: el tipo medio mensual del BOE
// de un mes concreto, con desfase respecto a la fecha de revisión. Lo normal es
// «el del mes anterior» o «el del segundo mes anterior», y entre dos meses
// consecutivos puede haber décimas.
//
// O sea: el día que el banco revisa, el número **ya está decidido y publicado**.
// No hay nada que adivinar, solo hay que ir a buscarlo — y para eso hace falta
// saber a qué mes ir.
//
// Sin esto, la pantalla que pide apuntar la revisión sugería el euríbor de
// «Actualizar valores», que es el de HOY. Para una revisión de agosto que se
// confirma en octubre, ese número no tiene por qué parecerse al que aplicó, y
// ofrecerlo invita a aceptarlo.
//
// **No hay desfase por defecto.** «La escritura no lo dice» y «el del mes
// anterior» son cosas distintas, y de la segunda saldría un mes concreto que se
// lee igual de firme que uno real. Cuando no se sabe, no se dice.
// ============================================================================

/** Lo mínimo para saber de dónde sale el índice · nada más. */
type ConDesfase = { indiceDesfaseMeses?: number };

/** Un `YYYY-MM` restándole meses · sin tocar `Date`, que aquí solo estorba. */
const mesesAtras = (anioMes: string, meses: number): string => {
  const anio = Number(anioMes.slice(0, 4));
  const mes = Number(anioMes.slice(5, 7));
  if (!Number.isInteger(anio) || !Number.isInteger(mes) || mes < 1 || mes > 12) return '';
  const total = anio * 12 + (mes - 1) - meses;
  // Antes del año cero no hay publicación · y sin este corte el `%` de JS da
  // resto NEGATIVO, así que saldría un «-1--1» con pinta de fecha.
  if (total < 0) return '';
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
};

/**
 * De qué mes publicado sale el índice que aplica en una revisión.
 *
 * Devuelve `YYYY-MM`, o `null` cuando la escritura no dice el desfase o la
 * fecha no sirve. Callarse es la respuesta correcta: mandar a alguien a mirar
 * el euríbor de un mes que nadie le ha dicho es peor que no decirle nada.
 */
export function publicacionDelIndice(
  prestamo: ConDesfase,
  fechaRevision: string | null | undefined
): string | null {
  const desfase = prestamo.indiceDesfaseMeses;
  if (!Number.isInteger(desfase) || (desfase as number) < 0) return null;
  if (!fechaRevision || fechaRevision.length < 7) return null;

  const publicacion = mesesAtras(fechaRevision.slice(0, 7), desfase as number);
  return publicacion || null;
}
