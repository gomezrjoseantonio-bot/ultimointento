import React from 'react';
import { formatSignedEuro } from '../utils/conciliacionFormatters';
import type { DayBucket } from '../hooks/useMonthConciliacion';

interface DayHeaderProps {
  bucket: DayBucket;
}

const DayHeader: React.FC<DayHeaderProps> = ({ bucket }) => {
  const net = bucket.totalIncome + bucket.totalExpense + bucket.totalFinancing;
  const movementsLabel = bucket.count === 1 ? '1 movimiento' : `${bucket.count} movimientos`;

  return (
    <div className="cv2-day-header">
      <div>
        <span className="cv2-day-date-main">{bucket.dayLabel}</span>
        <span className="cv2-day-date-weekday">
          {bucket.weekdayLabel} · {bucket.monthLabel}
        </span>
      </div>
      <div className="cv2-day-summary">
        {movementsLabel} · <strong>{formatSignedEuro(net)}</strong>
      </div>
    </div>
  );
};

export default DayHeader;
