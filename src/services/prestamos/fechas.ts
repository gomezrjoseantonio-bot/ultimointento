// ============================================================================
// Aritmética de fechas del préstamo · sobre la cadena ISO y en UTC
// ============================================================================
//
// Nada de campos locales de `Date`: en un navegador al este de Greenwich mueven
// el día, y un cuadro cuyo cargo se corre un día deja de cuadrar con el banco.
// Como los tests corren en UTC, ese fallo no aparecería aquí — solo en la
// pantalla de quien lo usa.
// ============================================================================

const DIA = 86_400_000;

/** Los tres números de una fecha ISO · `[año, mes 1-12, día]`. */
export const partes = (iso: string): [number, number, number] => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return [y, m, d];
};

export const aISO = (anio: number, mes: number, dia: number): string =>
  `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

/** Si eso es una fecha ISO y no cualquier otra cosa. */
export const esISO = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v);

/** Cuántos días tiene ese mes · `mes` va de 1 a 12. */
export const diasDelMes = (anio: number, mes: number): number =>
  new Date(Date.UTC(anio, mes, 0)).getUTCDate();

/**
 * Suma meses conservando el día objetivo, recortado al último del mes.
 *
 * Sin el recorte, un cargo el 31 se desborda al 3 de marzo y todas las citas
 * siguientes llegan tarde. Y el día objetivo se pasa aparte a propósito: si se
 * leyera de la fecha base, una cita ya recortada a 28 dejaría clavada en el 28
 * toda la serie posterior.
 */
export const sumarMeses = (iso: string, meses: number, diaObjetivo?: number): string => {
  const [y, m, d] = partes(iso);
  const total = y * 12 + (m - 1) + meses;
  const anio = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  return aISO(anio, mes, Math.min(diaObjetivo ?? d, diasDelMes(anio, mes)));
};

export const restarUnDia = (iso: string): string => {
  const [y, m, d] = partes(iso);
  const t = new Date(Date.UTC(y, m - 1, d) - DIA);
  return aISO(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
};

/** Días entre dos fechas ISO, ambas incluidas. */
export const diasEntre = (desde: string, hasta: string): number => {
  const [y1, m1, d1] = partes(desde);
  const [y2, m2, d2] = partes(hasta);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DIA) + 1;
};
