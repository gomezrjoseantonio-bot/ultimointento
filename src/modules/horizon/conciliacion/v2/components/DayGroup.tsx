import React from 'react';
import DayHeader from './DayHeader';
import MovementRow from './MovementRow';
import ParentRentRow from './ParentRentRow';
import type { DayBucket, SingleRow } from '../hooks/useMonthConciliacion';
import type { DocIconType } from './DocIcon';

interface DayGroupProps {
  bucket: DayBucket;
  onQuickConfirm: (row: SingleRow) => void;
  onQuickRevert: (row: SingleRow) => void;
  onOpenModal: (row: SingleRow) => void;
  onDelete: (row: SingleRow) => void;
  onOpenDocPopover: (row: SingleRow, slot: DocIconType, anchor: HTMLElement) => void;
  onBulkConfirm: (children: SingleRow[]) => void;
}

const DayGroup: React.FC<DayGroupProps> = ({
  bucket,
  onQuickConfirm,
  onQuickRevert,
  onOpenModal,
  onDelete,
  onOpenDocPopover,
  onBulkConfirm,
}) => (
  <div className="cv2-day-group">
    <DayHeader bucket={bucket} />

    <div className="cv2-table-head">
      <div />
      <div />
      <div>Concepto</div>
      <div>Contraparte</div>
      <div>Cuenta</div>
      <div className="cv2-th-right">Importe</div>
      <div className="cv2-th-center">Documentación</div>
      <div />
    </div>

    {bucket.items.map((item) => {
      if (item.type === 'rent_group') {
        return (
          <ParentRentRow
            key={item.id}
            group={item}
            onQuickConfirm={onQuickConfirm}
            onQuickRevert={onQuickRevert}
            onOpenModal={onOpenModal}
            onDelete={onDelete}
            onOpenDocPopover={onOpenDocPopover}
            onBulkConfirm={onBulkConfirm}
          />
        );
      }
      return (
        <MovementRow
          key={item.id}
          row={item}
          onQuickConfirm={onQuickConfirm}
          onQuickRevert={onQuickRevert}
          onOpenModal={onOpenModal}
          onDelete={onDelete}
          onOpenDocPopover={onOpenDocPopover}
        />
      );
    })}
  </div>
);

export default DayGroup;
