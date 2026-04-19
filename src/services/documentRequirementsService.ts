// PR5 · Requisitos documentales por categoría
//
// PR5-HOTFIX v2 · actualizado para usar `categoryKey` del catálogo canónico.
// Mantiene compatibilidad con datos previos que solo tengan `categoryLabel`
// gracias a `inferCategoryFromLegacyLabel` en categoryCatalog.
//
// Nota: el nombre `documentClassificationService.ts` ya estaba ocupado por un servicio
// distinto (ML · clasificación OCR). Este módulo cubre los defaults de factura y
// justificante bancario en la pantalla de Conciliación.

import {
  resolveCategoryFromRecord,
  TRANSFER_KEYS,
} from './categoryCatalog';

export type DocRequirement = 'requerido' | 'no_aplica' | 'opcional';

export interface CategoryDocDefaults {
  factura: DocRequirement;
  justificante: DocRequirement;
}

const DEFAULT_FALLBACK: CategoryDocDefaults = { factura: 'opcional', justificante: 'opcional' };

// Defaults por `key` del catálogo canónico.
const DEFAULTS_BY_KEY: Record<string, CategoryDocDefaults> = {
  // ── Ingresos ────────────────────────────────────────
  alquiler:              { factura: 'requerido',  justificante: 'requerido' },
  otros_ingresos:        { factura: 'opcional',   justificante: 'requerido' },

  // ── Gastos de inmueble deducibles ───────────────────
  reparacion_inmueble:   { factura: 'requerido',  justificante: 'requerido' },
  mejora_inmueble:       { factura: 'requerido',  justificante: 'requerido' },
  mobiliario_inmueble:   { factura: 'requerido',  justificante: 'requerido' },
  comunidad_inmueble:    { factura: 'requerido',  justificante: 'requerido' },
  seguro_inmueble:       { factura: 'requerido',  justificante: 'requerido' },
  suministro_inmueble:   { factura: 'requerido',  justificante: 'requerido' },
  ibi_inmueble:          { factura: 'requerido',  justificante: 'requerido' },
  basuras_inmueble:      { factura: 'requerido',  justificante: 'requerido' },
  servicio_inmueble:     { factura: 'requerido',  justificante: 'requerido' },
  otros_inmueble:        { factura: 'opcional',   justificante: 'requerido' },

  // ── Gasto personal ──────────────────────────────────
  gasto_personal:        { factura: 'no_aplica',  justificante: 'opcional' },

  // ── Traspasos internos (keys especiales, no en catálogo) ──
  [TRANSFER_KEYS.SALIDA]:  { factura: 'no_aplica', justificante: 'no_aplica' },
  [TRANSFER_KEYS.ENTRADA]: { factura: 'no_aplica', justificante: 'no_aplica' },
};

// Defaults por `label` legado — solo para datos antiguos donde no existe
// `categoryKey`. Se usa como fallback tras `resolveCategoryFromRecord`.
const LEGACY_LABEL_FALLBACKS: Record<string, CategoryDocDefaults> = {
  'Financiación':          { factura: 'no_aplica',  justificante: 'requerido' },
  'Hipoteca':              { factura: 'no_aplica',  justificante: 'requerido' },
  'Nómina':                { factura: 'no_aplica',  justificante: 'requerido' },
  'Traspaso interno':      { factura: 'no_aplica',  justificante: 'no_aplica' },
};

/**
 * Devuelve los defaults documentales para una categoría dada. Acepta tanto
 * `categoryKey` (nuevo) como `categoryLabel` (legado).
 */
export function getDocDefaultsForCategory(
  categoryLabelOrKey: string | undefined | null,
): CategoryDocDefaults {
  if (!categoryLabelOrKey) return DEFAULT_FALLBACK;
  const trimmed = categoryLabelOrKey.trim();
  if (!trimmed) return DEFAULT_FALLBACK;

  // Match directo por key (caso común en datos nuevos).
  if (DEFAULTS_BY_KEY[trimmed]) return DEFAULTS_BY_KEY[trimmed];

  // Resolver via catálogo (infiere desde label legado).
  const def = resolveCategoryFromRecord({ categoryLabel: trimmed });
  if (def && DEFAULTS_BY_KEY[def.key]) return DEFAULTS_BY_KEY[def.key];

  // Fallback por label legado fuera del catálogo (financiación / nómina / traspaso).
  if (LEGACY_LABEL_FALLBACKS[trimmed]) return LEGACY_LABEL_FALLBACKS[trimmed];

  return DEFAULT_FALLBACK;
}

/**
 * Devuelve las flags `*NoAplica` a aplicar por defecto al crear o recategorizar un movimiento,
 * en función de su categoría.
 */
export function computeDocFlags(categoryLabelOrKey: string | undefined | null): {
  facturaNoAplica: boolean;
  justificanteNoAplica: boolean;
} {
  const d = getDocDefaultsForCategory(categoryLabelOrKey);
  return {
    facturaNoAplica: d.factura === 'no_aplica',
    justificanteNoAplica: d.justificante === 'no_aplica',
  };
}

/**
 * Calcula el estado documental agregado (completo / incompleto) del movimiento
 * para pintar el conjunto de iconos en la fila de Conciliación.
 */
export function computeDocStatus(
  categoryLabelOrKey: string | undefined | null,
  hasFactura: boolean,
  facturaNoAplica: boolean,
  hasJustificante: boolean,
  justificanteNoAplica: boolean,
): 'complete' | 'incomplete' {
  const d = getDocDefaultsForCategory(categoryLabelOrKey);
  const facturaOk = d.factura !== 'requerido' || hasFactura || facturaNoAplica;
  const justificanteOk = d.justificante !== 'requerido' || hasJustificante || justificanteNoAplica;
  return (facturaOk && justificanteOk) ? 'complete' : 'incomplete';
}

/**
 * Estado individual de un slot (para renderizar el icono con uno de los 3 estilos).
 */
export function computeSlotState(
  requirement: DocRequirement,
  hasDocument: boolean,
  noAplica: boolean,
): 'attached' | 'missing' | 'not_applicable' {
  if (hasDocument) return 'attached';
  if (noAplica) return 'not_applicable';
  if (requirement === 'no_aplica') return 'not_applicable';
  return 'missing';
}
