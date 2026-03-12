import React from 'react';

interface FiscalCoverageBarProps {
  label: string;
  value: number;
  colorVar?: string;
}

const FiscalCoverageBar: React.FC<FiscalCoverageBarProps> = ({ label, value, colorVar = '--blue' }) => {
  const pct = Math.round(value * 100);
  return (
    <div style={{ display: 'grid', gap: 'var(--s1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--t-sm)', color: 'var(--n-700)' }}>
        <span>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)' }}>{pct}%</span>
      </div>
      <div style={{ height: '6px', background: 'var(--n-200)', borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
        <div
          style={{
            width: `${Math.max(0, Math.min(100, value * 100))}%`,
            height: '100%',
            background: `var(${colorVar})`,
            borderRadius: 'var(--r-sm)',
            transition: 'all 300ms ease',
          }}
        />
      </div>
    </div>
  );
};

export default FiscalCoverageBar;
