import React from 'react';

interface FiscalChipProps {
  label: string;
  variant: 'pos' | 'neg' | 'warn' | 'neu';
}

const palette = {
  pos: { background: 'var(--s-pos-bg)', color: 'var(--s-pos)' },
  neg: { background: 'var(--s-neg-bg)', color: 'var(--s-neg)' },
  warn: { background: 'var(--s-warn-bg)', color: 'var(--s-warn)' },
  neu: { background: 'var(--s-neu-bg)', color: 'var(--s-neu)' },
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
