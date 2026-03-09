import React from 'react';
import PageLayout from '../../../../components/common/PageLayout';

const TareasPendientes: React.FC = () => {
  return (
    <PageLayout 
      title="Tareas" 
      subtitle="Gestión de tareas operativas"
    >
      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Tareas Pendientes</h3>
            <button className="px-4 py-2 bg-brand-teal text-white rounded-md hover:bg-teal-600 transition-colors">
              Nueva Tarea
            </button>
          </div>
          <p className="text-gray-500">Gestiona y programa tareas operativas y seguimiento.</p>
          
          <div className="mt-6">
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <p className="text-gray-500">No hay tareas pendientes</p>
              <p className="text-sm text-gray-400 mt-1">Las tareas asignadas y pendientes aparecerán aquí</p>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default TareasPendientes;