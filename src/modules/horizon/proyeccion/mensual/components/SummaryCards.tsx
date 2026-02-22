// src/modules/horizon/proyeccion/mensual/components/SummaryCards.tsx
// ATLAS HORIZON: Summary cards for monthly projection totals

import React from 'react';
import { formatEuro } from '../../../../../utils/formatUtils';

interface SummaryCardProps {
  label: string;
  value: number;
  color: 'green' | 'red' | 'blue' | 'purple';
}

const colorMap: Record<
  SummaryCardProps['color'],
  { bg: string; border: string; text: string; value: string }
> = {
  green: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    value: 'text-green-900',
  },
  red: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    value: 'text-red-900',
  },
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    value: 'text-blue-900',
  },
  purple: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-700',
    value: 'text-purple-900',
  },
};

const SummaryCard: React.FC<SummaryCardProps> = ({ label, value, color }) => {
  const colors = colorMap[color];
  return (
    <div
      className={`${colors.bg} ${colors.border} border rounded-lg p-4 flex flex-col gap-1`}
    >
      <span className={`text-xs font-medium uppercase tracking-wide ${colors.text}`}>
        {label}
      </span>
      <span
        className={`text-xl font-bold tabular-nums ${colors.value} ${value < 0 ? 'text-red-600' : ''}`}
      >
        {formatEuro(value)}
      </span>
    </div>
  );
};

interface SummaryCardsProps {
  ingresos: number;
  gastos: number;
  flujoNeto: number;
  patrimonioNeto: number;
}

const SummaryCards: React.FC<SummaryCardsProps> = ({
  ingresos,
  gastos,
  flujoNeto,
  patrimonioNeto,
}) => {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <SummaryCard label="Ingresos Totales" value={ingresos} color="green" />
      <SummaryCard label="Gastos Totales" value={gastos} color="red" />
      <SummaryCard label="Flujo Neto" value={flujoNeto} color="blue" />
      <SummaryCard label="Patrimonio Neto" value={patrimonioNeto} color="purple" />
    </div>
  );
};

export default SummaryCards;
