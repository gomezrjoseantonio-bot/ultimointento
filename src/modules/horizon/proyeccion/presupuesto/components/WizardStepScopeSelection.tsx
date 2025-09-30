import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Building, User, CheckCircle, ChevronRight } from 'lucide-react';

interface ScopeSelectionData {
  selectedScopes: ('PERSONAL' | 'INMUEBLES')[];
  year: number;
  startMonth: number;
  isFullYear: boolean;
}

interface WizardStepScopeSelectionProps {
  year: number;
  initialData?: ScopeSelectionData;
  onComplete: (data: ScopeSelectionData) => void;
}

const WizardStepScopeSelection: React.FC<WizardStepScopeSelectionProps> = ({ 
  year, 
  initialData, 
  onComplete 
}) => {
  const [selectedScopes, setSelectedScopes] = useState<('PERSONAL' | 'INMUEBLES')[]>(
    initialData?.selectedScopes || []
  );
  const [isFullYear, setIsFullYear] = useState(initialData?.isFullYear ?? true);
  const [startMonth, setStartMonth] = useState(initialData?.startMonth ?? 1);
  
  const currentMonth = new Date().getMonth() + 1;
  const isMidYear = currentMonth > 1;

  const toggleScope = (scope: 'PERSONAL' | 'INMUEBLES') => {
    setSelectedScopes(prev => 
      prev.includes(scope)
        ? prev.filter(s => s !== scope)
        : [...prev, scope]
    );
  };

  const handleContinue = () => {
    if (selectedScopes.length === 0) {
      toast.error('Debes seleccionar al menos un ámbito.');
      return;
    }

    onComplete({
      selectedScopes,
      year,
      startMonth: isFullYear ? 1 : startMonth,
      isFullYear
    });
  };

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Selección de Ámbitos</h2>
        <p className="text-gray-600">
          Selecciona los ámbitos que quieres incluir en el presupuesto {year}. 
          Puedes elegir uno o ambos para crear la vista consolidada.
        </p>
      </div>

      {/* Scope Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* PERSONAL */}
        <div 
          className={`relative border-2 p-6 cursor-pointer transition-all ${
            selectedScopes.includes('PERSONAL')
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
          onClick={() => toggleScope('PERSONAL')}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className={`p-3 ${
                selectedScopes.includes('PERSONAL') 
                  ? 'bg-primary-100' 
                  : 'bg-gray-100'
              }`}>
                <User className={`h-6 w-6 ${
                  selectedScopes.includes('PERSONAL') 
                    ? 'text-primary-600' 
                    : 'text-gray-600'
                }`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">PERSONAL</h3>
                <p className="text-sm text-gray-600">Gastos e ingresos personales</p>
              </div>
            </div>
            
            {selectedScopes.includes('PERSONAL') && (
              <CheckCircle className="h-6 w-6 text-primary-600" />
            )}
          </div>
          
          <div className="text-sm text-gray-600">
            <ul className="space-y-1">
              <li>• Nóminas y otros ingresos personales</li>
              <li>• Suministros domiciliarios personales</li>
              <li>• Seguros personales</li>
              <li>• Otros gastos personales</li>
            </ul>
          </div>
        </div>

        {/* INMUEBLES */}
        <div 
          className={`relative border-2 p-6 cursor-pointer transition-all ${
            selectedScopes.includes('INMUEBLES')
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
          onClick={() => toggleScope('INMUEBLES')}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className={`p-3 ${
                selectedScopes.includes('INMUEBLES') 
                  ? 'bg-primary-100' 
                  : 'bg-gray-100'
              }`}>
                <Building className={`h-6 w-6 ${
                  selectedScopes.includes('INMUEBLES') 
                    ? 'text-primary-600' 
                    : 'text-gray-600'
                }`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">INMUEBLES</h3>
                <p className="text-sm text-gray-600">Ingresos y gastos inmobiliarios</p>
              </div>
            </div>
            
            {selectedScopes.includes('INMUEBLES') && (
              <CheckCircle className="h-6 w-6 text-primary-600" />
            )}
          </div>
          
          <div className="text-sm text-gray-600">
            <ul className="space-y-1">
              <li>• Rentas de alquiler por inmueble</li>
              <li>• Hipotecas (intereses y capital)</li>
              <li>• IBI, comunidad, seguros</li>
              <li>• Suministros, reparaciones</li>
              <li>• Mejoras y mobiliario</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Consolidado info */}
      {selectedScopes.length === 2 && (
        <div className="bg-success-50 border border-success-200 p-4 mb-8">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-success-600" />
            <div>
              <p className="font-medium text-success-800">Vista Consolidada</p>
              <p className="text-sm text-success-700">
                Al seleccionar ambos ámbitos, se generará automáticamente una vista 
                <strong> CONSOLIDADO</strong> que suma ambos presupuestos.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Date Range Selection */}
      {isMidYear && (
        <div className="btn-secondary-horizon btn-primary-horizon ">
          <div className="flex items-center mb-4">
            <div className="btn-primary-horizon p-2 mr-3">
              <span className="text-primary-600 text-sm font-medium">📅</span>
            </div>
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

      {/* Rules explanation */}
      <div className="bg-gray-50 border border-gray-200 p-6 mb-8">
        <h4 className="font-semibold text-gray-900 mb-3">Reglas de creación</h4>
        <div className="space-y-2 text-sm text-gray-700">
          <div className="flex items-start space-x-2">
            <span className="text-primary-600 font-medium">•</span>
            <span>Si marcas solo <strong>PERSONAL</strong> → se crea presupuesto de PERSONAL</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-primary-600 font-medium">•</span>
            <span>Si marcas solo <strong>INMUEBLES</strong> → se crea presupuesto de INMUEBLES</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-primary-600 font-medium">•</span>
            <span>Si marcas <strong>AMBOS</strong> → se crean dos presupuestos + vista CONSOLIDADO</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-primary-600 font-medium">•</span>
            <span>Tras confirmar se auto-semilla cada ámbito marcado con datos existentes</span>
          </div>
        </div>
      </div>

      {/* Continue Button */}
      <div className="flex justify-end">
        <button
          onClick={handleContinue}
          disabled={selectedScopes.length === 0}
          className={`flex items-center px-6 py-3 font-medium ${
            selectedScopes.length === 0
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-primary-600'          }`}
        >
          Continuar a Auto-Semilla
          <ChevronRight className="h-4 w-4 ml-2" />
        </button>
      </div>
    </div>
  );
};

export default WizardStepScopeSelection;