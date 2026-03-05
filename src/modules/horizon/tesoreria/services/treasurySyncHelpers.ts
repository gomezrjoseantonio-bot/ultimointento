import type { ReglaDia } from '../../../../types/personal';

function buildDate(year: number, month: number, day: number): string {
  const safeMonth = Math.min(Math.max(month, 1), 12);
  const normalizedDay = Math.min(Math.max(day, 1), 31);
  const lastDayOfMonth = new Date(year, safeMonth, 0).getDate();
  const effectiveDay = Math.min(normalizedDay, lastDayOfMonth);

  const mm = String(safeMonth).padStart(2, '0');
  const dd = String(effectiveDay).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

export function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

export function getBusinessDayForRule(
  year: number,
  month: number,
  rule?: ReglaDia,
  fallbackDay = 1,
): string {
  const safeMonth = Math.min(Math.max(month, 1), 12);

  if (!rule || rule.tipo === 'fijo') {
    const day = rule?.dia ?? fallbackDay;
    return buildDate(year, safeMonth, day);
  }

  if (rule.tipo === 'ultimo-habil') {
    const date = new Date(year, safeMonth, 0);
    while (!isBusinessDay(date)) {
      date.setDate(date.getDate() - 1);
    }
    return buildDate(year, safeMonth, date.getDate());
  }

  const position = rule.posicion ?? -1;
  if (position >= 1) {
    const date = new Date(year, safeMonth - 1, 1);
    let count = 0;
    while (date.getMonth() === safeMonth - 1) {
      if (isBusinessDay(date)) {
        count++;
        if (count === position) return buildDate(year, safeMonth, date.getDate());
      }
      date.setDate(date.getDate() + 1);
    }
    return buildDate(year, safeMonth, fallbackDay);
  }

  const targetFromEnd = Math.max(1, Math.abs(position));
  const date = new Date(year, safeMonth, 0);
  let count = 0;
  while (date.getMonth() === safeMonth - 1) {
    if (isBusinessDay(date)) {
      count++;
      if (count === targetFromEnd) return buildDate(year, safeMonth, date.getDate());
    }
    date.setDate(date.getDate() - 1);
  }

  return buildDate(year, safeMonth, fallbackDay);
}

export function getAddressStreetLiteral(address: string): string {
  const firstSegment = address.split(',')[0].replace(/\s+/g, ' ').trim();

  if (!firstSegment) return '';

  return firstSegment
    .replace(/^avda\.?\s+/i, 'Avenida ')
    .replace(/^av\.?\s+/i, 'Avenida ')
    .replace(/^c\/?\s*/i, 'Calle ')
    .trim();
}

export function getPropertyLiteral(property: { id?: number; alias?: string; address?: string }): string {
  const address = property.address?.trim();
  if (address) {
    const streetLiteral = getAddressStreetLiteral(address);
    if (streetLiteral) return streetLiteral;
  }

  const alias = property.alias?.trim();
  if (alias) return alias;

  return `Inmueble #${property.id}`;
}
