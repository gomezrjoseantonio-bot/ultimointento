// Modal de baja (§2.4). Apagar un gasto que SÍ ha tenido cargos pide la fecha
// del último cobro y el motivo: los cargos anteriores se conservan (deducibles),
// las previsiones desde esa fecha se retiran. El motivo importa porque
// "cambié de proveedor" bloquea la reactivación (§2.4).

import React, { useState } from 'react';
import type { MotivoBaja } from '../../../../../types/compromisosRecurrentes';

interface BajaModalProps {
  alias: string;
  onCancel: () => void;
  onConfirm: (fechaUltimoCobro: string, motivo: MotivoBaja) => void;
}

const MOTIVOS: Array<{ id: MotivoBaja; label: string }> = [
  { id: 'finContrato', label: 'Terminó el contrato' },
  { id: 'yaNoAplica', label: 'Ya no aplica' },
  { id: 'cambioProveedor', label: 'Cambié de proveedor (no se podrá reactivar)' },
  { id: 'otro', label: 'Otro motivo' },
];

const BajaModal: React.FC<BajaModalProps> = ({ alias, onCancel, onConfirm }) => {
  const hoy = new Date().toISOString().slice(0, 10);
  const [fecha, setFecha] = useState(hoy);
  const [motivo, setMotivo] = useState<MotivoBaja>('finContrato');

  return (
    <>
      <div style={overlay} onClick={onCancel} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label={`Dar de baja ${alias}`} style={modal}>
        <div style={title}>Dar de baja «{alias}»</div>
        <p style={hint}>
          Los cargos anteriores se conservan (siguen siendo deducibles). Las previsiones desde esta
          fecha se retiran.
        </p>

        <label style={label} htmlFor="baja-fecha">
          Fecha del último cobro
        </label>
        <input
          id="baja-fecha"
          type="date"
          value={fecha}
          max={hoy}
          onChange={(e) => setFecha(e.target.value)}
          style={input}
        />

        <label style={label} htmlFor="baja-motivo">
          Motivo
        </label>
        <select
          id="baja-motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value as MotivoBaja)}
          style={input}
        >
          {MOTIVOS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>

        <div style={actions}>
          <button type="button" style={btnGhost} onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="button"
            style={btnDanger}
            disabled={!fecha}
            onClick={() => onConfirm(fecha, motivo)}
          >
            Dar de baja
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
const btnDanger: React.CSSProperties = {
  padding: '9px 16px',
  borderRadius: 8,
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
  border: '1.5px solid var(--atlas-v5-neg)',
  background: 'var(--atlas-v5-neg)',
  color: 'var(--atlas-v5-white)',
  fontFamily: 'var(--atlas-v5-font-ui)',
};

export default BajaModal;
