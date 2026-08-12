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

import type { Contract, GestionDelegada, HonorarioAgencia } from '../../../services/db';
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
  /** Comisión de la agencia derivada (según la fórmula: garantizada/%/fees). */
  comision: number;
  /** Neto para el propietario · facturacion − comision. */
  neto: number;
}

/** Comisión anual de una línea de honorarios (fees). */
function comisionDeHonorario(h: HonorarioAgencia, facturacion: number, nHabitaciones: number): number {
  if (h.periodicidad === 'por_inquilino_nuevo') return 0; // evento puntual · no recurrente anual
  const factorPeriodo = h.periodicidad === 'anual' ? 1 : 12; // mensual → ×12
  if (h.calculo === 'porcentaje') return (facturacion * h.valor) / 100;
  // importe
  if (h.base === 'habitacion') return h.valor * nHabitaciones * factorPeriodo;
  return h.valor * factorPeriodo; // fijo
}

/**
 * Comisión de la agencia según la fórmula configurada. La vista fiscal es la
 * misma sea cual sea el flujo de liquidación (agencia_neto / propietario_bruto).
 */
export function calcularComision(
  gestion: GestionDelegada | undefined,
  facturacion: number,
  garantizado: number,
  nHabitaciones: number,
): number {
  const tipo = gestion?.comisionTipo ?? 'garantizada';
  if (tipo === 'porcentaje') {
    return Math.max(0, (facturacion * (gestion?.comisionPorcentaje ?? 0)) / 100);
  }
  if (tipo === 'fees') {
    return (gestion?.honorarios ?? []).reduce(
      (sum, h) => sum + comisionDeHonorario(h, facturacion, nHabitaciones),
      0,
    );
  }
  // garantizada (default) · la comisión es la diferencia con el neto garantizado.
  return Math.max(0, facturacion - garantizado);
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

  const comision = calcularComision(padre.gestion, facturacion, garantizado, conSolape.length);

  return {
    año,
    nSubcontratos: conSolape.length,
    facturacion,
    garantizado,
    comision,
    neto: facturacion - comision,
  };
}
