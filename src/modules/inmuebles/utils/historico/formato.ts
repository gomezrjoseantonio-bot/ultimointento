const MESES_CORTOS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

const eurosFmt = new Intl.NumberFormat('es-ES', {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

/** "1.560" · sin símbolo de moneda (se añade aparte donde se use). */
export function formatEuros(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return eurosFmt.format(Math.round(n));
}

function parseIso(iso: string | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "15/11/2025" */
export function formatearFechaCorta(iso: string | undefined): string {
  const d = parseIso(iso);
  if (!d) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** "nov 2025" */
export function formatearMesAno(iso: string | undefined): string {
  const d = parseIso(iso);
  if (!d) return '—';
  return `${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}`;
}
