import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Building, Calendar, Check, ChevronRight } from 'lucide-react';
import { Property, initDB } from '../../../../../services/db';

interface WizardStepAlcanceProps {
  year: number;
  initialData: {
    propertyIds: number[];
    roomIds?: string[];
    startMonth: number;
    isFullYear: boolean;
  };
  onComplete: (data: any) => void;
}

const WizardStepAlcance: React.FC<WizardStepAlcanceProps> = ({ 
  year, 
  initialData, 
  onComplete 
}) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<number[]>(initialData.propertyIds);
  const [isFullYear, setIsFullYear] = useState(initialData.isFullYear);
  const [startMonth, setStartMonth] = useState(initialData.startMonth);
  const [loading, setLoading] = useState(true);
  
  const currentMonth = new Date().getMonth() + 1;
  const isMidYear = currentMonth > 1;

  useEffect(() => {
    loadProperties();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadProperties = async () => {
    try {
      setLoading(true);
      const db = await initDB();
      const allProperties = await db.getAll('properties');
      // Filter active properties
      const activeProperties = allProperties.filter(p => p.state === 'activo');
      setProperties(activeProperties);
      
      // Auto-select all properties by default
      if (initialData.propertyIds.length === 0) {
        setSelectedPropertyIds(activeProperties.map(p => p.id!));
      }
    } catch (error) {
      console.error('Error loading properties:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePropertyToggle = (propertyId: number) => {
    setSelectedPropertyIds(prev => 
      prev.includes(propertyId)
        ? prev.filter(id => id !== propertyId)
        : [...prev, propertyId]
    );
  };

  const handleSelectAll = () => {
    setSelectedPropertyIds(properties.map(p => p.id!));
  };

  const handleSelectNone = () => {
    setSelectedPropertyIds([]);
  };

  const handleContinue = () => {
    // Allow testing mode when no properties exist
    if (selectedPropertyIds.length === 0 && properties.length > 0) {
      toast.error('Debes seleccionar al menos un inmueble.');
      return;
    }

    onComplete({
      propertyIds: selectedPropertyIds.length > 0 ? selectedPropertyIds : [999], // Use test property ID
      startMonth: isFullYear ? 1 : startMonth,
      isFullYear
    });
  };

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="btn-secondary-horizon animate-spin h-8 w-8 "></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Alcance del Presupuesto</h2>
        <p className="text-gray-600">
          Selecciona los inmuebles y habitaciones que quieres incluir en el presupuesto {year}.
        </p>
      </div>

      {/* Date Range Selection */}
      {isMidYear && (
        <div className="btn-secondary-horizon atlas-atlas-atlas-atlas-atlas-btn-primary ">
          <div className="flex items-center mb-4">
            <Calendar className="h-5 w-5 text-primary-600 mr-2" />
            <h3 className="font-semibold text-primary-900">Período del presupuesto</h3>
          </div>
          
          <p className="text-primary-800 mb-4">
            Estamos en {monthNames[currentMonth - 1]}. ¿Cómo quieres configurar el presupuesto para {year}?
          </p>
          
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="radio"
                name="period"
                checked={isFullYear}
                onChange={() => setIsFullYear(true)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
              />
              <span className="ml-3 text-sm text-primary-900">
                <strong>Todo el año:</strong> Rellenar meses previos como "retro estimado"
              </span>
            </label>
            
            <label className="flex items-center">
              <input
                type="radio"
                name="period"
                checked={!isFullYear}
                onChange={() => setIsFullYear(false)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
              />
              <span className="ml-3 text-sm text-primary-900">
                <strong>Desde {monthNames[currentMonth - 1]}:</strong> Meses previos quedan en blanco
              </span>
            </label>
          </div>
          
          {!isFullYear && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-primary-900 mb-2">
                Mes de inicio:
              </label>
              <select
                value={startMonth}
                onChange={(e) => setStartMonth(Number(e.target.value))}
                className="btn-secondary-horizon block w-48 px-3 py-2 "
              >
                {monthNames.slice(currentMonth - 1).map((month, index) => (
                  <option key={index} value={currentMonth + index}>
                    {month}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Property Selection */}
      <div className="bg-white border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Inmuebles en cartera activa</h3>
              <p className="text-sm text-gray-600">
                {selectedPropertyIds.length} de {properties.length} inmuebles seleccionados
              </p>
            </div>
            
            <div className="space-x-2">
              <button
                onClick={handleSelectAll}
                className="text-sm text-primary-600 hover:text-primary-800 font-medium"
              >
                Seleccionar todos
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={handleSelectNone}
                className="text-sm text-gray-600 hover:text-gray-800 font-medium"
              >
                Ninguno
              </button>
            </div>
          </div>
        </div>
        
        <div className="divide-y divide-gray-200">
          {properties.map((property) => (
            <div key={property.id} className="px-6 py-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedPropertyIds.includes(property.id!)}
                  onChange={() => handlePropertyToggle(property.id!)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                
                <div className="ml-4 flex-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="bg-gray-100 p-2">
                        <Building className="h-5 w-5 text-gray-600" />
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-gray-900">{property.alias}</h4>
                        <p className="text-sm text-gray-600">{property.address}</p>
                      </div>
                    </div>
                    
                    <div className="text-right text-sm text-gray-600">
                      <div>{property.squareMeters} m²</div>
                      <div>{property.bedrooms} hab.</div>
                    </div>
                  </div>
                </div>
                
                {selectedPropertyIds.includes(property.id!) && (
                  <Check className="h-5 w-5 text-primary-600 ml-4" />
                )}
              </label>
            </div>
          ))}
        </div>
        
        {properties.length === 0 && (
          <div className="px-6 py-8 text-center">
            <div className="text-gray-500 mb-4">
              No hay inmuebles activos en la cartera.
            </div>
            <div className="bg-warning-50 border border-yellow-200 p-4">
              <div className="flex items-center mb-2">
                <div className="bg-warning-100 p-1 mr-2">
                  <span className="text-warning-600 text-xs">⚠️</span>
                </div>
                <p className="text-sm font-medium text-yellow-800">Modo de prueba</p>
              </div>
              <p className="text-sm text-warning-700">
                Puedes continuar para probar el wizard con datos de ejemplo.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Continue Button */}
      <div className="flex justify-end mt-8">
        <button
          onClick={handleContinue}
          disabled={selectedPropertyIds.length === 0 && properties.length > 0}
          className={`flex items-center px-6 py-3 font-medium ${
            selectedPropertyIds.length === 0 && properties.length > 0
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-primary-600'          }`}
        >
          Continuar
          <ChevronRight className="h-4 w-4 ml-2" />
        </button>
      </div>
    </div>
  );
};

export default WizardStepAlcance;