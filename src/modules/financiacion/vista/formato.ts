// Formato de la vista de Financiación.
//
// Sin color: el signo − es lo único que marca la deuda (guía v5 §2.6). Las
// cifras van en tinta, y sobre el hero navy en blanco — nunca en rojo ni en
// verde, que es lo que hacía `MoneyValue` con `tone="neg"`.

const EUR0 = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const MESES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

/** Un importe de deuda · «−3.758 €». El cero no lleva signo. */
export const eurDeuda = (n: number): string => {
  const v = Math.round(n);
  return v === 0 ? '0 €' : `−${EUR0.format(Math.abs(v))} €`;
};

/** Un importe a favor · «+2.985 €». */
export const eurAFavor = (n: number): string => {
  const v = Math.round(n);
  return v === 0 ? '0 €' : `+${EUR0.format(Math.abs(v))} €`;
};

/** Un importe sin signo · «1.086». */
export const eurPlano = (n: number): string => EUR0.format(Math.round(n));

/** Un tipo de interés · «2,60 %». */
export const pct = (n: number, decimales = 2): string =>
  `${n.toFixed(decimales).replace('.', ',')} %`;

/** «ago 2052» a partir de un ISO `YYYY-MM-DD` o `YYYY-MM`. */
export const mesAnio = (iso: string | null | undefined): string => {
  if (!iso || iso.length < 7) return '—';
  const mes = Number(iso.slice(5, 7));
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) return '—';
  return `${MESES[mes - 1]} ${iso.slice(0, 4)}`;
};

/** «25 ago 2026» a partir de un ISO `YYYY-MM-DD`. */
export const diaMesAnio = (iso: string | null | undefined): string => {
  if (!iso || iso.length < 10) return '—';
  const mes = Number(iso.slice(5, 7));
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) return '—';
  return `${Number(iso.slice(8, 10))} ${MESES[mes - 1]} ${iso.slice(0, 4)}`;
};

/** El año · «2043». */
export const anio = (iso: string | null | undefined): string =>
  iso && iso.length >= 4 ? iso.slice(0, 4) : '—';

/** El mes corto de un `YYYY-MM` · «sep», para el hint de la revisión. */
export const mesCorto = (iso: string | null | undefined): string => {
  if (!iso || iso.length < 7) return '';
  const mes = Number(iso.slice(5, 7));
  return Number.isInteger(mes) && mes >= 1 && mes <= 12 ? MESES[mes - 1] : '';
};

/**
 * Un valor de índice o diferencial · «2,100» · «—» si no lo trae.
 *
 * Nada de `?? 0`: un cero es un valor válido —hubo Euríbor negativo, y hay
 * diferenciales a cero— así que escribirlo por un dato ausente sería enseñar
 * como hecho algo que nadie ha dicho.
 */
export const cifraIndice = (v: number | undefined): string =>
  typeof v === 'number' && Number.isFinite(v) ? v.toFixed(3).replace('.', ',') : '—';
