// ============================================================================
// La cuota del sistema francés · LA fórmula, la única
// ============================================================================
//
// Vive sola para que la importe todo el que la necesite —el generador del
// cuadro, el recálculo por tramos— en vez de copiarla. Dos fórmulas para lo
// mismo acaban dando dos cuotas distintas, y de la cuota sale todo lo demás.
// ============================================================================

/**
 * La cuota constante de un préstamo francés.
 *
 * `tinAnual` va en PORCENTAJE (4,99 = 4,99 %), como se dicen los tipos. El
 * resultado se redondea a céntimos porque es lo que el banco carga.
 */
export function cuotaFrancesa(principal: number, tinAnual: number, meses: number): number {
  if (principal <= 0 || meses <= 0) return 0;
  if (tinAnual === 0) return Math.round((principal / meses) * 100) / 100;

  const i = tinAnual / 100 / 12;
  const pot = Math.pow(1 + i, meses);
  return Math.round(((principal * i * pot) / (pot - 1)) * 100) / 100;
}
