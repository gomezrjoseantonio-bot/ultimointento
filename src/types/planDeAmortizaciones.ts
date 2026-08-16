// ============================================================================
// El plan de amortizaciones · lo que se guarda · §6 bis · quater
// ============================================================================
//
// Estas formas viven aquí y no en `services/prestamos/planDeAdelantos` porque
// desde que el plan se GUARDA dejaron de ser argumentos de una función: son
// datos del usuario, y un dato que se persiste no puede tener su definición
// dentro del motor que lo consume. El motor las importa de aquí.
//
// Tampoco caben en `types/prestamos.ts`, que está para lo que se pactó con el
// banco —y además a un palmo del tope de tamaño que vigila el marcador—. Un
// plan no se pactó con nadie: es una intención de quien paga, y puede cambiar
// mañana sin que cambie el préstamo.
//
// ── Guardarlo NO es haberlo hecho ───────────────────────────────────────────
//
// De aquí salen previsiones de tesorería, que es justo lo que se pedía —ver el
// esfuerzo antes de comprometerlo—, pero nacen `predicted`: son dinero que aún
// no ha salido. Lo que ocurra de verdad se registra el día que ocurra, con
// `confirmLoanSettlement`, y eso sí rehace el cuadro.
// ============================================================================

/** Cada cuánto se repite un adelanto. */
export type Cadencia = 'UNICA' | 'MENSUAL' | 'CADA_N_MESES' | 'ANUAL';

/**
 * Una regla de amortización · «200 € todos los meses desde enero».
 *
 * Son varias a la vez a propósito. «200 €/mes **y** 3.000 € cada junio» es un
 * caso corriente —el ahorro del mes por un lado y la paga extra por otro—, y
 * con una sola regla habría que elegir cuál de los dos se guarda.
 */
export interface ReglaDeAdelanto {
  /** Para poder editarla y borrarla en la pantalla. */
  id: string;
  cadencia: Cadencia;
  /** Lo que se mete CADA VEZ, en euros. */
  importe: number;
  /** El primer día en que se aplica · ISO `YYYY-MM-DD`. */
  desde: string;
  /** Último día en que puede aplicarse · ausente = hasta que se acabe el préstamo. */
  hasta?: string;
  /** Cuántas veces como mucho · ausente = las que quepan. */
  veces?: number;
  /** Cada cuántos meses, solo en `CADA_N_MESES` · 3 es trimestral. */
  cadaMeses?: number;
  /** En qué mes del año cae, solo en `ANUAL` · 1-12, 6 es junio. */
  mes?: number;
  /**
   * Cuánto sube el importe cada año, en % · para acompañar sueldo o IPC.
   *
   * Se aplica por años completos desde el primer adelanto de la regla, no por
   * año natural: la regla la escribe quien va a meter el dinero, y sube cuando
   * a esa persona le suben.
   */
  crecimientoAnual?: number;
}

/** El cupo anual que no paga comisión, tal como lo dice la escritura. */
export interface LimiteAnualExento {
  /**
   * Sobre qué año se cuenta.
   *
   * `ANUALIDAD` cuenta desde la firma —«en cada anualidad del préstamo»—, que es
   * la fórmula habitual; `ANIO_NATURAL` cuenta del 1 de enero al 31 de
   * diciembre. No es lo mismo y decide si dos adelantos de diciembre y enero
   * comparten cupo o no.
   */
  base: 'ANIO_NATURAL' | 'ANUALIDAD';
  /** Cupo en EUROS al año. */
  importe?: number;
  /** Cupo como % del capital CONCEDIDO · `20` es el 20 % del principal inicial. */
  porcentajeDelCapitalInicial?: number;
}

/**
 * El plan guardado de un préstamo · lo que el usuario dice que va a hacer.
 *
 * Se guarda entero —reglas, modo y lo que cuesta amortizar— porque las tres
 * cosas hacen falta para volver a dibujar exactamente lo que se vio al
 * guardarlo. Guardar solo las reglas obligaría a teclear otra vez el cupo de la
 * escritura cada vez que se abre la pantalla, y un cupo que se olvida convierte
 * un plan gratis en uno con doce comisiones al año.
 */
export interface PlanDeAmortizaciones {
  reglas: ReglaDeAdelanto[];
  /** Qué se le pide al banco que haga con lo amortizado. */
  modo: 'REDUCIR_PLAZO' | 'REDUCIR_CUOTA';
  limiteAnualExento?: LimiteAnualExento | null;
  /** Lo que cobra el banco por operación aparte de la comisión, en euros. */
  gastosFijosPorOperacion?: number;
  /**
   * Si de este plan salen previsiones de tesorería.
   *
   * Se pregunta y no se presume: un plan a diez años son ciento veinte apuntes
   * en la bandeja de «por confirmar», y eso lo decide quien la mira todos los
   * días. Guardar el plan para verlo al volver es una cosa; llenarle la
   * tesorería de dinero que aún no ha salido es otra.
   */
  generaPrevisiones: boolean;
  /** Cuándo se guardó por última vez · ISO timestamp. */
  actualizadoEn: string;
}
