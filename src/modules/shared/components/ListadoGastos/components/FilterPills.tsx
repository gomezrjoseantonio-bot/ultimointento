import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface FamilyOption {
  id: string;
  label: string;
  icon?: LucideIcon;
  count: number;
}

interface FilterPillsProps {
  options: FamilyOption[];
  active: string | null;
  total: number;
  onChange: (id: string | null) => void;
}

const FilterPills: React.FC<FilterPillsProps> = ({ options, active, total, onChange }) => {
  return (
    <div role="group" aria-label="Filtros por familia" style={containerStyle}>
      <button
        type="button"
        aria-pressed={active === null}
        style={pillStyle(active === null)}
        onClick={() => onChange(null)}
      >
        Todos
        <span style={countStyle(active === null)}>{total}</span>
      </button>
      {options.map((opt) => {
        const isActive = active === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={isActive}
            style={pillStyle(isActive)}
            onClick={() => onChange(opt.id)}
          >
            {opt.icon &&
              React.createElement(opt.icon, {
                size: 12,
                strokeWidth: 1.8,
                style: { flexShrink: 0 },
              })}
            {opt.label}
            {opt.count > 0 && <span style={countStyle(isActive)}>{opt.count}</span>}
          </button>
        );
      })}
    </div>
  );
};

const containerStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
  alignItems: 'center',
};

const pillStyle = (active: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  padding: '7px 14px',
  borderRadius: 99,
  fontSize: 12.5,
  fontWeight: 500,
  fontFamily: 'var(--atlas-v5-font-ui)',
  cursor: 'pointer',
  border: `1px solid ${active ? 'var(--atlas-v5-brand-ink)' : 'var(--atlas-v5-line)'}`,
  background: active ? 'var(--atlas-v5-brand-ink)' : 'var(--atlas-v5-card)',
  color: active ? 'var(--atlas-v5-white)' : 'var(--atlas-v5-ink-3)',
  transition: 'all 150ms ease',
});

const countStyle = (active: boolean): React.CSSProperties => ({
  fontFamily: 'var(--atlas-v5-font-mono-num)',
  fontSize: 10.5,
  padding: '1px 6px',
  borderRadius: 99,
  background: active ? 'rgba(255,255,255,0.15)' : 'var(--atlas-v5-bg)',
  color: active ? 'rgba(255,255,255,0.9)' : 'var(--atlas-v5-ink-4)',
  fontWeight: 600,
});

export default FilterPills;
