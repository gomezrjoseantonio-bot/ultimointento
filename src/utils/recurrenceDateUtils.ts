export type FrecuenciaRecurrencia = 'mensual' | 'trimestral' | 'semestral' | 'anual';

const MONTHS_BY_FREQUENCY: Record<FrecuenciaRecurrencia, number> = {
  mensual: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

/**
 * Formatea una fecha de CALENDARIO (no un instante) a `YYYY-MM-DD` usando sus
 * componentes LOCALES. Evita el bug clásico de `date.toISOString().slice(0,10)`:
 * ese convierte a UTC y, en zonas UTC+ (España UTC+1/+2), la medianoche local
 * cae en el día ANTERIOR → el día 1 se guardaba como el 31. Aquí no hay desfase.
 */
export function toISODateLocal(date: Date): string {
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseIsoDateAsUTC(dateLike: string): Date {
  const [year, month, day] = dateLike.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return new Date(NaN);
  return new Date(Date.UTC(year, month - 1, day));
}

export function daysInMonthUTC(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function addMonthsClampedUTC(baseDateLike: string, monthsToAdd: number, preferredDay?: number): Date {
  const base = parseIsoDateAsUTC(baseDateLike);
  if (Number.isNaN(base.getTime())) return new Date(NaN);

  const targetMonthDate = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + monthsToAdd, 1));
  const targetYear = targetMonthDate.getUTCFullYear();
  const targetMonth = targetMonthDate.getUTCMonth();
  const targetMaxDay = daysInMonthUTC(targetYear, targetMonth);

  const requestedDay = preferredDay ?? base.getUTCDate();
  const safeDay = Math.max(1, Math.min(requestedDay, targetMaxDay));

  return new Date(Date.UTC(targetYear, targetMonth, safeDay));
}

export function calculateNextRecurringDate(
  baseDateLike: string,
  frecuencia: FrecuenciaRecurrencia,
  preferredDay?: number,
): string {
  const monthsToAdd = MONTHS_BY_FREQUENCY[frecuencia] ?? 1;
  return addMonthsClampedUTC(baseDateLike, monthsToAdd, preferredDay).toISOString();
}

export function formatDateDDMMAAAA(dateLike: string | Date): string {
  const date = typeof dateLike === 'string' ? parseIsoDateAsUTC(dateLike) : dateLike;
  if (Number.isNaN(date.getTime())) return '';

  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = String(date.getUTCFullYear());
  return `${day}${month}${year}`;
}
