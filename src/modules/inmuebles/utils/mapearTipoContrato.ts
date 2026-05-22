import type { Contract } from '../../../services/db';

/**
 * Tipo de contrato visto desde el filtro de la tabla Activos.
 *
 * El modelo persistido usa `modalidad: 'habitual' | 'temporada' | 'vacacional'`.
 * El chip del mockup colapsa a sólo dos categorías de uso · "larga" (estancia
 * larga · alquiler habitual) y "corta" (estancia corta · temporada · vacacional).
 */
export type TipoContrato = 'larga' | 'corta';

export function mapearTipoContrato(c: Contract): TipoContrato {
  if (c.modalidad === 'habitual') return 'larga';
  if (c.modalidad === 'temporada' || c.modalidad === 'vacacional') return 'corta';
  // Fallback conservador · contratos sin modalidad reconocida → larga
  return 'larga';
}
