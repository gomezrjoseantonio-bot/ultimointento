// Seguro de vida en un inmueble con hipoteca (§4 · decisión Jose). Pregunta
// OBLIGATORIA al alta: ¿está vinculado a la hipoteca de este inmueble?
//   · Sí → gasto de FINANCIACIÓN del inmueble (deducible como financiación).
//   · No → NO pinta nada en el inmueble · se manda a gastos personales y se
//          avisa de que NO es deducible.
// No se puede cerrar sin responder: es una bifurcación, no un adorno (no hay
// overlay que descarte ni botón de cancelar · se sale eligiendo una de las dos).

import React from 'react';
import { Icons } from '../../../../../design-system/v5';

interface SeguroVidaModalProps {
  onVinculado: () => void;
  onNoVinculado: () => void;
}

const SeguroVidaModal: React.FC<SeguroVidaModalProps> = ({ onVinculado, onNoVinculado }) => {
  return (
    <>
      <div style={overlay} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label="Seguro de vida y la hipoteca" style={modal}>
        <div style={title}>El seguro de vida, ¿va con la hipoteca?</div>
        <p style={hint}>
          Un seguro de vida solo cuenta en este inmueble si lo exige la hipoteca. Elige una opción
          para continuar:
        </p>

        <button type="button" style={optSi} onClick={onVinculado}>
          <Icons.Financiacion size={18} />
          <span style={optCol}>
            <span style={optTitle}>Sí, es de la hipoteca</span>
            <span style={optSub}>Cuenta como gasto de financiación del inmueble · deducible</span>
          </span>
        </button>
        <button type="button" style={optNo} onClick={onNoVinculado}>
          <Icons.Personal size={18} />
          <span style={optCol}>
            <span style={optTitle}>No, es un seguro de vida mío</span>
            <span style={optSub}>Se guarda en tus gastos personales · no es deducible del inmueble</span>
          </span>
        </button>
      </div>
    </>
  );
};

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'var(--atlas-v5-overlay)',
  zIndex: 300,
};
const modal: React.CSSProperties = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 'min(440px, 94vw)',
  background: 'var(--atlas-v5-bg)',
  border: '1px solid var(--atlas-v5-line)',
  borderRadius: 14,
  boxShadow: 'var(--atlas-v5-shadow-modal)',
  zIndex: 301,
  padding: 22,
  fontFamily: 'var(--atlas-v5-font-ui)',
};
const title: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: 'var(--atlas-v5-ink)',
  marginBottom: 6,
};
const hint: React.CSSProperties = {
  fontSize: 12.5,
  color: 'var(--atlas-v5-ink-4)',
  marginBottom: 16,
  lineHeight: 1.5,
};
const optBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 11,
  width: '100%',
  textAlign: 'left',
  padding: '12px 14px',
  borderRadius: 10,
  border: '1px solid var(--atlas-v5-line)',
  background: 'var(--atlas-v5-card)',
  cursor: 'pointer',
  marginBottom: 10,
  fontFamily: 'var(--atlas-v5-font-ui)',
  color: 'var(--atlas-v5-ink-3)',
};
const optSi: React.CSSProperties = { ...optBase, borderLeft: '3px solid var(--atlas-v5-gold)' };
const optNo: React.CSSProperties = { ...optBase, borderLeft: '3px solid var(--atlas-v5-line)' };
const optCol: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 };
const optTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--atlas-v5-ink-2)',
};
const optSub: React.CSSProperties = {
  fontSize: 11.5,
  color: 'var(--atlas-v5-ink-4)',
  lineHeight: 1.4,
};

export default SeguroVidaModal;
