// ── Shared utilities for CompromisoRecurrente ──────────────────────────────

import type { CompromisoRecurrente } from '../../../types/compromisosRecurrentes';

/**
 * Estimates the average monthly cost of a compromiso.
 * Handles all importe modes: fijo, variable, diferenciadoPorMes, porPago.
 */
export function computeMonthly(c: CompromisoRecurrente): number {
  switch (c.importe.modo) {
    case 'fijo':
      return c.importe.importe;
    case 'variable':
      return c.importe.importeMedio;
    case 'diferenciadoPorMes':
      return c.importe.importesPorMes.reduce((s: number, v: number) => s + v, 0) / 12;
    case 'porPago':
      return Object.values(c.importe.importesPorPago).reduce((s, v) => s + v, 0) / 12;
    default:
      return 0;
  }
}
