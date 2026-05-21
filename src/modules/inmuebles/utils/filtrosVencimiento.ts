import type { Contract } from '../../../services/db';
import { isContratoActivo } from '../pages/ContratosListPage';
import { esFechaIndefinida } from './formatFechaFin';
import { parseIsoDateAsUTC } from '../../../utils/recurrenceDateUtils';

export interface ContratoConVencimiento {
  contrato: Contract & { id: number };
  diasRestantes: number;
  inquilinoNombre: string;
  inmuebleId: number;
  rentaMensual: number;
  modalidad: Contract['modalidad'];
}

const MS_DIA = 1000 * 60 * 60 * 24;

export function filtrarContratosVencenEn(
  contracts: Contract[],
  diasMin: number,
  diasMax: number,
  hoy: Date = new Date(),
): ContratoConVencimiento[] {
  const hoyUTC = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  return contracts
    .filter((c): c is Contract & { id: number } => c.id != null)
    .filter(isContratoActivo)
    .filter((c) => c.fechaFin && !esFechaIndefinida(c.fechaFin))
    .map((c) => {
      const fin = parseIsoDateAsUTC(c.fechaFin);
      const diasRestantes = Math.ceil((fin.getTime() - hoyUTC) / MS_DIA);
      const nombreCompleto = `${c.inquilino?.nombre ?? ''} ${
        c.inquilino?.apellidos ?? ''
      }`.trim() || '—';
      return {
        contrato: c,
        diasRestantes,
        inquilinoNombre: nombreCompleto,
        inmuebleId: c.inmuebleId,
        rentaMensual: c.rentaMensual ?? 0,
        modalidad: c.modalidad,
      };
    })
    .filter(({ diasRestantes }) => diasRestantes >= diasMin && diasRestantes <= diasMax)
    .sort((a, b) => a.diasRestantes - b.diasRestantes);
}

export function filtrarVencen30d(
  contracts: Contract[],
  hoy?: Date,
): ContratoConVencimiento[] {
  return filtrarContratosVencenEn(contracts, 0, 30, hoy);
}

export function filtrarVencen30a90d(
  contracts: Contract[],
  hoy?: Date,
): ContratoConVencimiento[] {
  return filtrarContratosVencenEn(contracts, 31, 90, hoy);
}
