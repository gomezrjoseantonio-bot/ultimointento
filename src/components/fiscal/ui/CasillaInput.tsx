import React from 'react';

interface CasillaInputProps {
  casilla: string;
  label: string;
  value?: number;
  onChange: (value: number) => void;
  optional?: boolean;
}

const CasillaInput: React.FC<CasillaInputProps> = ({
  casilla,
  label,
  value,
  onChange,
  optional = false,
}) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: '64px 1fr 140px',
      gap: '0.75rem',
      alignItems: 'center',
    }}
  >
    <span
      style={{
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: '0.75rem',
        color: 'var(--hz-neutral-700)',
        background: 'var(--hz-neutral-100)',
        padding: '0.25rem 0.45rem',
        borderRadius: '6px',
        textAlign: 'center',
        border: '1px solid var(--hz-neutral-300)',
      }}
    >
      {casilla}
    </span>
    <label style={{ fontSize: '0.9rem', color: 'var(--atlas-navy-1)' }}>
      {label}
      {optional && (
        <span style={{ color: 'var(--hz-neutral-500)', marginLeft: '0.25rem' }}>
          (opcional)
        </span>
      )}
    </label>
    <input
      type="number"
      step="0.01"
      value={value || ''}
      onChange={(event) => onChange(parseFloat(event.target.value) || 0)}
      placeholder="0,00"
      style={{
        padding: '0.55rem 0.75rem',
        border: '1px solid var(--hz-neutral-300)',
        borderRadius: '8px',
        fontFamily: 'IBM Plex Mono, monospace',
        textAlign: 'right',
      }}
    />
  </div>
);

export default CasillaInput;
