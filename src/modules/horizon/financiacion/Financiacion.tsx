import React, { useState } from 'react';
import PageLayout from '../../../components/common/PageLayout';
import PrestamosCreation from './components/PrestamosCreation';
import PrestamosList from './components/PrestamosList';
import FEINUploader from '../../../components/financiacion/FEINUploader';
import { FeinLoanDraft } from '../../../types/fein';
import { PrestamoFinanciacion } from '../../../types/financiacion';
import { FeinToPrestamoMapper } from '../../../services/fein/feinToPrestamoMapper';

type View = 'list' | 'create' | 'edit' | 'fein-upload';

const Financiacion: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('list');
  const [selectedPrestamoId, setSelectedPrestamoId] = useState<string>('');
  const [feinInitialData, setFeinInitialData] = useState<Partial<PrestamoFinanciacion> | null>(null);

  const handleCreateNew = () => {
    setFeinInitialData(null); // Clear any FEIN data
    setCurrentView('create');
  };

  const handleCreateFromFEIN = () => {
    setCurrentView('fein-upload');
  };

  const handleEdit = (prestamoId: string) => {
    setSelectedPrestamoId(prestamoId);
    setFeinInitialData(null); // Clear FEIN data for edits
    setCurrentView('edit');
  };

  const handleBackToList = () => {
    setCurrentView('list');
    setSelectedPrestamoId('');
    setFeinInitialData(null);
  };

  const handleFEINDraftReady = (draft: FeinLoanDraft) => {
    console.log('[Financiacion] FEIN draft ready:', draft);
    
    // Map FEIN draft to PrestamoFinanciacion format
    const mappedData = FeinToPrestamoMapper.mapToPrestamoFinanciacion(draft);
    const mappingInfo = FeinToPrestamoMapper.generateMappingInfo(draft);
    
    console.log('[Financiacion] Mapped FEIN data:', mappedData);
    console.log('[Financiacion] Mapping info:', mappingInfo);
    
    // Store mapped data
    setFeinInitialData(mappedData);
    
    // Show mapping summary if there are important warnings
    if (mappingInfo.warnings.length > 0 || mappingInfo.missingFields.length > 0) {
      const warningMsg = [
        mappingInfo.missingFields.length > 0 ? 
          `Campos pendientes: ${mappingInfo.missingFields.join(', ')}` : '',
        ...mappingInfo.warnings.slice(0, 2) // Limit to 2 warnings
      ].filter(Boolean).join('. ');
      
      if (warningMsg) {
        alert(`Datos extraídos del FEIN. ${warningMsg}.`);
      }
    }
    
    // Go directly to creation form with pre-filled data
    setCurrentView('create');
  };

  const renderContent = () => {
    switch (currentView) {
      case 'create':
        return (
          <PrestamosCreation
            prestamoId={selectedPrestamoId}
            initialData={feinInitialData || undefined} // Pass mapped FEIN data if available
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