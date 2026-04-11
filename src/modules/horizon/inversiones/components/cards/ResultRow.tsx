// ResultRow.tsx
// ATLAS HORIZON: Reusable result row component for summary displays

import React from 'react';

interface ResultRowProps {
  label: string;
  value: string;
  valueColor?: string;
  bold?: boolean;
}

const ResultRow: React.FC<ResultRowProps> = ({ label, value, valueColor, bold }) => {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        padding: '10px 0',
        borderBottom: '1px solid var(--grey-100, #EEF1F5)',
      }}
    >
      <span
        style={{
          fontSize: 13,
          color: bold ? 'var(--grey-700, #303A4C)' : 'var(--grey-500, #6C757D)',
          fontWeight: bold ? 700 : 400,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 13,
          fontWeight: 600,
          color: valueColor ?? 'var(--grey-700, #303A4C)',
        }}
      >
        {value}
      </span>
    </div>
  );
};

export default ResultRow;
