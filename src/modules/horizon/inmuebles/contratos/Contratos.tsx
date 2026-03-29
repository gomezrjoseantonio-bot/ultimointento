import React, { useState } from 'react';
// lucide-react icons removed – v4 underline tabs without icons
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
}

const tabs: Tab[] = [
  { id: 'lista', label: 'Lista' },
  { id: 'calendario', label: 'Calendario' },
  { id: 'cobros', label: 'Cobros' },
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
        <div className="mb-3" style={{ borderBottom: '1px solid var(--grey-200, #e5e7eb)' }}>
          <div role="tablist" className="flex" style={{ gap: 0 }}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  role="tab"
                  aria-selected={isActive}
                  style={{
                    padding: '10px 0',
                    marginRight: 32,
                    fontSize: 'var(--t-base, 0.875rem)',
                    fontWeight: isActive ? 500 : 400,
                    color: isActive ? 'var(--atlas-blue, #2563EB)' : 'var(--grey-500, #6B7280)',
                    background: 'none',
                    border: 'none',
                    borderBottom: isActive ? '2px solid var(--atlas-blue, #2563EB)' : '2px solid transparent',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 150ms ease',
                    marginBottom: -1,
                  }}
                >
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