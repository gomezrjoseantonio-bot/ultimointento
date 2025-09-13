import React, { useState } from 'react';
import PageLayout from '../../../components/common/PageLayout';
import PrestamosCreation from './components/PrestamosCreation';
import PrestamosList from './components/PrestamosList';

type View = 'list' | 'create' | 'edit';

const Financiacion: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('list');
  const [selectedPrestamoId, setSelectedPrestamoId] = useState<string>('');

  const handleCreateNew = () => {
    setCurrentView('create');
  };

  const handleEdit = (prestamoId: string) => {
    setSelectedPrestamoId(prestamoId);
    setCurrentView('edit');
  };

  const handleBackToList = () => {
    setCurrentView('list');
    setSelectedPrestamoId('');
  };

  const renderContent = () => {
    switch (currentView) {
      case 'create':
        return (
          <PrestamosCreation
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
      case 'list':
      default:
        return (
          <PrestamosList
            onCreateNew={handleCreateNew}
            onEdit={handleEdit}
          />
        );
    }
  };

  if (currentView === 'create' || currentView === 'edit') {
    // Don't wrap creation/edit views in PageLayout since they have their own navigation
    return <div className="min-h-screen bg-bg">{renderContent()}</div>;
  }

  return (
    <PageLayout 
      title="Financiación" 
      subtitle="Alta y gestión de préstamos manuales para ATLAS Horizon."
    >
      {renderContent()}
    </PageLayout>
  );
};

export default Financiacion;