import React, { useState } from 'react';
import PageLayout from '../../../components/common/PageLayout';
import PrestamosCreation from './components/PrestamosCreation';
import PrestamosList from './components/PrestamosList';
import FEINUploader from '../../../components/financiacion/FEINUploader';
import { FeinLoanDraft } from '../../../types/fein';
import { PrestamoFinanciacion } from '../../../types/financiacion';

type View = 'list' | 'create' | 'edit' | 'fein-upload';

const Financiacion: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('list');
  const [selectedPrestamoId, setSelectedPrestamoId] = useState<string>('');
  const [feinLoanDraft, setFeinLoanDraft] = useState<FeinLoanDraft | null>(null);

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
    setFeinLoanDraft(null);
  };

  const handleFEINDraftReady = (draft: FeinLoanDraft) => {
    console.log('[Financiacion] FEIN draft ready:', draft);
    setFeinLoanDraft(draft);
    setCurrentView('create'); // Go directly to creation with pre-filled data
  };

  const renderContent = () => {
    switch (currentView) {
      case 'create':
        return (
          <PrestamosCreation
            prestamoId={selectedPrestamoId}
            feinDraft={feinLoanDraft} // Pass FEIN draft if available
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
            onFEINDraftReady={handleFEINDraftReady}
            onCancel={handleBackToList}
          />
        );
      case 'list':
      default:
        return (
          <PrestamosList
            onEdit={handleEdit}
          />
        );
    }
  };

  if (currentView === 'create' || currentView === 'edit' || currentView === 'fein-upload') {
    // Don't wrap creation/edit/FEIN views in PageLayout since they have their own navigation
    return <div className="min-h-screen bg-bg">{renderContent()}</div>;
  }

  return (
    <PageLayout 
      title="Financiación" 
      subtitle="Alta y gestión de préstamos manuales para ATLAS Horizon."
      primaryAction={{
        label: "Crear desde FEIN (PDF)",
        onClick: handleCreateFromFEIN
      }}
      secondaryActions={[
        {
          label: "Crear Préstamo",
          onClick: handleCreateNew
        }
      ]}
    >
      {renderContent()}
    </PageLayout>
  );
};

export default Financiacion;