import React, { useState } from 'react';
import PageLayout from '../../../../components/common/PageLayout';
import ErrorBoundary from '../../../../components/common/ErrorBoundary';
import { Contract } from '../../../../services/db';
import ContractsListaEnhanced from './components/ContractsListaEnhanced';
import ContractsNuevo from './components/ContractsNuevo';

const Contratos: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showNewContract, setShowNewContract] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);

  const handleContractCreated = () => {
    setRefreshKey(prev => prev + 1);
    setShowNewContract(false);
    setEditingContract(null);
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

  const renderContent = () => {
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

    return (
      <ErrorBoundary>
        <ContractsListaEnhanced key={refreshKey} onEditContract={handleEditContract} />
      </ErrorBoundary>
    );
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
      {/* Content */}
      <div>
        {renderContent()}
      </div>
    </PageLayout>
  );
};

export default Contratos;