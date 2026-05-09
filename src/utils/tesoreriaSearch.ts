// Helpers compartidos por los buscadores de Tesorería · MovimientosTab y
// Conciliación v2. Búsqueda case-insensitive · sin acentos · con detección
// de importe exacto admitiendo "350", "350.00", "350,00" como equivalentes.

const COMBINING_MARKS = /[̀-ͯ]/g;

export const normalizeSearchText = (value?: string | null): string =>
  (value ?? '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .trim();

// Parsea una query como número permitiendo coma decimal estilo ES. Devuelve
// undefined si la query no es un número limpio. No usa parseFloat porque éste
// tolera basura al final ("350abc" → 350).
export const parseAmountQuery = (query: string): number | undefined => {
  const cleaned = query.trim();
  if (!cleaned) return undefined;
  if (!/^[+-]?\d+([.,]\d+)?$/.test(cleaned)) return undefined;
  const normalized = cleaned.replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : undefined;
};

const AMOUNT_EPSILON = 0.005;

export const matchesAmountQuery = (amount: number, query: string): boolean => {
  const target = parseAmountQuery(query);
  if (target === undefined) return false;
  return Math.abs(Math.abs(amount) - Math.abs(target)) < AMOUNT_EPSILON;
};
