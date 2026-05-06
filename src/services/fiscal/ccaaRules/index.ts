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
import { CATALUNA_RULES } from './cataluna';
import { ANDALUCIA_RULES } from './andalucia';
import { VALENCIA_RULES } from './valencia';
import { BALEARES_RULES } from './baleares';
import { CASTILLA_Y_LEON_RULES } from './castilla_y_leon';
import { GALICIA_RULES } from './galicia';
import { ARAGON_RULES } from './aragon';
import { ASTURIAS_RULES } from './asturias';
import { MURCIA_RULES } from './murcia';
import { CANTABRIA_RULES } from './cantabria';
import { CANARIAS_RULES } from './canarias';
import { CASTILLA_LA_MANCHA_RULES } from './castilla_la_mancha';
import { EXTREMADURA_RULES } from './extremadura';
import { LA_RIOJA_RULES } from './la_rioja';

// Regex de combining diacritics (U+0300 a U+036F) construido vía
// `RegExp` con escapes Unicode string · evita caracteres combining
// literales en el source (algunos linters/parsers de CRA los rechazan).
const COMBINING_DIACRITICS_RE = new RegExp('[\\u0300-\\u036F]', 'g');

// Normalizador · NFD + sin diacríticos + lowercase + trim · resiste
// 'Cataluña' · 'Catalunya' · 'CATALUÑA' · 'comunidad de madrid' ·
// 'Comunitat Valenciana' · 'Illes Balears'.
export function normalizeCcaaKey(input: string | null | undefined): string | null {
  if (!input || typeof input !== 'string') return null;
  const cleaned = input
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS_RE, '')
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

// Mapa de paquetes · 15 CCAA régimen común cubiertas (T18 cerrada).
// Quedan FUERA · País Vasco (3 territorios forales) · Navarra · IRPF foral
// · TAREA futura cuando aparezca cliente real.
const CCAA_RULES_MAP = new Map<string, CcaaRules>([
  ['madrid', MADRID_RULES],
  ['cataluna', CATALUNA_RULES],
  ['andalucia', ANDALUCIA_RULES],
  ['valencia', VALENCIA_RULES],
  ['baleares', BALEARES_RULES],
  ['castilla_y_leon', CASTILLA_Y_LEON_RULES],
  ['galicia', GALICIA_RULES],
  ['aragon', ARAGON_RULES],
  ['asturias', ASTURIAS_RULES],
  ['murcia', MURCIA_RULES],
  ['cantabria', CANTABRIA_RULES],
  ['canarias', CANARIAS_RULES],
  ['castilla_la_mancha', CASTILLA_LA_MANCHA_RULES],
  ['extremadura', EXTREMADURA_RULES],
  ['la_rioja', LA_RIOJA_RULES],
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
    // CCAA no informada · caso esperado (gateway emite el warning canónico)
    // · NO spammeamos logs aquí.
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
