import React from 'react';
import { 
  CCAA_LIST, 
  getLocationFromPostalCode, 
  validatePostalCode,
  formatCadastralReference 
} from '../../../../../utils/locationUtils';

interface PropertyBasicInfoProps {
  formData: any;
  updateFormData: (field: string, value: any) => void;
  errors: Record<string, string>;
}

const PropertyBasicInfo: React.FC<PropertyBasicInfoProps> = ({
  formData,
  updateFormData,
  errors
}) => {
  // Auto-complete location when postal code changes
  const handlePostalCodeChange = async (value: string) => {
    updateFormData('postalCode', value);
    
    if (validatePostalCode(value)) {
      try {
        const location = await getLocationFromPostalCode(value);
        if (location) {
          updateFormData('province', location.province);
          updateFormData('municipality', location.municipalities[0] || '');
          updateFormData('ccaa', location.ccaa);
        }
      } catch (error) {
        console.warn('Could not auto-complete location:', error);
      }
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900">Información Básica</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Alias */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Alias del inmueble *
          </label>
          <input
            type="text"
            value={formData.alias}
            onChange={(e) => updateFormData('alias', e.target.value)}
            className={`w-full px-3 py-2 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.alias ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="ej. Piso Centro Madrid"
          />
          {errors.alias && <p className="mt-1 text-sm text-red-600">{errors.alias}</p>}
        </div>

        {/* Global Alias */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Alias global
            <span className="text-gray-500 text-xs ml-1">(opcional)</span>
          </label>
          <input
            type="text"
            value={formData.globalAlias}
            onChange={(e) => updateFormData('globalAlias', e.target.value)}
            className="btn-secondary-horizon w-full px-3 py-2 "
            >
            placeholder="ej. Madrid-Centro-001"
          />
          <p className="mt-1 text-xs text-gray-500">
            Alias que puede ser referenciado desde otras propiedades
          </p>
        </div>

        {/* Address */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dirección completa *
          </label>
          <input
            type="text"
            value={formData.address}
            onChange={(e) => updateFormData('address', e.target.value)}
            className={`w-full px-3 py-2 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.address ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="ej. Calle Mayor 123, 2º A"
          />
          {errors.address && <p className="mt-1 text-sm text-red-600">{errors.address}</p>}
        </div>

        {/* Postal Code */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Código postal *
          </label>
          <input
            type="text"
            value={formData.postalCode}
            onChange={(e) => handlePostalCodeChange(e.target.value)}
            className={`w-full px-3 py-2 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.postalCode ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="ej. 28013"
            maxLength={5}
          />
          {errors.postalCode && <p className="mt-1 text-sm text-red-600">{errors.postalCode}</p>}
        </div>

        {/* Municipality */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Municipio *
          </label>
          <input
            type="text"
            value={formData.municipality}
            onChange={(e) => updateFormData('municipality', e.target.value)}
            className={`w-full px-3 py-2 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.municipality ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="ej. Madrid"
          />
          {errors.municipality && <p className="mt-1 text-sm text-red-600">{errors.municipality}</p>}
        </div>

        {/* Province */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Provincia *
          </label>
          <input
            type="text"
            value={formData.province}
            onChange={(e) => updateFormData('province', e.target.value)}
            className={`w-full px-3 py-2 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.province ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="ej. Madrid"
          />
          {errors.province && <p className="mt-1 text-sm text-red-600">{errors.province}</p>}
        </div>

        {/* CCAA */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Comunidad Autónoma *
          </label>
          <select
            value={formData.ccaa}
            onChange={(e) => updateFormData('ccaa', e.target.value)}
            className={`w-full px-3 py-2 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.ccaa ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            <option value="">Seleccione una CCAA</option>
            {CCAA_LIST.map((ccaa, index) => (
              <option key={index} value={ccaa.name}>
                {ccaa.name}
              </option>
            ))}
          </select>
          {errors.ccaa && <p className="mt-1 text-sm text-red-600">{errors.ccaa}</p>}
        </div>
      </div>
    </div>
  );
};

export default PropertyBasicInfo;