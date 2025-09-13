// Step 4: Fiscalidad y amortización - Valores catastrales, % construcción, tipo fiscal
// Following Horizon design system with automatic calculations

import React, { useState, useEffect } from 'react';
import { DocumentChartBarIcon, CalculatorIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { InmuebleStep4, MetodoAmortizacion } from '../../types/inmueble';
import { validateStep4, calculateConstructionPercentage, formatEuroAmount } from '../../utils/inmuebleUtils';

interface Step4FiscalidadProps {
  data: InmuebleStep4;
  onChange: (data: InmuebleStep4) => void;
  errors?: string[];
}

const Step4Fiscalidad: React.FC<Step4FiscalidadProps> = ({
  data,
  onChange,
  errors = []
}) => {
  const [localErrors, setLocalErrors] = useState<string[]>([]);

  // Validate on data change
  useEffect(() => {
    const validation = validateStep4(data);
    setLocalErrors(validation.errors);
  }, [data]);

  // Auto-calculate construction percentage when values change
  useEffect(() => {
    if (data.fiscalidad?.valor_catastral_total && data.fiscalidad?.valor_catastral_construccion) {
      const percentage = calculateConstructionPercentage(
        data.fiscalidad.valor_catastral_construccion,
        data.fiscalidad.valor_catastral_total
      );
      
      updateFiscalidad('porcentaje_construccion', percentage);
    }
  }, [data.fiscalidad?.valor_catastral_total, data.fiscalidad?.valor_catastral_construccion]);

  const allErrors = [...errors, ...localErrors];

  const updateFiscalidad = (field: string, value: any) => {
    onChange({
      ...data,
      fiscalidad: {
        ...data.fiscalidad,
        [field]: value
      }
    });
  };

  const formatCurrency = (value: number | undefined): string => {
    return value ? formatEuroAmount(value) : '0,00 €';
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-hz-text mb-2 font-inter">
          Paso 4 · Fiscalidad y amortización
        </h2>
        <p className="text-sm text-gray-600">
          Información fiscal para el cálculo de amortizaciones y declaraciones
        </p>
      </div>

      <div className="space-y-6">
        
        {/* Valores catastrales */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center mb-4">
            <DocumentChartBarIcon className="w-5 h-5 text-hz-primary mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Valores catastrales</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Valor catastral total (VC)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={data.fiscalidad?.valor_catastral_total || ''}
                  onChange={(e) => updateFiscalidad('valor_catastral_total', parseFloat(e.target.value) || 0)}
                  placeholder="Ej: 150000"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-md shadow-sm focus:ring-hz-primary focus:border-hz-primary"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-gray-500 text-sm">€</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Valor catastral completo del inmueble
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Valor catastral construcción (VCc)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={data.fiscalidad?.valor_catastral_construccion || ''}
                  onChange={(e) => updateFiscalidad('valor_catastral_construccion', parseFloat(e.target.value) || 0)}
                  placeholder="Ej: 135000"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-md shadow-sm focus:ring-hz-primary focus:border-hz-primary"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-gray-500 text-sm">€</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Valor catastral correspondiente a la construcción
              </p>
            </div>
          </div>

          {/* Porcentaje de construcción calculado automáticamente */}
          {data.fiscalidad?.valor_catastral_total && data.fiscalidad?.valor_catastral_construccion && (
            <div className="mt-6 bg-hz-primary bg-opacity-5 border border-hz-primary border-opacity-20 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <CalculatorIcon className="w-4 h-4 text-hz-primary mr-2" />
                <span className="text-sm font-medium text-hz-primary">Cálculo automático</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">% Construcción:</span>
                  <span className="ml-1 font-medium text-hz-primary">
                    {data.fiscalidad.porcentaje_construccion?.toFixed(4)}%
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Valor suelo:</span>
                  <span className="ml-1 font-medium">
                    {formatCurrency(
                      data.fiscalidad.valor_catastral_total - data.fiscalidad.valor_catastral_construccion
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">% Suelo:</span>
                  <span className="ml-1 font-medium">
                    {(100 - (data.fiscalidad.porcentaje_construccion || 0)).toFixed(4)}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Posibilidad de editar el porcentaje manualmente */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              % Construcción (editable)
            </label>
            <div className="relative">
              <input
                type="number"
                value={data.fiscalidad?.porcentaje_construccion || ''}
                onChange={(e) => updateFiscalidad('porcentaje_construccion', parseFloat(e.target.value) || 0)}
                placeholder="Calculado automáticamente"
                min="0"
                max="100"
                step="0.0001"
                className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-md shadow-sm focus:ring-hz-primary focus:border-hz-primary bg-gray-50"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                <span className="text-gray-500 text-sm">%</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Se calcula automáticamente pero puede editarse manualmente si es necesario
            </p>
          </div>
        </div>

        {/* Tipo fiscal y amortización */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center mb-4">
            <InformationCircleIcon className="w-5 h-5 text-hz-primary mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Configuración fiscal</h3>
          </div>
          
          <div className="space-y-4">
            
            {/* Tipo de adquisición (fijo, no editable) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo fiscal
              </label>
              <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                <span className="text-sm text-gray-700">Lucrativa onerosa</span>
                <p className="text-xs text-gray-500 mt-1">
                  Fijo para el cálculo de alquileres (no editable)
                </p>
              </div>
            </div>

            {/* Método de amortización */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Método de amortización
              </label>
              <select
                value={data.fiscalidad?.metodo_amortizacion || 'REGLA_GENERAL_3'}
                onChange={(e) => updateFiscalidad('metodo_amortizacion', e.target.value as MetodoAmortizacion)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-hz-primary focus:border-hz-primary"
              >
                <option value="REGLA_GENERAL_3">Regla general 3%</option>
                <option value="ESPECIAL">Caso especial</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Por defecto se usa la regla general del 3% sobre la base mayor
              </p>
            </div>

            {/* Porcentaje de amortización (informativo) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                % Amortización anual (informativo)
              </label>
              <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                <span className="text-sm text-gray-700">
                  {data.fiscalidad?.porcentaje_amortizacion_info?.toFixed(4) || '3.0000'}%
                </span>
                <p className="text-xs text-gray-500 mt-1">
                  Porcentaje aplicado sobre la base de amortización
                </p>
              </div>
            </div>

            {/* Base de amortización (calculada) */}
            {data.fiscalidad?.valor_catastral_construccion && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Base de amortización anual
                </label>
                <div className="bg-hz-primary bg-opacity-5 border border-hz-primary border-opacity-20 rounded-md p-3">
                  <span className="text-sm font-medium text-hz-primary">
                    {formatCurrency(data.fiscalidad.valor_catastral_construccion)}
                  </span>
                  <p className="text-xs text-gray-600 mt-1">
                    Calculada sobre el valor catastral de construcción
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notas adicionales */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Notas fiscales</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Aclaraciones (opcional)
            </label>
            <textarea
              value={data.fiscalidad?.nota || ''}
              onChange={(e) => updateFiscalidad('nota', e.target.value)}
              placeholder="Casos especiales, aclaraciones AEAT, etc."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-hz-primary focus:border-hz-primary"
            />
            <p className="text-xs text-gray-500 mt-1">
              Campo opcional para casos especiales o aclaraciones puntuales
            </p>
          </div>
        </div>

        {/* Información de ayuda */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-yellow-800 mb-2">
            💡 Información importante
          </h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• Todos los campos de este paso son opcionales</li>
            <li>• Los valores catastrales se pueden obtener de la sede electrónica del Catastro</li>
            <li>• El % de construcción se calcula automáticamente pero puede editarse</li>
            <li>• Esta información se usa para el cálculo de amortizaciones fiscales</li>
            <li>• Puede completarse o modificarse más adelante</li>
          </ul>
        </div>

        {/* Error Messages */}
        {allErrors.length > 0 && (
          <div className="bg-error-50 border border-error-200 rounded-md p-4">
            <h4 className="text-sm font-medium text-error-800 mb-2">
              Errores de validación:
            </h4>
            <ul className="text-sm text-error-700 space-y-1">
              {allErrors.map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default Step4Fiscalidad;