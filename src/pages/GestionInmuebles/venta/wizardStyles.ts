// src/pages/GestionInmuebles/venta/wizardStyles.ts
// Tokens y helpers compartidos por los 3 pasos del wizard de venta.
// Paleta V4: navy-900 + teal-600 + escala grey, IBM Plex Sans/Mono.

export const W = {
  navy900: 'var(--navy-900, #042C5E)',
  navy800: 'var(--navy-800, #0A3F7A)',
  teal600: 'var(--teal-600, #00A7B5)',
  teal100: 'var(--teal-100, #E0F7F9)',
  grey50: 'var(--grey-50, #F8F9FA)',
  grey100: 'var(--grey-100, #EEF1F5)',
  grey200: 'var(--grey-200, #DDE3EC)',
  grey300: 'var(--grey-300, #C8D0DC)',
  grey500: 'var(--grey-500, #6C757D)',
  grey700: 'var(--grey-700, #303A4C)',
  grey900: 'var(--grey-900, #1A2332)',
  white: '#FFFFFF',
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

export const inputStyle: React.CSSProperties = {
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

export const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: W.grey500,
  textTransform: 'uppercase',
  letterSpacing: '.04em',
  marginBottom: 4,
  display: 'block',
};

export const sectionStyle: React.CSSProperties = {
  background: W.white,
  border: `1px solid ${W.grey200}`,
  borderRadius: 12,
  padding: 20,
  marginBottom: 16,
};

export const sectionTitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  color: W.grey500,
  letterSpacing: '.06em',
  marginBottom: 12,
};

export const primaryButtonStyle: React.CSSProperties = {
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

export const secondaryButtonStyle: React.CSSProperties = {
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
