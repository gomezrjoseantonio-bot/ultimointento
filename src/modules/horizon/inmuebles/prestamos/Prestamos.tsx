import React, { useState } from 'react';
import PageLayout from '../../../../components/common/PageLayout';
import PrestamosList from './components/PrestamosList';
import PrestamoDetail from './components/PrestamoDetail';
import PrestamoForm from './components/PrestamoForm';

type View = 'list' | 'detail' | 'create' | 'edit';

const Prestamos: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('list');
  const [selectedPrestamoId, setSelectedPrestamoId] = useState<string>('');

  const handleSelectPrestamo = (prestamoId: string) => {
    setSelectedPrestamoId(prestamoId);
    setCurrentView('detail');
  };

  const handleEditPrestamo = (prestamoId: string) => {
    setSelectedPrestamoId(prestamoId);
    setCurrentView('edit');
  };

  const handleBackToList = () => {
    setCurrentView('list');
    setSelectedPrestamoId('');
  };

  const handleCreateNew = () => {
    setCurrentView('create');
  };

  const renderContent = () => {
    switch (currentView) {
      case 'detail':
        return (
          <PrestamoDetail
            prestamoId={selectedPrestamoId}
            onBack={handleBackToList}
          />
        );
      case 'create':
        return (
          <PrestamoForm
            onSuccess={(prestamo) => {
              setSelectedPrestamoId(prestamo.id);
              setCurrentView('detail');
            }}
            onCancel={handleBackToList}
          />
        );
      case 'edit':
        return (
          <PrestamoForm
            prestamoId={selectedPrestamoId}
            onSuccess={(prestamo) => {
              setSelectedPrestamoId(prestamo.id);
              setCurrentView('detail');
            }}
            onCancel={handleBackToList}
          />
        );
      case 'list':
      default:
        return (
          <PrestamosList
            onSelectPrestamo={handleSelectPrestamo}
            onEditPrestamo={handleEditPrestamo}
            onCreateNew={handleCreateNew}
          />
        );
    }
  };

  if (currentView === 'detail' || currentView === 'create' || currentView === 'edit') {
    // Don't wrap detail or create view in PageLayout since they have their own navigation
    return <div className="p-6">{renderContent()}</div>;
  }

  return (
    <PageLayout 
      title="Préstamos" 
      subtitle="Seguimiento de financiación inmobiliaria con calendario realista y cuotas irregulares."
    >
      {renderContent()}
    </PageLayout>
  );
};

export default Prestamos;