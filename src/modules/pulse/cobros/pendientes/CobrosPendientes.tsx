import React from 'react';
import PageLayout from '../../../../components/layout/PageLayout';

const CobrosPendientes: React.FC = () => {
  return (
    <PageLayout 
      title="Cobros" 
      subtitle="Gestión de cobros y conciliación"
    >
      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Cobros Pendientes</h3>
            <button className="px-4 py-2 bg-brand-teal text-white rounded-md hover:bg-teal-600 transition-colors">
              Nuevo Cobro
            </button>
          </div>
          <p className="text-gray-500">Gestiona cobros pendientes y procesos de conciliación bancaria.</p>
          
          <div className="mt-6">
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <p className="text-gray-500">No hay cobros pendientes</p>
              <p className="text-sm text-gray-400 mt-1">Los cobros pendientes y conciliaciones aparecerán aquí</p>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default CobrosPendientes;