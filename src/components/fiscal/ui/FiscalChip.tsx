import React from 'react';

interface FiscalChipProps {
  label: string;
  variant: 'pos' | 'neg' | 'warn' | 'neu';
}

const palette = {
  pos: { background: 'var(--n-100)', color: 'var(--blue)' },
  neg: { background: 'var(--n-100)', color: 'var(--teal)' },
  warn: { background: 'var(--n-100)', color: 'var(--n-700)' },
  neu: { background: 'var(--n-100)', color: 'var(--n-500)' },
};

const FiscalChip: React.FC<FiscalChipProps> = ({ label, variant }) => {
  return (
    <span
      style={{
        padding: '3px 10px',
        borderRadius: 'var(--r-sm)',
        fontSize: 'var(--t-xs)',
        fontWeight: 600,
        background: palette[variant].background,
        color: palette[variant].color,
        transition: 'all 150ms ease',
      }}
    >
      {label}
    </span>
  );
};

export default FiscalChip;
