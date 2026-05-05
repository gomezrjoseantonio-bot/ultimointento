import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { CompromisoRecurrente } from '../../../../../types/compromisosRecurrentes';
import type { Account } from '../../../../../services/db';
import { computeMonthly } from '../../../utils/compromisoUtils';
import { formatEur } from '../utils/amountFormatter';
import { formatPattern } from '../utils/patternFormatter';
import { getSubtypeIcon } from '../utils/iconMapping';

interface ExpenseRowProps {
  compromiso: CompromisoRecurrente & { id: number };
  isExpanded: boolean;
  account: Account | null;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const ROW_GRID = '36px 1fr 200px 200px 130px 80px 70px';

function formatAccountLabel(account: Account | null): string {
  if (!account) return '—';
  const alias = account.alias ?? account.name ?? account.banco?.name ?? '';
  const last4 = account.iban?.replace(/\s/g, '').slice(-4) ?? '';
  if (alias && last4) return `${alias} ···· ${last4}`;
  if (alias) return alias;
  if (last4) return `···· ${last4}`;
  return account.iban ?? '—';
}

function buildSubLabel(c: CompromisoRecurrente): string {
  if (c.proveedor?.referencia) return c.proveedor.referencia;
  if (c.proveedor?.nif) return c.proveedor.nif;
  if (c.proveedor?.nombre) return c.proveedor.nombre;
  return '';
}

function buildAmountSub(c: CompromisoRecurrente): string {
  const tipo = c.patron.tipo;
  if (tipo === 'mensualDiaFijo' || tipo === 'mensualDiaRelativo') {
    if (c.importe.modo === 'variable' || c.importe.modo === 'diferenciadoPorMes') {
      return 'media mensual';
    }
    return '12 cargos/año';
  }
  if (tipo === 'cadaNMeses') {
    const n = c.patron.cadaNMeses;
    if (c.importe.modo === 'variable') return n === 2 ? 'media bimestral' : 'media trimestral';
    return `${Math.round(12 / n)} cargos/año`;
  }
  if (tipo === 'anualMesesConcretos') {
    return `${c.patron.mesesPago.length} cargos/año`;
  }
  return 'media mensual';
}

const ExpenseRow: React.FC<ExpenseRowProps> = ({
  compromiso: c,
  isExpanded,
  account,
  onToggle,
  onEdit,
  onDelete,
}) => {
  const monthly = computeMonthly(c);
  const pattern = formatPattern(c.patron, c.fechaInicio);
  const SubIcon = getSubtypeIcon(c.subtipo);
  const accountLabel = formatAccountLabel(account);
  const subLabel = buildSubLabel(c);
  const amountSub = buildAmountSub(c);
  const isActivo = c.estado === 'activo';
  const isPausado = c.estado === 'pausado';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      onMouseEnter={(e) => {
        if (!isExpanded) {
          (e.currentTarget as HTMLDivElement).style.background = 'var(--atlas-v5-gold-wash-2)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isExpanded) {
          (e.currentTarget as HTMLDivElement).style.background = '';
        }
      }}
      style={{
        display: 'grid',
        gridTemplateColumns: ROW_GRID,
        gap: 16,
        padding: '14px 20px',
        borderBottom: '1px solid var(--atlas-v5-line-2)',
        alignItems: 'center',
        cursor: 'pointer',
        background: isExpanded ? 'var(--atlas-v5-gold-wash-2)' : undefined,
        transition: 'background 120ms ease',
        fontFamily: 'var(--atlas-v5-font-ui)',
      }}
      aria-expanded={isExpanded}
      aria-label={`${c.alias} · ${pattern.primary}`}
    >
      {/* Col 1 · icono subtipo */}
      <div style={iconWrap}>
        <SubIcon size={14} strokeWidth={1.8} style={{ color: 'var(--atlas-v5-ink-3)' }} />
      </div>

      {/* Col 2 · nombre + sub */}
      <div style={{ minWidth: 0 }}>
        <div style={rowName}>{c.alias}</div>
        {subLabel && <div style={rowSub}>{subLabel}</div>}
      </div>

      {/* Col 3 · patrón */}
      <div>
        <div style={rowPattern}>
          {(() => {
            const parts = pattern.primary.split(' · ');
            if (parts.length >= 2) {
              return (
                <>
                  <strong style={{ color: 'var(--atlas-v5-ink-2)', fontWeight: 600 }}>
                    {parts[0]}
                  </strong>
                  <span> · {parts.slice(1).join(' · ')}</span>
                </>
              );
            }
            return <strong>{pattern.primary}</strong>;
          })()}
        </div>
        {pattern.secondary && <div style={rowPatternSub}>{pattern.secondary}</div>}
      </div>

      {/* Col 4 · cuenta */}
      <div style={rowAccount}>
        <span style={accountDot} aria-hidden />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {accountLabel}
        </span>
      </div>

      {/* Col 5 · importe */}
      <div style={{ textAlign: 'right' }}>
        <div style={rowAmount}>{formatEur(-Math.abs(monthly))}</div>
        <div style={rowAmountSub}>{amountSub}</div>
      </div>

      {/* Col 6 · estado */}
      <div>
        <span
          style={{
            ...rowStatusBase,
            background: isActivo
              ? 'var(--atlas-v5-pos-wash)'
              : isPausado
                ? 'var(--atlas-v5-warn-wash)'
                : 'var(--atlas-v5-line-2)',
            color: isActivo
              ? 'var(--atlas-v5-pos)'
              : isPausado
                ? 'var(--atlas-v5-warn)'
                : 'var(--atlas-v5-ink-4)',
          }}
        >
          {isActivo ? 'Activo' : isPausado ? 'Pausado' : 'Baja'}
        </span>
      </div>

      {/* Col 7 · acciones */}
      <div style={rowActions} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          aria-label={`Editar ${c.alias}`}
          title="Editar"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          style={iconBtn}
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
          style={iconBtnDanger}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--atlas-v5-neg-wash)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--atlas-v5-neg)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--atlas-v5-ink-4)';
          }}
        >
          <Trash2 size={13} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
};

const iconWrap: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 7,
  background: 'var(--atlas-v5-bg)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const rowName: React.CSSProperties = {
  fontSize: 13.5,
  fontWeight: 600,
  color: 'var(--atlas-v5-ink)',
  letterSpacing: '-0.005em',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
const rowSub: React.CSSProperties = {
  fontSize: 11.5,
  color: 'var(--atlas-v5-ink-4)',
  marginTop: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
const rowPattern: React.CSSProperties = {
  fontSize: 12.5,
  color: 'var(--atlas-v5-ink-3)',
};
const rowPatternSub: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--atlas-v5-ink-4)',
  marginTop: 1,
};
const rowAccount: React.CSSProperties = {
  fontSize: 12.5,
  color: 'var(--atlas-v5-ink-3)',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  minWidth: 0,
};
const accountDot: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: 'var(--atlas-v5-gold)',
  flexShrink: 0,
  display: 'inline-block',
};
const rowAmount: React.CSSProperties = {
  fontFamily: 'var(--atlas-v5-font-mono-num)',
  fontSize: 13.5,
  fontWeight: 700,
  color: 'var(--atlas-v5-neg)',
  letterSpacing: '-0.02em',
};
const rowAmountSub: React.CSSProperties = {
  fontSize: 10.5,
  color: 'var(--atlas-v5-ink-4)',
  fontFamily: 'var(--atlas-v5-font-mono-num)',
  marginTop: 1,
};
const rowStatusBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  fontSize: 10.5,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  padding: '3px 9px',
  borderRadius: 99,
  width: 'fit-content',
};
const rowActions: React.CSSProperties = {
  display: 'flex',
  gap: 4,
  justifyContent: 'flex-end',
};
const iconBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 6,
  color: 'var(--atlas-v5-ink-4)',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 120ms ease',
};
const iconBtnDanger: React.CSSProperties = {
  ...iconBtn,
};

export { ROW_GRID };
export default ExpenseRow;
