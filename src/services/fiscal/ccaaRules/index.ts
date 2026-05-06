// ============================================================================
// ATLAS · TAREA 18.0 · Registro de reglas por CCAA + lookup con fallback
// ============================================================================
//
// Mapa `Map<string, CcaaRules>` indexado por nombre normalizado · resuelve
// variantes regionales (`Cataluña`/`Catalunya` · `Comunidad de Madrid`/
// `Madrid`).
//
// Política · si la CCAA no está implementada todavía (o el nombre no
// reconocible), `getReglasCcaa` devuelve `BASE_ESTATAL_RULES` y emite un
// warning en consola con el original recibido. ATLAS NUNCA crashea por
// CCAA desconocida.
//
// T18.0 incluye solo Madrid · resto de CCAA se incorporan en T18.1-T18.3.
// ============================================================================

import type { CcaaRules } from '../tipos';
import { BASE_ESTATAL_RULES } from './_base_estatal';
import { MADRID_RULES } from './madrid';

// Normalizador · NFD + sin diacríticos + lowercase + trim · resiste
// 'Cataluña' · 'Catalunya' · 'CATALUÑA' · 'comunidad de madrid'.
function normalizeCcaaKey(input: string | null | undefined): string | null {
  if (!input || typeof input !== 'string') return null;
  const cleaned = input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
  if (!cleaned) return null;

  // Aliases conocidos · centralizados aquí · NUNCA inventar fonetiquismos.
  if (cleaned.includes('madrid')) return 'madrid';
  if (cleaned.includes('catalu')) return 'cataluna'; // Cataluña / Catalunya
  if (cleaned.includes('asturi')) return 'asturias'; // Asturies / Asturias
  if (cleaned.includes('andalu')) return 'andalucia';
  if (cleaned.includes('arago')) return 'aragon';
  if (cleaned.includes('balear')) return 'baleares';
  if (cleaned.includes('canari')) return 'canarias';
  if (cleaned.includes('cantabri')) return 'cantabria';
  if (cleaned.includes('castilla') && cleaned.includes('mancha')) return 'castilla_la_mancha';
  if (cleaned.includes('castilla') && cleaned.includes('leon')) return 'castilla_y_leon';
  if (cleaned.includes('extremadu')) return 'extremadura';
  if (cleaned.includes('galici')) return 'galicia';
  if (cleaned.includes('murcia')) return 'murcia';
  if (cleaned.includes('rioja')) return 'la_rioja';
  if (cleaned.includes('valenci')) return 'valencia';
  // No matched · devolvemos cleaned para no perder la pista
  return cleaned;
}

// Mapa de paquetes · solo Madrid en T18.0 · resto se añadirán en T18.1-T18.3.
const CCAA_RULES_MAP = new Map<string, CcaaRules>([
  ['madrid', MADRID_RULES],
]);

/**
 * Devuelve el paquete `CcaaRules` para la CCAA del titular.
 * - Si está implementada · devuelve el paquete específico.
 * - Si no · devuelve `BASE_ESTATAL_RULES` y emite warning en consola.
 *
 * Esta función NUNCA lanza excepción · garantía de fallback.
 */
export function getReglasCcaa(ccaa: string | null | undefined): CcaaRules {
  const key = normalizeCcaaKey(ccaa);
  if (!key) {
    if (typeof console !== 'undefined') {
      // CCAA no informada · es un caso esperado (gateway emite el warning
      // canónico) · no spammeamos logs.
    }
    return BASE_ESTATAL_RULES;
  }

  const rules = CCAA_RULES_MAP.get(key);
  if (!rules) {
    if (typeof console !== 'undefined') {
      console.warn(
        `[fiscal/ccaaRules] CCAA no implementada · "${ccaa}" (normalizada · "${key}") · usando fallback estatal · TODO T18.1-T18.3 cubrirá las 14 CCAA pendientes.`,
      );
    }
    return BASE_ESTATAL_RULES;
  }

  return rules;
}

/**
 * Lista las claves implementadas · útil para tests y diagnóstico.
 */
export function listarCcaaImplementadas(): string[] {
  return Array.from(CCAA_RULES_MAP.keys());
}
