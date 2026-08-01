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
// ============================================================================

import type { TreasuryEvent } from '../../../services/db';
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
 * `saldoDesde` (fecha del saldo inicial más antiguo) actúa de suelo duro: por
 * debajo de esa fecha no existe saldo del que partir, así que un cierre pintado
 * ahí sería inventado.
 */
export function mesMinimo(params: {
  eventos: TreasuryEvent[];
  hoy: string;
  saldoDesde?: string;
}): { year: number; month0: number } {
  const { eventos, hoy, saldoDesde } = params;
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

  if (saldoDesde) {
    const [sy, sm] = saldoDesde.slice(0, 10).split('-').map(Number);
    const suelo = indice(sy, sm - 1);
    if (mejor < suelo) mejor = suelo;
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
