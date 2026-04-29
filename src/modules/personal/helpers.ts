// Helpers compartidos del módulo Personal.
// T20 Fase 3b · review #1172 · centralizar cálculos del modelo real.

import type { Autonomo } from '../../types/personal';
import type {
  CategoriaGastoCompromiso,
  CompromisoRecurrente,
} from '../../types/compromisosRecurrentes';

/**
 * Estimación bruta anual de ingresos para un autónomo.
 *
 * El tipo `Autonomo` NO tiene `ingresoBrutoAnualEstimado`. La fuente real
 * son `fuentesIngreso` (estimación con calendario) y `ingresosFacturados`
 * (registros históricos del año en curso). Preferimos `fuentesIngreso`
 * porque es proyección · `ingresosFacturados` cubre lo ya emitido.
 */
export const computeAutonomoIngresoAnualEstimado = (a: Autonomo): number => {
  if (a.fuentesIngreso && a.fuentesIngreso.length > 0) {
    return a.fuentesIngreso.reduce((sum, f) => {
      const meses = Array.isArray(f.meses) && f.meses.length > 0 ? f.meses.length : 12;
      const importeAnual = (f.importeEstimado ?? 0) * meses;
      return sum + importeAnual;
    }, 0);
  }
  if (a.ingresosFacturados && a.ingresosFacturados.length > 0) {
    return a.ingresosFacturados.reduce((sum, i) => sum + (i.importe ?? 0), 0);
  }
  return 0;
};

/**
 * Importe mensual normalizado de un compromiso (cualquier modo de importe).
 */
export const computeCompromisoMonthly = (c: CompromisoRecurrente): number => {
  switch (c.importe.modo) {
    case 'fijo':
      return c.importe.importe;
    case 'variable':
      return c.importe.importeMedio;
    case 'diferenciadoPorMes':
      return (
        c.importe.importesPorMes.reduce((s: number, v: number) => s + v, 0) / 12
      );
    case 'porPago':
      return (
        Object.values(c.importe.importesPorPago).reduce((s, v) => s + v, 0) / 12
      );
    default:
      return 0;
  }
};

/**
 * Importe esperado en un mes concreto · usa estacionalidad si la hay.
 * @param month 0-11 (estilo Date)
 */
export const computeCompromisoImporteEnMes = (
  c: CompromisoRecurrente,
  month: number,
): number => {
  switch (c.importe.modo) {
    case 'fijo':
      return c.importe.importe;
    case 'variable':
      return c.importe.importeMedio;
    case 'diferenciadoPorMes':
      return c.importe.importesPorMes[month] ?? 0;
    case 'porPago': {
      // mes 1-12 · convertir desde el month 0-11
      const value = c.importe.importesPorPago[month + 1] ?? 0;
      return value;
    }
    default:
      return 0;
  }
};

/**
 * Reparto canónico de categorías → bolsa 50/30/20 según prefijo.
 */
export const bolsaForCategoria = (
  categoria: CategoriaGastoCompromiso,
): 'necesidades' | 'deseos' | 'ahorroInversion' | 'obligaciones' | 'inmueble' => {
  if (categoria.startsWith('vivienda.')) return 'necesidades';
  if (categoria.startsWith('ahorro.')) return 'ahorroInversion';
  if (categoria.startsWith('obligaciones.')) return 'obligaciones';
  if (categoria.startsWith('inmueble.')) return 'inmueble';
  // Necesidades sin prefijo · alimentacion · transporte · salud · educacion
  if (
    categoria === 'alimentacion' ||
    categoria === 'transporte' ||
    categoria === 'salud' ||
    categoria === 'educacion'
  ) {
    return 'necesidades';
  }
  // Deseos
  if (
    categoria === 'ocio' ||
    categoria === 'viajes' ||
    categoria === 'suscripciones' ||
    categoria === 'personal' ||
    categoria === 'regalos' ||
    categoria === 'tecnologia'
  ) {
    return 'deseos';
  }
  return 'necesidades';
};

/**
 * Devuelve la "familia" de la categoría · útil para colorear donut.
 */
export const familiaForCategoria = (
  categoria: CategoriaGastoCompromiso,
): string => {
  const prefix = categoria.split('.')[0];
  return prefix; // 'vivienda' · 'ahorro' · 'obligaciones' · 'inmueble' · 'alimentacion' · etc.
};

/**
 * Día seguro del mes · clamp al último día disponible.
 * Ejemplo · `safeDayOfMonth(2026, 1, 31)` → 28 (febrero) · `safeDayOfMonth(2024, 1, 31)` → 29.
 *
 * @param year full year
 * @param month 0-11
 * @param day 1-31
 */
export const safeDayOfMonth = (year: number, month: number, day: number): number => {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return Math.min(Math.max(1, day), lastDay);
};
