// Estimación anual de compromisos recurrentes para la rentabilidad del inmueble.
//
// Funciones puras extraídas de `DetallePage` (no leen IndexedDB): dado un
// compromiso recurrente activo, estiman su gasto anual según el patrón y el
// modo de importe. Se usan como "gastos previstos" cuando aún no hay gastos
// reales registrados. No sustituyen la lógica de proyección de Tesorería.

import type { CompromisoRecurrente } from '../../../types/compromisosRecurrentes';

/** Nº de pagos al año que implica el patrón de un compromiso. */
export const estimarPagosAnuales = (patron: CompromisoRecurrente['patron']): number => {
  switch (patron.tipo) {
    case 'mensualDiaFijo':
    case 'mensualDiaRelativo':
      return 12;
    case 'cadaNMeses':
      return patron.cadaNMeses > 0 ? Math.ceil(12 / patron.cadaNMeses) : 0;
    case 'trimestralFiscal':
      return 4;
    case 'anualMesesConcretos':
      return patron.mesesPago.length;
    case 'pagasExtra':
      return patron.mesesExtra.length;
    case 'variablePorMes':
      return patron.mesesPago.length;
    case 'puntual':
      return 1;
    default:
      return 0;
  }
};

/**
 * Gasto anual estimado de un compromiso recurrente · `undefined` cuando no es
 * determinable (compromiso no activo, tramos vacíos, porcentaje de renta sin
 * renta, …). `rentaMensual` solo se usa en el modo `porcentajeRenta`.
 */
export const estimarGastoAnualCompromiso = (
  compromiso: CompromisoRecurrente,
  rentaMensual: number,
): number | undefined => {
  if (compromiso.estado !== 'activo') return undefined;

  if (compromiso.patron.tipo === 'variablePorMes') {
    return Number.isFinite(compromiso.patron.importeObjetivoAnual)
      ? compromiso.patron.importeObjetivoAnual
      : undefined;
  }

  switch (compromiso.importe.modo) {
    case 'fijo':
      return compromiso.importe.importe * estimarPagosAnuales(compromiso.patron);
    case 'variable':
      return compromiso.importe.importeMedio * estimarPagosAnuales(compromiso.patron);
    case 'diferenciadoPorMes':
      return compromiso.importe.importesPorMes.reduce((sum, amount) => sum + amount, 0);
    case 'porPago':
      return Object.values(compromiso.importe.importesPorPago).reduce((sum, amount) => sum + amount, 0);
    case 'porTramos': {
      const importes = compromiso.importe.tramos
        .map((tramo) => tramo.importe)
        .filter((amount) => Number.isFinite(amount));
      if (importes.length === 0) return undefined;
      const importeMedio = importes.reduce((sum, amount) => sum + amount, 0) / importes.length;
      return importeMedio * estimarPagosAnuales(compromiso.patron);
    }
    case 'porcentajeRenta':
      return rentaMensual > 0 ? (rentaMensual * 12 * compromiso.importe.porcentaje) / 100 : undefined;
    default:
      return undefined;
  }
};
