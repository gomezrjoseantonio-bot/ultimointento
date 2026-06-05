import type { Contract, Property } from '../../../services/db';
import { habitacionNumeroDe } from './timelineColores';

export interface SubMetaInmueble {
  text: string;
  /** `true` · habitación sin asignar (por_habitaciones sin HX) · estilo apagado + tooltip. */
  pending: boolean;
}

/**
 * Sub-meta de la celda Inmueble (§ 1.3 problema 2), según el `modoExplotacion`
 * del inmueble:
 *  · piso_completo            → "Piso completo"
 *  · por_habitaciones + hab   → "Hab N"
 *  · por_habitaciones sin hab → "Hab pendiente" (pending · tooltip al renderizar)
 *
 * Si no se conoce el modo (legacy/mixto) se cae al `unidadTipo` del contrato
 * para mantener compatibilidad con datos previos a la propagación.
 */
export function subMetaInmueble(
  c: Contract,
  modo: Property['modoExplotacion'] | undefined,
): SubMetaInmueble {
  if (modo === 'por_habitaciones') {
    const habNum = habitacionNumeroDe(c);
    return habNum != null
      ? { text: `Hab ${habNum}`, pending: false }
      : { text: 'Hab pendiente', pending: true };
  }

  if (modo === 'piso_completo') {
    return { text: 'Piso completo', pending: false };
  }

  // Sin modo conocido · fallback al tipo del contrato.
  if (c.unidadTipo === 'vivienda') {
    return { text: 'Piso completo', pending: false };
  }
  const habNum = habitacionNumeroDe(c);
  return habNum != null
    ? { text: `Hab ${habNum}`, pending: false }
    : { text: 'Hab pendiente', pending: true };
}
