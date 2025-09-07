import React, { useState } from 'react';
import PageLayout from '../../../../components/common/PageLayout';
import PrestamosList from './components/PrestamosList';
import PrestamoDetail from './components/PrestamoDetail';

type View = 'list' | 'detail' | 'create';

const Prestamos: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('list');
  const [selectedPrestamoId, setSelectedPrestamoId] = useState<string>('');

  const handleSelectPrestamo = (prestamoId: string) => {
    setSelectedPrestamoId(prestamoId);
    setCurrentView('detail');
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
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-[#0F172A] mb-4">
              Crear nuevo préstamo
            </h2>
            <p className="text-[#6B7280] mb-6">
              Funcionalidad de creación en desarrollo
            </p>
            <button
              onClick={handleBackToList}
              className="px-4 py-2 bg-[#022D5E] text-white rounded-lg hover:bg-[#033A73] transition-colors"
            >
              Volver a la lista
            </button>
          </div>
        );
      case 'list':
      default:
        return (
          <PrestamosList
            onSelectPrestamo={handleSelectPrestamo}
            onCreateNew={handleCreateNew}
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