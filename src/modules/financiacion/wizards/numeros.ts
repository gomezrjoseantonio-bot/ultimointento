// Lo que el usuario teclea, cuando cero no vale como respuesta.
//
// `parseNum` devuelve 0 ante cualquier cosa, que está bien para un importe en
// blanco y muy mal para un dato que se guarda como HECHO: el valor del índice
// de una revisión del banco (§6 bis · bis). Un dedazo se guardaría ahí como
// «el Euríbor fue del 0 %», y de esa cifra salen la cuota, las previsiones de
// tesorería y los intereses del ejercicio.

/** Si eso que han escrito es un número · admite la coma decimal española. */
export const esNumero = (raw: string): boolean => {
  const normalizado = String(raw ?? '').replace(/\./g, '').replace(',', '.').trim();
  return normalizado !== '' && /^-?\d*\.?\d+$/.test(normalizado);
};

/** Lo tecleado a número · la coma decimal española y el punto de millares. */
export const parseNum = (raw: string): number => {
  if (!raw) return 0;
  const normalized = String(raw).replace(/\./g, '').replace(',', '.').trim();
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
};

/** Un número como se escribe aquí · 1.234,56. */
export const fmtNumeroEs = (v: number, dec = 2): string => {
  if (!Number.isFinite(v)) return '';
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(v);
};

/** Un conteo · nunca negativo y siempre entero. */
export const enteroNoNegativo = (n: number): number =>
  Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
