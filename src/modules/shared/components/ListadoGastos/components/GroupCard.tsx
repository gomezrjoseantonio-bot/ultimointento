// Sección de un bloque dentro de la tabla (§3.1): una cabecera de grupo en gris
// sobre fondo crema (comunidad y tributos · suministros · seguros · … ·
// preparados · dados de baja) y sus filas. NO es un acordeón ni una tarjeta
// aparte: vive dentro de la única tabla, bajo la cabecera navy común. La fila
// desplegada (RowForm) se pinta justo debajo de su fila, dentro de la tabla.

import React from 'react';
import type { CompromisoRecurrente } from '../../../../../types/compromisosRecurrentes';
import type { Account } from '../../../../../services/db';
import ExpenseRow, { ROW_GRID } from './ExpenseRow';
import RowForm from './RowForm';

interface GroupSectionProps {
  familiaLabel: string;
  compromisos: (CompromisoRecurrente & { id: number })[];
  expandedRowId: number | null;
  onToggleRow: (id: number) => void;
  onDelete: (c: CompromisoRecurrente) => void;
  onToggleEstado: (c: CompromisoRecurrente & { id: number }) => void;
  onRowSaved: () => void;
  accountsById: Record<number, Account>;
  accounts: Account[];
}

const GroupSection: React.FC<GroupSectionProps> = ({
  familiaLabel,
  compromisos,
  expandedRowId,
  onToggleRow,
  onDelete,
  onToggleEstado,
  onRowSaved,
  accountsById,
  accounts,
}) => {
  return (
    <div role="rowgroup">
      {/* Cabecera de grupo (§3.1) */}
      <div role="row" style={grpHeader}>
        {familiaLabel}
      </div>
      {compromisos.map((c) => {
        const account = accountsById[c.cuentaCargo] ?? null;
        return (
          <React.Fragment key={c.id}>
            <ExpenseRow
              compromiso={c}
              account={account}
              accounts={accounts}
              isExpanded={expandedRowId === c.id}
              onToggle={() => onToggleRow(c.id)}
              onDelete={() => onDelete(c)}
              onToggleEstado={() => onToggleEstado(c)}
              onInlineSaved={onRowSaved}
            />
            {expandedRowId === c.id && (
              <RowForm compromiso={c} accounts={accounts} onSaved={onRowSaved} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const grpHeader: React.CSSProperties = {
  gridColumn: '1 / -1',
  padding: '8px 14px',
  background: 'var(--atlas-v5-card-alt)',
  borderTop: '1px solid var(--atlas-v5-line-2)',
  borderBottom: '1px solid var(--atlas-v5-line-2)',
  fontSize: 9.5,
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--atlas-v5-ink-4)',
  fontFamily: 'var(--atlas-v5-font-ui)',
};

// Cabecera navy de columnas (una sola vez, encima de todos los grupos).
export const TableHead: React.FC = () => (
  <div role="row" style={theadRow}>
    <span style={th} />
    <span style={th} />
    <span style={th}>Concepto</span>
    <span style={{ ...th, textAlign: 'right' }}>Importe</span>
    <span style={th}>Cuándo se cobra</span>
    <span style={th}>Cuenta de cargo</span>
    <span style={{ ...th, textAlign: 'right' }}>Al año</span>
    <span style={th} />
  </div>
);

const theadRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: ROW_GRID,
  gap: 12,
  padding: '10px 12px',
  background: 'var(--atlas-v5-brand)',
};
const th: React.CSSProperties = {
  fontSize: 9.5,
  fontWeight: 600,
  letterSpacing: '0.09em',
  textTransform: 'uppercase',
  color: 'var(--atlas-v5-on-navy-3)',
  fontFamily: 'var(--atlas-v5-font-ui)',
};

export default GroupSection;
