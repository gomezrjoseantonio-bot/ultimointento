import React, { useState } from 'react';
import PageLayout from '../../../../components/common/PageLayout';
import AlertsSection from './AlertsSection';
import AccountsSection from './AccountsSection';
import IncomeExpensesSection from './IncomeExpensesSection';
import RentsSection from './RentsSection';
import ExpensesSection from './ExpensesSection';

export interface PanelFilters {
  excludePersonal: boolean;
  dateRange: 'today' | '7days' | '30days';
}

const HorizonVisualPanel: React.FC = () => {
  const [filters, setFilters] = useState<PanelFilters>({
    excludePersonal: true,
    dateRange: '30days'
  });

  const handleFilterChange = (newFilters: Partial<PanelFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  return (
    <PageLayout 
      title="Panel"
      subtitle="Vista general del módulo Horizon con resumen de inversiones."
      showInfoIcon={true}
    >
      {/* Global Filters */}
      <div className="mb-6 flex items-center justify-between bg-hz-card-bg border border-hz-neutral-300 rounded-lg p-4">
        <div className="flex items-center gap-6">
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

          {/* Date Range */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-hz-neutral-700">Rango:</span>
            <div className="flex bg-hz-neutral-100 rounded-lg p-1">
              {[
                { key: 'today', label: 'Hoy' },
                { key: '7days', label: '7 días' },
                { key: '30days', label: '30 días' }
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
        </div>
      </div>

      {/* Panel Sections */}
      <div className="space-y-6">
        {/* 1. Alerts Section */}
        <AlertsSection filters={filters} />

        {/* 2. Accounts & Balances */}
        <AccountsSection filters={filters} />

        {/* 3. Income & Expenses Timeline */}
        <IncomeExpensesSection filters={filters} />

        {/* 4. Rents Section */}
        <RentsSection filters={filters} />

        {/* 5. Key Expenses */}
        <ExpensesSection filters={filters} />
      </div>
    </PageLayout>
  );
};

export default HorizonVisualPanel;