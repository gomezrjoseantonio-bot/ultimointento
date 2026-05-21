// Saldo medio proyectado del plan en el periodo `[hoy, rescate]`, usando
// fórmula trapezoidal · `(valorActual + valorFinalProyectado) / 2`.
//
// Sustituye al heurístico `valorActual × 1.5` previo. Es la base para
// estimar comisiones futuras acumuladas (saldoMedio × TER × años).

export const TWR_FALLBACK_NOMINAL = 0.04;

/** Rango razonable para aceptar un TWR anualizado como input válido. */
const TWR_MIN_RAZONABLE = -0.2;
const TWR_MAX_RAZONABLE = 0.3;

export function calcularSaldoMedioProyectado(
  valorActual: number,
  anosHastaRescate: number,
  twrEsperadoAnual: number,
): number {
  if (valorActual <= 0) return 0;
  if (anosHastaRescate <= 0) return valorActual;
  const valorFinal =
    valorActual * Math.pow(1 + twrEsperadoAnual, anosHastaRescate);
  return (valorActual + valorFinal) / 2;
}

/**
 * Resuelve el TWR esperado anual usando la prioridad:
 *   1. TWR histórico anualizado del plan (si está en rango razonable).
 *   2. Fallback conservador `TWR_FALLBACK_NOMINAL` (4 %).
 */
export function obtenerTwrEsperado(
  twrHistoricoAnualizado: number | null | undefined,
): number {
  if (
    typeof twrHistoricoAnualizado === 'number' &&
    Number.isFinite(twrHistoricoAnualizado) &&
    twrHistoricoAnualizado > TWR_MIN_RAZONABLE &&
    twrHistoricoAnualizado < TWR_MAX_RAZONABLE
  ) {
    return twrHistoricoAnualizado;
  }
  return TWR_FALLBACK_NOMINAL;
}
