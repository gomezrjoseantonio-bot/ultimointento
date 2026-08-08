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

/** Lo que se sabe sobre las revisiones. */
export interface CalendarioDeRevision {
  /** La fecha desde la que se cuenta todo · la firma. ISO `YYYY-MM-DD`. */
  desdeLaFirma: string;
  /**
   * La próxima revisión TAL COMO LA DA EL BANCO · `YYYY-MM`.
   *
   * Manda sobre todo lo demás, y por eso existe. La carta del Santander dice
   * «REVISIÓN ANUAL» y «desde el 31/03/2026 hasta el 30/03/2027»: la revisión
   * es regular, pero **la fecha es la del banco, no el aniversario de la
   * firma**, y nada obliga a que coincidan. Deducirla acierta solo si lo hacen,
   * y una fecha equivocada es peor que ninguna porque se lee igual que la
   * buena.
   *
   * Va en mes y año porque es lo que el banco enseña. Inventarle un día sería
   * precisión que nadie ha dado.
   */
  proximaSegunElBanco?: string;
  /** Cada cuántos meses mira el banco · 6 y 12 son lo normal. */
  cadaMeses?: number;
  /**
   * Meses iniciales en que las bonificaciones se dan por cumplidas.
   *
   * `0` o ausente = ninguno, se exige desde el primer día.
   */
  graciaMeses?: number;
}

export interface Revision {
  /**
   * Cuándo mira el banco · `YYYY-MM-DD` o `YYYY-MM` según lo que se sepa.
   *
   * **Puede faltar y aun así haber algo que decir**: quien no sabe cada cuánto
   * revisan su hipoteca —lo más habitual— puede saber perfectamente que tiene
   * el primer año regalado. Perder el aviso del periodo inicial por no tener
   * fecha sería callar justo en el caso más probable.
   */
  fecha?: string;
  /**
   * Con qué precisión se conoce · el banco da el mes, la periodicidad da el día.
   *
   * Se dice para que el texto no prometa un día que nadie ha puesto.
   */
  precision?: 'dia' | 'mes';
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

/** El `YYYY-MM` del banco, o `null` si lo que hay no lo es. */
function mesDelBanco(v: unknown): string | null {
  return typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : null;
}

/**
 * Un número de meses utilizable, o `null`.
 *
 * No se redondea: un `11,6` guardado por error se convertiría en un calendario
 * de doce meses sin que nadie se entere, y de ahí saldría una fecha que se lee
 * igual que la buena. Lo que no es un entero de meses no es un calendario.
 */
function mesesValidos(n: unknown): number | null {
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null;
}

// ─── El calendario de UN préstamo ───────────────────────────────────────────
//
// **La revisión es un solo acto** *(Jose · 8 ago 2026)*: una o dos veces al año
// el banco mira lo que tenga que mirar de este préstamo — el índice si el tramo
// en curso es variable, y las bonificaciones cuando lo diga la escritura.
//
// ATLAS lo tenía partido en dos periodicidades, `periodoRevisionMeses` y
// `periodoRevisionBonificacionMeses`, cada una con su propio desplegable
// «Revisión» en la misma pantalla de alta. Dos respuestas a la misma pregunta
// que podían no coincidir — y no coincidían: la ficha anunciaba una fecha de
// revisión arriba y otra distinta en la tarjeta de bonificaciones.
//
// Y no es que una valga para variables y la otra para fijos: **un fijo también
// revisa**. El de ING mira todos los años si cumples y mueve el tipo fijo de
// 2,15 % a 1,35 %. Lo que no revisa un fijo es el índice, porque no tiene.

/** Lo mínimo de un préstamo para saber cuándo lo mira el banco. */
export type PrestamoRevisable = {
  fechaFirma?: string;
  proximaRevisionBonificaciones?: string;
  periodoRevisionMeses?: number;
  /** @deprecated Legado · la periodicidad es una sola. Solo se lee de respaldo. */
  periodoRevisionBonificacionMeses?: number;
  graciaMesesBonificaciones?: number;
};

/**
 * Cada cuántos meses revisa el banco · una sola respuesta.
 *
 * `periodoRevisionMeses` es la canónica. La de bonificaciones se lee solo como
 * respaldo, para los préstamos guardados antes de unificarlas — entre otros los
 * fijos, a los que el asistente no escribía la canónica porque daba por hecho
 * que un fijo no revisa nada.
 */
export function cadaCuantoRevisa(p: PrestamoRevisable): number | null {
  return mesesValidos(p.periodoRevisionMeses) ?? mesesValidos(p.periodoRevisionBonificacionMeses);
}

/**
 * El calendario de revisión de un préstamo.
 *
 * Existe para que nadie vuelva a montarlo a mano: lo hacían dos sitios con los
 * mismos cuatro campos, y bastaba con que uno cambiara de opinión sobre cuál es
 * la periodicidad para que la pantalla dijera dos fechas.
 */
export function calendarioDe(p: PrestamoRevisable): CalendarioDeRevision {
  return {
    desdeLaFirma: p.fechaFirma ?? '',
    proximaSegunElBanco: p.proximaRevisionBonificaciones,
    cadaMeses: cadaCuantoRevisa(p) ?? undefined,
    graciaMeses: p.graciaMesesBonificaciones,
  };
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
  const firmaValida = typeof cal.desdeLaFirma === 'string' && cal.desdeLaFirma.length >= 10;

  const gracia = firmaValida ? mesesValidos(cal.graciaMeses) : null;
  const finDeGracia = gracia != null ? sumarMeses(cal.desdeLaFirma, gracia) : undefined;
  const enGracia = finDeGracia != null && hoy < finDeGracia;

  // Lo que dice el banco manda · es el dato de verdad, no una deducción.
  //
  // Sigue valiendo mientras no acabe SU MES: dentro del mes de la revisión
  // todavía es la próxima, porque nadie ha dicho qué día de agosto mira.
  const delBanco = mesDelBanco(cal.proximaSegunElBanco);
  if (delBanco && delBanco >= hoy.slice(0, 7)) {
    return {
      fecha: delBanco,
      precision: 'mes',
      enGracia,
      ...(finDeGracia ? { finDeGracia } : {}),
    };
  }

  // Sin periodicidad no hay fecha, pero el periodo inicial sigue siendo cierto
  // y hay que decirlo · es además el caso más habitual: mucha gente no sabe
  // cada cuánto revisan su hipoteca y sí que el primer año está regalado.
  const sinFecha = (): Revision | null =>
    finDeGracia ? { enGracia, finDeGracia } : null;

  const cada = mesesValidos(cal.cadaMeses);
  if (cada == null || !firmaValida) return sinFecha();

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
  let vueltas = 0;
  while (fecha <= suelo && vueltas < 1200) {
    fecha = sumarMeses(fecha, cada);
    vueltas++;
  }

  // Si el tope se agotó, lo que hay en la mano es una fecha del pasado. Darla
  // por buena sería enseñar una cita que ya pasó — peor que no dar ninguna.
  if (fecha <= suelo) return sinFecha();

  return {
    fecha,
    precision: 'dia',
    enGracia,
    ...(finDeGracia ? { finDeGracia } : {}),
  };
}

/** Una revisión que YA TOCÓ y que nadie ha dado por buena todavía. */
export interface RevisionPendiente {
  /** Cuándo tocó · `YYYY-MM-DD` o `YYYY-MM` según lo que se supiera. */
  fecha: string;
  precision: 'dia' | 'mes';
  /**
   * El día desde el que rige el tipo que salga · siempre `YYYY-MM-DD`.
   *
   * Con precisión de mes se toma el día 1: el banco aplica el tipo nuevo desde
   * la revisión, así que la cuota de ese mes ya va al tipo nuevo. Ponerlo al
   * final del mes dejaría un mes cobrado al tipo viejo que el banco sí revisó.
   */
  aplicaDesde: string;
}

/**
 * La revisión que está esperando a que digas qué pasó.
 *
 * ATLAS no ve la carta del banco: puede decir qué dicen tus movimientos, pero no
 * si te dejaron la bonificación. Por eso una revisión que ya pasó no cambia nada
 * sola — queda **pendiente** hasta que la confirmas o la rectificas.
 *
 * `null` cuando no hay ninguna que reclamar: porque no se sabe cuándo revisa,
 * porque la próxima aún no ha llegado, o porque la última ya se dio por buena.
 */
export function revisionPendiente(
  cal: CalendarioDeRevision,
  hoy: string,
  ultimaConfirmada?: string
): RevisionPendiente | null {
  const yaConfirmada = (fecha: string): boolean =>
    typeof ultimaConfirmada === 'string' && ultimaConfirmada.length >= 7 &&
    // Se comparan por el trozo común · una confirmada «2027-03» tapa la
    // revisión «2027-03-31», que es la misma.
    fecha.slice(0, Math.min(fecha.length, ultimaConfirmada.length)) <=
      ultimaConfirmada.slice(0, Math.min(fecha.length, ultimaConfirmada.length));

  // La del banco · pendiente en cuanto acaba SU MES, no antes: dentro del mes
  // todavía puede estar mirando.
  const delBanco = mesDelBanco(cal.proximaSegunElBanco);
  if (delBanco && delBanco < hoy.slice(0, 7) && !yaConfirmada(delBanco)) {
    return { fecha: delBanco, precision: 'mes', aplicaDesde: `${delBanco}-01` };
  }

  const cada = mesesValidos(cal.cadaMeses);
  const firmaValida = typeof cal.desdeLaFirma === 'string' && cal.desdeLaFirma.length >= 10;
  if (cada == null || !firmaValida) return null;

  // La ÚLTIMA de la serie que ya pasó · se avanza desde la firma y se guarda la
  // anterior a hoy, que es la que reclama respuesta.
  let fecha = sumarMeses(cal.desdeLaFirma, cada);
  let ultima: string | null = null;
  for (let i = 0; fecha < hoy && i < 1200; i++) {
    ultima = fecha;
    fecha = sumarMeses(fecha, cada);
  }
  if (ultima == null || yaConfirmada(ultima)) return null;

  // Las que caen dentro del periodo inicial no decidieron nada · no hay nada
  // que confirmar de una revisión que no podía cambiar la cuota.
  const gracia = mesesValidos(cal.graciaMeses);
  if (gracia != null && ultima <= sumarMeses(cal.desdeLaFirma, gracia)) return null;

  return { fecha: ultima, precision: 'dia', aplicaDesde: ultima };
}
