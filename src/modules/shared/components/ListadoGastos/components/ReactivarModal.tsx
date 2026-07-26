// Modal de reactivación (§2.4). El mismo servicio vuelve: se reactiva con una
// fecha de nuevo cobro y se proyecta desde ahí. El hueco entre la baja y el
// nuevo cobro queda vacío —esa es la verdad— y se conservan CUPS, contrato,
// historial y cadena fiscal.

import React, { useState } from 'react';

interface ReactivarModalProps {
  alias: string;
  onCancel: () => void;
  onConfirm: (fechaNuevoCobro: string) => void;
}

const ReactivarModal: React.FC<ReactivarModalProps> = ({ alias, onCancel, onConfirm }) => {
  const hoy = new Date().toISOString().slice(0, 10);
  const [fecha, setFecha] = useState(hoy);

  return (
    <>
      <div style={overlay} onClick={onCancel} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label={`Reactivar ${alias}`} style={modal}>
        <div style={title}>Reactivar «{alias}»</div>
        <p style={hint}>
          Se retoma la proyección desde el nuevo cobro. Los meses entre la baja y esta fecha quedan
          como hueco sin previsión —correcto—; se conservan el historial y la referencia (CUPS /
          contrato).
        </p>

        <label style={label} htmlFor="reactivar-fecha">
          Fecha del nuevo cobro
        </label>
        <input
          id="reactivar-fecha"
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          style={input}
        />

        <div style={actions}>
          <button type="button" style={btnGhost} onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" style={btnGold} disabled={!fecha} onClick={() => onConfirm(fecha)}>
            Reactivar
          </button>
        </div>
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
  width: 'min(420px, 92vw)',
  background: 'var(--atlas-v5-bg)',
  border: '1px solid var(--atlas-v5-line)',
  borderRadius: 14,
  boxShadow: 'var(--atlas-v5-shadow-modal)',
  zIndex: 301,
  padding: 24,
  fontFamily: 'var(--atlas-v5-font-ui)',
};
const title: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: 'var(--atlas-v5-ink)',
  marginBottom: 8,
};
const hint: React.CSSProperties = {
  fontSize: 12.5,
  color: 'var(--atlas-v5-ink-3)',
  lineHeight: 1.5,
  marginBottom: 16,
};
const label: React.CSSProperties = {
  display: 'block',
  fontSize: 12.5,
  fontWeight: 600,
  color: 'var(--atlas-v5-ink-2)',
  marginBottom: 6,
  marginTop: 12,
};
const input: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 8,
  border: '1px solid var(--atlas-v5-line)',
  fontSize: 13,
  background: 'var(--atlas-v5-card)',
  color: 'var(--atlas-v5-ink)',
  fontFamily: 'var(--atlas-v5-font-ui)',
  boxSizing: 'border-box',
};
const actions: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 10,
  marginTop: 22,
};
const btnGhost: React.CSSProperties = {
  padding: '9px 16px',
  borderRadius: 8,
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
  border: '1px solid var(--atlas-v5-line)',
  background: 'var(--atlas-v5-card)',
  color: 'var(--atlas-v5-ink-3)',
  fontFamily: 'var(--atlas-v5-font-ui)',
};
const btnGold: React.CSSProperties = {
  padding: '9px 16px',
  borderRadius: 8,
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
  border: '1.5px solid var(--atlas-v5-gold)',
  background: 'var(--atlas-v5-gold)',
  color: 'var(--atlas-v5-white)',
  fontFamily: 'var(--atlas-v5-font-ui)',
};

export default ReactivarModal;
