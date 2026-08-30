// ============================================================================
// Lo que el usuario ya le dijo a ATLAS · y que el motor no estaba mirando
// ============================================================================
//
// Un origen determinista es un dato que el usuario introdujo con fecha e importe
// EXACTOS: la cuota 7 de su préstamo, la venta de un piso, el pago de intereses
// de un P2P, su nómina. Casa o no casa; aquí no hay marcador ni umbral.
//
// ── Por qué esto no va contra `treasuryEvents` ──────────────────────────────
//
// El camino natural sería que cada origen emitiera su previsión y que el
// emparejador de siempre las cazara. De hecho las emite: hay `sourceType`
// 'prestamo', 'nomina', 'inversion_rendimiento'…
//
// Pero `regenerateForecastsForward` (`treasuryBootstrapService.ts:124`) arranca
// en `startOfCurrentMonthUTC()` y va HACIA DELANTE. El extracto trae el PASADO.
// Para casi todo lo que hay en un fichero de agosto no existe ninguna previsión
// contra la que casar, por muy bien que puntúe el marcador — no hay nada que
// puntuar. Ese es el motivo real de que de cien líneas se reconocieran dos, y no
// que falten stores por conectar.
//
// La alternativa era generar previsiones hacia atrás. Se descartó: es
// exactamente lo que se retiró en #1821 y #1824 —previsiones fabricadas para
// fechas ya pasadas— y volvería a mover saldos. El dato de origen se lee tal
// cual, sin materializar nada.
// ============================================================================

/** De qué libro del usuario sale este reconocimiento. */
export type FuenteDeterminista = 'prestamo' | 'venta' | 'inversion' | 'nomina';

/**
 * Cómo se reconoció la línea. No es cosmético: gobierna qué se puede dar por
 * bueno solo.
 *
 * `fecha_importe` es una igualdad: la fecha y el importe del banco coinciden con
 * los del cuadro. No hay nada que interpretar.
 *
 * `concepto_cuenta_dia` identifica el ORIGEN sin comprobar el importe, porque el
 * importe no se puede derivar: de un bruto anual no sale el neto de la nómina
 * (falta la Seguridad Social y la retención real de ese mes). Lo que manda ahí
 * es el banco, que no estima: paga. Se acepta su importe como verdad consumada.
 */
export type ComoSeReconocio = 'fecha_importe' | 'concepto_cuenta_dia';

/**
 * El desglose fiscal · se calcula y se guarda POR DETRÁS.
 *
 * §3.3 del encargo: el usuario cuadra su tesorería, no ve fiscalidad mientras
 * concilia. Esto no se enseña en ninguna pantalla; viaja con el reconocimiento
 * para poder persistirlo cuando el usuario guarde, y solo entonces.
 */
export type DesgloseFiscal =
  | { tipo: 'prestamo'; periodo: number; interes: number; amortizacion: number }
  | { tipo: 'rendimiento'; bruto: number; retencion: number; neto: number };

export interface OrigenDeterminista {
  movementId: number;
  fuente: FuenteDeterminista;
  /** El registro de origen · `prestamos.id`, `property_sales.id`, `inversiones.id`. */
  origenId: string;
  /** La pieza exacta dentro del origen · nº de periodo, id del pago. */
  piezaId?: string;
  /** Lo que lee el usuario · «Cuota 7/240 · Unicaja». Sin jerga. */
  titulo: string;
  como: ComoSeReconocio;
  desglose?: DesgloseFiscal;
  /** Atribución, cuando el origen la sabe · un préstamo conoce su inmueble. */
  inmuebleId?: number;
  categoryKey?: string;
}

/**
 * La señal de atribución que NO es un reconocimiento.
 *
 * Lo que el usuario declaró el año pasado por cada piso (IBI, comunidad,
 * intereses) dice QUÉ gastos tiene cada inmueble, pero no con qué importe ni qué
 * día llegarán este año: el IBI de 2026 no es el de 2025. Por eso no casa nada
 * —sería aproximar, y esta fase no aproxima—; entra en la propuesta de la
 * tarjeta para que, cuando el usuario conteste, el piso ya venga puesto.
 */
export interface AtribucionDeterminista {
  movementId: number;
  inmuebleId: number;
  /** El concepto tal como se declaró · «IBI», «Comunidad». */
  concepto: string;
  /** De qué ejercicio sale · para poder decir «lo declaraste en 2025». */
  ejercicio: number;
}
