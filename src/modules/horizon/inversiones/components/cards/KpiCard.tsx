// KpiCard.tsx
// ATLAS HORIZON: Reusable KPI card component for investments dashboard

import React from 'react';

interface KpiCardProps {
  label: string;
  value: string;
  meta?: React.ReactNode;
  accentColor?: string;
  iconBg?: string;
  icon?: React.ElementType;
  valueColor?: string;
}

const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  meta,
  accentColor,
  iconBg,
  icon: Icon,
  valueColor,
}) => {
  return (
    <div
      style={{
        background: 'var(--white, #fff)',
        border: '1px solid var(--grey-300, #C8D0DC)',
        borderRadius: 12,
        padding: 20,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {accentColor && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: accentColor,
          }}
        />
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '.06em',
            textTransform: 'uppercase',
            color: 'var(--grey-500, #6C757D)',
          }}
        >
          {label}
        </span>
        {Icon && (
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: iconBg ?? 'rgba(4,44,94,.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon size={16} />
          </div>
        )}
      </div>
      <div
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 32,
          fontWeight: 600,
          lineHeight: 1,
          marginBottom: 5,
          color: valueColor ?? 'var(--grey-700, #303A4C)',
        }}
      >
        {value}
      </div>
      {meta && (
        <div style={{ fontSize: 12, color: 'var(--grey-500, #6C757D)' }}>
          {meta}
        </div>
      )}
    </div>
  );
};

export default KpiCard;
