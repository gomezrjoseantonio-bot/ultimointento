import React from 'react';
import RadarPanel from './components/RadarPanel';

const Tesoreria: React.FC = () => {
  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-navy-900">
                  Tesorería
                </h1>
                <p className="mt-1 text-sm text-neutral-500">
                  Gestión centralizada de cuentas, movimientos y automatizaciones
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <RadarPanel />
      </div>
    </div>
  );
};

export default Tesoreria;