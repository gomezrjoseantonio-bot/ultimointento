// ============================================================================
// Tarjetas · docs/VOCABULARIO-dinero.md §3
// ============================================================================
//
// Una tarjeta NO es una cuenta: es una forma de gastar el dinero de una cuenta.
// Hasta ahora vivía como `Account.tipo = 'TARJETA_CREDITO'` con un `cardConfig`
// único, y de ahí salían tres imposibles: una cuenta no podía tener dos
// tarjetas —lo normal son dos, débito y crédito—, no se distinguía el débito
// del crédito, y una tarjeta de fuera quedaba anclada a un banco del que en
// realidad puede mudarse cuando quieras.
// ============================================================================

/**
 * Cuándo mueve el dinero (§3.3).
 *
 * `debito` lo mueve en el momento; `credito` no mueve nada el día de la compra
 * y lo cobra todo junto el día de cargo. El fraccionado queda fuera de esta
 * versión por decisión de Jose (§3.3).
 */
export type ModalidadTarjeta = 'debito' | 'credito';

/**
 * De quién es la tarjeta (§3.2) · y no es un detalle administrativo.
 *
 * De ello dependen dos cosas: si su cuenta es intrínseca o mudable, y si su
 * gasto cuenta para bonificar una hipoteca. Las de fuera **nunca** bonifican.
 */
export type OrigenTarjeta = 'banco' | 'externa';

export type PeriodicidadCiclo = 'mensual' | 'semanal';

/**
 * El ciclo · CORTE y CARGO son dos fechas distintas (§3.4).
 *
 * Guardar un único día —lo que hacía `cardConfig.settlementDay`— no permite
 * decir "corta el 24 y cobra el 5 del mes siguiente", que es lo normal.
 */
export interface CicloTarjeta {
  periodicidad: PeriodicidadCiclo;
  /**
   * Hasta cuándo se acumulan las compras.
   *
   * Mensual: día del mes, donde 31 significa "el último" —febrero no se salta—.
   * Semanal: día de la semana, 1 lunes … 7 domingo.
   */
  corte: number;
  /**
   * Cuándo se cobra en la cuenta. Puede caer en otro mes que el corte.
   *
   * Mensual: día del mes, con la misma regla del 31.
   * Semanal: día de la semana.
   */
  diaCargo: number;
  /**
   * Cuántos periodos después del corte se cobra · 0 = el mismo periodo.
   *
   * Sin esto, "corta el 24 de enero y cobra el 5" es ambiguo: puede ser el 5 de
   * enero (antes del corte, imposible) o el 5 de febrero. Lo normal es 1.
   */
  periodosHastaElCargo: number;
}

export interface Tarjeta {
  id?: number;
  /** Cómo la llamas tú · "Visa Sabadell", "Carrefour". */
  alias: string;
  /**
   * Quién la emite (§3.2) · texto libre a propósito.
   *
   * Carrefour o Cetelem no son bancos tuyos, así que esto NO se elige entre tus
   * cuentas. Es una etiqueta.
   */
  emisora?: string;
  origen: OrigenTarjeta;
  modalidad: ModalidadTarjeta;
  /**
   * De qué cuenta TUYA sale el dinero.
   *
   * En una tarjeta del banco es intrínseca. En una de fuera es "dónde la tienes
   * domiciliada hoy" y cambia a menudo — cambiarla no puede obligar a rehacer
   * la tarjeta, porque se perdería su historial de gasto (§3.2).
   *
   * Siempre una cuenta bancaria propia · nunca el efectivo ni otra tarjeta.
   */
  cuentaLiquidacionId: number;
  /** Solo en `credito` · el débito no acumula nada, cobra al momento. */
  ciclo?: CicloTarjeta;
  /**
   * Techo de gasto del periodo (§3.7) · acota lo que puede rendir la tarjeta.
   * No es una alerta.
   */
  limite?: number;
  /** % que devuelve del gasto · para medir lo REALIZADO, no para preverlo. */
  cashbackPorcentaje?: number;
  activa: boolean;
  createdAt: string;
  updatedAt: string;
}
