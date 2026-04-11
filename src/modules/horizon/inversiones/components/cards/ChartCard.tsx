// ChartCard.tsx
// ATLAS HORIZON: Reusable chart wrapper card component

import React from 'react';

interface ChartCardProps {
  title: string;
  sub?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}

const ChartCard: React.FC<ChartCardProps> = ({ title, sub, children, right }) => {
  return (
    <div
      style={{
        background: 'var(--white, #fff)',
        border: '1px solid var(--grey-300, #C8D0DC)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--grey-100, #EEF1F5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--grey-700, #303A4C)',
            }}
          >
            {title}
          </div>
          {sub && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--grey-500, #6C757D)',
                marginTop: 2,
              }}
            >
              {sub}
            </div>
          )}
        </div>
        {right}
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
};

export default ChartCard;
