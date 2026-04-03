import React from 'react';

interface SupervisionCardProps {
  title: string;
  value: string;
  detail?: string;
  children?: React.ReactNode;
}

const SupervisionCard: React.FC<SupervisionCardProps> = ({ title, value, detail, children }) => (
  <div style={{
    background: 'var(--white)',
    border: '1px solid var(--grey-200)',
    borderRadius: 'var(--r-lg)',
    padding: 'var(--space-6)',
    flex: '1 1 0',
    minWidth: 180,
  }}>
    <h3 style={{
      fontSize: 'var(--t-xs)',
      fontWeight: 600,
      color: 'var(--grey-500)',
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      margin: '0 0 8px',
    }}>
      {title}
    </h3>
    <p style={{
      fontSize: 'var(--t-xl)',
      fontWeight: 600,
      fontFamily: 'var(--font-mono)',
      fontVariantNumeric: 'tabular-nums',
      color: 'var(--grey-900)',
      margin: '0 0 4px',
    }}>
      {value}
    </p>
    {detail && (
      <p style={{
        fontSize: 'var(--t-sm)',
        color: 'var(--grey-500)',
        margin: 0,
        fontFamily: 'var(--font-mono)',
      }}>
        {detail}
      </p>
    )}
    {children}
  </div>
);

export default SupervisionCard;
