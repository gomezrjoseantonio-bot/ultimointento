import React from 'react';
import { Search } from 'lucide-react';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterBarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: {
    key: string;
    label: string;
    value: string;
    options: FilterOption[];
    onChange: (value: string) => void;
  }[];
  dateRange?: {
    label: string;
    startDate: string;
    endDate: string;
    onStartDateChange: (value: string) => void;
    onEndDateChange: (value: string) => void;
  };
  className?: string;
}

const FilterBar: React.FC<FilterBarProps> = ({
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Buscar...',
  filters = [],
  dateRange,
  className = ''
}) => {
  return (
    <div className={`bg-white border-b border-gray-200 px-6 py-4 ${className}`}>
      <div className="flex flex-wrap items-center gap-4">
        {/* Search Input */}
        {onSearchChange && (
          <div className="relative flex-1 min-w-[200px] max-w-[300px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              >
              style={{ 
                '--tw-ring-color': 'var(--hz-primary)',
                '--tw-ring-opacity': '0.3'
              } as React.CSSProperties}
            />
          </div>
        )}

        {/* Filter Selects */}
        {filters.map((filter) => (
          <div key={filter.key} className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
              {filter.label}:
            </label>
            <select
              value={filter.value}
              onChange={(e) => filter.onChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              >
              style={{ 
                '--tw-ring-color': 'var(--hz-primary)',
                '--tw-ring-opacity': '0.3'
              } as React.CSSProperties}
            >
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ))}

        {/* Date Range */}
        {dateRange && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
              {dateRange.label}:
            </label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => dateRange.onStartDateChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              >
              style={{ 
                '--tw-ring-color': 'var(--hz-primary)',
                '--tw-ring-opacity': '0.3'
              } as React.CSSProperties}
            />
            <span className="text-gray-500">-</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => dateRange.onEndDateChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              >
              style={{ 
                '--tw-ring-color': 'var(--hz-primary)',
                '--tw-ring-opacity': '0.3'
              } as React.CSSProperties}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default FilterBar;