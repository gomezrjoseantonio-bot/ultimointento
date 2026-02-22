// src/modules/horizon/proyeccion/mensual/components/YearSelector.tsx
// ATLAS HORIZON: Year selector for monthly projection

import React from 'react';
import { Calendar } from 'lucide-react';

interface YearSelectorProps {
  selectedYear: number;
  years: number[];
  onChange: (year: number) => void;
}

const YearSelector: React.FC<YearSelectorProps> = ({
  selectedYear,
  years,
  onChange,
}) => {
  return (
    <div className="flex items-center gap-2">
      <Calendar className="w-4 h-4 text-gray-500" />
      <span className="text-sm text-gray-600 font-medium">Año:</span>
      <select
        value={selectedYear}
        onChange={e => onChange(Number(e.target.value))}
        className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        {years.map(year => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </div>
  );
};

export default YearSelector;
