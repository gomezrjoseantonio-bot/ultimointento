import React, { useState } from 'react';
import { Settings, Info, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * ReglasAlertas - ATLAS Design System
 * 
 * Rules for movement classification per ATLAS guide:
 * - Rules classify movements, not accounts
 * - Can assign: class (Personal/Inmuebles + category/subcategory), property, provider, alerts
 * - Examples: "If description contains IBI and account = ESxx... → Class: Inmuebles > Suministros > Agua; Property: Tenderina 48"
 */
const ReglasAlertas: React.FC = () => {
  const [rules] = useState([
    {
      id: 1,
      name: 'IBI - Clasificación automática',
      description: 'Si descripción contiene IBI → Inmuebles > Suministros > Agua',
      condition: 'description contains "IBI"',
      action: 'Classify as Inmuebles > Suministros > Agua',
      active: true
    },
    {
      id: 2, 
      name: 'Nómina - Personal',
      description: 'Si descripción contiene NÓMINA → Personal > Ingresos > Nómina',
      condition: 'description contains "NÓMINA"',
      action: 'Classify as Personal > Ingresos > Nómina',
      active: true
    },
    {
      id: 3,
      name: 'Alquiler - Inmuebles',
      description: 'Si importe > 500€ y concepto contiene "ALQUILER" → Inmuebles > Ingresos > Alquiler',
      condition: 'amount > 500 AND description contains "ALQUILER"',
      action: 'Classify as Inmuebles > Ingresos > Alquiler',
      active: true
    }
  ]);

  const handleNewRule = () => {
    toast.success('Funcionalidad de nueva regla en desarrollo');
  };

  return (
    <div className="px-6">
      {/* ATLAS Info Banner */}
      <div className="mb-6 bg-blue-50 border border-atlas-blue/20 rounded-lg p-4">
        <div className="flex items-start">
          <Info className="w-5 h-5 text-atlas-blue mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-atlas-navy-1 mb-1">Reglas de clasificación</h3>
            <p className="text-sm text-text-gray">
              Las reglas clasifican movimientos automáticamente según condiciones simples (importe, texto, IBAN, proveedor). 
              Permiten asignar categoría, subcategoría, inmueble, proveedor y generar alertas.
            </p>
          </div>
        </div>
      </div>

      {/* Rules List */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-atlas-navy-1">
              Reglas de clasificación ({rules.length})
            </h2>
            <button
              onClick={handleNewRule}
              className="inline-flex items-center px-4 py-2 bg-atlas-blue text-white rounded-lg hover:bg-navy-800 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nueva regla
            </button>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {rules.map((rule) => (
            <div key={rule.id} className="px-6 py-4 hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-atlas-blue/10 rounded-full flex items-center justify-center mt-1">
                    <Settings className="w-4 h-4 text-atlas-blue" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-medium text-atlas-navy-1">{rule.name}</h3>
                      {rule.active ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Activa
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Inactiva
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-text-gray mt-1">{rule.description}</p>
                    <div className="mt-2 space-y-1">
                      <div className="text-xs text-text-gray">
                        <strong>Condición:</strong> {rule.condition}
                      </div>
                      <div className="text-xs text-text-gray">
                        <strong>Acción:</strong> {rule.action}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-sm text-text-gray">
                  Reglas ATLAS
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Examples Section */}
      <div className="mt-8 bg-white rounded-lg shadow border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-atlas-navy-1">Ejemplos de reglas ATLAS</h3>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <h4 className="font-medium text-atlas-navy-1 mb-2">Clasificación por descripción</h4>
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <code>Si descripción contiene "IBI" y cuenta = ESxx... → Clase: Inmuebles &gt; Suministros &gt; Agua; Inmueble: Tenderina 48</code>
            </div>
          </div>
          <div>
            <h4 className="font-medium text-atlas-navy-1 mb-2">Clasificación por tipo de ingreso</h4>
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <code>Si descripción contiene "NÓMINA" → Clase: Personal &gt; Ingresos &gt; Nómina</code>
            </div>
          </div>
          <div>
            <h4 className="font-medium text-atlas-navy-1 mb-2">Clasificación combinada</h4>
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <code>Si importe &gt; 500€ y concepto contiene "ALQUILER" → Inmuebles &gt; Ingresos &gt; Alquiler + Alerta</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReglasAlertas;