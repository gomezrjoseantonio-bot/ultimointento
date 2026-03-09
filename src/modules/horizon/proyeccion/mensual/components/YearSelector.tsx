// src/modules/horizon/proyeccion/mensual/components/YearSelector.tsx
// ATLAS HORIZON: Year selector for monthly projection

import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

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
  const currentIndex = years.indexOf(selectedYear);
  const canPrev = currentIndex > 0;
  const canNext = currentIndex < years.length - 1;

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => canPrev && onChange(years[0])}
        disabled={!canPrev}
        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Primer año"
        title="Primer año"
      >
        <ChevronsLeft className="w-4 h-4 text-gray-600" />
      </button>
      <button
        onClick={() => canPrev && onChange(years[currentIndex - 1])}
        disabled={!canPrev}
        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Año anterior"
      >
        <ChevronLeft className="w-4 h-4 text-gray-600" />
      </button>
      <select
        value={selectedYear}
        onChange={e => onChange(Number(e.target.value))}
        className="text-sm font-semibold text-gray-700 border border-gray-300 rounded px-2 py-0.5 bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400"
        aria-label="Seleccionar año"
      >
        {years.map(y => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
      <button
        onClick={() => canNext && onChange(years[currentIndex + 1])}
        disabled={!canNext}
        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Año siguiente"
      >
        <ChevronRight className="w-4 h-4 text-gray-600" />
      </button>
      <button
        onClick={() => canNext && onChange(years[years.length - 1])}
        disabled={!canNext}
        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Último año"
        title="Último año"
      >
        <ChevronsRight className="w-4 h-4 text-gray-600" />
      </button>
    </div>
  );
};

export default YearSelector;
