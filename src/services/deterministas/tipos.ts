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
//
// ── E2.4 · contra la DEFINICIÓN ─────────────────────────────────────────────
//
// Lo mismo vale para lo que el usuario dio de alta como estructura: un
// recurrente (su CUPS, su póliza, su día y su importe), el contrato de un
// inquilino (su nombre, su renta, sus fechas) y sus propias cuentas (su IBAN,
// su nombre). Todo eso existe para el histórico entero; la previsión, solo para
// el mes en curso. Aquí se casa la línea contra la definición, y el
// emparejador de previsiones (`movementMatchingService`) no se toca: esto es
// un camino AÑADIDO para lo que él no puede ver, no una reescritura.
// ============================================================================

/**
 * De qué libro del usuario sale este reconocimiento.
 *
 * E2.4 añade `recurrente` (compromisosRecurrentes), `renta` (el contrato de
 * alquiler) y `traspaso` (una cuenta del propio titular al otro lado).
 */
export type FuenteDeterminista =
  | 'prestamo'
  | 'venta'
  | 'inversion'
  | 'nomina'
  | 'recurrente'
  | 'renta'
  | 'traspaso';

/** E2.4 · las fuentes que casan contra una definición, no contra un cuadro. */
export const FUENTES_POR_DEFINICION: ReadonlySet<FuenteDeterminista> = new Set<FuenteDeterminista>([
  'recurrente',
  'renta',
  'traspaso',
]);

export function esPorDefinicion(fuente: FuenteDeterminista): boolean {
  return FUENTES_POR_DEFINICION.has(fuente);
}

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
 *
 * E2.4 · `identidad` es un identificador estable que solo puede ser de ESA
 * cosa: el CUPS, el nº de contrato o póliza, el IBAN de una cuenta propia, el
 * nombre del titular. `definicion` es lo que la definición dice que pasa
 * (texto del proveedor + importe según el modo + calendario del patrón; el
 * inquilino + su renta + sus fechas) cuando cuadra sin contradicción.
 */
export type ComoSeReconocio = 'fecha_importe' | 'concepto_cuenta_dia' | 'identidad' | 'definicion';

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
  /**
   * E2.4 · solo `fuente: 'traspaso'` · de qué lado está esta línea y con qué
   * cuenta propia va. Sin `cuentaContrariaId` se sabe que es un traspaso (el
   * titular es el propio usuario) pero no a qué cuenta: se marca como
   * traspaso sin pata al otro lado, y no se inventa una.
   */
  traspaso?: {
    sentido: 'salida' | 'entrada';
    cuentaContrariaId?: number;
    /** El movimiento que ya existe al otro lado (su extracto ya se importó). */
    movimientoEspejoId?: number;
  };
  /** E2.4 · solo `fuente: 'renta'` · el contrato que explica el cobro. */
  renta?: { contratoId: number; inquilino: string };
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
