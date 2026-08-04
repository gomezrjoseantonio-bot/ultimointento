// ============================================================================
// Cuánto se ha gastado con una tarjeta en un periodo · VOCABULARIO §3.5
// ============================================================================
//
// «Es una sola cifra y de ella salen las tres respuestas que siguen»: sin ella
// ni se puede prever el cargo (§3.3), ni demostrar una bonificación de hipoteca
// (§3.6), ni saber lo que rinde el cashback (§3.7).
//
// Y ya existe, sin necesidad de guardar nada nuevo: para una tarjeta de crédito
// el gasto de un periodo ES su recibo. El banco carga exactamente eso.
//
//   - El periodo CERRADO tiene su cargo cobrado: la cifra es la real.
//   - El periodo ABIERTO todavía crece, y su cifra es la previsión viva —
//     justo lo que describe Jose: «si mañana gasto algo de la tarjeta tendré
//     que hacer una anotación manual e irá creciendo».
//
// El DÉBITO va por otro sitio (`gastoDeMovimientos`, al final): no tiene recibo
// del que deducirlo, así que sale de los movimientos que el usuario ha
// atribuido a una tarjeta.
//
// Puro: no lee la base. Quien llame le pasa los eventos.
// ============================================================================

import type { Movement, TreasuryEvent } from './db';
import type { Tarjeta } from '../types/tarjetas';

/** Lo gastado con UNA tarjeta en UN periodo. */
export interface GastoDeUnPeriodo {
  tarjetaId: number;
  /** El corte que cierra el periodo · ISO `YYYY-MM-DD`. Identifica al periodo. */
  fechaCorte: string;
  /** Cuándo sale (o salió) el dinero de la cuenta. */
  fechaCargo: string;
  importe: number;
  /**
   * `cerrado` = el cargo ya se cobró y cuadró contra el extracto, así que la
   * cifra es la REAL. `abierto` = todavía es una previsión y puede crecer.
   *
   * La distinción importa: una bonificación se demuestra con lo cerrado, no con
   * lo que esperas gastar.
   */
  estado: 'cerrado' | 'abierto';
}

/** Reconoce el recibo de una tarjeta y saca de su clave a quién pertenece. */
function periodoDelRecibo(ev: TreasuryEvent): { tarjetaId: number; fechaCorte: string } | null {
  if (ev.sourceType !== 'tarjeta_recibo' || typeof ev.sourceId !== 'string') return null;
  // `tarjeta-<id>-<YYYY-MM-DD>` · ver `claveDeRecibo`.
  const m = /^tarjeta-(\d+)-(\d{4}-\d{2}-\d{2})$/.exec(ev.sourceId);
  return m ? { tarjetaId: Number(m[1]), fechaCorte: m[2] } : null;
}

/**
 * Ya ocurrió: se cobró y quedó ligado a un movimiento del extracto.
 *
 * Mismo criterio que el resto de la aplicación (`esPrevisionIntocable`), menos
 * el descarte: un recibo descartado no es gasto cerrado, es gasto que no fue.
 *
 * Los DOS enlaces a movimiento cuentan. `executedMovementId` es el que escribe
 * la confirmación y `movementId` el que traen otros caminos; mirar solo uno
 * dejaba por abierto algo ya conciliado, y de ahí sale un «no cumples» de una
 * bonificación que sí se cumple. Ver `treasuryConfirmationService`, que también
 * los lee juntos.
 *
 * Vive aquí y lo importa la nómina: decir «mismo criterio» en un comentario no
 * lo hace verdad, compartir la función sí.
 */
export function yaSeCobro(ev: TreasuryEvent): boolean {
  return ev.status === 'executed' || ev.executedMovementId != null || ev.movementId != null;
}

/**
 * El gasto por (tarjeta · periodo), del más reciente al más antiguo.
 *
 * Un recibo DESCARTADO no cuenta: el usuario dijo que no ocurre, así que no es
 * gasto ni previsto ni real. Contarlo inflaría tanto la bonificación como el
 * cashback — y las dos cosas se presumen ante terceros.
 */
export function gastoPorTarjeta(eventos: TreasuryEvent[]): GastoDeUnPeriodo[] {
  const salida: GastoDeUnPeriodo[] = [];

  for (const ev of eventos) {
    if (ev.descartado === true) continue;
    const periodo = periodoDelRecibo(ev);
    if (!periodo) continue;

    // Manda lo COBRADO sobre lo previsto. Al confirmar un cargo se rellenan
    // `actualAmount` y `actualDate` y `amount` se queda como estaba: un recibo
    // previsto de 180 € que el banco cobró por 187,40 € seguiría contando 180.
    // Esta cifra se presume ante un banco para una bonificación y mide el
    // cashback — tiene que ser la de verdad, no la que se esperaba.
    salida.push({
      ...periodo,
      fechaCargo: ev.actualDate ?? ev.predictedDate,
      // El importe previsto se guarda en negativo —es un gasto—; el real ya
      // viene como magnitud. En los dos casos interesa cuánto, no el signo.
      importe: Math.abs(ev.actualAmount ?? ev.amount),
      estado: yaSeCobro(ev) ? 'cerrado' : 'abierto',
    });
  }

  return salida.sort((a, b) => b.fechaCorte.localeCompare(a.fechaCorte));
}

/** Lo gastado con una tarjeta entre dos cortes, ambos incluidos. */
export function gastoDeLaTarjeta(
  periodos: GastoDeUnPeriodo[],
  tarjetaId: number,
  opciones: { desde?: string; hasta?: string; soloCerrados?: boolean } = {}
): number {
  return periodos
    .filter((p) => p.tarjetaId === tarjetaId)
    .filter((p) => (opciones.desde ? p.fechaCorte >= opciones.desde : true))
    .filter((p) => (opciones.hasta ? p.fechaCorte <= opciones.hasta : true))
    .filter((p) => (opciones.soloCerrados ? p.estado === 'cerrado' : true))
    .reduce((suma, p) => suma + p.importe, 0);
}

/**
 * El gasto con tarjeta de DÉBITO · lo que dicen los movimientos (§3.5).
 *
 * El débito no tiene recibo del que deducir el gasto —cobra al momento—, así
 * que sale de los movimientos que el usuario ha atribuido a una tarjeta.
 *
 * **Solo el débito.** Un movimiento marcado con una tarjeta de crédito es su
 * RECIBO, y ese gasto ya viene por `gastoPorTarjeta`: contarlo aquí también lo
 * sumaría dos veces, y esta cifra se presume ante un banco.
 *
 * Cada movimiento es su propio periodo, y eso no es un apaño: el débito cobra
 * al momento, así que su periodo dura un instante. Inventarle cortes mensuales
 * sería fabricar un ciclo que esa tarjeta no tiene (§3.3).
 */
export function gastoDeMovimientos(
  movimientos: Movement[],
  tarjetas: Array<Pick<Tarjeta, 'id' | 'modalidad'>>
): GastoDeUnPeriodo[] {
  const debito = new Set(
    tarjetas.filter((t) => t.modalidad === 'debito' && t.id != null).map((t) => t.id as number)
  );

  const salida: GastoDeUnPeriodo[] = [];

  for (const m of movimientos) {
    if (m.tarjetaId == null || !debito.has(m.tarjetaId)) continue;
    // Un ingreso no es gasto · una devolución en la tarjeta no suma consumo.
    if (m.amount >= 0) continue;

    const fecha = m.date.slice(0, 10);
    salida.push({
      tarjetaId: m.tarjetaId,
      fechaCorte: fecha,
      fechaCargo: fecha,
      importe: Math.abs(m.amount),
      // Un movimiento del extracto ya ocurrió · no hay nada que esperar.
      estado: 'cerrado',
    });
  }

  return salida.sort((a, b) => b.fechaCorte.localeCompare(a.fechaCorte));
}
