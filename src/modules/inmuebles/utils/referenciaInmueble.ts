import { normalizeCcaaKey } from '../../../services/fiscal/ccaaRules';
import type { Property } from '../../../services/db';

/**
 * Referencia visual de un inmueble · «AST-01», «CAT-03», «MAD-07»…
 *
 * Dos decisiones de diseño, ambas por peticiones de producto:
 *
 *  1. El PREFIJO identifica la comunidad autónoma del inmueble (`Property.ccaa`),
 *     no es una sigla fija. Antes el código escribía «AST» a todos los inmuebles
 *     (incluido uno de Madrid o Cataluña); ahora Asturias→AST, Cataluña→CAT, etc.
 *     El identificador pasa a ser buscable/filtrable por comunidad (el buscador
 *     de la lista ya indexa la referencia).
 *
 *  2. El NÚMERO es el `id` estable del inmueble, y se calcula con ESTA misma
 *     función tanto en la lista como en el detalle. Antes la lista numeraba por
 *     posición (`index + 1`) y el detalle por `id`, de modo que un mismo inmueble
 *     podía verse como AST-03 en la lista y AST-04 al abrirlo. Usar el `id` en
 *     ambos sitios elimina esa divergencia y no cambia al borrar otros inmuebles.
 *     (No es un correlativo por comunidad —CAT-01, CAT-02…— a propósito: eso
 *     exigiría persistir una secuencia y volvería a ser inestable al borrar.)
 */

/** Sigla por comunidad · clave = salida de `normalizeCcaaKey`. */
const SIGLA_POR_CCAA: Record<string, string> = {
  andalucia: 'AND',
  aragon: 'ARA',
  asturias: 'AST',
  baleares: 'BAL',
  canarias: 'CAN',
  cantabria: 'CTB',
  castilla_la_mancha: 'CLM',
  castilla_y_leon: 'CYL',
  cataluna: 'CAT',
  extremadura: 'EXT',
  galicia: 'GAL',
  madrid: 'MAD',
  murcia: 'MUR',
  la_rioja: 'RIO',
  valencia: 'VAL',
};

/** Prefijo genérico cuando el inmueble no tiene comunidad informada (p. ej. importados con `ccaa: ''`). */
export const SIGLA_SIN_COMUNIDAD = 'INM';

/**
 * Devuelve la sigla de la comunidad autónoma a partir del nombre almacenado en
 * `Property.ccaa` (texto libre: «Cataluña», «Catalunya», «Comunitat Valenciana»…).
 * Reutiliza `normalizeCcaaKey` (fiscal) para no reinventar la normalización.
 */
export function siglaComunidad(ccaa: string | null | undefined): string {
  const key = normalizeCcaaKey(ccaa);
  if (!key) return SIGLA_SIN_COMUNIDAD;

  const directa = SIGLA_POR_CCAA[key];
  if (directa) return directa;

  // Comunidades y ciudades autónomas que el normalizador fiscal no mapea
  // explícitamente (devuelve el texto limpio): las resolvemos aquí.
  if (key.includes('vasco') || key.includes('euskadi')) return 'PVA';
  if (key.includes('navarra')) return 'NAV';
  if (key.includes('ceuta')) return 'CEU';
  if (key.includes('melilla')) return 'MEL';

  return SIGLA_SIN_COMUNIDAD;
}

/**
 * Referencia visual estable de un inmueble: `<sigla CCAA>-<id con 2 dígitos>`.
 * Debe usarse en TODAS las pantallas para que lista y detalle nunca difieran.
 */
export function referenciaInmueble(property: Pick<Property, 'id' | 'ccaa'>): string {
  const num = typeof property.id === 'number' ? property.id : 0;
  return `${siglaComunidad(property.ccaa)}-${String(num).padStart(2, '0')}`;
}
