import React, { useState } from 'react';
import { Calendar, CreditCard, List } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';
import ErrorBoundary from '../../../../components/common/ErrorBoundary';
import { Contract } from '../../../../services/db';
import ContractsListaEnhanced from './components/ContractsListaEnhanced';
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
  const [editingContract, setEditingContract] = useState<Contract | null>(null);

  const handleContractCreated = () => {
    setRefreshKey(prev => prev + 1);
    setShowNewContract(false);
    setEditingContract(null);
    setActiveTab('lista');
  };

  const handleEditContract = (contract?: Contract) => {
    if (contract) {
      setEditingContract(contract);
      setShowNewContract(true);
    } else {
      setEditingContract(null);
      setShowNewContract(true);
    }
  };

  const handleCancelEdit = () => {
    setShowNewContract(false);
    setEditingContract(null);
  };

  const renderTabContent = () => {
    if (showNewContract) {
      return (
        <ErrorBoundary>
          <ContractsNuevo 
            editingContract={editingContract}
            onContractCreated={handleContractCreated} 
            onCancel={handleCancelEdit} 
          />
        </ErrorBoundary>
      );
    }

    switch (activeTab) {
      case 'lista':
        return (
          <ErrorBoundary>
            <ContractsListaEnhanced key={refreshKey} onEditContract={handleEditContract} />
          </ErrorBoundary>
        );
      case 'calendario':
        return (
          <ErrorBoundary>
            <ContractsCalendario key={refreshKey} />
          </ErrorBoundary>
        );
      case 'cobros':
        return (
          <ErrorBoundary>
            <ContractsCobros key={refreshKey} />
          </ErrorBoundary>
        );
      default:
        return (
          <ErrorBoundary>
            <ContractsListaEnhanced key={refreshKey} onEditContract={handleEditContract} />
          </ErrorBoundary>
        );
    }
  };

  return (
    <PageLayout 
      title="Contratos" 
      subtitle="Gestión de contratos de alquiler con control completo de ocupación, indexación automática y integración con tesorería."
      showInfoIcon={true}
      primaryAction={!showNewContract ? {
        label: "Nuevo contrato",
        onClick: () => setShowNewContract(true)
      } : undefined}
    >
      {/* Row 3: Segment Control - 12px spacing to content - Only show when not creating new contract */}
      {!showNewContract && (
        <div className="mb-3">
          <div role="tablist" className="flex bg-gray-100 rounded-lg p-1 w-fit">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const activeColor = 'text-atlas-blue'; // Always use ATLAS blue for Horizon
              
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