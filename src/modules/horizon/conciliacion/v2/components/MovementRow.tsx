import React from 'react';
import { Trash2 } from 'lucide-react';
import CheckCircle from './CheckCircle';
import CategoryIcon from './CategoryIcon';
import DocIcon, { type DocIconType } from './DocIcon';
import { formatSignedEuro } from '../utils/conciliacionFormatters';
import type { SingleRow } from '../hooks/useMonthConciliacion';

interface MovementRowProps {
  row: SingleRow;
  onQuickConfirm: (row: SingleRow) => void;
  onQuickRevert: (row: SingleRow) => void;
  onOpenModal: (row: SingleRow) => void;
  onDelete: (row: SingleRow) => void;
  onOpenDocPopover: (
    row: SingleRow,
    slot: DocIconType,
    anchor: HTMLElement,
  ) => void;
}

const MovementRow: React.FC<MovementRowProps> = ({
  row,
  onQuickConfirm,
  onQuickRevert,
  onOpenModal,
  onDelete,
  onOpenDocPopover,
}) => {
  const rowClasses = ['cv2-row'];
  rowClasses.push(row.state === 'confirmed' ? 'cv2-row--confirmed' : 'cv2-row--predicted');

  const amountClass = row.amount >= 0 ? 'cv2-amount--positive' : 'cv2-amount--negative';

  const handleCheck = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (row.state === 'confirmed') onQuickRevert(row);
    else onQuickConfirm(row);
  };

  const handleDocClick = (slot: DocIconType) => (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onOpenDocPopover(row, slot, e.currentTarget);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(row);
  };

  return (
    <div className={rowClasses.join(' ')} onClick={() => onOpenModal(row)}>
      <CheckCircle
        state={row.state === 'confirmed' ? 'checked' : 'empty'}
        onClick={handleCheck}
      />
      <span />

      <div className="cv2-concept">
        <CategoryIcon category={row.categoryLabel} />
        {row.concept}
        {row.fractional && (
          <span className="cv2-badge-frac">
            parcial {row.fractional.paid}/{row.fractional.total}
          </span>
        )}
      </div>

      <div className="cv2-counterparty">{row.counterparty || '—'}</div>
      <div className="cv2-account">{row.accountLabel}</div>
      <div className={`cv2-amount ${amountClass}`}>{formatSignedEuro(row.amount)}</div>

      <div className="cv2-docs-cell">
        <DocIcon
          type="factura"
          state={row.factura.state}
          docName={row.factura.docName}
          onClick={handleDocClick('factura')}
        />
        <DocIcon
          type="justificante"
          state={row.justificante.state}
          docName={row.justificante.docName}
          onClick={handleDocClick('justificante')}
        />
      </div>

      <div className="cv2-row-actions">
        <button
          type="button"
          className="cv2-btn-icon"
          title="Eliminar"
          onClick={handleDelete}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
};

export default MovementRow;
