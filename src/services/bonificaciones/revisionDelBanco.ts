// ============================================================================
// Cuándo revisa el banco · VOCABULARIO §6 ter
// ============================================================================
//
// Una bonificación no se gana ni se pierde el día que dejas de cumplirla: se
// pierde **el día que el banco lo mira**. Hasta entonces sigues pagando la
// cuota rebajada aunque lleves tres meses sin gastar con la tarjeta, y al revés
// —empezar a cumplir hoy no baja el recibo de este mes—.
//
// Por eso el veredicto de §6 ter no puede decir «pasarías al 2,70 %» a secas.
// Sin fecha eso es una hipótesis; con fecha es una cita, y da tiempo a
// corregir, que es de lo que va todo esto (decisión de Jose · 4 ago 2026).
//
// Dos datos, y los dos vienen de la escritura:
//
//   · CADA CUÁNTO revisa · lo normal es cada 6 o cada 12 meses.
//   · EL PERIODO INICIAL en que se dan por cumplidas · el primer año, los
//     primeros seis meses, o ninguno. Es del préstamo entero, no de cada
//     bonificación: el banco concede un plazo común (decisión de Jose).
//
// Puro: no lee la base ni el reloj. Quien llame pasa la fecha de hoy.
// ============================================================================

/** Lo que la escritura dice sobre las revisiones. */
export interface CalendarioDeRevision {
  /** La fecha desde la que se cuenta todo · la firma. ISO `YYYY-MM-DD`. */
  desdeLaFirma: string;
  /** Cada cuántos meses mira el banco · 6 y 12 son lo normal. */
  cadaMeses: number;
  /**
   * Meses iniciales en que las bonificaciones se dan por cumplidas.
   *
   * `0` o ausente = ninguno, se exige desde el primer día.
   */
  graciaMeses?: number;
}

export interface Revision {
  /** El día en que el banco mira y la cuota puede cambiar · ISO. */
  fecha: string;
  /**
   * Si HOY las bonificaciones están aplicadas por el periodo inicial.
   *
   * Importa decirlo: durante la gracia la cuota rebajada no demuestra nada
   * sobre si cumples, y quien no lo sepa creerá que va bien.
   */
  enGracia: boolean;
  /** Cuándo se acaba el periodo inicial · ausente si no hay. */
  finDeGracia?: string;
}

// ─── Fechas · en UTC de extremo a extremo ───────────────────────────────────
//
// Mismo motivo que en `cumplimiento.ts`: mezclar hora local con `toISOString()`
// corre el día, y CI corre en UTC, así que el fallo solo aparecería en el
// navegador de quien lo usa.

const aIso = (d: Date): string => d.toISOString().slice(0, 10);

/** El último día del mes · sumar meses no puede aterrizar en un 31 de febrero. */
function ultimoDiaDelMes(anio: number, mes0: number): number {
  return new Date(Date.UTC(anio, mes0 + 1, 0)).getUTCDate();
}

/**
 * `origen` más `meses`, recortando el día al último del mes destino.
 *
 * Una firma del 31 de enero más un mes es el 28 de febrero, no el 3 de marzo:
 * dejar que `Date` desborde correría todas las revisiones siguientes.
 */
function sumarMeses(origen: string, meses: number): string {
  const base = new Date(`${origen}T00:00:00Z`);
  const destino = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + meses, 1));
  const dia = Math.min(
    base.getUTCDate(),
    ultimoDiaDelMes(destino.getUTCFullYear(), destino.getUTCMonth())
  );
  return aIso(new Date(Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth(), dia)));
}

/** Un entero de meses utilizable, o `null` si lo que hay no lo es. */
function mesesValidos(n: unknown): number | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  const entero = Math.round(n);
  return entero > 0 ? entero : null;
}

/**
 * La próxima revisión que DECIDE algo, y si hoy estamos en el periodo inicial.
 *
 * Las revisiones caen cada `cadaMeses` desde la firma, pero las que suceden
 * dentro del periodo inicial no cambian nada: enseñar «en la revisión del 10 de
 * marzo pasarías al 2,70 %» cuando esa revisión está en gracia sería una alarma
 * falsa. Lo que se devuelve es **la primera que puede mover la cuota**.
 *
 * `null` cuando la escritura no dice cada cuánto revisa. No se inventa un año
 * por defecto: una fecha inventada se lee igual que una real, y esta manda a
 * alguien a gastar antes de un día que nadie le ha puesto.
 */
export function proximaRevision(cal: CalendarioDeRevision, hoy: string): Revision | null {
  const cada = mesesValidos(cal.cadaMeses);
  if (cada == null) return null;
  if (typeof cal.desdeLaFirma !== 'string' || cal.desdeLaFirma.length < 10) return null;

  const gracia = mesesValidos(cal.graciaMeses);
  const finDeGracia = gracia != null ? sumarMeses(cal.desdeLaFirma, gracia) : undefined;

  // La primera revisión que cuenta es la primera posterior a HOY que además
  // caiga fuera del periodo inicial.
  const suelo = finDeGracia && finDeGracia > hoy ? finDeGracia : hoy;

  let fecha = sumarMeses(cal.desdeLaFirma, cada);
  // Se avanza de una en una en vez de calcular el múltiplo: con el recorte de
  // día del mes, «firma + 3×6 meses» y «firma + 6, +6, +6» no siempre dan lo
  // mismo, y la serie buena es la segunda — cada revisión sale de la anterior.
  //
  // El tope evita un bucle infinito si alguien guarda una firma absurdamente
  // antigua; 1.200 revisiones son cien años incluso revisando cada mes.
  for (let i = 0; fecha <= suelo && i < 1200; i++) {
    fecha = sumarMeses(fecha, cada);
  }

  return {
    fecha,
    enGracia: finDeGracia != null && hoy < finDeGracia,
    ...(finDeGracia ? { finDeGracia } : {}),
  };
}
