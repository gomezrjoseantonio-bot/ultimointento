import React from 'react';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
    label?: string;
  };
  className?: string;
  onClick?: () => void;
}

const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  className = '',
  onClick
}) => {
  const isClickable = !!onClick;

  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        background: 'var(--white)',
        border: '1px solid var(--grey-200)',
        borderRadius: 'var(--r-lg)',
        padding: 24,
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'all 150ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {icon && (
          <div style={{ color: 'var(--grey-500)', flexShrink: 0 }}>
            {icon}
          </div>
        )}
        <h3 style={{
          fontSize: 'var(--t-xs)',
          fontWeight: 600,
          color: 'var(--grey-500)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          margin: 0,
        }}>
          {title}
        </h3>
      </div>

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

      {subtitle && (
        <p style={{
          fontSize: 'var(--t-sm)',
          color: 'var(--grey-500)',
          margin: 0,
        }}>
          {subtitle}
        </p>
      )}

      {trend && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
          <span style={{
            fontSize: 'var(--t-sm)',
            fontWeight: 500,
            color: trend.isPositive ? 'var(--navy-900)' : 'var(--grey-700)',
          }}>
            {trend.isPositive ? '+' : ''}{trend.value}%
          </span>
          {trend.label && (
            <span style={{ fontSize: 'var(--t-sm)', color: 'var(--grey-500)' }}>
              {trend.label}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default KpiCard;
