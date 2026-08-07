// ============================================================================
// La cuota del sistema francés · LA fórmula, la única
// ============================================================================
//
// Vive sola para que la importe todo el que la necesite —el generador del
// cuadro, el recálculo por tramos— en vez de copiarla. Dos fórmulas para lo
// mismo acaban dando dos cuotas distintas, y de la cuota sale todo lo demás.
//
// Son dos formas de la MISMA cuenta, y cuál toca lo dice la base de cálculo:
//
//   · con **30/360** todos los meses cuestan lo mismo —el tipo entre doce—, y
//     entonces vale la fórmula cerrada de toda la vida.
//   · con **días reales** (ACT/365, ACT/360) no: febrero cuesta menos que
//     enero, así que la cuota constante que amortiza a cero **depende del
//     calendario** y hay que resolverla contra él.
//
// La segunda no es un refinamiento teórico. La escritura de Unicaja de Jose
// —85.000 € a 240 meses, 2,600 % los primeros 36, ACT/365— dice **454,66 €**.
// La fórmula cerrada da 454,57 €. La cuenta contra el calendario real da
// 454,6599 €, o sea los 454,66 impresos, al céntimo *(Jose · 6 ago 2026: «la
// cuota no son 454,57 son 454,66»)*.
// ============================================================================

import type { BaseDeCalculo } from './baseDeCalculo';

/**
 * La cuota constante de un préstamo francés **con el mes comercial**.
 *
 * `tinAnual` va en PORCENTAJE (4,99 = 4,99 %), como se dicen los tipos. El
 * resultado se redondea a céntimos porque es lo que el banco carga.
 *
 * Vale tal cual cuando la base es `30/360`, donde el interés de un mes es
 * siempre `capital × tipo ÷ 12` y da igual qué días tenga. Con días reales,
 * `cuotaFrancesaPorDias`.
 */
export function cuotaFrancesa(principal: number, tinAnual: number, meses: number): number {
  if (principal <= 0 || meses <= 0) return 0;
  if (tinAnual === 0) return Math.round((principal / meses) * 100) / 100;

  const i = tinAnual / 100 / 12;
  const pot = Math.pow(1 + i, meses);
  return Math.round(((principal * i * pot) / (pot - 1)) * 100) / 100;
}

/**
 * La cuota constante que amortiza a cero **contando los días de cada periodo**.
 *
 * `dias[k]` son los del devengo de la cuota k+1, contados como los cuenta el
 * cuadro. Con el mes comercial no se miran —el interés de un mes es el tipo
 * entre doce—, y entonces esto devuelve exactamente lo mismo que la fórmula
 * cerrada; con días reales, cada periodo tiene su propio tipo.
 *
 * Se resuelve en cerrado, sin tanteo. Si `Qₖ = 1 + iₖ`:
 *
 *     saldo_n = C·∏Qₖ − cuota·∑ₖ ∏_{j>k} Qⱼ = 0
 *     cuota   = C·∏Qₖ ÷ ∑ₖ ∏_{j>k} Qⱼ
 *
 * que es la anualidad de toda la vida cuando todos los `iₖ` son iguales.
 */
export function cuotaFrancesaPorDias(
  principal: number,
  tinAnual: number,
  dias: readonly number[],
  base: BaseDeCalculo
): number {
  if (principal <= 0 || dias.length === 0) return 0;
  if (tinAnual === 0) return Math.round((principal / dias.length) * 100) / 100;

  const tipo = tinAnual / 100;
  const divisor = base === 'ACT/360' ? 360 : 365;
  const interesDe = (d: number): number =>
    base === '30/360' ? tipo / 12 : (d > 0 ? (tipo * d) / divisor : 0);

  // Hacia atrás · `producto` acumula ∏_{j>k} Qⱼ y `suma` los va sumando.
  let producto = 1;
  let suma = 0;
  for (let k = dias.length - 1; k >= 0; k--) {
    suma += producto;
    producto *= 1 + interesDe(dias[k]);
  }
  if (suma <= 0) return 0;

  return Math.round(((principal * producto) / suma) * 100) / 100;
}
