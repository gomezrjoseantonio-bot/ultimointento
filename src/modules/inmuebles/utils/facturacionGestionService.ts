// Gestión delegada · Fase 2 · facturación de un contrato de gestión (padre).
//
// Requisito núcleo (docs/DISENO-gestion-delegada-agencias-V1.md §4.4):
// la FACTURACIÓN de un piso en gestión delegada ES, por definición, la suma de
// los subcontratos de inquilinos ANEXADOS a su contrato de gestión
// (`gestionPadreId === padre.id`), prorrateada por su solape con el ejercicio.
// De ahí se deriva la comisión de la agencia:
//
//   facturacion(año) = Σ rentaMensual(hijo) × meses de solape(hijo, año)
//   garantizado(año) = rentaGarantizada × meses de solape(padre, año)
//   comision(año)    = max(0, facturacion − garantizado)
//
// Servicio puro · no toca persistencia.

import type { Contract } from '../../../services/db';
import { esFechaIndefinida } from './formatFechaFin';
import { parseIsoDateAsUTC } from '../../../utils/recurrenceDateUtils';

export interface ResumenFacturacion {
  año: number;
  /** Número de subcontratos anexados con solape en el año. */
  nSubcontratos: number;
  /** Σ de las rentas reales de los subcontratos anexados (prorrateada al año). */
  facturacion: number;
  /** Renta garantizada del padre imputable al año. */
  garantizado: number;
  /** Comisión de la agencia derivada · max(0, facturacion − garantizado). */
  comision: number;
}

/** Subcontratos de inquilinos anexados a un contrato de gestión (padre). */
export function subcontratosDe(padreId: number, contracts: Contract[]): Contract[] {
  return contracts.filter((c) => c.gestionPadreId === padreId);
}

/** Meses (0..12) que un contrato solapa con el año natural indicado. */
export function mesesSolapeEnAño(contract: Contract, año: number): number {
  const inicioAño = Date.UTC(año, 0, 1);
  const finAño = Date.UTC(año, 11, 31);

  const iniMs = contract.fechaInicio ? parseIsoDateAsUTC(contract.fechaInicio).getTime() : NaN;
  if (Number.isNaN(iniMs)) return 0;
  const finMs = esFechaIndefinida(contract.fechaFin)
    ? finAño
    : parseIsoDateAsUTC(contract.fechaFin).getTime();
  if (Number.isNaN(finMs)) return 0;

  const desde = Math.max(iniMs, inicioAño);
  const hasta = Math.min(finMs, finAño);
  if (hasta < desde) return 0;

  const d = new Date(desde);
  const h = new Date(hasta);
  const meses =
    (h.getUTCFullYear() * 12 + h.getUTCMonth()) - (d.getUTCFullYear() * 12 + d.getUTCMonth()) + 1;
  return Math.max(0, Math.min(12, meses));
}

/**
 * Resumen de facturación de un contrato de gestión para un ejercicio.
 * `padre` debe llevar bloque `gestion`; si no, garantizado = 0.
 */
export function resumenFacturacion(
  padre: Contract & { id?: number },
  contracts: Contract[],
  año: number,
): ResumenFacturacion {
  const hijos = padre.id != null ? subcontratosDe(padre.id, contracts) : [];
  const conSolape = hijos.filter((h) => mesesSolapeEnAño(h, año) > 0);

  const facturacion = conSolape.reduce(
    (sum, h) => sum + (h.rentaMensual ?? 0) * mesesSolapeEnAño(h, año),
    0,
  );

  const rentaGarantizada = padre.gestion?.rentaGarantizada ?? 0;
  const garantizado = rentaGarantizada * mesesSolapeEnAño(padre, año);

  return {
    año,
    nSubcontratos: conSolape.length,
    facturacion,
    garantizado,
    comision: Math.max(0, facturacion - garantizado),
  };
}
