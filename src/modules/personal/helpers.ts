// Helpers compartidos del módulo Personal.
// T20 Fase 3b · review #1172 · centralizar cálculos del modelo real.
//
// FIX consolidar módulo Personal (F6/F7) · estos helpers YA NO calculan: son
// adaptadores de vista que delegan en la ÚNICA FUENTE DE VERDAD
// (`nominaCalculoService` / `autonomoCalculoService`). Sólo añaden el guard de
// activa/activo y el año en curso. NINGÚN cálculo vive aquí ni en componentes.

import type { Autonomo, Nomina } from '../../types/personal';
import type { CompromisoRecurrente } from '../../types/compromisosRecurrentes';
import {
  calcularNetoMesNomina,
  calcularNetoAnualNomina,
} from '../../services/nominaCalculoService';
import {
  calcularNetoMesAutonomo,
  calcularNetoAnualAutonomo,
} from '../../services/autonomoCalculoService';

/** Año en curso · calendario REAL (spec v1.1 regla 4). */
const añoEnCurso = (): number => new Date().getFullYear();

/**
 * Neto líquido de una nómina en un mes concreto · lo que llega al banco.
 * Delega en la ÚNICA FUENTE DE VERDAD `calcularNetoMesNomina`.
 *
 * Devuelve 0 si la nómina está inactiva.
 *
 * @param mes 1-12
 */
export const computeNominaNetoEnMes = (n: Nomina, mes: number): number => {
  if (!n.activa) return 0;
  return calcularNetoMesNomina(n, mes, añoEnCurso()).netoMes;
};

/**
 * Neto líquido de una nómina por los 12 meses del año.
 * Delega en `calcularNetoAnualNomina` (única fuente de verdad).
 *
 * Devuelve `[0, 0, …]` si la nómina está inactiva.
 */
export const computeNominaNetoPorMes = (n: Nomina): number[] => {
  if (!n.activa) return Array(12).fill(0);
  return calcularNetoAnualNomina(n, añoEnCurso()).porMes.map((m) => m.neto);
};

/**
 * Neto de un autónomo en un mes concreto.
 * Delega en `calcularNetoMesAutonomo` · neto = ingresos − cuotaRETA − gastos −
 * retención IRPF. Devuelve 0 si el autónomo está inactivo.
 *
 * @param mes 1-12
 */
export const computeAutonomoNetoEnMes = (a: Autonomo, mes: number): number => {
  if (!a.activo) return 0;
  return calcularNetoMesAutonomo(a, mes, añoEnCurso()).netoMes;
};

/**
 * Neto de un autónomo por los 12 meses del año.
 * Delega en `calcularNetoAnualAutonomo` (única fuente de verdad).
 * Devuelve `[0, 0, …]` si el autónomo está inactivo.
 */
export const computeAutonomoNetoPorMes = (a: Autonomo): number[] => {
  if (!a.activo) return Array(12).fill(0);
  return calcularNetoAnualAutonomo(a, añoEnCurso()).porMes.map((m) => m.neto);
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
  categoria: string,
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
  categoria: string,
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
