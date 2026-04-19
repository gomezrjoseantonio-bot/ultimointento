import React, { useState } from 'react';
import { ChevronRight, Home } from 'lucide-react';
import CheckCircle from './CheckCircle';
import MovementRow from './MovementRow';
import { formatSignedEuro } from '../utils/conciliacionFormatters';
import type { RentGroupRow, SingleRow } from '../hooks/useMonthConciliacion';
import type { DocIconType } from './DocIcon';

interface ParentRentRowProps {
  group: RentGroupRow;
  onQuickConfirm: (row: SingleRow) => void;
  onQuickRevert: (row: SingleRow) => void;
  onOpenModal: (row: SingleRow) => void;
  onDelete: (row: SingleRow) => void;
  onOpenDocPopover: (row: SingleRow, slot: DocIconType, anchor: HTMLElement) => void;
  onBulkConfirm: (children: SingleRow[]) => void;
  onBulkRevert: (children: SingleRow[]) => void;
}

const ParentRentRow: React.FC<ParentRentRowProps> = ({
  group,
  onQuickConfirm,
  onQuickRevert,
  onOpenModal,
  onDelete,
  onOpenDocPopover,
  onBulkConfirm,
  onBulkRevert,
}) => {
  const [expanded, setExpanded] = useState(false);

  const checkState: 'empty' | 'checked' | 'indeterminate' =
    group.checkState === 'all'
      ? 'checked'
      : group.checkState === 'some'
      ? 'indeterminate'
      : 'empty';

  // PR5.6 · all confirmadas + click → despuntear todas. En none/some sólo
  // confirma las pendientes (comportamiento previo).
  const handleParentCheck = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (checkState === 'checked') {
      const confirmed = group.children.filter((c) => c.state === 'confirmed');
      if (confirmed.length > 0) onBulkRevert(confirmed);
      return;
    }
    const pending = group.children.filter((c) => c.state === 'predicted');
    if (pending.length > 0) onBulkConfirm(pending);
  };

  const toggleExpand = () => setExpanded((v) => !v);

  return (
    <>
      <div
        className="cv2-row cv2-row--parent cv2-row--predicted"
        onClick={toggleExpand}
      >
        <CheckCircle
          state={checkState}
          onClick={handleParentCheck}
          ariaLabel={
            checkState === 'checked'
              ? 'Despuntear todas las rentas confirmadas'
              : 'Puntear todas las rentas pendientes'
          }
        />
        <span className={`cv2-chevron ${expanded ? 'cv2-chevron--open' : ''}`}>
          <ChevronRight size={14} />
        </span>

        <div className="cv2-concept">
          <span className="cv2-cat-icon" aria-hidden>
            <Home size={14} />
          </span>
          {group.children.length} rentas · {group.propertyAlias || `Inmueble ${group.propertyId}`}
        </div>

        <div className="cv2-counterparty">
          {group.children.length} inquilinos
        </div>
        <div className="cv2-account">{group.accountLabel}</div>
        <div className="cv2-amount cv2-amount--positive">
          {formatSignedEuro(group.totalAmount)}
        </div>
        <div className="cv2-docs-cell" />
        <div className="cv2-row-actions" />
      </div>

      {expanded &&
        group.children.map((child) => (
          <div key={child.id} className="cv2-row--child-wrapper">
            <MovementRow
              row={child}
              onQuickConfirm={onQuickConfirm}
              onQuickRevert={onQuickRevert}
              onOpenModal={onOpenModal}
              onDelete={onDelete}
              onOpenDocPopover={onOpenDocPopover}
            />
          </div>
        ))}
    </>
  );
};

export default ParentRentRow;
