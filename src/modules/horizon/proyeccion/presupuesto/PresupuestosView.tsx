import React, { useState } from 'react';
import { BarChart3, Calculator, TrendingUp } from 'lucide-react';
import ProyeccionMensual from '../mensual/ProyeccionMensual';
import ProyeccionPresupuesto from './ProyeccionPresupuesto';
import ProyeccionComparativa from '../comparativa/ProyeccionComparativa';

type PresupuestosTab = 'proyeccion' | 'presupuesto' | 'comparativa';

const PresupuestosView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<PresupuestosTab>('proyeccion');

  const tabs = [
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
      case 'proyeccion':
        return <ProyeccionMensual />;
      case 'presupuesto':
        return <ProyeccionPresupuesto />;
      case 'comparativa':
        return <ProyeccionComparativa />;
      default:
        return <ProyeccionMensual />;
    }
  };

  return (
    <div>
      {/* Tab Navigation */}
      <div className="border-b px-6 bg-white" style={{ borderColor: 'var(--n-200)' }}>
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
                    ? 'border-[var(--blue)] text-[var(--blue)]'
                    : 'border-transparent text-[var(--n-500)] hover:text-[var(--n-700)] hover:border-[var(--n-200)]'
                }`}
              >
                <Icon
                  className={`mr-2 h-4 w-4 ${
                    isActive ? 'text-[var(--blue)]' : 'text-[var(--n-500)] group-hover:text-[var(--n-700)]'
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
