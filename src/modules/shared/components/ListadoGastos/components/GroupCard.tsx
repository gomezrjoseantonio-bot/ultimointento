import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { CompromisoRecurrente } from '../../../../../types/compromisosRecurrentes';
import type { Account } from '../../../../../services/db';
import type { SortField, SortState } from '../ListadoGastosRecurrentes.types';
import { computeMonthly } from '../../../utils/compromisoUtils';
import { getFamilyIcon } from '../utils/iconMapping';
import { sortCompromisos } from '../utils/sortingHelpers';
import { formatEur } from '../utils/amountFormatter';
import ExpenseRow, { ROW_GRID } from './ExpenseRow';
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
  accountsById: Record<number, Account>;
  sort: SortState;
  onSort: (field: SortField) => void;
  showHeader: boolean;
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
  accountsById,
  sort,
  onSort,
  showHeader,
}) => {
  const FamilyIcon = getFamilyIcon(familiaId, mode);
  const totalMensual = compromisos.reduce((s, c) => s + computeMonthly(c), 0);
  const sorted = sortCompromisos(compromisos, sort);

  const sortIndicator = (field: SortField): string =>
    sort.field === field ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : '';

  return (
    <div style={groupWrap}>
      <button
        type="button"
        style={groupHeader}
        onClick={onToggleGroup}
        aria-expanded={isExpanded}
        aria-label={`${familiaLabel} · ${compromisos.length} ${compromisos.length === 1 ? 'patrón' : 'patrones'}`}
      >
        <div style={iconBg}>
          <FamilyIcon size={18} strokeWidth={1.8} style={{ color: 'var(--atlas-v5-gold-ink)' }} />
        </div>
        <span style={groupTitle}>{familiaLabel}</span>
        <span style={groupMeta}>
          · {compromisos.length} {compromisos.length === 1 ? 'patrón' : 'patrones'}
        </span>
        <div style={{ flex: 1 }} />
        <div style={{ textAlign: 'right' }}>
          <div style={groupTotal}>{formatEur(-Math.abs(totalMensual))}</div>
          <div style={groupTotalSub}>mensual estimado</div>
        </div>
        <div style={{ marginLeft: 12 }}>
          {isExpanded ? (
            <ChevronDown size={14} strokeWidth={2} style={{ color: 'var(--atlas-v5-ink-4)' }} />
          ) : (
            <ChevronRight size={14} strokeWidth={2} style={{ color: 'var(--atlas-v5-ink-4)' }} />
          )}
        </div>
      </button>

      {isExpanded && (
        <div>
          {showHeader && (
            <div
              role="row"
              style={{
                display: 'grid',
                gridTemplateColumns: ROW_GRID,
                gap: 16,
                padding: '10px 20px',
                borderBottom: '1px solid var(--atlas-v5-line)',
                background: 'var(--atlas-v5-card-alt)',
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--atlas-v5-ink-4)',
                fontFamily: 'var(--atlas-v5-font-ui)',
              }}
            >
              <span />
              <span
                role="columnheader"
                aria-sort={
                  sort.field === 'nombre'
                    ? sort.dir === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
              >
                <button
                  type="button"
                  onClick={() => onSort('nombre')}
                  style={sortableHeaderBtn}
                >
                  Nombre{sortIndicator('nombre')}
                </button>
              </span>
              <span>Patrón</span>
              <span>Cuenta</span>
              <span
                role="columnheader"
                style={{ textAlign: 'right' }}
                aria-sort={
                  sort.field === 'importe'
                    ? sort.dir === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
              >
                <button
                  type="button"
                  onClick={() => onSort('importe')}
                  style={{ ...sortableHeaderBtn, textAlign: 'right' }}
                >
                  Importe{sortIndicator('importe')}
                </button>
              </span>
              <span>Estado</span>
              <span />
            </div>
          )}

          {sorted.map((c) => {
            const account = accountsById[c.cuentaCargo] ?? null;
            return (
              <React.Fragment key={c.id}>
                <ExpenseRow
                  compromiso={c}
                  account={account}
                  isExpanded={expandedRowId === c.id}
                  onToggle={() => onToggleRow(c.id)}
                  onEdit={() => onEdit(c)}
                  onDelete={() => onDelete(c)}
                />
                {expandedRowId === c.id && <RowExpandedDetail compromiso={c} />}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
};

const groupWrap: React.CSSProperties = {
  border: '1px solid var(--atlas-v5-line)',
  borderRadius: 12,
  overflow: 'hidden',
  background: 'var(--atlas-v5-card)',
  marginBottom: 14,
  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
};
const groupHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  width: '100%',
  padding: '14px 20px',
  background: 'var(--atlas-v5-card-alt)',
  border: 'none',
  borderBottom: '1px solid var(--atlas-v5-line-2)',
  cursor: 'pointer',
  fontFamily: 'var(--atlas-v5-font-ui)',
  textAlign: 'left',
};
const iconBg: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 9,
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
  letterSpacing: '-0.01em',
};
const groupMeta: React.CSSProperties = {
  fontSize: 11.5,
  color: 'var(--atlas-v5-ink-4)',
  marginLeft: 4,
};
const groupTotal: React.CSSProperties = {
  fontFamily: 'var(--atlas-v5-font-mono-num)',
  fontSize: 14,
  fontWeight: 700,
  color: 'var(--atlas-v5-neg)',
  letterSpacing: '-0.02em',
  lineHeight: 1.2,
};
const groupTotalSub: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--atlas-v5-ink-4)',
  marginTop: 1,
  textAlign: 'right',
};
const sortableHeaderBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  fontSize: 'inherit',
  fontWeight: 'inherit',
  letterSpacing: 'inherit',
  textTransform: 'inherit',
  color: 'inherit',
  fontFamily: 'inherit',
  textAlign: 'left',
};

export default GroupCard;
