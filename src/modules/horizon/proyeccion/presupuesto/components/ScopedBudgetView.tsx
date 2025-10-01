import React, { useState } from 'react';
import { User, Building, TrendingUp, Plus, Download } from 'lucide-react';
import { PresupuestoLinea } from '../../../../../services/db';
import BudgetTableEditor from './BudgetTableEditor';

interface ScopedBudgetViewProps {
  year: number;
  scopes: ('PERSONAL' | 'INMUEBLES')[];
  lines: PresupuestoLinea[];
  onLinesChange?: (lines: PresupuestoLinea[]) => void;
  onAddLine?: (scope: 'PERSONAL' | 'INMUEBLES') => void;
  onExport?: (scope: string) => void;
}

type TabType = 'PERSONAL' | 'INMUEBLES' | 'CONSOLIDADO';

const ScopedBudgetView: React.FC<ScopedBudgetViewProps> = ({
  year,
  scopes,
  lines,
  onLinesChange,
  onAddLine,
  onExport
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    // Default tab logic based on scopes
    if (scopes.length === 1) {
      return scopes[0];
    } else if (scopes.length === 2) {
      return 'CONSOLIDADO'; // Show consolidated view by default when both scopes are present
    }
    return 'PERSONAL';
  });

  // Determine available tabs
  const availableTabs: TabType[] = [];
  if (scopes.includes('PERSONAL')) availableTabs.push('PERSONAL');
  if (scopes.includes('INMUEBLES')) availableTabs.push('INMUEBLES');
  if (scopes.length === 2) availableTabs.push('CONSOLIDADO');

  // Filter lines by active tab
  const getFilteredLines = (): PresupuestoLinea[] => {
    if (activeTab === 'CONSOLIDADO') {
      return lines; // Show all lines
    }
    return lines.filter(line => line.scope === activeTab);
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  const handleTabLinesChange = (updatedLines: PresupuestoLinea[]) => {
    if (!onLinesChange) return;

    if (activeTab === 'CONSOLIDADO') {
      // For consolidated view, update all lines
      onLinesChange(updatedLines);
    } else {
      // For specific scope, update only lines from that scope
      const otherScopeLines = lines.filter(line => line.scope !== activeTab);
      const combinedLines = [...otherScopeLines, ...updatedLines];
      onLinesChange(combinedLines);
    }
  };

  const handleAddLineForScope = () => {
    if (activeTab === 'CONSOLIDADO') {
      // For consolidated view, we need to specify which scope
      // This could be improved with a dropdown, for now default to INMUEBLES
      if (onAddLine) onAddLine('INMUEBLES');
    } else {
      if (onAddLine) onAddLine(activeTab);
    }
  };

  const getTabIcon = (tab: TabType) => {
    switch (tab) {
      case 'PERSONAL':
        return <User className="h-4 w-4" />;
      case 'INMUEBLES':
        return <Building className="h-4 w-4" />;
      case 'CONSOLIDADO':
        return <TrendingUp className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getTabTitle = (tab: TabType) => {
    switch (tab) {
      case 'PERSONAL':
        return 'Personal';
      case 'INMUEBLES':
        return 'Inmuebles';
      case 'CONSOLIDADO':
        return 'Consolidado';
      default:
        return tab;
    }
  };

  const getTabDescription = (tab: TabType) => {
    switch (tab) {
      case 'PERSONAL':
        return 'Gastos e ingresos personales';
      case 'INMUEBLES':
        return 'Ingresos y gastos inmobiliarios';
      case 'CONSOLIDADO':
        return 'Vista unificada de ambos ámbitos';
      default:
        return '';
    }
  };

  const filteredLines = getFilteredLines();

  return (
    <div className="space-y-6">
      {/* Header with title and actions */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Presupuesto · {getTabTitle(activeTab)} · {year}
          </h1>
          <p className="text-gray-600 mt-1">
            {getTabDescription(activeTab)}
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Add Line Button */}
          {activeTab !== 'CONSOLIDADO' && onAddLine && (
            <button
              onClick={handleAddLineForScope}
              className="atlas-atlas-atlas-atlas-btn-primary inline-flex items-center px-4 py-2"
            >
              <Plus className="h-4 w-4 mr-2" />
              Añadir Línea
            </button>
          )}
          
          {/* Export Button */}
          {onExport && (
            <button
              onClick={() => onExport(activeTab)}
              className="inline-flex items-center px-4 py-2 bg-gray-600"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </button>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      {availableTabs.length > 1 && (
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {availableTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {getTabIcon(tab)}
                <span>{getTabTitle(tab)}</span>
                {tab === 'CONSOLIDADO' && (
                  <span className="atlas-atlas-atlas-atlas-btn-primary text-primary-800 text-xs px-2 py-1">
                    Auto
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Special notice for consolidated view */}
      {activeTab === 'CONSOLIDADO' && (
        <div className="bg-info-50 border border-info-200 p-4">
          <div className="flex items-start space-x-3">
            <TrendingUp className="h-5 w-5 text-info-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-info-900">Vista Consolidada</h4>
              <p className="text-sm text-info-800 mt-1">
                Esta vista muestra la suma automática de los presupuestos PERSONAL e INMUEBLES. 
                Las líneas se distinguen por colores: 
                <span className="atlas-atlas-atlas-atlas-btn-primary inline-block w-3 h-3 mx-1"></span>Personal 
                <span className="inline-block w-3 h-3 bg-success-500 mx-1"></span>Inmuebles
              </p>
              <p className="text-sm text-info-700 mt-2">
                <strong>Nota:</strong> Para editar líneas, cambia a las pestañas específicas de cada ámbito.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Budget Table */}
      <BudgetTableEditor
        lines={filteredLines}
        scope={activeTab}
        readonly={activeTab === 'CONSOLIDADO'}
        onLinesChange={handleTabLinesChange}
        onAddLine={activeTab !== 'CONSOLIDADO' ? handleAddLineForScope : undefined}
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="bg-white border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="bg-success-100 p-3">
              <TrendingUp className="h-6 w-6 text-success-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Ingresos</p>
              <p className="text-2xl font-bold text-success-600">
                {new Intl.NumberFormat('es-ES', {
                  style: 'currency',
                  currency: 'EUR',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                }).format(
                  filteredLines
                    .filter(line => line.type === 'INGRESO')
                    .reduce((sum, line) => sum + line.amountByMonth.reduce((lineSum, amount) => lineSum + (amount || 0), 0), 0)
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="bg-error-100 p-3">
              <TrendingUp className="h-6 w-6 text-error-600 transform rotate-180" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Costes</p>
              <p className="text-2xl font-bold text-error-600">
                {new Intl.NumberFormat('es-ES', {
                  style: 'currency',
                  currency: 'EUR',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                }).format(
                  filteredLines
                    .filter(line => line.type === 'COSTE')
                    .reduce((sum, line) => sum + line.amountByMonth.reduce((lineSum, amount) => lineSum + (amount || 0), 0), 0)
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="atlas-atlas-atlas-atlas-btn-primary p-3">
              <TrendingUp className="h-6 w-6 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Neto Anual</p>
              <p className="text-2xl font-bold text-primary-600">
                {(() => {
                  const totalIncome = filteredLines
                    .filter(line => line.type === 'INGRESO')
                    .reduce((sum, line) => sum + line.amountByMonth.reduce((lineSum, amount) => lineSum + (amount || 0), 0), 0);
                  const totalExpenses = filteredLines
                    .filter(line => line.type === 'COSTE')
                    .reduce((sum, line) => sum + line.amountByMonth.reduce((lineSum, amount) => lineSum + (amount || 0), 0), 0);
                  const net = totalIncome - totalExpenses;
                  
                  return new Intl.NumberFormat('es-ES', {
                    style: 'currency',
                    currency: 'EUR',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                  }).format(net);
                })()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScopedBudgetView;