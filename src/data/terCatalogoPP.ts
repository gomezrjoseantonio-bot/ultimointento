// T-FICHA-PP-PULIDO v1 · Bug #1 · catálogo curado de TER (Total Expense Ratio)
// de planes de pensiones conocidos en España.
//
// Origen híbrido B+C · catálogo manual para gestoras conocidas + override
// manual por usuario. El flujo de resolución (`resolveTerPlan` en
// `planesPensionesService`) prioriza · override del usuario > catálogo >
// sin dato (CTA "consulta a tu gestora").
//
// El matching contra `PlanPensiones` se hace por normalización del campo
// `gestoraActual` y `nombre` actuales (sin DB bump · sin cambio de alta).

import type { TipoAdministrativo } from '../types/planesPensiones';

export interface TerCatalogoEntry {
  /** Slug normalizado · 'myinvestor', 'indexa', 'bbva', 'ing', ... */
  gestoraId: string;
  /** Display name · 'myinvestor', 'Indexa Capital', 'BBVA', ... */
  gestoraNombre: string;
  /** Slug normalizado · 'indexado-sp500', 'plan-orange', ... */
  planSlug: string;
  planNombre: string;
  tipoPlan: TipoAdministrativo;
  /** % anual · 0.43 = 0,43%. */
  ter: number;
  /** Fuente del dato · web oficial gestora o comparador. */
  fuente: string;
  /** ISO yyyy-mm-dd · fecha de revisión manual del catálogo. */
  fechaActualizacion: string;
}

/**
 * Normaliza una cadena a slug · lowercase, sin tildes/diacríticos, símbolos
 * a guiones, una sola guión consecutivo, sin guión inicial/final. Aplica
 * tanto a gestora como a nombre de plan.
 */
export function normalizeGestoraSlug(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const normalizePlanSlug = normalizeGestoraSlug;

export const TER_CATALOGO_PP: TerCatalogoEntry[] = [
  // === myinvestor (PPI low-cost) ===
  {
    gestoraId: 'myinvestor',
    gestoraNombre: 'myinvestor',
    planSlug: 'indexado-s-p-500',
    planNombre: 'Indexado S&P 500',
    tipoPlan: 'PPI',
    ter: 0.43,
    fuente: 'myinvestor.es',
    fechaActualizacion: '2026-05-19',
  },
  {
    gestoraId: 'myinvestor',
    gestoraNombre: 'myinvestor',
    planSlug: 'indexado-global',
    planNombre: 'Indexado Global',
    tipoPlan: 'PPI',
    ter: 0.43,
    fuente: 'myinvestor.es',
    fechaActualizacion: '2026-05-19',
  },
  // === Indexa Capital (PPI low-cost) ===
  {
    gestoraId: 'indexa-capital',
    gestoraNombre: 'Indexa Capital',
    planSlug: 'plan-de-pensiones-indexa',
    planNombre: 'Plan de Pensiones Indexa',
    tipoPlan: 'PPI',
    ter: 0.5,
    fuente: 'indexacapital.com',
    fechaActualizacion: '2026-05-19',
  },
  // === BBVA (PPE Plan Orange · alto coste típico) ===
  {
    gestoraId: 'bbva',
    gestoraNombre: 'BBVA',
    planSlug: 'plan-orange',
    planNombre: 'Plan Orange',
    tipoPlan: 'PPE',
    ter: 1.5,
    fuente: 'bbva.es',
    fechaActualizacion: '2026-05-19',
  },
  {
    gestoraId: 'bbva',
    gestoraNombre: 'BBVA',
    planSlug: 'plan-quality',
    planNombre: 'Plan Quality',
    tipoPlan: 'PPI',
    ter: 1.5,
    fuente: 'bbva.es',
    fechaActualizacion: '2026-05-19',
  },
  // === ING ===
  {
    gestoraId: 'ing',
    gestoraNombre: 'ING',
    planSlug: 'plan-naranja-pensiones',
    planNombre: 'Plan Naranja Pensiones',
    tipoPlan: 'PPI',
    ter: 1.25,
    fuente: 'ing.es',
    fechaActualizacion: '2026-05-19',
  },
  // === Finizens ===
  {
    gestoraId: 'finizens',
    gestoraNombre: 'Finizens',
    planSlug: 'plan-de-pensiones-finizens',
    planNombre: 'Plan de Pensiones Finizens',
    tipoPlan: 'PPI',
    ter: 0.61,
    fuente: 'finizens.com',
    fechaActualizacion: '2026-05-19',
  },
  // === Mapfre (PPE clásicos) ===
  {
    gestoraId: 'mapfre',
    gestoraNombre: 'Mapfre',
    planSlug: 'plan-de-pensiones-mapfre-empleo',
    planNombre: 'Plan de Pensiones Mapfre Empleo',
    tipoPlan: 'PPE',
    ter: 1.4,
    fuente: 'mapfre.es',
    fechaActualizacion: '2026-05-19',
  },
  // === Bestinver ===
  {
    gestoraId: 'bestinver',
    gestoraNombre: 'Bestinver',
    planSlug: 'bestinver-global',
    planNombre: 'Bestinver Global',
    tipoPlan: 'PPI',
    ter: 1.75,
    fuente: 'bestinver.es',
    fechaActualizacion: '2026-05-19',
  },
];

/**
 * Busca el TER catalogado para un plan dado. Match estricto por
 * `(gestoraId, planSlug)`. Si no encuentra · null.
 */
export function lookupTerCatalogo(
  gestoraId: string,
  planSlug: string,
): TerCatalogoEntry | null {
  if (!gestoraId || !planSlug) return null;
  return (
    TER_CATALOGO_PP.find(
      (e) => e.gestoraId === gestoraId && e.planSlug === planSlug,
    ) ?? null
  );
}

/**
 * Variante "loose" · normaliza nombre de gestora y plan antes de buscar.
 * Usada por `resolveTerPlan` para hacer match desde los campos actuales
 * del plan sin requerir migración (`gestoraActual`, `nombre`).
 */
export function lookupTerCatalogoFromNames(
  gestoraNombre: string | null | undefined,
  planNombre: string | null | undefined,
): TerCatalogoEntry | null {
  const g = normalizeGestoraSlug(gestoraNombre);
  const p = normalizePlanSlug(planNombre);
  if (!g || !p) return null;
  return lookupTerCatalogo(g, p);
}

/**
 * TER medio de mercado por tipo de plan · fallback estadístico cuando no
 * hay match en catálogo. Usado SOLO para comparativos visuales · NO como
 * dato del plan.
 */
export const TER_MEDIA_MERCADO: Record<TipoAdministrativo, number> = {
  PPI: 1.1,
  PPE: 1.35,
  PPES: 0.8,
  PPA: 1.2,
};
