// PR5 · Requisitos documentales por categoría
//
// Nota: el nombre `documentClassificationService.ts` ya estaba ocupado por un servicio
// distinto (ML · clasificación OCR). Este módulo cubre los defaults de factura y
// justificante bancario en la pantalla de Conciliación.

export type DocRequirement = 'requerido' | 'no_aplica' | 'opcional';

export interface CategoryDocDefaults {
  factura: DocRequirement;
  justificante: DocRequirement;
}

const DEFAULTS_BY_CATEGORY: Record<string, CategoryDocDefaults> = {
  // Ingresos de alquiler
  'Alquiler':               { factura: 'requerido',  justificante: 'requerido' },

  // Gastos de inmueble deducibles
  'Reparación inmueble':    { factura: 'requerido',  justificante: 'requerido' },
  'Mejora inmueble':        { factura: 'requerido',  justificante: 'requerido' },
  'Mobiliario inmueble':    { factura: 'requerido',  justificante: 'requerido' },
  'Comunidad':              { factura: 'requerido',  justificante: 'requerido' },
  'Comunidad inmueble':     { factura: 'requerido',  justificante: 'requerido' },
  'Seguro':                 { factura: 'requerido',  justificante: 'requerido' },
  'Seguro inmueble':        { factura: 'requerido',  justificante: 'requerido' },
  'Suministro':             { factura: 'requerido',  justificante: 'requerido' },
  'Suministro inmueble':    { factura: 'requerido',  justificante: 'requerido' },
  'IBI':                    { factura: 'requerido',  justificante: 'requerido' },
  'IBI inmueble':           { factura: 'requerido',  justificante: 'requerido' },
  'Basuras':                { factura: 'requerido',  justificante: 'requerido' },
  'Tributo':                { factura: 'requerido',  justificante: 'requerido' },

  // Financiación: no hay factura, solo justificante del cargo
  'Financiación':           { factura: 'no_aplica',  justificante: 'requerido' },
  'Hipoteca':               { factura: 'no_aplica',  justificante: 'requerido' },

  // Nómina: no hay factura
  'Nómina':                 { factura: 'no_aplica',  justificante: 'requerido' },

  // Personal y otros
  'Gasto personal':         { factura: 'no_aplica',  justificante: 'opcional' },
  'Personal':               { factura: 'no_aplica',  justificante: 'opcional' },
  'Traspaso interno':       { factura: 'no_aplica',  justificante: 'no_aplica' },
};

const DEFAULT_FALLBACK: CategoryDocDefaults = { factura: 'opcional', justificante: 'opcional' };

export function getDocDefaultsForCategory(categoryLabel: string | undefined | null): CategoryDocDefaults {
  if (!categoryLabel) return DEFAULT_FALLBACK;
  const normalized = categoryLabel.trim();
  return DEFAULTS_BY_CATEGORY[normalized] ?? DEFAULT_FALLBACK;
}

/**
 * Devuelve las flags `*NoAplica` a aplicar por defecto al crear o recategorizar un movimiento,
 * en función de su categoría.
 */
export function computeDocFlags(categoryLabel: string | undefined | null): {
  facturaNoAplica: boolean;
  justificanteNoAplica: boolean;
} {
  const d = getDocDefaultsForCategory(categoryLabel);
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
  categoryLabel: string | undefined | null,
  hasFactura: boolean,
  facturaNoAplica: boolean,
  hasJustificante: boolean,
  justificanteNoAplica: boolean,
): 'complete' | 'incomplete' {
  const d = getDocDefaultsForCategory(categoryLabel);
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
