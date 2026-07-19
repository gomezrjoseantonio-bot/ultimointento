// src/pages/GestionInmuebles/venta/wizardStyles.ts
// Tokens y helpers compartidos por los 3 pasos del wizard de venta.
// Paleta V4: navy-900 + teal-600 + escala grey, IBM Plex Sans/Mono.

import type { CSSProperties } from 'react';

export const W = {
  navy900: 'var(--atlas-v5-brand)',
  navy800: 'var(--atlas-v5-brand)',
  teal600: 'var(--atlas-v5-brand)',
  teal100: 'var(--atlas-v5-brand-wash)',
  grey50: 'var(--atlas-v5-bg)',
  grey100: 'var(--atlas-v5-line-2)',
  grey200: 'var(--atlas-v5-line)',
  grey300: 'var(--atlas-v5-ink-5)',
  grey500: 'var(--atlas-v5-ink-3)',
  grey700: 'var(--atlas-v5-ink-2)',
  grey900: 'var(--atlas-v5-ink)',
  white: 'var(--atlas-v5-white)',
};

export const fontFamily = "'IBM Plex Sans', system-ui, sans-serif";
export const monoFontFamily = "'IBM Plex Mono', monospace";

export const fmtEuro = (n: number | null | undefined): string => {
  if (n == null || Number.isNaN(n)) return '—';
  return (
    new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n) + ' €'
  );
};

export const fmtEuroSigned = (n: number | null | undefined): string => {
  if (n == null || Number.isNaN(n)) return '—';
  const prefix = n > 0 ? '+' : '';
  return prefix + fmtEuro(n);
};

export const fmtDate = (iso?: string): string => {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return '—';
  return `${d}/${m}/${y}`;
};

export const inputStyle: CSSProperties = {
  width: '100%',
  height: 34,
  padding: '6px 10px',
  border: `1px solid ${W.grey300}`,
  borderRadius: 6,
  fontSize: 13,
  color: W.grey900,
  fontFamily,
  background: W.white,
  outline: 'none',
  boxSizing: 'border-box',
};

export const labelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: W.grey500,
  textTransform: 'uppercase',
  letterSpacing: '.04em',
  marginBottom: 4,
  display: 'block',
};

export const sectionStyle: CSSProperties = {
  background: W.white,
  border: `1px solid ${W.grey200}`,
  borderRadius: 12,
  padding: 20,
  marginBottom: 16,
};

export const sectionTitleStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  color: W.grey500,
  letterSpacing: '.06em',
  marginBottom: 12,
};

export const primaryButtonStyle: CSSProperties = {
  padding: '10px 20px',
  border: 'none',
  background: W.navy900,
  color: W.white,
  fontSize: 13,
  fontWeight: 500,
  borderRadius: 8,
  cursor: 'pointer',
  fontFamily,
};

export const secondaryButtonStyle: CSSProperties = {
  padding: '10px 20px',
  border: `1.5px solid ${W.grey300}`,
  background: W.white,
  color: W.grey700,
  fontSize: 13,
  fontWeight: 500,
  borderRadius: 8,
  cursor: 'pointer',
  fontFamily,
};
