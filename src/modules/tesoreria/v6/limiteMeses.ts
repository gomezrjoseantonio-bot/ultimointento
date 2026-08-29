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
// Y por abajo corta el SUELO DEL EJERCICIO (C0 · `sueloReconstruccion.ts`): el
// 1 de enero del ejercicio no declarado más antiguo. Antes cortaba la fecha del
// saldo inicial de las cuentas, con el argumento de que por debajo no hay saldo
// del que partir. Pero eso ataba el trabajo pendiente a cuándo se dieron de
// alta las cuentas: quien abre ATLAS hoy con ocho meses de recibos por cuadrar
// no llegaba ni a verlos. El cierre de un mes anterior a la apertura sigue
// siendo orientativo —de ahí no se puede sacar más—; la lista de pendientes es
// real, y es a lo que se retrocede.
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
 * `suelo` (el de C0 · 1 de enero del ejercicio no declarado más antiguo) corta
 * por abajo: más atrás hay ejercicios cuya campaña ya cerró, y ahí no queda
 * nada que presentar. NO arrastra hacia atrás: sin trabajo pendiente no se
 * retrocede aunque el ejercicio empiece en enero.
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
