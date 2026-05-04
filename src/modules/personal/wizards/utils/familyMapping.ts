// ============================================================================
// T38 · Mapping familias Personal · 6 familias × tipo legacy × categoria
// ============================================================================
//
// Tabla canónica Personal:
//   vivienda        → tipo legacy 'otros'        (no existe 'vivienda' en enum legacy)
//   suministros     → tipo legacy 'suministro'
//   dia_a_dia       → tipo legacy 'otros'        (no existe 'dia_a_dia' en enum legacy)
//   suscripciones   → tipo legacy 'suscripcion'
//   seguros_cuotas  → tipo legacy 'otros'        (no existe 'seguros_cuotas' en enum legacy)
//   otros           → tipo legacy 'otros'
// ============================================================================

import type { TipoCompromiso } from '../../../../types/compromisosRecurrentes';

/** Mapping familia Personal → TipoCompromiso legacy (para compatibilidad hacia atrás) */
export const FAMILIA_TO_TIPO_LEGACY_PERSONAL: Record<string, TipoCompromiso> = {
  vivienda:        'otros',
  suministros:     'suministro',
  dia_a_dia:       'otros',
  suscripciones:   'suscripcion',
  seguros_cuotas:  'otros',
  otros:           'otros',
};

/**
 * Construye la categoria normalizada en formato "familia.subfamilia".
 * Ejemplo: buildCategoriaPersonal('suministros', 'luz') → 'suministros.luz'
 */
export function buildCategoriaPersonal(familiaId: string, subtipoId: string): string {
  return `${familiaId}.${subtipoId}`;
}
