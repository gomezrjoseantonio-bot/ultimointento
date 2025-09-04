import React from 'react';
import PageLayout from '../../../../components/layout/PageLayout';

const ContratosLista: React.FC = () => {
  return (
    <PageLayout 
      title="Contratos" 
      subtitle="Gestión de contratos y documentación"
    >
      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Lista de Contratos</h3>
            <button className="px-4 py-2 bg-brand-teal text-white rounded-md hover:bg-teal-600 transition-colors">
              Nuevo Contrato
            </button>
          </div>
          <p className="text-gray-500">Gestiona la creación, firma y administración de contratos.</p>
          
          <div className="mt-6">
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <p className="text-gray-500">No hay contratos registrados</p>
              <p className="text-sm text-gray-400 mt-1">Comienza creando tu primer contrato</p>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default ContratosLista;