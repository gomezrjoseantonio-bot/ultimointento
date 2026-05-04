import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { CompromisoRecurrente } from '../../../../../types/compromisosRecurrentes';
import type { SortState } from '../ListadoGastosRecurrentes.types';
import { computeMonthly } from '../../../utils/compromisoUtils';
import { getFamilyIcon } from '../utils/iconMapping';
import { sortCompromisos } from '../utils/sortingHelpers';
import { formatEur } from '../utils/amountFormatter';
import ExpenseRow from './ExpenseRow';
import RowExpandedDetail from './RowExpandedDetail';

interface GroupCardProps {
  familiaId: string;
  familiaLabel: string;
  compromisos: (CompromisoRecurrente & { id: number })[];
  mode: 'personal' | 'inmueble';
  isExpanded: boolean;
  onToggleGroup: () => void;
  expandedRowId: number | null;
  onToggleRow: (id: number) => void;
  onEdit: (c: CompromisoRecurrente) => void;
  onDelete: (c: CompromisoRecurrente) => void;
  sort: SortState;
}

const GroupCard: React.FC<GroupCardProps> = ({
  familiaId,
  familiaLabel,
  compromisos,
  mode,
  isExpanded,
  onToggleGroup,
  expandedRowId,
  onToggleRow,
  onEdit,
  onDelete,
  sort,
}) => {
  const FamilyIcon = getFamilyIcon(familiaId, mode);
  const totalMensual = compromisos.reduce((s, c) => s + computeMonthly(c), 0);
  const sorted = sortCompromisos(compromisos, sort);

  return (
    <div style={groupWrap}>
      <button
        type="button"
        style={groupHeader}
        onClick={onToggleGroup}
        aria-expanded={isExpanded}
        aria-label={`${familiaLabel} · ${compromisos.length} gastos`}
      >
        <div style={groupHeaderLeft}>
          <div style={iconBg}>
            <FamilyIcon
              size={18}
              strokeWidth={1.8}
              style={{ color: 'var(--atlas-v5-gold-ink)' }}
            />
          </div>
          <span style={groupTitle}>{familiaLabel}</span>
          <span style={groupCount}>{compromisos.length}</span>
        </div>
        <div style={groupHeaderRight}>
          <span style={groupTotal}>
            {formatEur(totalMensual)}
            <span style={groupTotalLabel}>/mes</span>
          </span>
          {isExpanded ? (
            <ChevronDown
              size={16}
              strokeWidth={2}
              style={{ color: 'var(--atlas-v5-ink-4)' }}
            />
          ) : (
            <ChevronRight
              size={16}
              strokeWidth={2}
              style={{ color: 'var(--atlas-v5-ink-4)' }}
            />
          )}
        </div>
      </button>

      {isExpanded && (
        <div style={{ overflow: 'hidden' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontFamily: 'var(--atlas-v5-font-ui)',
            }}
          >
            <tbody>
              {sorted.map((c) => (
                <React.Fragment key={c.id}>
                  <ExpenseRow
                    compromiso={c}
                    isExpanded={expandedRowId === c.id}
                    onToggle={() => onToggleRow(c.id)}
                    onEdit={() => onEdit(c)}
                    onDelete={() => onDelete(c)}
                  />
                  {expandedRowId === c.id && <RowExpandedDetail compromiso={c} />}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const groupWrap: React.CSSProperties = {
  border: '1px solid var(--atlas-v5-line)',
  borderRadius: 10,
  overflow: 'hidden',
  background: 'var(--atlas-v5-card)',
  marginBottom: 8,
};
const groupHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  padding: '12px 16px',
  background: 'var(--atlas-v5-card)',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'var(--atlas-v5-font-ui)',
  borderBottom: '1px solid var(--atlas-v5-line-2)',
};
const groupHeaderLeft: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10 };
const groupHeaderRight: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10 };
const iconBg: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  background: 'var(--atlas-v5-gold-wash)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};
const groupTitle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: 'var(--atlas-v5-ink)',
};
const groupCount: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--atlas-v5-ink-4)',
  background: 'var(--atlas-v5-line-2)',
  borderRadius: 20,
  padding: '2px 8px',
};
const groupTotal: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  fontFamily: 'var(--atlas-v5-font-mono-num)',
  color: 'var(--atlas-v5-neg)',
};
const groupTotalLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 400,
  color: 'var(--atlas-v5-ink-4)',
  marginLeft: 2,
};

export default GroupCard;
