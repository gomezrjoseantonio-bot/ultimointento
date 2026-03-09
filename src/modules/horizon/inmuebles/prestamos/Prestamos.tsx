import React, { useState } from 'react';
import PageLayout from '../../../../components/common/PageLayout';
import PrestamosList from './components/PrestamosList';
import PrestamoDetail from './components/PrestamoDetail';

type View = 'list' | 'detail';

const Prestamos: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('list');
  const [selectedPrestamoId, setSelectedPrestamoId] = useState<string>('');

  const handleSelectPrestamo = (prestamoId: string) => {
    setSelectedPrestamoId(prestamoId);
    setCurrentView('detail');
  };

  const handleEditPrestamo = (prestamoId: string) => {
    setSelectedPrestamoId(prestamoId);
    setCurrentView('detail');
  };

  const handleBackToList = () => {
    setCurrentView('list');
    setSelectedPrestamoId('');
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
      case 'list':
      default:
        return (
          <PrestamosList
            onSelectPrestamo={handleSelectPrestamo}
            onEditPrestamo={handleEditPrestamo}
            onCreateNew={() => {}}
          />
        );
    }
  };

  if (currentView === 'detail') {
    // Don't wrap detail view in PageLayout since it has its own navigation
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