// ============================================================================
// P0 · IDEMPOTENCIA DE LA PREVISIÓN (innegociable)
// ============================================================================
//
// Regenerar una previsión tiene que dejar el MISMO resultado se ejecute una vez
// o cinco. Para eso toda previsión automática lleva CLAVE DE ORIGEN — qué la
// creó (`sourceType` + `sourceId`), para qué periodo y para qué cuenta — y la
// regeneración:
//
//   1. retira primero las previsiones VIVAS de esa clave,
//   2. emite después las nuevas,
//   3. NO emite en un periodo cuya clave ya está ocupada por algo intocable
//      (confirmado · conciliado · descartado). Antes sí lo hacía: por eso una
//      edición dejaba un `predicted` gemelo encima de cada previsión ya
//      confirmada, e inflaba pendientes y cierres.
//
// Puro: no lee ni escribe la base. Vive aparte del servicio porque lo consultan
// también las auditorías, y porque la regla se escribe UNA vez.
// ============================================================================

import type { TreasuryEvent } from '../db';

/**
 * Familias de `sourceType` que genera el servicio de compromisos · `opex_rule`
 * es el legacy del mismo origen (el store `opexRules` se migró a
 * `compromisosRecurrentes`), así que cuenta como la MISMA previsión: si no,
 * cada camino emitiría la suya.
 */
export function esPrevisionDeCompromiso(ev: Pick<TreasuryEvent, 'sourceType'>): boolean {
  return ev.sourceType === 'gasto_recurrente' || ev.sourceType === 'opex_rule';
}

/**
 * Clave de origen de una previsión automática · `origen|id|periodo|cuenta`.
 *
 * Es la unidad de idempotencia: como mucho puede haber UNA previsión viva por
 * clave. El periodo es normalmente el `año-mes` del cargo, porque ningún patrón
 * de compromiso se repite dentro de un mes.
 *
 * `año`/`mes` caen a `predictedDate` cuando el evento es antiguo y no los trae.
 */
export function claveOrigenPrevision(
  ev: Pick<TreasuryEvent, 'sourceType' | 'sourceId' | 'año' | 'mes' | 'predictedDate' | 'accountId'>,
): string {
  const iso = typeof ev.predictedDate === 'string' ? ev.predictedDate : '';
  const año = ev.año ?? Number(iso.slice(0, 4));
  const mes = ev.mes ?? Number(iso.slice(5, 7));
  const origen = esPrevisionDeCompromiso(ev) ? 'gasto_recurrente' : ev.sourceType;
  const periodo = `${año}-${String(mes).padStart(2, '0')}`;
  return `${origen}|${ev.sourceId ?? ''}|${periodo}|${ev.accountId ?? ''}`;
}

/**
 * ¿Es una previsión INTOCABLE? Confirmada, conciliada o descartada dejó de ser
 * una previsión viva: ni se borra al regenerar, ni se vuelve a emitir su
 * periodo. Misma garantía que la cascada (adenda 02 · D6b) y que el descarte
 * (V84: «no vuelve a proponerse»).
 */
export function esPrevisionIntocable(ev: TreasuryEvent): boolean {
  return (
    ev.status !== 'predicted' ||
    ev.executedMovementId != null ||
    ev.descartado === true
  );
}
