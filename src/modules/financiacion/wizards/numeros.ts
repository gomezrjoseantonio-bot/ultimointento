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
