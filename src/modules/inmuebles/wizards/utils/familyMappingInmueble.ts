// ============================================================================
// T38 · Mapping familias Inmueble · 7 familias × tipo legacy × categoria
// ============================================================================
//
// Tabla canónica Inmueble:
//   tributos    → tipo legacy 'impuesto'  ('impuesto' existe en enum legacy)
//   comunidad   → tipo legacy 'otros'     (enum tiene 'comunidad' pero spec usa 'otros')
//   suministros → tipo legacy 'suministro'
//   seguros     → tipo legacy 'seguro'    ('seguro' existe en enum legacy)
//   gestion     → tipo legacy 'otros'
//   reparacion  → tipo legacy 'otros'
//   otros       → tipo legacy 'otros'
// ============================================================================

import type { TipoCompromiso } from '../../../../types/compromisosRecurrentes';

/** Mapping familia Inmueble → TipoCompromiso legacy (para compatibilidad hacia atrás) */
export const FAMILIA_TO_TIPO_LEGACY_INMUEBLE: Record<string, TipoCompromiso> = {
  tributos:    'impuesto',
  comunidad:   'otros',
  suministros: 'suministro',
  seguros:     'seguro',
  gestion:     'otros',
  reparacion:  'otros',
  otros:       'otros',
};

/**
 * Construye la categoria normalizada en formato "inmueble.familia.subfamilia".
 * Ejemplo: buildCategoriaInmueble('tributos', 'ibi') → 'inmueble.tributos.ibi'
 */
export function buildCategoriaInmueble(familiaId: string, subtipoId: string): string {
  return `inmueble.${familiaId}.${subtipoId}`;
}
