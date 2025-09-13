import React from 'react';
import DynamicImportDemo from '../components/DynamicImportDemo';

const UnicornioInboxPrompt: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-4">Unicornio Inbox</h1>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-blue-800">
            Esta página ha sido temporalmente simplificada para demostrar las optimizaciones de bundle.
          </p>
          <p className="text-blue-600 mt-2">
            Las funcionalidades de procesamiento de documentos volverán en la próxima actualización.
          </p>
        </div>
      </div>
      
      {/* Bundle Optimization Demo */}
      <DynamicImportDemo />
    </div>
  );
};

export default UnicornioInboxPrompt;