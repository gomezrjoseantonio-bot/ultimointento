// PR5 · Requisitos documentales por clasificación
//
// E2.4.1c · los defaults se deciden por la FAMILIA del catálogo único (y la
// naturaleza para lo que no lleva familia), no por una key del árbol viejo.
//
// Nota: el nombre `documentClassificationService.ts` ya estaba ocupado por un servicio
// distinto (ML · clasificación OCR). Este módulo cubre los defaults de factura y
// justificante bancario en la pantalla de Conciliación.

import { familiaPorId, type FamiliaId, type Naturaleza } from './catalogo/catalogoUnico';

export type DocRequirement = 'requerido' | 'no_aplica' | 'opcional';

export interface CategoryDocDefaults {
  factura: DocRequirement;
  justificante: DocRequirement;
}

const DEFAULT_FALLBACK: CategoryDocDefaults = { factura: 'opcional', justificante: 'opcional' };

const REQUERIDOS: CategoryDocDefaults = { factura: 'requerido', justificante: 'requerido' };
const SOLO_JUSTIFICANTE: CategoryDocDefaults = { factura: 'no_aplica', justificante: 'requerido' };
const NADA: CategoryDocDefaults = { factura: 'no_aplica', justificante: 'no_aplica' };

// Defaults por familia del catálogo único.
const DEFAULTS_POR_FAMILIA: Partial<Record<FamiliaId, CategoryDocDefaults>> = {
  // ── Ingresos ────────────────────────────────────────
  alquiler:        REQUERIDOS,
  otros_ingresos:  { factura: 'opcional', justificante: 'requerido' },
  nomina:          SOLO_JUSTIFICANTE,
  pension:         SOLO_JUSTIFICANTE,
  // ── Gastos de inmueble deducibles · factura y justificante ──
  reparacion_mantenimiento: REQUERIDOS,
  reforma_mejora:           REQUERIDOS,
  mobiliario_enseres:       REQUERIDOS,
  comunidad:                REQUERIDOS,
  seguros_alarmas:          REQUERIDOS,
  suministro:               REQUERIDOS,
  impuestos_tasas:          REQUERIDOS,
  gestion:                  REQUERIDOS,
  limpieza:                 REQUERIDOS,
  // ── Financiación · el banco no factura ──
  prestamo_hipoteca:        SOLO_JUSTIFICANTE,
  comisiones_bancarias:     SOLO_JUSTIFICANTE,
  // ── Interno · ni factura ni justificante ──
  traspaso:                 NADA,
  aportacion:               NADA,
  disposicion_prestamo:     SOLO_JUSTIFICANTE,
  fianza:                   SOLO_JUSTIFICANTE,
};

export interface ClasificacionDoc {
  familia?: FamiliaId | string | null;
  naturaleza?: Naturaleza | null;
  ambito?: 'personal' | 'inmueble' | null;
}

/** Devuelve los defaults documentales para una clasificación. */
export function getDocDefaultsForCategory(c: ClasificacionDoc | string | undefined | null): CategoryDocDefaults {
  const clas: ClasificacionDoc = typeof c === 'string' ? { familia: c } : (c ?? {});
  if (clas.naturaleza === 'movimiento_interno' && !clas.familia) return NADA;
  const familia = clas.familia && familiaPorId(clas.familia) ? (clas.familia as FamiliaId) : undefined;
  if (familia && DEFAULTS_POR_FAMILIA[familia]) return DEFAULTS_POR_FAMILIA[familia]!;
  // Un gasto personal no se declara · sin factura que exigir.
  if (clas.naturaleza === 'gasto' && clas.ambito === 'personal') {
    return { factura: 'no_aplica', justificante: 'opcional' };
  }
  return DEFAULT_FALLBACK;
}

/**
 * Devuelve las flags `*NoAplica` a aplicar por defecto al crear o recategorizar un movimiento,
 * en función de su clasificación.
 */
export function computeDocFlags(c: ClasificacionDoc | string | undefined | null): {
  facturaNoAplica: boolean;
  justificanteNoAplica: boolean;
} {
  const d = getDocDefaultsForCategory(c);
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
  c: ClasificacionDoc | string | undefined | null,
  hasFactura: boolean,
  facturaNoAplica: boolean,
  hasJustificante: boolean,
  justificanteNoAplica: boolean,
): 'complete' | 'incomplete' {
  const d = getDocDefaultsForCategory(c);
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
