import React from 'react';
import { formatSignedEuro, monthLabel } from '../utils/conciliacionFormatters';
import type { MonthKpis } from '../hooks/useMonthConciliacion';

interface KpiRowProps {
  kpis: MonthKpis;
  year: number;
  month0: number;
}

interface KpiCardProps {
  label: string;
  predicted: number;
  confirmed: number;
  variant?: 'primary' | 'teal' | 'grey';
}

const KpiCard: React.FC<KpiCardProps> = ({ label, predicted, confirmed, variant = 'primary' }) => {
  const classes = ['cv2-kpi'];
  if (variant === 'teal') classes.push('cv2-kpi--teal');
  if (variant === 'grey') classes.push('cv2-kpi--grey');
  return (
    <div className={classes.join(' ')}>
      <div className="cv2-kpi-label">{label}</div>
      <div className="cv2-kpi-predicted">{formatSignedEuro(predicted)}</div>
      <div className="cv2-kpi-confirmed">
        Confirmado <strong>{formatSignedEuro(confirmed)}</strong>
      </div>
    </div>
  );
};

const KpiRow: React.FC<KpiRowProps> = ({ kpis, year, month0 }) => {
  const monthTag = monthLabel(year, month0).toLowerCase();
  return (
    <div className="cv2-kpi-row">
      <KpiCard
        label={`CF Neto · ${monthTag}`}
        predicted={kpis.predictedNet}
        confirmed={kpis.confirmedNet}
        variant="primary"
      />
      <KpiCard
        label={`Ingresos · ${monthTag.split(' ')[0]}`}
        predicted={kpis.predictedIncome}
        confirmed={kpis.confirmedIncome}
        variant="teal"
      />
      <KpiCard
        label={`Gastos · ${monthTag.split(' ')[0]}`}
        predicted={kpis.predictedExpense}
        confirmed={kpis.confirmedExpense}
        variant="grey"
      />
      <KpiCard
        label={`Financiación · ${monthTag.split(' ')[0]}`}
        predicted={kpis.predictedFinancing}
        confirmed={kpis.confirmedFinancing}
        variant="grey"
      />
    </div>
  );
};

export default KpiRow;
