// rentasContratosEngine · C-PROY-5 · Fase B3
//
// Ciclo de vida de contratos para el motor de proyección: los contratos
// VENCEN, se RENUEVAN y se INDEXAN más allá del año base (antes el motor
// congelaba el array de rentas del año base los 20 años).
//
// Modelo (cada regla lee su supuesto de B1 · ningún default escondido):
// · Indexación anual compuesta desde el año base del motor. Tasa por contrato:
//   - `indexacion === 'none'` → 0 % (elección explícita del contrato)
//   - legacy `rentUpdate.type === 'fixed-percentage'` con % → ese % (único
//     sitio del modelo con tasa propia por contrato)
//   - resto ('ipc' | 'irav' | 'otros') → `supuestos.subidaRentasPct` global
//   Paso anual en enero (simplificación declarada: no por mes de aniversario).
// · Renovación: al llegar `fechaFin`, el contrato se renueva indefinidamente
//   a la renta indexada, con el descuento de `vacanciaPct` como riesgo de
//   re-alquiler. Mientras el contrato firmado está vigente NO hay vacancia:
//   la renta contractual es la que paga el inquilino.
// · `estadoContrato` 'rescindido' | 'finalizado' → fuera (igual que antes).
//
// Coherencia fiscal (B0.4): `contratosSimuladosParaEjercicio` produce el
// MISMO ciclo de vida como contratos sintéticos para `calcularDeclaracionIRPF`
// en ejercicios futuros — cashflow y fiscal ven los mismos contratos. La
// vacancia queda fuera del lado fiscal (declarado: fiscal asume renovación
// ocupada · conservador, tributa algo de más).

import type { Contract } from '../../../../../services/db';
import type { SupuestosProyeccion } from '../../../../../types/supuestosProyeccion';
import type { DrillDownItem } from '../types/proyeccionMensual';

export interface RentaMes {
  total: number;
  drillDown: DrillDownItem[];
}

/** Contratos que participan en la proyección (mismo criterio que el motor pre-B3). */
function esProyectable(c: Contract): boolean {
  return c.estadoContrato !== 'rescindido' && c.estadoContrato !== 'finalizado';
}

/** Tasa de indexación anual (%) de un contrato · B1 global salvo override propio. */
export function tasaIndexacionContrato(
  c: Contract,
  supuestos: SupuestosProyeccion,
): number {
  if (c.indexacion === 'none') return 0;
  const legacy = (c as { rentUpdate?: { type?: string; ipcPercentage?: number } }).rentUpdate;
  if (legacy?.type === 'fixed-percentage' && typeof legacy.ipcPercentage === 'number') {
    return legacy.ipcPercentage;
  }
  return supuestos.subidaRentasPct;
}

/**
 * Construye el mapa `'YYYY-MM' → {total, drillDown}` de rentas de alquiler
 * para todo el horizonte. Pura · sin DB · testable.
 */
export function buildRentaPorMes(
  contracts: Contract[],
  supuestos: SupuestosProyeccion,
  propertyAliasMap: Map<number, string>,
  startYear: number,
  years: number,
): Map<string, RentaMes> {
  const porMes = new Map<string, RentaMes>();
  const vacanciaFactor = 1 - supuestos.vacanciaPct / 100;

  for (const contract of contracts) {
    if (!esProyectable(contract)) continue;
    const rentaBase = contract.rentaMensual ?? 0;
    if (rentaBase <= 0) continue;

    const fechaInicio = new Date(contract.fechaInicio);
    const fechaFin = contract.fechaFin ? new Date(contract.fechaFin) : null;
    if (Number.isNaN(fechaInicio.getTime())) continue;

    const tasa = tasaIndexacionContrato(contract, supuestos) / 100;
    const propertyAlias =
      propertyAliasMap.get(contract.inmuebleId) ??
      (contract.inmuebleId ? `Inmueble ${contract.inmuebleId}` : 'Inmueble');
    const inquilino =
      `${contract.inquilino?.nombre ?? ''} ${contract.inquilino?.apellidos ?? ''}`.trim() ||
      'Inquilino';

    for (let yearIndex = 0; yearIndex < years; yearIndex++) {
      const year = startYear + yearIndex;
      const factorIndexacion = Math.pow(1 + tasa, yearIndex);

      for (let m = 0; m < 12; m++) {
        const monthStart = new Date(year, m, 1);
        const monthEnd = new Date(year, m + 1, 0);
        // El contrato aún no ha empezado
        if (monthEnd < fechaInicio) continue;

        // ¿Mes bajo contrato firmado o bajo renovación simulada?
        const enRenovacion = fechaFin !== null && monthStart > fechaFin;
        const renta =
          rentaBase * factorIndexacion * (enRenovacion ? vacanciaFactor : 1);
        if (renta === 0) continue;

        const monthKey = `${year}-${String(m + 1).padStart(2, '0')}`;
        let mes = porMes.get(monthKey);
        if (!mes) {
          mes = { total: 0, drillDown: [] };
          porMes.set(monthKey, mes);
        }
        mes.total += renta;
        mes.drillDown.push({
          concepto: enRenovacion ? `${inquilino} (renovación estimada)` : inquilino,
          importe: renta,
          fuente: propertyAlias,
        });
      }
    }
  }

  return porMes;
}

/**
 * Contratos sintéticos para el cálculo IRPF de un ejercicio FUTURO · el mismo
 * ciclo de vida que proyecta el cashflow (B0.4 · opción a):
 * - renta indexada al ejercicio con la misma tasa por contrato
 * - `fechaFin` extendida a fin de ejercicio si el contrato se renueva
 * - SIN descuento de vacancia (lado fiscal conservador · declarado)
 */
export function contratosSimuladosParaEjercicio(
  contracts: Contract[],
  supuestos: SupuestosProyeccion,
  ejercicio: number,
  startYear: number,
): Contract[] {
  const finEjercicio = `${ejercicio}-12-31`;
  return contracts
    .filter(esProyectable)
    .filter((c) => new Date(c.fechaInicio).getFullYear() <= ejercicio)
    .map((c) => {
      const tasa = tasaIndexacionContrato(c, supuestos) / 100;
      const factor = Math.pow(1 + tasa, Math.max(0, ejercicio - startYear));
      const renueva = Boolean(c.fechaFin && c.fechaFin < finEjercicio);
      return {
        ...c,
        rentaMensual: (c.rentaMensual ?? 0) * factor,
        fechaFin: renueva ? finEjercicio : c.fechaFin,
      };
    });
}
