import React, { useState } from 'react';
import { BarChart3, Calculator, TrendingUp, Layers } from 'lucide-react';
import ProyeccionMensual from '../mensual/ProyeccionMensual';
import ProyeccionPresupuesto from './ProyeccionPresupuesto';
import ProyeccionComparativa from '../comparativa/ProyeccionComparativa';
import PresupuestoScopeView from './PresupuestoScopeView';

type PresupuestosTab = 'operativa' | 'proyeccion' | 'presupuesto' | 'comparativa';

const PresupuestosView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<PresupuestosTab>('operativa');

  const tabs = [
    {
      id: 'operativa' as const,
      label: 'Forecast/Actual (Nueva)',
      icon: Layers,
    },
    {
      id: 'proyeccion' as const,
      label: 'Proyección Automática',
      icon: TrendingUp,
    },
    {
      id: 'presupuesto' as const,
      label: 'Crear Presupuesto',
      icon: Calculator,
    },
    {
      id: 'comparativa' as const,
      label: 'Real vs Previsión',
      icon: BarChart3,
    },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'operativa':
        return <PresupuestoScopeView />;
      case 'proyeccion':
        return <ProyeccionMensual />;
      case 'presupuesto':
        return <ProyeccionPresupuesto />;
      case 'comparativa':
        return <ProyeccionComparativa />;
      default:
        return <PresupuestoScopeView />;
    }
  };

  return (
    <div>
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 px-6 bg-white">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                  isActive
                    ? 'border-primary-700 text-primary-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon
                  className={`mr-2 h-4 w-4 ${
                    isActive ? 'text-primary-700' : 'text-gray-400 group-hover:text-gray-500'
                  }`}
                />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {renderTabContent()}
      </div>
    </div>
  );
};

export default PresupuestosView;
