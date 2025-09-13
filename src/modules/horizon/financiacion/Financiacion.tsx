import React, { useState } from 'react';
import PageLayout from '../../../components/common/PageLayout';
import PrestamosCreation from './components/PrestamosCreation';
import PrestamosList from './components/PrestamosList';
import FEINUploader from '../../../components/financiacion/FEINUploader';
import FEINValidation from '../../../components/financiacion/FEINValidation';
import { FEINProcessingResult } from '../../../types/fein';
import { PrestamoFinanciacion } from '../../../types/financiacion';

type View = 'list' | 'create' | 'edit' | 'fein-upload' | 'fein-validation';

const Financiacion: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('list');
  const [selectedPrestamoId, setSelectedPrestamoId] = useState<string>('');
  const [feinResult, setFeinResult] = useState<FEINProcessingResult | null>(null);
  const [feinLoanData, setFeinLoanData] = useState<Partial<PrestamoFinanciacion> | null>(null);

  const handleCreateNew = () => {
    setCurrentView('create');
  };

  const handleCreateFromFEIN = () => {
    setCurrentView('fein-upload');
  };

  const handleEdit = (prestamoId: string) => {
    setSelectedPrestamoId(prestamoId);
    setCurrentView('edit');
  };

  const handleBackToList = () => {
    setCurrentView('list');
    setSelectedPrestamoId('');
    setFeinResult(null);
    setFeinLoanData(null);
  };

  const handleFEINProcessed = (result: FEINProcessingResult) => {
    setFeinResult(result);
    if (result.success && result.data) {
      setCurrentView('fein-validation');
    } else {
      // If FEIN processing failed, show error and option to create manually
      alert('No se pudo procesar el documento FEIN. Puede crear el préstamo manualmente.');
      setCurrentView('create');
    }
  };

  const handleFEINValidated = (loanData: Partial<PrestamoFinanciacion>) => {
    setFeinLoanData(loanData);
    setCurrentView('create'); // Go to creation with pre-filled data
  };

  const renderContent = () => {
    switch (currentView) {
      case 'create':
        return (
          <PrestamosCreation
            prestamoId={selectedPrestamoId}
            initialData={feinLoanData || undefined} // Pass FEIN data if available
            onSuccess={handleBackToList}
            onCancel={handleBackToList}
          />
        );
      case 'edit':
        return (
          <PrestamosCreation
            prestamoId={selectedPrestamoId}
            onSuccess={handleBackToList}
            onCancel={handleBackToList}
          />
        );
      case 'fein-upload':
        return (
          <FEINUploader
            onFEINProcessed={handleFEINProcessed}
            onCancel={handleBackToList}
          />
        );
      case 'fein-validation':
        return feinResult ? (
          <FEINValidation
            feinResult={feinResult}
            onContinue={handleFEINValidated}
            onBack={() => setCurrentView('fein-upload')}
          />
        ) : null;
      case 'list':
      default:
        return (
          <PrestamosList
            onEdit={handleEdit}
          />
        );
    }
  };

  if (currentView === 'create' || currentView === 'edit' || currentView === 'fein-upload' || currentView === 'fein-validation') {
    // Don't wrap creation/edit/FEIN views in PageLayout since they have their own navigation
    return <div className="min-h-screen bg-bg">{renderContent()}</div>;
  }

  return (
    <PageLayout 
      title="Financiación" 
      subtitle="Alta y gestión de préstamos manuales para ATLAS Horizon."
      primaryAction={{
        label: "Crear Préstamo",
        onClick: handleCreateNew
      }}
      secondaryActions={[
        {
          label: "Crear desde FEIN",
          onClick: handleCreateFromFEIN
        }
      ]}
    >
      {renderContent()}
    </PageLayout>
  );
};

export default Financiacion;