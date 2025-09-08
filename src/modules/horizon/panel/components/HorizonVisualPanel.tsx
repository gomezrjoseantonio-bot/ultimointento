import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import CompactAlertsSection from './CompactAlertsSection';
import RiskRunwaySection from './RiskRunwaySection';
import TimelineSection from './TimelineSection';
import RentsCompactSection from './RentsCompactSection';
import AccountsCompactSection from './AccountsCompactSection';
import ExpensesCompactSection from './ExpensesCompactSection';

export interface PanelFilters {
  excludePersonal: boolean;
  dateRange: 'today' | '7days' | '30days';
}

const HorizonVisualPanel: React.FC = () => {
  const [filters, setFilters] = useState<PanelFilters>({
    excludePersonal: true,
    dateRange: '7days'  // Default to 7 days as per requirements
  });

  const [showConfigModal, setShowConfigModal] = useState(false);

  const handleFilterChange = (newFilters: Partial<PanelFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  return (
    <div className="h-screen bg-hz-bg overflow-hidden">
      {/* Fixed Height Container - max 1200px width, centered */}
      <div className="max-w-[1200px] mx-auto p-4 h-full flex flex-col">
        
        {/* Toolbar - Single line, 16px top margin */}
        <div className="flex items-center justify-between mb-4 py-2">
          {/* Left side: Title + Toggle + Range */}
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-semibold text-hz-neutral-900">Panel</h1>
            
            {/* Exclude Personal Toggle */}
            <div className="flex items-center gap-2">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.excludePersonal}
                  onChange={(e) => handleFilterChange({ excludePersonal: e.target.checked })}
                  className="sr-only"
                />
                <div className={`relative w-11 h-6 transition-colors rounded-full ${
                  filters.excludePersonal ? 'bg-hz-primary' : 'bg-hz-neutral-300'
                }`}>
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    filters.excludePersonal ? 'translate-x-5' : ''
                  }`} />
                </div>
                <span className="ml-3 text-sm font-medium text-hz-neutral-900">
                  Excluir personal
                </span>
              </label>
            </div>

            {/* Date Range Selector */}
            <div className="flex bg-hz-neutral-100 rounded-lg p-1">
              {[
                { key: 'today', label: 'Hoy' },
                { key: '7days', label: '7d' },
                { key: '30days', label: '30d' }
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleFilterChange({ dateRange: key as any })}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    filters.dateRange === key
                      ? 'bg-hz-primary text-white'
                      : 'text-hz-neutral-700 hover:text-hz-neutral-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Right side: Configure Panel button */}
          <button 
            onClick={() => setShowConfigModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-hz-neutral-700 border border-hz-neutral-300 rounded-lg hover:bg-hz-neutral-100 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Configurar Panel
          </button>
        </div>

        {/* Fixed Grid Layout - 12 columns, 16px gap */}
        <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
          
          {/* Row 1: Height 120px */}
          <div className="col-span-6 h-[120px]">
            <CompactAlertsSection filters={filters} />
          </div>
          <div className="col-span-6 h-[120px]">
            <RiskRunwaySection filters={filters} />
          </div>

          {/* Row 2: Height 260px */}
          <div className="col-span-8 h-[260px]">
            <TimelineSection filters={filters} />
          </div>
          <div className="col-span-4 h-[260px]">
            <RentsCompactSection filters={filters} />
          </div>

          {/* Row 3: Height 260px */}
          <div className="col-span-8 h-[260px]">
            <AccountsCompactSection filters={filters} />
          </div>
          <div className="col-span-4 h-[260px]">
            <ExpensesCompactSection filters={filters} />
          </div>
        </div>

        {/* Bottom margin: 16px */}
        <div className="h-4 flex-shrink-0"></div>
      </div>

      {/* Configure Panel Modal - TODO: Implement modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-hz-neutral-900 mb-4">Configurar Panel</h3>
            <p className="text-hz-neutral-700 mb-4">
              Funcionalidad de configuración en desarrollo.
            </p>
            <button 
              onClick={() => setShowConfigModal(false)}
              className="px-4 py-2 bg-hz-primary text-white rounded-lg hover:bg-hz-primary-dark transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HorizonVisualPanel;