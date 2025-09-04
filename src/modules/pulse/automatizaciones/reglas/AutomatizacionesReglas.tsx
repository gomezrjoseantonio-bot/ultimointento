import React from 'react';
import PageLayout from '../../../../components/layout/PageLayout';

const AutomatizacionesReglas: React.FC = () => {
  return (
    <PageLayout 
      title="Automatizaciones" 
      subtitle="Reglas y flujos automatizados de gestión"
    >
      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Reglas de Automatización</h3>
            <button className="px-4 py-2 bg-brand-teal text-white rounded-md hover:bg-teal-600 transition-colors">
              Nueva Regla
            </button>
          </div>
          <p className="text-gray-500">Configura automatizaciones para gestión de contratos, cobros y tareas.</p>
          
          <div className="mt-6">
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <p className="text-gray-500">No hay reglas configuradas</p>
              <p className="text-sm text-gray-400 mt-1">Crea reglas para automatizar procesos de gestión</p>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default AutomatizacionesReglas;