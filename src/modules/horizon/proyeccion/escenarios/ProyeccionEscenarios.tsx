import React, { useState } from 'react';
import { BarChart3, Calculator, LayoutDashboard, TrendingUp } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';

// Direct imports for internal navigation
import ProyeccionBase from '../base/ProyeccionBase';
import ProyeccionSimulaciones from '../simulaciones/ProyeccionSimulaciones';
import ProyeccionComparativas from '../comparativas/ProyeccionComparativas';
import ScenarioManagement from './components/ScenarioManagement';

type EscenarioTab = 'gestion' | 'base' | 'simulaciones' | 'comparativas';

const ProyeccionEscenarios: React.FC = () => {
  const [activeTab, setActiveTab] = useState<EscenarioTab>('gestion');

  const tabs = [
    {
      id: 'gestion' as const,
      label: 'Gestión',
      icon: LayoutDashboard,
    },
    {
      id: 'base' as const,
      label: 'Base',
      icon: Calculator,
    },
    {
      id: 'simulaciones' as const,
      label: 'Simulaciones',
      icon: TrendingUp,
    },
    {
      id: 'comparativas' as const,
      label: 'Comparativas',
      icon: BarChart3,
    }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'gestion':
        return <ScenarioManagement />;
      case 'base':
        return <ProyeccionBase isEmbedded={true} />;
      case 'simulaciones':
        return <ProyeccionSimulaciones isEmbedded={true} />;
      case 'comparativas':
        return <ProyeccionComparativas isEmbedded={true} />;
      default:
        return <ProyeccionBase isEmbedded={true} />;
    }
  };

  const getSubtitle = () => {
    switch (activeTab) {
      case 'gestion':
        return 'Escenarios accionables con métricas, planes y stress tests listos para ejecutar';
      case 'base':
        return 'Línea base a 20 años derivada de contratos y gastos recurrentes';
      case 'simulaciones':
        return 'Escenarios alternativos y análisis de sensibilidad';
      case 'comparativas':
        return 'Comparar hasta 3 escenarios marcados en Simulaciones';
      default:
        return '';
    }
  };

  return (
    <PageLayout title="Escenarios" subtitle={getSubtitle()}>
      <div className="space-y-6">
        {/* Subtabs Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group inline-flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
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
        <div className="min-h-[400px]">
          {renderTabContent()}
        </div>
      </div>
    </PageLayout>
  );
};

export default ProyeccionEscenarios;