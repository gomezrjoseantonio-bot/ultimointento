// ============================================================================
// Tesorería V6 · §2.3 · hasta dónde se puede retroceder
// ============================================================================
//
// Tesorería mira hacia DELANTE. El histórico es trabajo de Archivo y de Fiscal,
// no de aquí. Pero el drawer de mes dejaba retroceder sin límite: se llegaba a
// 2024 y a meses que son anteriores incluso a la fecha del saldo inicial de las
// cuentas, donde el cierre que se pinta no significa nada porque no hay saldo
// del que partir.
//
// El único motivo legítimo para mirar atrás es que quede TRABAJO ahí: un
// previsto vencido sin confirmar. Así que ese es el tope.
//
// Y por abajo corta el DINERO QUE CONSTA: el movimiento más antiguo que hay en
// la cuenta. Por debajo de ahí no hay nada —ni saldo del que partir ni realidad
// contra la que cuadrar—, así que un mes pintado ahí sería inventado.
//
// Antes cortaba la fecha del saldo inicial, que es un tope FIJO: ataba el
// trabajo pendiente a cuándo se dieron de alta las cuentas, y quien abría ATLAS
// con ocho meses de recibos por cuadrar no llegaba ni a verlos. Mirando el
// movimiento más antiguo el suelo se mueve solo: el día que entra el extracto
// de enero, enero pasa a ser navegable sin que nadie toque nada. Y sigue sin
// inventar: si el extracto no ha entrado, ese mes no existe y no se abre.
// ============================================================================

import type { Movement, TreasuryEvent } from '../../../services/db';
import { esPendiente } from '../../../services/tesoreriaV6Metrics';

/** Un mes como número comparable · `2026-08` → 24318. */
function indice(year: number, month0: number): number {
  return year * 12 + month0;
}

/**
 * Primer mes al que se puede retroceder.
 *
 * Es el mes del pendiente sin confirmar MÁS ANTIGUO. Si no hay ninguno, no se
 * retrocede del mes en curso: no habría nada que hacer allí.
 *
 * `suelo` corta por abajo · lo pone `sueloDeMovimientos`, más abajo. NO
 * arrastra hacia atrás: que haya movimientos desde enero no abre enero, porque
 * se retrocede por trabajo, no por calendario.
 */
export function mesMinimo(params: {
  eventos: TreasuryEvent[];
  hoy: string;
  suelo?: string;
}): { year: number; month0: number } {
  const { eventos, hoy, suelo } = params;
  const [hy, hm] = hoy.split('-').map(Number);
  let mejor = indice(hy, hm - 1);

  for (const e of eventos) {
    if (!esPendiente(e)) continue;
    const f = (e.predictedDate ?? '').slice(0, 10);
    // Solo lo VENCIDO cuenta: un previsto de diciembre no es motivo para
    // retroceder, vive hacia delante.
    if (!f || f > hoy) continue;
    const [y, m] = f.split('-').map(Number);
    const i = indice(y, m - 1);
    if (i < mejor) mejor = i;
  }

  if (suelo) {
    const [sy, sm] = suelo.slice(0, 10).split('-').map(Number);
    const tope = indice(sy, sm - 1);
    if (mejor < tope) mejor = tope;
  }

  return { year: Math.floor(mejor / 12), month0: mejor % 12 };
}

/** ¿Se puede retroceder desde el mes que se está viendo? */
export function puedeRetroceder(
  actual: { year: number; month0: number },
  minimo: { year: number; month0: number },
): boolean {
  return indice(actual.year, actual.month0) > indice(minimo.year, minimo.month0);
}

/**
 * El suelo · hasta dónde hay dinero del que hablar.
 *
 * La fecha del movimiento más antiguo de la cuenta, `undefined` si no hay
 * ninguno (y entonces no hay suelo que aplicar: no se inventa una fecha).
 *
 * El saldo inicial cuenta como movimiento, así que en una cuenta recién dada de
 * alta el suelo es su apertura —lo de siempre—. La diferencia está en que deja
 * de ser un tope fijo: en cuanto entra un extracto más viejo, el suelo baja con
 * él y esos meses se vuelven navegables sin tocar nada.
 */
export function sueloDeMovimientos(movimientos: Movement[]): string | undefined {
  let min: string | undefined;
  for (const m of movimientos) {
    const f = (m.date ?? '').slice(0, 10);
    if (f && (!min || f < min)) min = f;
  }
  return min;
}
