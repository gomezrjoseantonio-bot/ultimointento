// Step 1: Identificación - Alias, Dirección, CP with autocomplete
// Following Horizon design system with clean input styling

import React, { useState, useEffect } from 'react';
import { MapPin, Building2, Hash } from 'lucide-react';
import { InmuebleStep1, EstadoInmueble, ComunidadAutonoma } from '../../types/inmueble';
import { getLocationFromPostalCode, validatePostalCode } from '../../utils/locationUtils';
import { validateStep1 } from '../../utils/inmuebleUtils';

interface Step1IdentificacionProps {
  data: InmuebleStep1;
  onChange: (data: InmuebleStep1) => void;
  errors?: string[];
}

const Step1Identificacion: React.FC<Step1IdentificacionProps> = ({
  data,
  onChange,
  errors = []
}) => {
  const [localErrors, setLocalErrors] = useState<string[]>([]);
  const [isAutoCompleting, setIsAutoCompleting] = useState(false);

  // Auto-complete location when postal code changes
  const handlePostalCodeChange = async (cp: string) => {
    const newData = {
      ...data,
      direccion: {
        ...data.direccion,
        cp
      }
    };

    if (validatePostalCode(cp)) {
      setIsAutoCompleting(true);
      const locationData = getLocationFromPostalCode(cp);
      
      if (locationData) {
        newData.direccion = {
          ...newData.direccion,
          municipio: locationData.municipalities[0] || '',
          provincia: locationData.province,
          ca: locationData.ccaa as ComunidadAutonoma
        };
      }
      setIsAutoCompleting(false);
    }

    onChange(newData);
  };

  // Validate on data change
  useEffect(() => {
    const validation = validateStep1(data);
    setLocalErrors(validation.errors);
  }, [data]);

  const allErrors = [...errors, ...localErrors];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-hz-text mb-2 font-inter">
          Paso 1 · Identificación
        </h2>
        <p className="text-sm text-gray-600">
          Información básica del inmueble y su ubicación
        </p>
      </div>

      {/* Form Fields */}
      <div className="space-y-6">
        
        {/* Alias */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Building2 className="w-4 h-4 inline mr-2"  />
            Alias *
          </label>
          <input
            type="text"
            value={data.alias || ''}
            onChange={(e) => onChange({
              ...data,
              alias: e.target.value
            })}
            placeholder="Ej: Piso Centro, Casa Playa..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-hz-primary focus:border-hz-primary"
            maxLength={80}
          />
          <p className="text-xs text-gray-500 mt-1">
            Nombre corto para identificar el inmueble (máx. 80 caracteres)
          </p>
        </div>

        {/* Dirección */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="w-4 h-4 inline mr-2" size={24}  />
              Calle *
            </label>
            <input
              type="text"
              value={data.direccion?.calle || ''}
              onChange={(e) => onChange({
                ...data,
                direccion: {
                  ...data.direccion,
                  calle: e.target.value
                }
              })}
              placeholder="Nombre de la calle"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-hz-primary focus:border-hz-primary"
              maxLength={120}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Número *
            </label>
            <input
              type="text"
              value={data.direccion?.numero || ''}
              onChange={(e) => onChange({
                ...data,
                direccion: {
                  ...data.direccion,
                  numero: e.target.value
                }
              })}
              placeholder="Nº"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-hz-primary focus:border-hz-primary" maxLength={10} />
          </div>
        </div>

        {/* Piso y Puerta */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Piso
            </label>
            <input
              type="text"
              value={data.direccion?.piso || ''}
              onChange={(e) => onChange({
                ...data,
                direccion: {
                  ...data.direccion,
                  piso: e.target.value
                }
              })}
              placeholder="Ej: 2º, Bajo..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-hz-primary focus:border-hz-primary" maxLength={10} />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Puerta
            </label>
            <input
              type="text"
              value={data.direccion?.puerta || ''}
              onChange={(e) => onChange({
                ...data,
                direccion: {
                  ...data.direccion,
                  puerta: e.target.value
                }
              })}
              placeholder="Ej: A, B, Izq..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-hz-primary focus:border-hz-primary" maxLength={10} />
          </div>
        </div>

        {/* Código Postal */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Código Postal *
          </label>
          <div className="relative">
            <input
              type="text"
              value={data.direccion?.cp || ''}
              onChange={(e) => handlePostalCodeChange(e.target.value)}
              placeholder="Ej: 28001"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-hz-primary focus:border-hz-primary"
              maxLength={5}
              pattern="[0-9]{5}"
            />
            {isAutoCompleting && (
              <div className="absolute right-3 top-2">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-hz-primary border-t-transparent"></div>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Autocompleta municipio y comunidad autónoma
          </p>
        </div>

        {/* Municipio y Provincia (autocompletados pero editables) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Municipio
            </label>
            <input
              type="text"
              value={data.direccion?.municipio || ''}
              onChange={(e) => onChange({
                ...data,
                direccion: {
                  ...data.direccion,
                  municipio: e.target.value
                }
              })}
              placeholder="Autocompletado por CP"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-hz-primary focus:border-hz-primary bg-gray-50" maxLength={80} />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Provincia
            </label>
            <input
              type="text"
              value={data.direccion?.provincia || ''}
              onChange={(e) => onChange({
                ...data,
                direccion: {
                  ...data.direccion,
                  provincia: e.target.value
                }
              })}
              placeholder="Autocompletado por CP"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-hz-primary focus:border-hz-primary bg-gray-50" maxLength={80} />
          </div>
        </div>

        {/* Comunidad Autónoma */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Comunidad Autónoma
          </label>
          <input
            type="text"
            value={data.direccion?.ca || ''}
            onChange={(e) => onChange({
              ...data,
              direccion: {
                ...data.direccion,
                ca: e.target.value as ComunidadAutonoma
              }
            })}
            placeholder="Autocompletado por CP"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-hz-primary focus:border-hz-primary bg-gray-50" readOnly={false} />
        </div>

        {/* Referencia Catastral */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Hash className="w-4 h-4 inline mr-2" size={24}  />
            Referencia Catastral
          </label>
          <input
            type="text"
            value={data.ref_catastral || ''}
            onChange={(e) => onChange({
              ...data,
              ref_catastral: e.target.value
            })}
            placeholder="Opcional"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-hz-primary focus:border-hz-primary" maxLength={20} />
          <p className="text-xs text-gray-500 mt-1">
            Campo opcional, puede completarse más adelante
          </p>
        </div>

        {/* Estado */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Estado inicial
          </label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="radio"
                value="ACTIVO"
                checked={data.estado === 'ACTIVO'}
                onChange={(e) => onChange({
                  ...data,
                  estado: e.target.value as EstadoInmueble
                })}
                className="mr-2 text-hz-primary focus:ring-hz-primary"
              />
              <span className="text-sm">Activo</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="VENDIDO"
                checked={data.estado === 'VENDIDO'}
                onChange={(e) => onChange({
                  ...data,
                  estado: e.target.value as EstadoInmueble
                })}
                className="mr-2 text-hz-primary focus:ring-hz-primary"
              />
              <span className="text-sm">Vendido</span>
            </label>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Se podrá cambiar más adelante
          </p>
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

export default Step1Identificacion;