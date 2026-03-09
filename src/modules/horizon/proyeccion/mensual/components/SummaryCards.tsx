// src/modules/horizon/proyeccion/mensual/components/SummaryCards.tsx
// ATLAS HORIZON: Summary cards for monthly projection totals

import React from 'react';
import { formatInteger } from '../../../../../utils/formatUtils';

interface SummaryCardProps {
  label: string;
  value: number;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ label, value }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <span
        className={`text-xl font-bold tabular-nums ${value < 0 ? 'text-red-600' : 'text-gray-900'}`}
      >
        {formatInteger(value)}
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
      <SummaryCard label="Ingresos Totales" value={ingresos} />
      <SummaryCard label="Gastos Totales" value={gastos} />
      <SummaryCard label="Flujo Neto" value={flujoNeto} />
      <SummaryCard label="Patrimonio Neto" value={patrimonioNeto} />
    </div>
  );
};

export default SummaryCards;
