// src/modules/horizon/proyeccion/mensual/components/YearSelector.tsx
// ATLAS HORIZON: Year selector for monthly projection

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
        onClick={() => canPrev && onChange(years[currentIndex - 1])}
        disabled={!canPrev}
        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Año anterior"
      >
        <ChevronLeft className="w-4 h-4 text-gray-600" />
      </button>
      <span className="min-w-[4.5rem] text-center text-sm font-semibold text-gray-700 select-none">
        {selectedYear}
      </span>
      <button
        onClick={() => canNext && onChange(years[currentIndex + 1])}
        disabled={!canNext}
        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Año siguiente"
      >
        <ChevronRight className="w-4 h-4 text-gray-600" />
      </button>
    </div>
  );
};

export default YearSelector;
