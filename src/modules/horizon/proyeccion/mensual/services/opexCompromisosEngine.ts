// opexCompromisosEngine · C-PROY-5 · Fase B2
//
// Expande los compromisos recurrentes de inmueble a un mapa mensual de OPEX
// para el horizonte completo del motor (20 años) por la VÍA DIRECTA (B0.3):
// `expandirPatron + calcularImporte + aplicarVariacion` — la misma fuente y
// la misma expansión que usa el colchón del Panel (`compromisosMensual.ts`) y
// el generador de eventos de tesorería (`generarEventosDesdeCompromiso`).
//
// El adaptador `mapCompromisoToOpexRule` queda PROHIBIDO aquí: aplana la
// `variacion`, convierte `puntual` en anual recurrente y pierde la vigencia
// (`fechaInicio`/`fechaFin`) — ver informe fase A · anexo B0.3.
//
// Inflación de gastos (B1): el supuesto global `inflacionGastosPct` aplica
// SOLO a compromisos sin `variacion` propia, compuesto desde el año base del
// motor (sin inflación retroactiva: el importe registrado es precio de hoy).
// Un compromiso CON `variacion` — incluido `sinVariacion`, que es elección
// explícita del usuario — se rige por ella vía `aplicarVariacion`, anclada en
// `fechaInicio` (misma semántica que el generador canónico de eventos).

import type { CompromisoRecurrente } from '../../../../../types/compromisosRecurrentes';
import {
  aplicarVariacion,
  calcularImporte,
  expandirPatron,
} from '../../../../../services/personal/patronCalendario';
import type { OpexDetalleItem } from './forecastEngine';

export interface OpexMes {
  /** Suma de todos los eventos de gasto de inmueble del mes en €. */
  total: number;
  /** Desglose por inmueble/concepto para el drill-down de la UI. */
  desglose: OpexDetalleItem[];
}

const isoDate = (y: number, m: number, d: number): string =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/**
 * Construye el mapa `'YYYY-MM' → {total, desglose}` de OPEX de inmuebles
 * para todo el horizonte de proyección. Pura · sin DB · testable.
 *
 * Regla #4 del modelo (patronCalendario): NUNCA se prorratea — cada evento
 * se imputa al mes en que cae su fecha de cargo (el colchón del Panel muestra
 * el prorrateo /12 por diseño propio; misma fuente, agregación distinta).
 */
export function buildOpexPorMes(
  compromisos: CompromisoRecurrente[],
  inflacionGastosPct: number,
  propertyAliasMap: Map<number, string>,
  startYear: number,
  years: number,
): Map<string, OpexMes> {
  const porMes = new Map<string, OpexMes>();
  const horizonteDesde = isoDate(startYear, 1, 1);
  const horizonteHasta = isoDate(startYear + years - 1, 12, 31);

  for (const c of compromisos) {
    if (c.ambito !== 'inmueble' || c.inmuebleId == null) continue;
    if (c.estado !== 'activo') continue;

    // Vigencia del compromiso recortada al horizonte (ISO compara lexicográfico)
    const desde = c.fechaInicio > horizonteDesde ? c.fechaInicio : horizonteDesde;
    const hasta = c.fechaFin && c.fechaFin < horizonteHasta ? c.fechaFin : horizonteHasta;

    let fechas: Date[];
    try {
      fechas = expandirPatron(c.patron, desde, hasta);
    } catch {
      continue; // patrón corrupto · mismo trato defensivo que el Panel
    }

    const fechaInicio = new Date(c.fechaInicio);
    const alias = propertyAliasMap.get(c.inmuebleId) ?? `Inmueble #${c.inmuebleId}`;

    for (const fecha of fechas) {
      let importe: number;
      try {
        importe = calcularImporte(c.importe, fecha);
      } catch {
        continue; // p.ej. `porPago` sin importe para ese mes
      }

      if (c.variacion) {
        importe = aplicarVariacion(importe, c.variacion, fechaInicio, fecha);
      } else if (inflacionGastosPct !== 0) {
        importe *= Math.pow(1 + inflacionGastosPct / 100, fecha.getFullYear() - startYear);
      }
      if (importe === 0) continue;

      const monthKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      let mes = porMes.get(monthKey);
      if (!mes) {
        mes = { total: 0, desglose: [] };
        porMes.set(monthKey, mes);
      }
      mes.total += importe;

      const existente = mes.desglose.find(
        (d) => d.propertyId === c.inmuebleId && d.concepto === c.alias,
      );
      if (existente) {
        existente.importe += importe;
      } else {
        mes.desglose.push({
          propertyId: c.inmuebleId,
          propertyAlias: alias,
          concepto: c.alias,
          importe,
        });
      }
    }
  }

  return porMes;
}
