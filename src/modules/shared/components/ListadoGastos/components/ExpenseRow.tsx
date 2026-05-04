import React from 'react';
import { Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import type { CompromisoRecurrente } from '../../../../../types/compromisosRecurrentes';
import { Pill } from '../../../../../design-system/v5';
import { computeMonthly } from '../../../utils/compromisoUtils';
import { formatEur } from '../utils/amountFormatter';
import { formatPattern } from '../utils/patternFormatter';
import { getSubtypeIcon } from '../utils/iconMapping';

interface ExpenseRowProps {
  compromiso: CompromisoRecurrente & { id: number };
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const ExpenseRow: React.FC<ExpenseRowProps> = ({
  compromiso: c,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
}) => {
  const monthly = computeMonthly(c);
  const pattern = formatPattern(c.patron, c.fechaInicio);
  const SubIcon = getSubtypeIcon(c.subtipo);

  return (
    <tr
      onClick={onToggle}
      style={{
        cursor: 'pointer',
        background: isExpanded ? 'var(--atlas-v5-gold-wash-2)' : undefined,
        transition: 'background 120ms ease',
      }}
      onMouseEnter={(e) => {
        if (!isExpanded)
          (e.currentTarget as HTMLTableRowElement).style.background =
            'var(--atlas-v5-gold-wash-2)';
      }}
      onMouseLeave={(e) => {
        if (!isExpanded)
          (e.currentTarget as HTMLTableRowElement).style.background = '';
      }}
      aria-expanded={isExpanded}
    >
      <td style={{ ...td, width: 36 }}>
        <div style={iconWrap}>
          <SubIcon
            size={16}
            strokeWidth={1.8}
            style={{ color: 'var(--atlas-v5-gold-ink)' }}
          />
        </div>
      </td>
      <td style={td}>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--atlas-v5-ink-2)' }}>
          {c.alias}
        </div>
        {c.proveedor?.nombre && (
          <div style={{ fontSize: 11, color: 'var(--atlas-v5-ink-4)', marginTop: 1 }}>
            {c.proveedor.nombre}
          </div>
        )}
      </td>
      <td style={{ ...td, width: 200 }}>
        <div style={{ fontSize: 12, color: 'var(--atlas-v5-ink-2)' }}>{pattern.primary}</div>
        {pattern.secondary && (
          <div style={{ fontSize: 11, color: 'var(--atlas-v5-ink-4)', marginTop: 1 }}>
            {pattern.secondary}
          </div>
        )}
      </td>
      <td style={{ ...td, width: 200 }}>
        <div style={{ fontSize: 12, color: 'var(--atlas-v5-ink-3)' }}>{c.categoria ?? '—'}</div>
      </td>
      <td style={{ ...td, textAlign: 'right', width: 130 }}>
        <span
          style={{
            fontFamily: 'var(--atlas-v5-font-mono-num)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--atlas-v5-neg)',
          }}
        >
          {formatEur(-monthly)}
        </span>
      </td>
      <td style={{ ...td, textAlign: 'center', width: 80 }}>
        <Pill variant={c.estado === 'activo' ? 'pos' : 'gris'} asTag>
          {c.estado === 'activo' ? 'Activo' : c.estado === 'pausado' ? 'Pausado' : 'Baja'}
        </Pill>
      </td>
      <td
        style={{ ...td, textAlign: 'right', width: 70, whiteSpace: 'nowrap' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label={`Editar ${c.alias}`}
          title="Editar"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          style={actionBtn}
        >
          <Pencil size={13} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          aria-label={`Eliminar ${c.alias}`}
          title="Eliminar"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={{ ...actionBtn, color: 'var(--atlas-v5-neg)' }}
        >
          <Trash2 size={13} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          aria-label={isExpanded ? 'Colapsar detalle' : 'Ver detalle'}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          style={{
            ...actionBtn,
            color: isExpanded ? 'var(--atlas-v5-brand)' : 'var(--atlas-v5-ink-4)',
          }}
        >
          {isExpanded ? (
            <ChevronUp size={13} strokeWidth={2} />
          ) : (
            <ChevronDown size={13} strokeWidth={2} />
          )}
        </button>
      </td>
    </tr>
  );
};

const td: React.CSSProperties = {
  padding: '14px 8px',
  borderBottom: '1px solid var(--atlas-v5-line-2)',
  verticalAlign: 'middle',
};
const iconWrap: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  background: 'var(--atlas-v5-gold-wash)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};
const actionBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '3px 4px',
  borderRadius: 4,
  color: 'var(--atlas-v5-ink-3)',
  display: 'inline-flex',
  alignItems: 'center',
};

export default ExpenseRow;
