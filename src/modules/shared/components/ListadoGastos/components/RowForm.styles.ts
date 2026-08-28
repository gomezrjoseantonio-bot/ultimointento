// Los estilos de la ficha desplegada (§3.2 · Oxford Gold V5).
//
// Viven aparte porque son doscientas líneas de tokens que no dicen nada del
// comportamiento del formulario, y con ellas dentro la ficha pasaba de las 800
// líneas que el trinquete vigila. Solo se mueven: ni un valor cambia.

import type React from 'react';

export const panel: React.CSSProperties = {
  background: 'var(--atlas-v5-card-alt)',
  borderLeft: '3px solid var(--atlas-v5-gold)',
  borderBottom: '1px solid var(--atlas-v5-line-2)',
  padding: '18px 20px 20px',
};
export const dtit: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--atlas-v5-ink-4)',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  margin: '20px 0 12px',
  paddingTop: 16,
  borderTop: '1px solid var(--atlas-v5-line-2)',
};
export const dgrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '14px 16px',
};
export const dgrid2: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: '14px 16px',
  marginTop: 14,
};
export const lab: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--atlas-v5-ink-4)',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  marginBottom: 5,
  display: 'block',
};
export const inp: React.CSSProperties = {
  width: '100%',
  border: '1px solid var(--atlas-v5-line)',
  borderRadius: 7,
  padding: '6px 9px',
  fontSize: 12.5,
  background: 'var(--atlas-v5-card)',
  color: 'var(--atlas-v5-ink)',
  fontFamily: 'var(--atlas-v5-font-ui)',
  boxSizing: 'border-box',
};
export const inpSmall: React.CSSProperties = { ...inp, width: 84 };
export const tramoRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 };
export const tramoDel: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--atlas-v5-ink-4)', cursor: 'pointer', fontSize: 16, lineHeight: 1,
};
export const btnLinkTramo: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--atlas-v5-gold-ink)', fontSize: 11.5, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'var(--atlas-v5-font-ui)', padding: 0, marginTop: 2,
};
export const fiscalInfo: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--atlas-v5-ink-3)',
  background: 'var(--atlas-v5-gold-wash)',
  border: '1px solid var(--atlas-v5-gold-soft)',
  borderRadius: 7,
  padding: '7px 10px',
  lineHeight: 1.4,
};
export const inlineRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 };
export const hint: React.CSSProperties = { fontSize: 10.5, color: 'var(--atlas-v5-ink-4)' };
export const hint2: React.CSSProperties = { fontSize: 10.5, color: 'var(--atlas-v5-ink-5)', marginTop: 5, lineHeight: 1.45 };
export const checkRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 11.5,
  color: 'var(--atlas-v5-ink-3)',
  marginTop: 10,
  cursor: 'pointer',
};
// Checkbox nativo tintado con el navy ATLAS · sin él, el navegador pinta su
// azul por defecto (fuera de paleta).
export const checkInput: React.CSSProperties = { accentColor: 'var(--atlas-v5-brand)' };
export const estadoBox: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--atlas-v5-ink-3)',
  background: 'var(--atlas-v5-card)',
  border: '1px solid var(--atlas-v5-line)',
  borderRadius: 8,
  padding: '10px 13px',
};
export const footer: React.CSSProperties = { display: 'flex', justifyContent: 'flex-end', marginTop: 18 };
export const btnGold: React.CSSProperties = {
  padding: '9px 22px',
  borderRadius: 8,
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
  border: '1px solid var(--atlas-v5-gold)',
  background: 'var(--atlas-v5-gold)',
  color: 'var(--atlas-v5-brand-ink)',
  fontFamily: 'var(--atlas-v5-font-ui)',
};

