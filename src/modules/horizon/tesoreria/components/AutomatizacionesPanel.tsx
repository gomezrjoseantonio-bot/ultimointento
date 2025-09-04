import React from 'react';
import { Settings, AlertTriangle, Clock, Check } from 'lucide-react';

const AutomatizacionesPanel: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Automatizaciones</h2>
        <p className="text-sm text-gray-500 mt-1">
          Reglas simples de alertas y sweeps automáticos
        </p>
      </div>

      {/* Coming Soon Notice */}
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <div className="mx-auto w-16 h-16 bg-brand-teal bg-opacity-10 rounded-full flex items-center justify-center mb-4">
          <Settings className="w-8 h-8 text-brand-teal" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          En construcción
        </h3>
        <p className="text-gray-500 mb-6">
          Próximo hito: funcionalidades de automatización bancaria.
        </p>
        
        {/* Preview Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <div className="bg-gray-50 rounded-lg p-4">
            <AlertTriangle className="w-6 h-6 text-orange-500 mx-auto mb-2" />
            <h4 className="font-medium text-gray-900 mb-1">Alertas de Saldo</h4>
            <p className="text-sm text-gray-600">
              Notificaciones automáticas cuando las cuentas estén por debajo del mínimo
            </p>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <Clock className="w-6 h-6 text-blue-500 mx-auto mb-2" />
            <h4 className="font-medium text-gray-900 mb-1">Sweeps Programados</h4>
            <p className="text-sm text-gray-600">
              Transferencias automáticas entre cuentas según reglas definidas
            </p>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <Check className="w-6 h-6 text-green-500 mx-auto mb-2" />
            <h4 className="font-medium text-gray-900 mb-1">Conciliación Auto</h4>
            <p className="text-sm text-gray-600">
              Matching automático de movimientos con facturas y recibos
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutomatizacionesPanel;