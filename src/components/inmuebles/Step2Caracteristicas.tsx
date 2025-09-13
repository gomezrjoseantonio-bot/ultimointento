// Step 2: Características físicas - Superficie, Habitaciones, Baños, Año construcción
// Following Horizon design system with clean icon-based inputs

import React, { useState, useEffect } from 'react';
import { HomeIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { Square, Bed, Bath } from 'lucide-react';
import { InmuebleStep2 } from '../../types/inmueble';
import { validateStep2 } from '../../utils/inmuebleUtils';

interface Step2CaracteristicasProps {
  data: InmuebleStep2;
  onChange: (data: InmuebleStep2) => void;
  errors?: string[];
}

const Step2Caracteristicas: React.FC<Step2CaracteristicasProps> = ({
  data,
  onChange,
  errors = []
}) => {
  const [localErrors, setLocalErrors] = useState<string[]>([]);

  // Validate on data change
  useEffect(() => {
    const validation = validateStep2(data);
    setLocalErrors(validation.errors);
  }, [data]);

  const allErrors = [...errors, ...localErrors];

  const updateCaracteristicas = (field: string, value: any) => {
    onChange({
      ...data,
      caracteristicas: {
        ...data.caracteristicas,
        [field]: value
      }
    });
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-hz-text mb-2 font-inter">
          Paso 2 · Características físicas
        </h2>
        <p className="text-sm text-gray-600">
          Información sobre las dimensiones y características del inmueble. Solo la superficie es obligatoria.
        </p>
      </div>

      {/* Form Fields in Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Superficie Card */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center mb-4">
            <Square className="w-5 h-5 text-hz-primary mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Superficie</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Metros cuadrados *
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={data.caracteristicas?.m2 || ''}
                  onChange={(e) => updateCaracteristicas('m2', parseFloat(e.target.value) || 0)}
                  placeholder="Ej: 85.50"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-md shadow-sm focus:ring-hz-primary focus:border-hz-primary"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-gray-500 text-sm">m²</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Superficie útil del inmueble
              </p>
            </div>
          </div>
        </div>

        {/* Habitaciones Card */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center mb-4">
            <Bed className="w-5 h-5 text-hz-primary mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Habitaciones</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Número de habitaciones
              </label>
              <input
                type="number"
                value={data.caracteristicas?.habitaciones || ''}
                onChange={(e) => updateCaracteristicas('habitaciones', parseInt(e.target.value) || 0)}
                placeholder="Ej: 3"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-hz-primary focus:border-hz-primary"
              />
              <p className="text-xs text-gray-500 mt-1">
                Incluyendo dormitorios y estudio
              </p>
            </div>
          </div>
        </div>

        {/* Baños Card */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center mb-4">
            <Bath className="w-5 h-5 text-hz-primary mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Baños</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Número de baños
              </label>
              <input
                type="number"
                value={data.caracteristicas?.banos || ''}
                onChange={(e) => updateCaracteristicas('banos', parseInt(e.target.value) || 0)}
                placeholder="Ej: 2"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-hz-primary focus:border-hz-primary"
              />
              <p className="text-xs text-gray-500 mt-1">
                Incluyendo aseos completos y medios baños
              </p>
            </div>
          </div>
        </div>

        {/* Año de Construcción Card */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center mb-4">
            <CalendarIcon className="w-5 h-5 text-hz-primary mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Año de construcción</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Año (opcional)
              </label>
              <input
                type="number"
                value={data.caracteristicas?.anio_construccion || ''}
                onChange={(e) => updateCaracteristicas('anio_construccion', parseInt(e.target.value) || undefined)}
                placeholder="Ej: 1990"
                min="1800"
                max="2100"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-hz-primary focus:border-hz-primary"
              />
              <p className="text-xs text-gray-500 mt-1">
                Campo opcional, puede completarse más adelante
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Information */}
      {data.caracteristicas?.m2 && data.caracteristicas.m2 > 0 && (
        <div className="mt-6 bg-hz-primary bg-opacity-5 border border-hz-primary border-opacity-20 rounded-lg p-4">
          <div className="flex items-center">
            <HomeIcon className="w-5 h-5 text-hz-primary mr-2" />
            <h4 className="text-sm font-medium text-hz-primary">Resumen de características</h4>
          </div>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Superficie:</span>
              <span className="ml-1 font-medium">{data.caracteristicas.m2} m²</span>
            </div>
            {data.caracteristicas.habitaciones !== undefined && (
              <div>
                <span className="text-gray-600">Habitaciones:</span>
                <span className="ml-1 font-medium">{data.caracteristicas.habitaciones}</span>
              </div>
            )}
            {data.caracteristicas.banos !== undefined && (
              <div>
                <span className="text-gray-600">Baños:</span>
                <span className="ml-1 font-medium">{data.caracteristicas.banos}</span>
              </div>
            )}
            {data.caracteristicas.anio_construccion && (
              <div>
                <span className="text-gray-600">Año:</span>
                <span className="ml-1 font-medium">{data.caracteristicas.anio_construccion}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Messages */}
      {allErrors.length > 0 && (
        <div className="mt-6 bg-error-50 border border-error-200 rounded-md p-4">
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

      {/* Help Text */}
      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-800 mb-2">
          💡 Información de ayuda
        </h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Solo la superficie es obligatoria para continuar</li>
          <li>• El resto de campos pueden completarse más adelante</li>
          <li>• La superficie se utilizará para calcular el precio por m²</li>
          <li>• Esta información será útil para análisis comparativo</li>
        </ul>
      </div>
    </div>
  );
};

export default Step2Caracteristicas;