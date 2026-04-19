// PR5 · Formatters auxiliares para /conciliacion
//
// Todos los importes se muestran con el formato es-ES (coma decimal, punto de miles).

const euroFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const euroFormatterPlain = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * "+1.240,30 €" / "−32,30 €" — siempre con signo explícito.
 * Usa el carácter tipográfico "−" (U+2212) para los negativos.
 */
export function formatSignedEuro(amount: number): string {
  if (amount === 0) return '0,00 €';
  const sign = amount > 0 ? '+' : '−';
  return `${sign}${euroFormatterPlain.format(Math.abs(amount))} €`;
}

/** "1.240,30 €" sin signo — para totales agregados donde el signo lo da el contexto. */
export function formatEuro(amount: number): string {
  return euroFormatter.format(amount).replace(/\s/g, ' ');
}

export function monthLabel(year: number, month0: number): string {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  return `${months[month0]} ${year}`;
}

export function monthLabelShort(month0: number): string {
  const months = [
    'ene', 'feb', 'mar', 'abr', 'may', 'jun',
    'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
  ];
  return months[month0];
}

export function weekdayLabel(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  const weekdays = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  return weekdays[d.getDay()];
}

/** "05" — día de 2 dígitos. */
export function dayOfMonth(isoDate: string): string {
  return String(Number(isoDate.slice(8, 10))).padStart(2, '0');
}

export function extractDate(isoOrDate: string): string {
  return isoOrDate.slice(0, 10);
}

export function fileSizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function timeAgoLabel(isoDate: string | undefined): string {
  if (!isoDate) return '';
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'hace unos segundos';
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `hace ${day} d`;
  const mon = Math.floor(day / 30);
  if (mon < 12) return `hace ${mon} mes${mon === 1 ? '' : 'es'}`;
  const yr = Math.floor(day / 365);
  return `hace ${yr} año${yr === 1 ? '' : 's'}`;
}
