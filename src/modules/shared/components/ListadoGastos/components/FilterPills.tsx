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
    <div
      role="group"
      aria-label="Filtros por familia"
      style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}
    >
      <button
        type="button"
        aria-pressed={active === null}
        style={pillStyle(active === null)}
        onClick={() => onChange(null)}
      >
        Todos · {total}
      </button>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          aria-pressed={active === opt.id}
          style={pillStyle(active === opt.id)}
          onClick={() => onChange(opt.id)}
        >
          {opt.icon &&
            React.createElement(opt.icon, {
              size: 11,
              strokeWidth: 2,
              style: { marginRight: 4, flexShrink: 0 },
            })}
          {opt.label}
          {opt.count > 0 && (
            <span style={{ marginLeft: 4, opacity: 0.7 }}>· {opt.count}</span>
          )}
        </button>
      ))}
    </div>
  );
};

const pillStyle = (active: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '5px 12px',
  borderRadius: 20,
  fontSize: 12,
  fontWeight: 500,
  fontFamily: 'var(--atlas-v5-font-ui)',
  cursor: 'pointer',
  border: `1px solid ${active ? 'var(--atlas-v5-brand)' : 'var(--atlas-v5-line)'}`,
  background: active ? 'var(--atlas-v5-brand)' : 'var(--atlas-v5-card)',
  color: active ? 'var(--atlas-v5-white)' : 'var(--atlas-v5-ink-3)',
  transition: 'all 120ms ease',
});

export default FilterPills;
