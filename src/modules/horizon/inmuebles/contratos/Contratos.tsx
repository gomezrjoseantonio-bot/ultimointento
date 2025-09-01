import React, { useState } from 'react';
import { Plus, Calendar, CreditCard, List } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';
import { useTheme } from '../../../../contexts/ThemeContext';
import ContractsLista from './components/ContractsLista';
import ContractsNuevo from './components/ContractsNuevo';
import ContractsCalendario from './components/ContractsCalendario';
import ContractsCobros from './components/ContractsCobros';

type TabId = 'lista' | 'calendario' | 'cobros';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
}

const tabs: Tab[] = [
  { id: 'lista', label: 'Lista', icon: List },
  { id: 'calendario', label: 'Calendario', icon: Calendar },
  { id: 'cobros', label: 'Cobros', icon: CreditCard },
];

const Contratos: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('lista');
  const [refreshKey, setRefreshKey] = useState(0);
  const [showNewContract, setShowNewContract] = useState(false);
  const { currentModule } = useTheme();

  const handleContractCreated = () => {
    setRefreshKey(prev => prev + 1);
    setShowNewContract(false);
    setActiveTab('lista');
  };

  const renderTabContent = () => {
    if (showNewContract) {
      return <ContractsNuevo onContractCreated={handleContractCreated} onCancel={() => setShowNewContract(false)} />;
    }

    switch (activeTab) {
      case 'lista':
        return <ContractsLista key={refreshKey} onEditContract={() => setShowNewContract(true)} />;
      case 'calendario':
        return <ContractsCalendario key={refreshKey} />;
      case 'cobros':
        return <ContractsCobros key={refreshKey} />;
      default:
        return <ContractsLista key={refreshKey} onEditContract={() => setShowNewContract(true)} />;
    }
  };

  return (
    <PageLayout 
      title="Contratos" 
      subtitle="Gestión de contratos de alquiler por inmueble completo o por unidades."
      showInfoIcon={true}
      primaryAction={
        !showNewContract ? (
          <button
            onClick={() => setShowNewContract(true)}
            className="inline-flex items-center px-4 py-2 bg-brand-navy text-white rounded-md hover:bg-navy-800 transition-colors"
          >
            <Plus className="h-5 w-5 mr-2" />
            Nuevo contrato
          </button>
        ) : null
      }
    >
      {/* Row 3: Segment Control - 12px spacing to content - Only show when not creating new contract */}
      {!showNewContract && (
        <div className="mb-3">
          <div role="tablist" className="flex bg-gray-100 rounded-lg p-1 w-fit">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const activeColor = currentModule === 'horizon' ? 'text-brand-navy' : 'text-brand-teal';
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  role="tab"
                  aria-selected={isActive}
                  className={`
                    inline-flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
                    ${isActive
                      ? `bg-white ${activeColor} shadow-sm`
                      : 'text-gray-600 hover:text-gray-900'
                    }
                  `}
                >
                  <Icon className={`-ml-0.5 mr-2 h-4 w-4 ${
                    isActive ? activeColor : 'text-gray-400'
                  }`} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab Content */}
      <div>
        {renderTabContent()}
      </div>
    </PageLayout>
  );
};

export default Contratos;