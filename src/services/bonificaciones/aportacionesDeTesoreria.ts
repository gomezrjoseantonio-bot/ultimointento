// ============================================================================
// Lo que sale de una cuenta hacia un plan o un fondo · VOCABULARIO §6 ter
// ============================================================================
//
// *«El plan de pensiones y los fondos son MOVIMIENTOS DE TESORERÍA de esa
// cuenta a la aportación del plan de ese banco»* *(Jose · 8 ago 2026)*.
//
// Y así estaba ya guardado: un `TreasuryEvent` con `sourceType`
// `inversion_aportacion` —o `inversion_compra`, que es la primera— sale de su
// cuenta como cualquier otro cargo. No hacía falta ir a buscar el saldo de una
// posición ni cruzar un store de aportaciones: la prueba lleva todo este tiempo
// en tesorería, igual que la nómina y que el recibo del seguro.
//
// Lo que había en su lugar:
//
//   · **Fondos** estaba en `SIN_FUENTE` con la excusa «el saldo en fondos se
//     prueba con la posición, no con un movimiento». No es el saldo lo que el
//     banco premia, es que le entre dinero a él.
//   · **Planes** sí se comprobaba, pero contra el store de aportaciones. Con
//     ese store vacío no decía «no lo sé»: decía **«no cumples»**, que es un
//     falso negativo — y un falso negativo aquí te hace creer que vas a perder
//     puntos que ya tienes ganados.
//
// La cuenta ata la condición al banco por sí sola: lo que sale de la cuenta de
// Unicaja hacia un producto de Unicaja es lo que Unicaja bonifica. Por eso aquí
// no hace falta saber la gestora — basta con de dónde salió el dinero.
// ============================================================================

import type { TreasuryEvent } from '../db';
import { yaSeCobro } from '../gastoPorTarjeta';

/** Lo aportado desde UNA cuenta en UN año. */
export interface AportacionDesdeCuenta {
  /** La cuenta de la que sale · es lo que el banco exige, la suya. */
  cuentaId: number;
  /** El año natural · las condiciones de plan se miden por ejercicio. */
  anio: number;
  /** Todo lo que hay apuntado ese año · lo salido **y** lo previsto. */
  importe: number;
  /**
   * Lo que ha salido DE VERDAD · es lo único que demuestra la condición.
   *
   * Separado del total a propósito. Con una sola cifra, una aportación que
   * todavía no ha salido daba la bonificación por ganada en enero, y eso es la
   * misma clase de falso positivo que se paga en el recibo de agosto.
   */
  salido: number;
  /**
   * `cerrado` = todo lo sumado salió de verdad. `abierto` = queda algo previsto.
   *
   * Misma distinción que en la nómina, y por lo mismo: una aportación prevista
   * todavía puede no ocurrir. La diferencia con el seguro es que aquí no hay
   * contrato que obligue — una transferencia al plan la haces cuando quieres.
   */
  estado: 'cerrado' | 'abierto';
}

/** Redondeo a céntimos · sumar euros en coma flotante deja 599.9999999999999. */
const centimos = (n: number): number => Math.round(n * 100) / 100;

/** Los movimientos que son aportar a un producto de inversión. */
const esAportacion = (ev: TreasuryEvent): boolean =>
  ev.sourceType === 'inversion_aportacion' || ev.sourceType === 'inversion_compra';

/**
 * Lo aportado a planes y fondos, agrupado por (cuenta · año).
 *
 * Un evento descartado no cuenta: el usuario dijo que no ocurre, así que ni es
 * una aportación real ni una prevista. Contarlo diría que cumples una condición
 * que no cumples, y eso se paga en el recibo de la hipoteca.
 *
 * El importe va en valor absoluto: una aportación es una salida y viene con
 * signo, pero lo que la condición pregunta es cuánto pusiste. Y manda lo
 * APORTADO de verdad sobre lo previsto, igual que en la nómina.
 */
export function aportacionesDeTesoreria(eventos: TreasuryEvent[]): AportacionDesdeCuenta[] {
  const porClave = new Map<string, AportacionDesdeCuenta>();

  for (const ev of eventos) {
    if (!esAportacion(ev) || ev.descartado === true) continue;
    if (ev.accountId == null) continue;

    const fecha = ev.actualDate ?? ev.predictedDate;
    if (typeof fecha !== 'string' || fecha.length < 4) continue;
    const anio = Number(fecha.slice(0, 4));
    if (!Number.isInteger(anio)) continue;

    const importe = Math.abs(ev.actualAmount ?? ev.amount);
    const yaSalio = yaSeCobro(ev);
    const clave = `${ev.accountId}|${anio}`;
    const previo = porClave.get(clave);

    porClave.set(clave, {
      cuentaId: ev.accountId,
      anio,
      importe: centimos((previo?.importe ?? 0) + importe),
      // Lo previsto suma al total pero NO a esto · es lo que se pone delante de
      // una condición, y una transferencia que aún no has hecho no prueba nada.
      salido: centimos((previo?.salido ?? 0) + (yaSalio ? importe : 0)),
      // El año solo está cerrado si salió todo lo que hay en él · con una
      // aportación hecha y otra prevista, el año todavía puede crecer.
      estado: previo?.estado === 'abierto' || !yaSalio ? 'abierto' : 'cerrado',
    });
  }

  return [...porClave.values()].sort((a, b) => b.anio - a.anio);
}

/** Lo aportado desde una cuenta en un año · `null` si no hay nada. */
export const aportadoDesde = (
  aportaciones: AportacionDesdeCuenta[],
  cuentaId: number,
  anio: number
): AportacionDesdeCuenta | null =>
  aportaciones.find((a) => a.cuentaId === cuentaId && a.anio === anio) ?? null;
