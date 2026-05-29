/**
 * ccaa.ts · Mapeo del código AEAT de Comunidad Autónoma de residencia
 * (`codigoCADeclaracion` del XML Modelo 100) a nombre legible.
 *
 * Numeración oficial AEAT de CCAA de régimen común (alfabética). Validado con
 * XML real: `codigoCADeclaracion="12"` → Madrid. País Vasco y Navarra (régimen
 * foral) no presentan IRPF de régimen común, por lo que no usan este código;
 * los códigos fuera de tabla caen al fallback.
 *
 * El store `personalData.comunidadAutonoma` sigue guardando el código (dato
 * canónico) · este helper solo transforma al renderizar.
 */

export const CCAA_AEAT: Record<string, string> = {
  '01': 'Andalucía',
  '02': 'Aragón',
  '03': 'Asturias',
  '04': 'Illes Balears',
  '05': 'Canarias',
  '06': 'Cantabria',
  '07': 'Castilla-La Mancha',
  '08': 'Castilla y León',
  '09': 'Cataluña',
  '10': 'Extremadura',
  '11': 'Galicia',
  '12': 'Madrid',
  '13': 'Murcia',
  '14': 'La Rioja',
  '15': 'Comunitat Valenciana',
};

/**
 * Devuelve el nombre legible de la CCAA.
 * - Si recibe un código numérico AEAT (1-2 dígitos) lo mapea (normaliza a 2 dígitos).
 * - Si recibe ya un nombre (string no numérico) lo devuelve tal cual.
 * - Si no hay valor o el código es desconocido, devuelve un fallback seguro.
 */
export function nombreCCAA(valor: string | number | undefined | null): string {
  if (valor === undefined || valor === null || valor === '') return 'No especificada';
  const str = String(valor).trim();
  if (/^\d{1,2}$/.test(str)) {
    const codigo = str.padStart(2, '0');
    return CCAA_AEAT[codigo] ?? `CCAA ${codigo}`;
  }
  // Ya es un nombre (p. ej. guardado previamente como texto).
  return str;
}
