// Rejilla de doce meses (§2.2 / §3.2). Sustituye al desplegable de "patrón de
// cobro" con presets: se marcan los meses en los que se cobra (a mano o con un
// atajo) y se fija el día. El patrón se deriva de aquí (ver `mesesToPatron`).
//
// Controlado: el padre guarda `meses` (1-12) y `dia`, y el componente los pinta.
// Los atajos SOLO marcan casillas · cualquier combinación rara se marca a mano.

import React from 'react';
import { mesesDeAtajo, type AtajoRejilla } from '../utils/rejillaMeses';

interface RejillaMesesProps {
  meses: number[]; // 1-12 marcados
  dia: number; // día del cargo (1-31)
  /** Mes de anclaje para los atajos (normalmente el del primer cobro). 1-12. */
  mesAncla?: number;
  onMesesChange: (meses: number[]) => void;
  onDiaChange: (dia: number) => void;
  disabled?: boolean;
}

const NOMBRES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const ATAJOS: Array<{ id: AtajoRejilla; label: string }> = [
  { id: 'todos', label: 'Todos los meses' },
  { id: 'cada2', label: 'Cada 2' },
  { id: 'cada3', label: 'Cada 3' },
  { id: 'cada4', label: 'Cada 4' },
  { id: 'cada6', label: 'Cada 6' },
  { id: 'unaVezAlAnio', label: 'Una vez al año' },
];

const RejillaMeses: React.FC<RejillaMesesProps> = ({
  meses,
  dia,
  mesAncla = 1,
  onMesesChange,
  onDiaChange,
  disabled = false,
}) => {
  const marcado = new Set(meses);

  const toggle = (m: number) => {
    if (disabled) return;
    const next = new Set(marcado);
    if (next.has(m)) next.delete(m);
    else next.add(m);
    onMesesChange(Array.from(next).sort((a, b) => a - b));
  };

  const aplicarAtajo = (atajo: AtajoRejilla) => {
    if (disabled) return;
    onMesesChange(mesesDeAtajo(atajo, mesAncla));
  };

  return (
    <div>
      {/* Atajos · solo marcan casillas */}
      <div style={atajosRow}>
        {ATAJOS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => aplicarAtajo(a.id)}
            disabled={disabled}
            style={atajoBtn}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Rejilla 12 meses */}
      <div style={grid} role="group" aria-label="Meses en los que se cobra">
        {NOMBRES.map((nombre, i) => {
          const m = i + 1;
          const on = marcado.has(m);
          return (
            <button
              key={m}
              type="button"
              onClick={() => toggle(m)}
              disabled={disabled}
              aria-pressed={on}
              style={{
                ...celda,
                background: on ? 'var(--atlas-v5-gold)' : 'var(--atlas-v5-card)',
                color: on ? 'var(--atlas-v5-brand-ink)' : 'var(--atlas-v5-ink-3)',
                borderColor: on ? 'var(--atlas-v5-gold)' : 'var(--atlas-v5-line)',
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              {nombre}
            </button>
          );
        })}
      </div>

      {/* Día del cargo */}
      <div style={diaRow}>
        <label style={diaLabel} htmlFor="rejilla-dia">Día del cargo</label>
        <input
          id="rejilla-dia"
          type="number"
          min={1}
          max={31}
          value={dia || ''}
          disabled={disabled}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            onDiaChange(Number.isNaN(n) ? 1 : Math.min(31, Math.max(1, n)));
          }}
          style={diaInput}
        />
        <span style={diaHint}>del mes (1-31)</span>
      </div>
    </div>
  );
};

const atajosRow: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  marginBottom: 12,
};
const atajoBtn: React.CSSProperties = {
  padding: '5px 11px',
  borderRadius: 99,
  border: '1px solid var(--atlas-v5-line)',
  background: 'var(--atlas-v5-card)',
  color: 'var(--atlas-v5-ink-3)',
  fontSize: 11.5,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--atlas-v5-font-ui)',
};
const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(6, 1fr)',
  gap: 6,
  marginBottom: 14,
};
const celda: React.CSSProperties = {
  padding: '9px 0',
  borderRadius: 8,
  border: '1px solid',
  fontSize: 12.5,
  fontWeight: 600,
  fontFamily: 'var(--atlas-v5-font-ui)',
  transition: 'all 120ms ease',
};
const diaRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
};
const diaLabel: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 600,
  color: 'var(--atlas-v5-ink-2)',
};
const diaInput: React.CSSProperties = {
  width: 72,
  padding: '7px 10px',
  borderRadius: 8,
  border: '1px solid var(--atlas-v5-line)',
  fontSize: 13,
  fontFamily: 'var(--atlas-v5-font-mono-num)',
  background: 'var(--atlas-v5-card)',
  color: 'var(--atlas-v5-ink)',
};
const diaHint: React.CSSProperties = {
  fontSize: 11.5,
  color: 'var(--atlas-v5-ink-4)',
};

export default RejillaMeses;
