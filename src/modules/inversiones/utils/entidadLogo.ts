// T23.6.2 · Helper de logos por entidad (§Z.3 spec).
//
// Mapping de 13 entidades reconocidas + default (3 letras uppercase).
//
// ⚠️ COLORES DE MARCA EXTERNOS (§12.5 guía v5):
// Los hex literales de este archivo son colores de identidad corporativa
// de entidades terceras (bancos · brokers · exchanges). NO son parte de
// la paleta v5 de Atlas. Se concentran aquí para facilitar el mantenimiento.
// Para la paleta propia de Atlas siempre usar tokens v5 canónicos.

import type React from 'react';

export interface LogoConfig {
  /** Clase CSS que corresponde al logo (para lookup en el CSS module). */
  cls: string;
  /** Texto corto a renderizar dentro del cuadrado del logo. */
  text: string;
  /**
   * Color de fondo del logo en formato CSS. Para entidades conocidas puede
   * ser un hex literal (color de marca externo) o un token v5. Para el
   * default es `var(--atlas-v5-bg)`.
   */
  bg: string;
  /** Color de texto del logo. Blanco para fondos oscuros · token para el default. */
  color: string;
  /** Si true · no aplicar border (el fondo es suficientemente visible). */
  noBorder?: boolean;
  /** Gradient CSS, si aplica (reemplaza `bg`). */
  gradient?: string;
}

/**
 * Mapa de entidades reconocidas. La clave es el patrón de búsqueda
 * (lowercased · parcial) y el valor es la configuración del logo.
 *
 * Colores de marca externos (NO paleta v5 · ver comentario en la cabecera).
 */
const ENTIDAD_MAP: Array<{ pattern: RegExp; config: LogoConfig }> = [
  {
    pattern: /myinvestor/i,
    config: {
      cls: 'myi',
      text: 'MyI',
      bg: '#7C3AED', /* MyInvestor · mockup atlas-inversiones-v2.html:115 */
      color: '#FFFFFF',
      noBorder: true,
    },
  },
  {
    pattern: /bbva/i,
    config: {
      cls: 'bbva',
      text: 'BBV',
      bg: '#004481', /* BBVA corporate blue */
      color: '#FFFFFF',
      noBorder: true,
    },
  },
  {
    pattern: /santander/i,
    config: {
      cls: 'san',
      text: 'SAN',
      bg: '#EC0000', /* Santander corporate red */
      color: '#FFFFFF',
      noBorder: true,
    },
  },
  {
    pattern: /\bing\b/i,
    config: {
      cls: 'ing',
      text: 'ING',
      bg: '#FF6200', /* ING corporate orange */
      color: '#FFFFFF',
      noBorder: true,
    },
  },
  {
    pattern: /caixa(bank)?/i,
    config: {
      cls: 'caixa',
      text: 'CAI',
      bg: '#007FAA', /* CaixaBank corporate blue */
      color: '#FFFFFF',
      noBorder: true,
    },
  },
  {
    pattern: /sabadell/i,
    config: {
      cls: 'sab',
      text: 'SAB',
      bg: '#00497A', /* Sabadell corporate blue */
      color: '#FFFFFF',
      noBorder: true,
    },
  },
  {
    pattern: /unicaja/i,
    config: {
      cls: 'uni',
      text: 'UNJ',
      bg: '#007F3D', /* Unicaja corporate green */
      color: '#FFFFFF',
      noBorder: true,
    },
  },
  {
    pattern: /bnp\s*paribas|bnp/i,
    config: {
      cls: 'bnp',
      text: 'BNP',
      bg: '#00915A', /* BNP Paribas · mockup atlas-inversiones-v2.html:119 */
      color: '#FFFFFF',
      noBorder: true,
    },
  },
  {
    pattern: /smartflip/i,
    config: {
      cls: 'smartflip',
      text: 'SF',
      bg: '#059669', /* SmartFlip · mockup atlas-inversiones-v2.html:116 */
      color: '#FFFFFF',
      noBorder: true,
    },
  },
  {
    pattern: /unihouser/i,
    config: {
      cls: 'unihouser',
      text: 'UH',
      bg: '#B88A3E', /* Unihouser · mockup atlas-inversiones-v2.html:117 */
      color: '#FFFFFF',
      noBorder: true,
    },
  },
  {
    pattern: /indexa\s*capital|indexa/i,
    config: {
      cls: 'indexa',
      text: 'IDX',
      bg: '#2D9CDB', /* IndexaCapital corporate blue */
      color: '#FFFFFF',
      noBorder: true,
    },
  },
  {
    pattern: /coinbase/i,
    config: {
      cls: 'coinbase',
      text: 'CB',
      bg: '#0052FF', /* Coinbase corporate blue */
      color: '#FFFFFF',
      noBorder: true,
    },
  },
  {
    pattern: /binance/i,
    config: {
      cls: 'binance',
      text: 'BIN',
      bg: '#F0B90B', /* Binance corporate yellow */
      color: '#FFFFFF',
      noBorder: true,
    },
  },
];

/** Genera el texto por defecto (3 letras uppercase) para entidades no reconocidas. */
function defaultText(entidad: string): string {
  const trimmed = entidad.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/[\s/·.-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].slice(0, 3).toUpperCase();
}

/** Config por defecto para entidades no reconocidas. */
const DEFAULT_CONFIG: Omit<LogoConfig, 'text'> = {
  cls: '',
  bg: 'var(--atlas-v5-bg)',
  color: 'var(--atlas-v5-ink-2)',
  noBorder: false,
};

/**
 * Devuelve la configuración de logo para una entidad dada.
 * Usa matching por expresión regular contra la lista de entidades conocidas.
 * Si no coincide ninguna, devuelve el default (3 letras en estilo neutro).
 */
export function getEntidadLogoConfig(entidad?: string | null): LogoConfig {
  if (!entidad) return { ...DEFAULT_CONFIG, text: '?' };
  for (const { pattern, config } of ENTIDAD_MAP) {
    if (pattern.test(entidad)) return config;
  }
  return { ...DEFAULT_CONFIG, text: defaultText(entidad) };
}

/**
 * Devuelve la clase CSS del logo (vacío si es el default).
 * Wrapper de compatibilidad con el helpers.ts existente.
 */
export function getEntidadLogoClass(entidad?: string | null): string {
  return getEntidadLogoConfig(entidad).cls;
}

/**
 * Devuelve el texto del logo (iniciales o "?" si no hay entidad).
 * Wrapper de compatibilidad con el helpers.ts existente.
 */
export function getEntidadLogoText(entidad?: string | null): string {
  return getEntidadLogoConfig(entidad).text;
}

/**
 * Devuelve el estilo inline del logo (`background`, `color`, `border`).
 * Útil para logos con gradients o colores que no se pueden expresar
 * como una sola clase CSS.
 */
export function getEntidadLogoStyle(
  entidad?: string | null,
): React.CSSProperties {
  const cfg = getEntidadLogoConfig(entidad);
  return {
    background: cfg.gradient ?? cfg.bg,
    color: cfg.color,
    border: cfg.noBorder ? 'none' : '1px solid var(--atlas-v5-line)',
  };
}

