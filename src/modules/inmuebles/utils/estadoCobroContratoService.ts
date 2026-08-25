// Consolidación Contratos → Alquileres · Fase E · derivación del ESTADO DE COBRO
// de un contrato a partir de Tesorería (fuente de verdad del dinero cobrado).
//
// Esta capa NO es una segunda Tesorería: solo LEE eventos de tesorería ya
// existentes y deriva un estado de presentación. No crea, confirma ni concilia
// nada. Alimenta el `TreasuryCobroContext` de `resumenOperativoContrato` (Fase D).
//
// Enlace evento ↔ contrato (spec auditoría §5):
//   · principal · `TreasuryEvent.contratoId === contractId`
//   · legacy    · `sourceType ∈ {'contract','contrato'}` && `sourceId === contractId`
// Renta = `type === 'income'`. Se excluyen los descartados (`descartado`).
// Cobrado = `status ∈ {'confirmed','executed'}` (materializado en un movimiento).

import type { Contract, TreasuryEvent } from '../../../services/db';
import type { EstadoCobro } from './resumenOperativoContrato';
import { parseIsoDateAsUTC } from '../../../utils/recurrenceDateUtils';

const MS_DIA = 1000 * 60 * 60 * 24;

/**
 * Los dos nombres con los que una renta de alquiler llega a `treasuryEvents`.
 *
 * `'contrato'` lo escribe el generador de previsiones (`treasurySyncService`);
 * `'contract'` lo escribe el extracto al asignar una línea del banco a un
 * contrato (`bankStatementOrchestrator`). Son el mismo dinero, así que quien
 * pregunte «¿ya hay renta de este contrato en este mes?» tiene que mirar los
 * dos: con uno solo, el cobro que entró por el extracto no impedía emitir
 * además la previsión, y la renta se contaba dos veces.
 *
 * Exportado para que el generador use ESTA lista y no un literal suelto.
 */
export const RENT_SOURCE_TYPES: ReadonlySet<string> = new Set(['contract', 'contrato']);

const diaUTC = (d: Date): number =>
  Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/** ¿El evento de tesorería es una renta viva (no descartada) de este contrato? */
export function esRentaDeContrato(e: TreasuryEvent, contractId: number): boolean {
  if (e.type !== 'income') return false;
  if (e.descartado) return false;
  if (e.contratoId === contractId) return true;
  return (
    e.sourceType != null &&
    RENT_SOURCE_TYPES.has(e.sourceType) &&
    e.sourceId === contractId
  );
}

/** Eventos de renta (vivos) de un contrato. */
export function eventosRentaDeContrato(
  events: TreasuryEvent[],
  contractId: number,
): TreasuryEvent[] {
  return events.filter((e) => esRentaDeContrato(e, contractId));
}

/** Un evento está cobrado cuando Tesorería lo ha confirmado/ejecutado. */
export function estaCobrado(e: TreasuryEvent): boolean {
  return e.status === 'confirmed' || e.status === 'executed';
}

/** Fecha relevante del evento · la real de cobro si existe, si no la prevista. */
function fechaEvento(e: TreasuryEvent): string | undefined {
  return e.actualDate ?? e.predictedDate;
}

/** Importe relevante del evento · el real si existe, si no el previsto. */
export function importeEvento(e: TreasuryEvent): number {
  return e.actualAmount ?? e.amount ?? 0;
}

/**
 * Estado de cobro del contrato a fecha `hoy`, derivado de sus eventos de renta.
 *
 *   · `sin_datos` · el contrato no tiene eventos de renta en Tesorería (no se
 *     puede afirmar nada · no se inventa).
 *   · `impago`    · hay al menos una renta VENCIDA (fecha + margen de gracia <
 *     hoy) y NO cobrada.
 *   · `pendiente` · hay al menos una renta vencida hoy pero aún dentro del
 *     margen de gracia, y NO cobrada (y ninguna en impago).
 *   · `al_dia`    · todo lo vencido está cobrado (o aún no vence nada).
 *
 * El margen de gracia sale de `contract.margenGraciaDias` (0 si no está).
 */
export function calcularEstadoCobroContrato(
  contract: Contract,
  events: TreasuryEvent[],
  hoy: Date = new Date(),
): EstadoCobro {
  const id = contract.id;
  if (id == null) return 'sin_datos';

  const propios = eventosRentaDeContrato(events, id);
  if (propios.length === 0) return 'sin_datos';

  const hoyMs = diaUTC(hoy);
  const graciaMs = Math.max(0, contract.margenGraciaDias ?? 0) * MS_DIA;

  let hayImpago = false;
  let hayPendiente = false;

  for (const e of propios) {
    if (estaCobrado(e)) continue; // cobrado · no debe nada
    const fecha = fechaEvento(e);
    if (!fecha) continue;
    const dueMs = parseIsoDateAsUTC(fecha).getTime();
    if (Number.isNaN(dueMs)) continue;
    if (dueMs > hoyMs) continue; // aún no vence · no cuenta como deuda
    if (dueMs + graciaMs < hoyMs) hayImpago = true;
    else hayPendiente = true;
  }

  if (hayImpago) return 'impago';
  if (hayPendiente) return 'pendiente';
  return 'al_dia';
}

export interface CobroEvento {
  /** Fecha real de cobro si existe, si no la prevista (ISO). */
  fecha: string;
  importe: number;
  cobrado: boolean;
  /** `true` si la fecha del evento es hoy o anterior. */
  vencido: boolean;
}

export interface ResumenCobros {
  estado: EstadoCobro;
  /** Eventos de renta ordenados de más reciente a más antiguo. */
  eventos: CobroEvento[];
}

/**
 * Resumen de cobros del contrato para la UI (drawer): estado + lista de eventos
 * de renta ordenada por fecha descendente. Puro · derivado de Tesorería.
 */
export function resumenCobrosContrato(
  contract: Contract,
  events: TreasuryEvent[],
  hoy: Date = new Date(),
): ResumenCobros {
  const id = contract.id;
  const propios = id == null ? [] : eventosRentaDeContrato(events, id);
  const hoyMs = diaUTC(hoy);

  const eventos: CobroEvento[] = propios
    .map((e) => {
      const fecha = fechaEvento(e) ?? '';
      const dueMs = fecha ? parseIsoDateAsUTC(fecha).getTime() : NaN;
      return {
        fecha,
        importe: importeEvento(e),
        cobrado: estaCobrado(e),
        vencido: !Number.isNaN(dueMs) && dueMs <= hoyMs,
      };
    })
    .filter((e) => e.fecha !== '')
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  return {
    estado: calcularEstadoCobroContrato(contract, events, hoy),
    eventos,
  };
}

/**
 * Estado de cobro por contrato para una lista (p.ej. la banda de KPIs o una
 * tabla). Devuelve un `Map<contractId, EstadoCobro>`.
 */
export function calcularEstadoCobroPorContrato(
  contracts: Contract[],
  events: TreasuryEvent[],
  hoy: Date = new Date(),
): Map<number, EstadoCobro> {
  const map = new Map<number, EstadoCobro>();
  for (const c of contracts) {
    if (c.id == null) continue;
    map.set(c.id, calcularEstadoCobroContrato(c, events, hoy));
  }
  return map;
}
