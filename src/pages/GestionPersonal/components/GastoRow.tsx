import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { PersonalExpense } from '../../../types/personal';
import { patronGastosPersonalesService } from '../../../services/patronGastosPersonalesService';

const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const FONT = "'IBM Plex Sans', system-ui, sans-serif";

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(v);

const FREQ_LABEL: Record<string, string> = {
  semanal: '/sem',
  mensual: '/mes',
  bimestral: '/bim',
  trimestral: '/trim',
  semestral: '/sem',
  anual: '/a\u00F1o',
  meses_especificos: '/esp',
};

interface GastoRowProps {
  expense: PersonalExpense;
  onEdit: (e: PersonalExpense) => void;
  onDelete: (e: PersonalExpense) => void;
  /** Whether this is a suggested row (not yet configured) */
  isSuggested?: boolean;
}

const GastoRow: React.FC<GastoRowProps> = ({ expense, onEdit, onDelete, isSuggested }) => {
  const mensual = patronGastosPersonalesService.calcularImporteMensual(expense);
  const hasValue = expense.importe > 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '10px 0',
        borderBottom: '1px solid var(--grey-100, #EEF1F5)',
        fontFamily: FONT,
        opacity: isSuggested && !hasValue ? 0.65 : 1,
      }}
    >
      {/* Concepto */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--grey-900, #1A2332)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {expense.concepto}
          {isSuggested && !hasValue && (
            <span
              style={{
                marginLeft: 6,
                fontSize: 10,
                color: 'var(--teal-600, #1DA0BA)',
                fontWeight: 400,
              }}
            >
              Sugerido
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--grey-400, #9CA3AF)', marginTop: 1 }}>
          {expense.categoria}
          {expense.frecuencia !== 'mensual' && ` \u00B7 ${FREQ_LABEL[expense.frecuencia] || expense.frecuencia}`}
        </div>
      </div>

      {/* Importe */}
      <div
        style={{
          minWidth: 90,
          textAlign: 'right',
          fontFamily: MONO,
          fontVariantNumeric: 'tabular-nums',
          fontSize: 13,
          fontWeight: 600,
          color: hasValue ? 'var(--grey-900, #1A2332)' : 'var(--grey-400, #9CA3AF)',
          marginRight: 8,
        }}
      >
        {hasValue ? `${fmt(Math.round(mensual))} \u20AC` : '\u2014'}
      </div>

      {/* Freq label */}
      <div
        style={{
          minWidth: 40,
          fontSize: 11,
          color: 'var(--grey-400, #9CA3AF)',
          marginRight: 12,
        }}
      >
        /mes
      </div>

      {/* Action buttons — ALWAYS visible */}
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={() => onEdit(expense)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 6,
            border: '1px solid var(--grey-200, #DDE3EC)',
            background: 'var(--white, #FFFFFF)',
            cursor: 'pointer',
            color: 'var(--grey-500, #6C757D)',
          }}
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={() => onDelete(expense)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 6,
            border: '1px solid var(--grey-200, #DDE3EC)',
            background: 'var(--white, #FFFFFF)',
            cursor: 'pointer',
            color: 'var(--grey-500, #6C757D)',
          }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
};

export default GastoRow;
