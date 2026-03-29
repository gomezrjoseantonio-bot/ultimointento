import React from 'react';

interface CompletenessBarProps {
  /** 0-100 completeness percentage */
  porcentaje: number;
  label?: string;
}

const CompletenessBar: React.FC<CompletenessBarProps> = ({ porcentaje, label }) => {
  const clamped = Math.max(0, Math.min(100, porcentaje));

  return (
    <div style={{ marginTop: 8 }}>
      {label && (
        <div style={{ fontSize: 'var(--t-xs, 11px)', color: 'var(--n-500)', marginBottom: 4 }}>
          {label}
        </div>
      )}
      <div style={{
        height: 6,
        borderRadius: 3,
        background: 'var(--n-100)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${clamped}%`,
          borderRadius: 3,
          background: clamped === 100 ? 'var(--s-pos)' : 'var(--s-warn)',
          transition: 'width 300ms ease',
        }} />
      </div>
      <div style={{
        fontSize: 'var(--t-xs, 11px)',
        color: 'var(--n-500)',
        marginTop: 2,
        textAlign: 'right',
      }}>
        {clamped.toFixed(0)}% completado
      </div>
    </div>
  );
};

export default CompletenessBar;
