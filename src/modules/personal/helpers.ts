// Helpers compartidos del módulo Personal.
// T20 Fase 3b · review #1172 · centralizar cálculos del modelo real.

import type { Autonomo, Nomina } from '../../types/personal';
import type {
  CategoriaGastoCompromiso,
  CompromisoRecurrente,
} from '../../types/compromisosRecurrentes';
import { nominaService } from '../../services/nominaService';

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
 * Bruto devengado de una nómina en un mes concreto · spec v1.1 regla 4
 * (calendario REAL, no plano). Incluye paga extra entera en su mes,
 * variable íntegro en el mes pagadero, bonus íntegro en su mes.
 *
 * Devuelve 0 si la nómina está inactiva o si los datos están incompletos.
 * NO hay fallback prorrateado · el spec v1.1 prohibe expresamente prorratear
 * ficticiamente. Si calculateSalary lanza, se logea y se devuelve 0 (failing
 * loud · UI muestra dato ausente).
 *
 * @param mes 1-12
 */
export const computeNominaBrutoEnMes = (n: Nomina, mes: number): number => {
  if (!n.activa) return 0;
  try {
    const r = nominaService.calculateSalary(n);
    return r.distribucionMensual.find((d) => d.mes === mes)?.totalDevengado ?? 0;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[helpers] computeNominaBrutoEnMes · calculateSalary lanzó · datos incompletos', err);
    return 0;
  }
};

/**
 * Bruto anual real de una nómina · usa `calculateSalary(n).totalAnualBruto`
 * que sí incluye paga extra, variable y bonus (a diferencia de
 * `n.salarioBrutoAnual` que es sólo la base anual sin variables/bonus).
 *
 * Spec v1.1 regla 4 · todas las cifras anuales mostradas deben ser coherentes
 * con la suma real mes a mes.
 */
export const computeNominaBrutoAnual = (n: Nomina): number => {
  try {
    return nominaService.calculateSalary(n).totalAnualBruto;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[helpers] computeNominaBrutoAnual · calculateSalary lanzó · datos incompletos', err);
    return n.salarioBrutoAnual ?? 0;
  }
};

/**
 * Ingreso bruto estimado de un autónomo en un mes concreto.
 *
 * Estrategia (en orden):
 *   1. Si tiene `fuentesIngreso` · suma `importeEstimado` cuyas `meses`
 *      incluyen el mes indicado (sin `meses` = todos los meses).
 *   2. Si no tiene `fuentesIngreso` pero sí `ingresosFacturados`
 *      (autónomos legacy) · suma `importe` de los registros cuya `fecha`
 *      cae en el mes indicado del año en curso.
 *   3. Si nada de lo anterior · 0.
 *
 * Devuelve 0 si el autónomo está inactivo.
 *
 * @param mes 1-12
 */
export const computeAutonomoIngresoEnMes = (a: Autonomo, mes: number): number => {
  if (!a.activo) return 0;

  // Estrategia 1 · proyección con fuentesIngreso
  if (a.fuentesIngreso && a.fuentesIngreso.length > 0) {
    return a.fuentesIngreso.reduce((sum, f) => {
      const aplica =
        !Array.isArray(f.meses) || f.meses.length === 0 || f.meses.includes(mes);
      return aplica ? sum + (f.importeEstimado ?? 0) : sum;
    }, 0);
  }

  // Estrategia 2 · histórico de facturas del mes (autónomos legacy)
  if (a.ingresosFacturados && a.ingresosFacturados.length > 0) {
    return a.ingresosFacturados.reduce((sum, i) => {
      if (!i.fecha) return sum;
      // Acepta ISO 'YYYY-MM-DD' o 'YYYY-MM'
      const mesFecha = parseInt(i.fecha.slice(5, 7), 10);
      return mesFecha === mes ? sum + (i.importe ?? 0) : sum;
    }, 0);
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
