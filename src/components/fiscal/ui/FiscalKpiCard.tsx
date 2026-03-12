import React from 'react';

type FiscalKpiCardVariant = 'default' | 'positive' | 'negative' | 'neutral';

interface FiscalKpiCardProps {
  label: string;
  value: string;
  delta?: string;
  variant?: FiscalKpiCardVariant;
}

const getColor = (variant: FiscalKpiCardVariant) => {
  if (variant === 'positive') return 'var(--s-pos)';
  if (variant === 'negative') return 'var(--s-neg)';
  return 'var(--n-900)';
};

const FiscalKpiCard: React.FC<FiscalKpiCardProps> = ({ label, value, delta, variant = 'default' }) => {
  return (
    <article
      style={{
        background: 'var(--n-50)',
        border: '1.5px solid var(--n-200)',
        borderRadius: 'var(--r-lg)',
        padding: 'var(--s5)',
        transition: 'all 150ms ease',
      }}
    >
      <p style={{ fontSize: 'var(--t-sm)', color: 'var(--n-500)', fontFamily: 'var(--font-ui)' }}>{label}</p>
      <p style={{ fontSize: 'var(--t-2xl)', fontFamily: 'var(--font-mono)', color: getColor(variant), marginTop: 'var(--s1)' }}>{value}</p>
      {delta ? <p style={{ fontSize: 'var(--t-xs)', color: 'var(--n-300)', marginTop: 'var(--s1)' }}>{delta}</p> : null}
    </article>
  );
};

export default FiscalKpiCard;
