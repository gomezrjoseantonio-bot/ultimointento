import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';

interface Props {
  value: number;
  onChange: (año: number) => void;
  /** All available years sorted descending */
  years: number[];
}

const EjercicioPillSelector: React.FC<Props> = ({ value, onChange, years }) => {
  const [offset, setOffset] = useState(0);
  const maxVisible = 4;
  const visible = years.slice(offset, offset + maxVisible);
  const canGoBack = offset + maxVisible < years.length;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {visible.map((año) => {
        const isActive = año === value;
        return (
          <button
            key={año}
            type="button"
            onClick={() => onChange(año)}
            style={{
              padding: '6px 14px',
              borderRadius: 999,
              border: 'none',
              background: isActive ? 'var(--blue)' : 'var(--n-100)',
              color: isActive ? 'white' : 'var(--n-700)',
              fontSize: 'var(--t-sm, 13px)',
              fontWeight: 500,
              fontFamily: 'var(--font-base, IBM Plex Sans, sans-serif)',
              cursor: 'pointer',
              transition: 'all 150ms ease',
              minHeight: 32,
              minWidth: 44,
            }}
          >
            {año}
          </button>
        );
      })}
      {canGoBack && (
        <button
          type="button"
          onClick={() => setOffset((o) => Math.min(o + 1, years.length - maxVisible))}
          aria-label="Ver años anteriores"
          style={{
            padding: '6px 10px',
            borderRadius: 999,
            border: 'none',
            background: 'var(--n-100)',
            color: 'var(--n-700)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 32,
            minWidth: 32,
            transition: 'all 150ms ease',
          }}
        >
          <ChevronLeft size={16} />
        </button>
      )}
      {offset > 0 && (
        <button
          type="button"
          onClick={() => setOffset((o) => Math.max(o - 1, 0))}
          aria-label="Ver años recientes"
          style={{
            padding: '6px 10px',
            borderRadius: 999,
            border: 'none',
            background: 'var(--n-100)',
            color: 'var(--n-700)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 32,
            minWidth: 32,
            transition: 'all 150ms ease',
            transform: 'rotate(180deg)',
          }}
        >
          <ChevronLeft size={16} />
        </button>
      )}
    </div>
  );
};

export default EjercicioPillSelector;
