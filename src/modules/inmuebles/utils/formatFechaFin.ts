import { parseIsoDateAsUTC } from '../../../utils/recurrenceDateUtils';

/**
 * Convención del proyecto · una fecha de fin "indefinida" se persiste como
 * 31-dic-2099. T1 de Contratos · cleanup quirúrgico de render únicamente; no
 * se migra el dato persistido (decisión pospuesta a tarea con DB bump).
 */
const FECHA_SENTINEL_INDEFINIDO = '2099-12-31';

export function esFechaIndefinida(
  fechaFin: string | null | undefined,
  flagIndefinido?: boolean | null,
): boolean {
  if (flagIndefinido === true) return true;
  if (fechaFin === null || fechaFin === undefined || fechaFin === '') return true;
  const fechaNormalizada = fechaFin.slice(0, 10);
  return fechaNormalizada === FECHA_SENTINEL_INDEFINIDO;
}

export function formatFechaFinContrato(
  fechaFin: string | null | undefined,
  flagIndefinido?: boolean | null,
  formatFecha?: (f: string) => string,
): string {
  if (esFechaIndefinida(fechaFin, flagIndefinido)) {
    return 'Indefinido';
  }
  if (formatFecha) return formatFecha(fechaFin!);
  const parsed = parseIsoDateAsUTC(fechaFin!);
  if (Number.isNaN(parsed.getTime())) return 'Fecha inválida';
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}
