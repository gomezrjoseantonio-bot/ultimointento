import React from 'react';
import type { SortField, SortDir } from '../ListadoGastosRecurrentes.types';

interface SortableHeaderProps {
  field: SortField;
  label: string;
  current: { field: SortField | null; dir: SortDir };
  onSort: (field: SortField) => void;
  style?: React.CSSProperties;
}

const SortableHeader: React.FC<SortableHeaderProps> = ({ field, label, current, onSort, style }) => {
  const isActive = current.field === field;
  return (
    <th
      style={{ ...thBase, cursor: 'pointer', userSelect: 'none', ...style }}
      onClick={() => onSort(field)}
      aria-sort={isActive ? (current.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {label}
        <span
          style={{
            color: isActive ? 'var(--atlas-v5-brand)' : 'var(--atlas-v5-ink-5)',
            fontSize: 10,
          }}
        >
          {isActive ? (current.dir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </span>
    </th>
  );
};

const thBase: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 8px',
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--atlas-v5-ink-4)',
};

export default SortableHeader;
