// ============================================================================
// Condiciones que se verifican contra la tesorería · VOCABULARIO §6 ter
// ============================================================================
//
// «Las bonificaciones de una hipoteca o un préstamo no se cumplen por
// declararlas: se cumplen porque los movimientos lo demuestran.»
//
// Todas tienen la misma forma —§6 ter lo dice, y por eso van juntas—:
//
//     agregar movimientos DE UN TIPO, en UNA VENTANA, contra UN UMBRAL
//
// Aquí vive esa forma, y nada más: este fichero no sabe qué es una tarjeta ni
// qué es una nómina. Cada fuente aporta el agregado; la ventana, la comparación
// y el veredicto son los mismos para todas. Es el sitio que §6 ter pide dejar
// hecho para las que vengan.
//
// Puro: no lee la base ni el reloj. Quien llame pasa la fecha.
// ============================================================================

/** El tramo en el que se mide · ISO `YYYY-MM-DD`, los dos extremos incluidos. */
export interface Ventana {
  desde: string;
  hasta: string;
}

/**
 * Tres respuestas, no dos.
 *
 * `no_verificable` no es un `no_cumple` cobarde: es la diferencia entre «los
 * movimientos dicen que te quedas corto» y «nada en la tesorería puede probar
 * esto». Enseñar la segunda como la primera manda a alguien a gastar más para
 * arreglar algo que no se arregla gastando.
 */
export type Veredicto = 'cumple' | 'no_cumple' | 'no_verificable';

export interface Cumplimiento {
  bonificacionId: string;
  nombre: string;
  veredicto: Veredicto;
  /** En qué tramo se ha mirado · ausente cuando no se ha podido mirar. */
  ventana?: Ventana;
  /** Lo que los movimientos demuestran, ya agregado. */
  medido?: number;
  /** Lo que hay que alcanzar para cumplir. */
  exigido?: number;
  /**
   * En qué se miden `medido` y `exigido`.
   *
   * Casi todo se mide en euros y ese es el supuesto por defecto. Los recibos
   * domiciliados no: ahí la condición es **cuántos**, y enseñar «3 €» donde el
   * banco pide tres recibos no es un detalle de formato — es otra cosa.
   */
  unidad?: 'euros' | 'recibos';
  /**
   * Lo que hay en la ventana pero el banco todavía no ha cobrado.
   *
   * Va aparte a propósito. Sumarlo a `medido` diría que está demostrado algo
   * que aún puede crecer o quedarse corto (§3.5); esconderlo haría creer que se
   * llega corto cuando el gasto ya está hecho y solo falta que lo cobren.
   *
   * No es solo el periodo abierto: también cabe aquí un cargo antiguo que nunca
   * se llegó a conciliar. Los dos casos son lo mismo para esto — gasto que no
   * prueba nada porque no consta cobrado.
   */
  sinCobrar?: number;
  /**
   * Cuando la condición se mide **mes a mes** y no sobre un total.
   *
   * La forma de §6 ter —agregar, en una ventana, contra un umbral— vale para la
   * tarjeta, que se mide por el total del semestre. La nómina no: «1.200 € al
   * mes» no lo cumple un semestre con 7.200 € si un mes vino vacío y otro
   * doble. Cuando esto viene, `medido` es **el mes más flojo** y `exigido` el
   * mínimo mensual — la cifra que decide sigue siendo una, pero hay que decir
   * de cuántos meses sale.
   */
  mensual?: {
    /** Meses de la ventana en los que entró algo. */
    conMovimiento: number;
    /** De esos, cuántos alcanzaron el umbral. */
    queLlegan: number;
  };
  /** Por qué · lo que no se puede medir se dice, no se disimula. */
  motivo?: string;
}

// ─── Fechas · en UTC de extremo a extremo ───────────────────────────────────
//
// Mismo motivo que en `tarjetasReglas`: mezclar hora local con `toISOString()`
// corre el día, y CI corre en UTC, así que el fallo aparecería solo en el
// navegador del usuario.

/** El último día del mes · restar meses no puede aterrizar en un 31 de febrero. */
function ultimoDiaDelMes(anio: number, mes0: number): number {
  return new Date(Date.UTC(anio, mes0 + 1, 0)).getUTCDate();
}

const aIso = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * Los `lookbackMeses` que acaban en `hasta`, con los dos extremos dentro.
 *
 * Seis meses acabados el 3 de agosto son del 4 de febrero al 3 de agosto: el
 * día que abre la ventana es el siguiente al mismo día de hace seis meses, o
 * media jornada se contaría dos veces al encadenar ventanas.
 *
 * Una ventana de cero meses no puede probar nada y leerla como vacía se
 * confundiría con «no cumples», así que el mínimo es un mes.
 *
 * El cinturón contra un `lookbackMeses` que no es número está aquí porque esto
 * termina en `toISOString()`, y un `NaN` no devuelve una fecha rara: **lanza**,
 * y se lleva por delante la pantalla que lo estaba pintando. Pero quien decide
 * de verdad es `verificarBonificaciones`, que en ese caso ni llega a preguntar
 * — inventar una ventana sería contestar por el usuario.
 */
export function ventanaDeEvaluacion(hasta: string, lookbackMeses: number): Ventana {
  const fin = new Date(`${hasta}T00:00:00Z`);
  const meses = Number.isFinite(lookbackMeses) ? Math.max(1, Math.round(lookbackMeses)) : 1;

  const anio = fin.getUTCFullYear();
  const mes0 = fin.getUTCMonth() - meses;
  // `Date.UTC` normaliza los meses negativos al año anterior; el día se recorta
  // al último del mes destino —31 de agosto menos seis meses es el 28/29 de
  // febrero, no un 3 de marzo que se comería tres días de más.
  const destino = new Date(Date.UTC(anio, mes0, 1));
  const dia = Math.min(
    fin.getUTCDate(),
    ultimoDiaDelMes(destino.getUTCFullYear(), destino.getUTCMonth())
  );

  const inicio = new Date(Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth(), dia + 1));
  return { desde: aIso(inicio), hasta };
}

/**
 * Si lo medido alcanza lo exigido.
 *
 * El medio céntimo de holgura es por las sumas en coma flotante: tres importes
 * que suman exactamente 3.000 € pueden dar 2999.9999999996, y nadie entendería
 * —ni el banco— que eso sea incumplir.
 */
export function veredictoDelImporte(medido: number, exigido: number): Veredicto {
  return medido + 0.005 >= exigido ? 'cumple' : 'no_cumple';
}
