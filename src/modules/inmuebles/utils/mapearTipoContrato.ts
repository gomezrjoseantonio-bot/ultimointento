import type { Contract } from '../../../services/db';
import { esCortaEstancia } from '../../../services/db/types-alquiler';

/**
 * Tipo de contrato visto desde el filtro de la tabla Activos.
 *
 * El modelo persistido usa el subtipo de `types-alquiler`. El chip del mockup lo
 * colapsa a dos categorías de uso: «larga» (vivienda habitual del inquilino) y
 * «corta» (temporada y turístico, que van juntos en todo lo fiscal).
 */
export type TipoContrato = 'larga' | 'corta';

export function mapearTipoContrato(c: Contract): TipoContrato {
  if (c.modalidad === 'larga_estancia') return 'larga';
  if (esCortaEstancia(c.modalidad)) return 'corta';
  // Fallback conservador · contratos sin modalidad reconocida → larga
  return 'larga';
}
