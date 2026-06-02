import type { Contract } from '../../../services/db';
import { esFechaIndefinida } from './formatFechaFin';
import { isContratoActivo } from './contratoEstado';
import { parseIsoDateAsUTC } from '../../../utils/recurrenceDateUtils';

export type EstadoChip = 'al-dia' | 'vence-30d' | 'impago' | 'sin-firmar';

/**
 * "Firmado" en el modelo actual · se acepta cualquiera de estas señales ·
 *   1. `firma.estado === 'firmado'` (workflow de firma digital)
 *   2. `fechaFirmaContrato` presente (firma manual registrada)
 *
 * Si NINGUNA está presente y el contrato está activo · se considera "Sin firmar".
 */
export function estaFirmado(c: Contract): boolean {
  if (c.firma?.estado === 'firmado') return true;
  if (typeof c.fechaFirmaContrato === 'string' && c.fechaFirmaContrato.trim() !== '') return true;
  return false;
}

const MS_DIA = 1000 * 60 * 60 * 24;

function diasHastaFin(c: Contract, hoyUTC: number): number | null {
  if (!c.fechaFin || esFechaIndefinida(c.fechaFin)) return null;
  const fin = parseIsoDateAsUTC(c.fechaFin);
  if (Number.isNaN(fin.getTime())) return null;
  return Math.ceil((fin.getTime() - hoyUTC) / MS_DIA);
}

/**
 * Calcula el estado granular de un contrato para el chip / pill.
 *
 * Prioridad · sin-firmar > impago > vence-30d > al-dia.
 *
 * NOTA · "impago" requiere histórico de cobros · servicio aún no
 * integrado en este módulo (T3.6) · por tanto siempre devuelve false
 * hasta que se cablee el servicio · el chip queda deshabilitado.
 */
export function calcularEstadoChip(
  c: Contract,
  hoy: Date = new Date(),
): EstadoChip {
  // V79 · contratos importados nacen con estadoContrato='sin_firmar': se muestran
  // siempre con el chip "sin-firmar" (independientemente de la firma digital).
  if (c.estadoContrato === 'sin_firmar') return 'sin-firmar';

  // Sólo aplicamos chips a contratos activos · si está finalizado/rescindido
  // se trata como "al-dia" por defecto para evitar render roto, pero el chip
  // no debería verse en el tab Activos (este filtro vive aguas arriba).
  if (!isContratoActivo(c)) return 'al-dia';

  if (!estaFirmado(c)) return 'sin-firmar';

  // T3.6 · impago no calculable sin servicio de cobros · false por ahora
  // if (tieneImpagoActivo(c)) return 'impago';

  const hoyUTC = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
  const dias = diasHastaFin(c, hoyUTC);
  if (dias != null && dias >= 0 && dias <= 30) return 'vence-30d';

  return 'al-dia';
}

export const ESTADO_PRIORIDAD: EstadoChip[] = ['sin-firmar', 'impago', 'vence-30d', 'al-dia'];
