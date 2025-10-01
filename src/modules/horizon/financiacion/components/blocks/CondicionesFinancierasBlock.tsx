import React from 'react';
import { Calculator, Clock, Euro, Percent } from 'lucide-react';
import { PrestamoFinanciacion, ValidationError, CalculoLive } from '../../../../../types/financiacion';

interface CondicionesFinancierasBlockProps {
  formData: Partial<PrestamoFinanciacion>;
  updateFormData: (updates: Partial<PrestamoFinanciacion>) => void;
  errors: ValidationError[];
  calculoLive?: CalculoLive | null;
}

const CondicionesFinancierasBlock: React.FC<CondicionesFinancierasBlockProps> = ({ 
  formData, 
  updateFormData, 
  errors,
  calculoLive 
}) => {
  const getFieldError = (fieldName: string) => errors.find(e => e.field === fieldName)?.message;

  // Format number input for Spanish locale
  const formatNumber = (value: number) => {
    return value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Parse Spanish formatted number
  const parseNumber = (value: string) => {
    if (!value) return 0;
    return parseFloat(value.replace(/\./g, '').replace(',', '.'));
  };

  // Format percentage for display
  const formatPercentage = (value: number) => {
    return value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-6">
      {/* Capital and Term */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Initial Capital */}
        <div>
          <label htmlFor="capitalInicial" className="block text-sm font-medium text-atlas-navy-1 mb-2">
            <Euro className="h-4 w-4 inline mr-1" />
            Capital inicial *
          </label>
          <div className="relative">
            <input
              type="text"
              id="capitalInicial"
              value={formData.capitalInicial ? formatNumber(formData.capitalInicial) : ''}
              onChange={(e) => updateFormData({ capitalInicial: parseNumber(e.target.value) })}
              placeholder="0,00"
              min="0"
              max="999999.99"
              step="0.01"
              className={`w-full border shadow-sm focus:ring-atlas-blue pl-3 pr-8 ${
                getFieldError('capitalInicial') 
                  ? 'border-error-300 focus:border-error-500' 
                  : 'border-gray-300 focus:border-atlas-blue'
              }`}
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-text-gray text-sm">€</span>
            </div>
          </div>
          {getFieldError('capitalInicial') && (
            <p className="mt-1 text-sm text-error-600">{getFieldError('capitalInicial')}</p>
          )}
        </div>

        {/* Term */}
        <div>
          <label className="block text-sm font-medium text-atlas-navy-1 mb-2">
            <Clock className="h-4 w-4 inline mr-1" />
            Plazo total *
          </label>
          <div className="flex space-x-2">
            <input
              type="number"
              value={formData.plazoTotal || ''}
              onChange={(e) => updateFormData({ plazoTotal: parseInt(e.target.value) || 0 })}
              placeholder="25"
              min="1"
              className={`flex-1 border shadow-sm focus:ring-atlas-blue ${
                getFieldError('plazoTotal') 
                  ? 'border-error-300 focus:border-error-500' 
                  : 'border-gray-300 focus:border-atlas-blue'
              }`}
            />
            <select
              value={formData.plazoPeriodo || 'AÑOS'}
              onChange={(e) => updateFormData({ plazoPeriodo: e.target.value as 'AÑOS' | 'MESES' })}
              className="rounded-atlas border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue"
            >
              <option value="AÑOS">Años</option>
              <option value="MESES">Meses</option>
            </select>
          </div>
          {getFieldError('plazoTotal') && (
            <p className="mt-1 text-sm text-error-600">{getFieldError('plazoTotal')}</p>
          )}
        </div>
      </div>

      {/* Grace Period */}
      <div>
        <label className="block text-sm font-medium text-atlas-navy-1 mb-3">
          Carencia
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { value: 'NINGUNA', label: 'Ninguna', description: 'Sin período de carencia' },
            { value: 'CAPITAL', label: 'Capital', description: 'Solo se pagan intereses' },
            { value: 'TOTAL', label: 'Total', description: 'No se paga nada' }
          ].map(carencia => (
            <button
              key={carencia.value}
              type="button"
              onClick={() => updateFormData({ carencia: carencia.value as any })}
              className={`rounded-atlas border-2 p-3 text-left transition-all ${
                formData.carencia === carencia.value
                  ? 'border-atlas-blue bg-primary-50 text-atlas-blue'
                  : 'border-gray-200 hover:border-gray-300 text-atlas-navy-1'
              }`}
            >
              <div className="font-medium">{carencia.label}</div>
              <div className="text-xs text-text-gray mt-1">{carencia.description}</div>
            </button>
          ))}
        </div>
        
        {formData.carencia !== 'NINGUNA' && (
          <div className="mt-4">
            <label htmlFor="carenciaMeses" className="block text-sm font-medium text-atlas-navy-1 mb-2">
              Período de carencia (meses)
            </label>
            <input
              type="number"
              id="carenciaMeses"
              value={formData.carenciaMeses || ''}
              onChange={(e) => updateFormData({ carenciaMeses: parseInt(e.target.value) || undefined })}
              placeholder="6"
              min="1"
              className="w-32 border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue"
            />
          </div>
        )}
      </div>

      {/* Interest Type */}
      <div>
        <label className="block text-sm font-medium text-atlas-navy-1 mb-3">
          <Percent className="h-4 w-4 inline mr-1" />
          Tipo de interés *
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { value: 'FIJO', label: 'Fijo', description: 'Tipo fijo durante toda la vida del préstamo' },
            { value: 'VARIABLE', label: 'Variable', description: 'Revisable según índice de referencia' },
            { value: 'MIXTO', label: 'Mixto', description: 'Período inicial fijo, después variable' }
          ].map(tipo => (
            <button
              key={tipo.value}
              type="button"
              onClick={() => updateFormData({ tipo: tipo.value as any })}
              className={`rounded-atlas border-2 p-3 text-left transition-all ${
                formData.tipo === tipo.value
                  ? 'border-atlas-blue bg-primary-50 text-atlas-blue'
                  : 'border-gray-200 hover:border-gray-300 text-atlas-navy-1'
              }`}
            >
              <div className="font-medium">{tipo.label}</div>
              <div className="text-xs text-text-gray mt-1">{tipo.description}</div>
            </button>
          ))}
        </div>
        {getFieldError('tipo') && (
          <p className="mt-1 text-sm text-error-600">{getFieldError('tipo')}</p>
        )}
      </div>

      {/* Fixed Rate Details */}
      {formData.tipo === 'FIJO' && (
        <div className="btn-secondary-horizon atlas-atlas-atlas-atlas-btn-primary p-4 ">
          <h4 className="font-medium text-atlas-blue mb-3">Configuración Tipo Fijo</h4>
          <div>
            <label htmlFor="tinFijo" className="block text-sm font-medium text-atlas-navy-1 mb-2">
              TIN fijo (%) *
            </label>
            <div className="relative max-w-xs">
              <input
                type="text"
                id="tinFijo"
                value={formData.tinFijo ? formatPercentage(formData.tinFijo) : ''}
                onChange={(e) => updateFormData({ tinFijo: parseNumber(e.target.value) })}
                placeholder="3,45"
                className={`w-full border shadow-sm focus:ring-atlas-blue pr-8 ${
                  getFieldError('tinFijo') 
                    ? 'border-error-300 focus:border-error-500' 
                    : 'border-gray-300 focus:border-atlas-blue'
                }`}
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-text-gray text-sm">%</span>
              </div>
            </div>
            {getFieldError('tinFijo') && (
              <p className="mt-1 text-sm text-error-600">{getFieldError('tinFijo')}</p>
            )}
          </div>
        </div>
      )}

      {/* Variable Rate Details */}
      {formData.tipo === 'VARIABLE' && (
        <div className="bg-warning-50 p-4 border border-warning-200">
          <h4 className="font-medium text-warn mb-3">Configuración Tipo Variable</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="indice" className="block text-sm font-medium text-atlas-navy-1 mb-2">
                Índice de referencia
              </label>
              <select
                id="indice"
                value={formData.indice || 'EURIBOR'}
                onChange={(e) => updateFormData({ indice: e.target.value as 'EURIBOR' | 'OTRO' })}
                className="w-full border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue"
              >
                <option value="EURIBOR">EURIBOR</option>
                <option value="OTRO">Otro índice</option>
              </select>
            </div>

            <div>
              <label htmlFor="valorIndice" className="block text-sm font-medium text-atlas-navy-1 mb-2">
                Valor índice actual (%) *
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="valorIndice"
                  value={formData.valorIndice !== undefined ? formatPercentage(formData.valorIndice) : ''}
                  onChange={(e) => updateFormData({ valorIndice: parseNumber(e.target.value) })}
                  placeholder="4,20"
                  className={`w-full border shadow-sm focus:ring-atlas-blue pr-8 ${
                    getFieldError('valorIndice') 
                      ? 'border-error-300 focus:border-error-500' 
                      : 'border-gray-300 focus:border-atlas-blue'
                  }`}
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span className="text-text-gray text-sm">%</span>
                </div>
              </div>
              {getFieldError('valorIndice') && (
                <p className="mt-1 text-sm text-error-600">{getFieldError('valorIndice')}</p>
              )}
            </div>

            <div>
              <label htmlFor="diferencial" className="block text-sm font-medium text-atlas-navy-1 mb-2">
                Diferencial (%) *
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="diferencial"
                  value={formData.diferencial !== undefined ? formatPercentage(formData.diferencial) : ''}
                  onChange={(e) => updateFormData({ diferencial: parseNumber(e.target.value) })}
                  placeholder="0,85"
                  className={`w-full border shadow-sm focus:ring-atlas-blue pr-8 ${
                    getFieldError('diferencial') 
                      ? 'border-error-300 focus:border-error-500' 
                      : 'border-gray-300 focus:border-atlas-blue'
                  }`}
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span className="text-text-gray text-sm">%</span>
                </div>
              </div>
              {getFieldError('diferencial') && (
                <p className="mt-1 text-sm text-error-600">{getFieldError('diferencial')}</p>
              )}
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-atlas-navy-1 mb-2">
              Revisión
            </label>
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => updateFormData({ revision: 6 })}
                className={`px-4 py-2 border-2 transition-all ${
                  formData.revision === 6
                    ? 'border-atlas-blue bg-primary-50 text-atlas-blue'
                    : 'border-gray-200 hover:border-gray-300 text-atlas-navy-1'
                }`}
              >
                6 meses
              </button>
              <button
                type="button"
                onClick={() => updateFormData({ revision: 12 })}
                className={`px-4 py-2 border-2 transition-all ${
                  formData.revision === 12
                    ? 'border-atlas-blue bg-primary-50 text-atlas-blue'
                    : 'border-gray-200 hover:border-gray-300 text-atlas-navy-1'
                }`}
              >
                12 meses
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mixed Rate Details */}
      {formData.tipo === 'MIXTO' && (
        <div className="bg-info-50 p-4 border border-info-200">
          <h4 className="font-medium text-atlas-blue mb-3">Configuración Tipo Mixto</h4>
          
          {/* Fixed portion */}
          <div className="mb-4">
            <h5 className="font-medium text-atlas-navy-1 mb-2">Tramo Fijo</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="tramoFijoAnos" className="block text-sm font-medium text-atlas-navy-1 mb-2">
                  Duración (años) *
                </label>
                <input
                  type="number"
                  id="tramoFijoAnos"
                  value={formData.tramoFijoAnos || ''}
                  onChange={(e) => updateFormData({ tramoFijoAnos: parseInt(e.target.value) || undefined })}
                  placeholder="5"
                  min="1"
                  className={`w-full border shadow-sm focus:ring-atlas-blue ${
                    getFieldError('tramoFijoAnos') 
                      ? 'border-error-300 focus:border-error-500' 
                      : 'border-gray-300 focus:border-atlas-blue'
                  }`}
                />
                {getFieldError('tramoFijoAnos') && (
                  <p className="mt-1 text-sm text-error-600">{getFieldError('tramoFijoAnos')}</p>
                )}
              </div>

              <div>
                <label htmlFor="tinTramoFijo" className="block text-sm font-medium text-atlas-navy-1 mb-2">
                  TIN fijo (%) *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="tinTramoFijo"
                    value={formData.tinTramoFijo ? formatPercentage(formData.tinTramoFijo) : ''}
                    onChange={(e) => updateFormData({ tinTramoFijo: parseNumber(e.target.value) })}
                    placeholder="2,95"
                    className={`w-full border shadow-sm focus:ring-atlas-blue pr-8 ${
                      getFieldError('tinTramoFijo') 
                        ? 'border-error-300 focus:border-error-500' 
                        : 'border-gray-300 focus:border-atlas-blue'
                    }`}
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-text-gray text-sm">%</span>
                  </div>
                </div>
                {getFieldError('tinTramoFijo') && (
                  <p className="mt-1 text-sm text-error-600">{getFieldError('tinTramoFijo')}</p>
                )}
              </div>
            </div>
          </div>

          {/* Variable portion */}
          <div className="border-t border-info-200 pt-4">
            <h5 className="font-medium text-atlas-navy-1 mb-2">Tramo Variable (después del período fijo)</h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="indiceMixto" className="block text-sm font-medium text-atlas-navy-1 mb-2">
                  Índice de referencia
                </label>
                <select
                  id="indiceMixto"
                  value={formData.indice || 'EURIBOR'}
                  onChange={(e) => updateFormData({ indice: e.target.value as 'EURIBOR' | 'OTRO' })}
                  className="w-full border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue"
                >
                  <option value="EURIBOR">EURIBOR</option>
                  <option value="OTRO">Otro índice</option>
                </select>
              </div>

              <div>
                <label htmlFor="valorIndiceMixto" className="block text-sm font-medium text-atlas-navy-1 mb-2">
                  Valor índice actual (%)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="valorIndiceMixto"
                    value={formData.valorIndice !== undefined ? formatPercentage(formData.valorIndice) : ''}
                    onChange={(e) => updateFormData({ valorIndice: parseNumber(e.target.value) })}
                    placeholder="4,20"
                    className="w-full border shadow-sm focus:ring-atlas-blue pr-8 border-gray-300 focus:border-atlas-blue"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-text-gray text-sm">%</span>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="diferencialMixto" className="block text-sm font-medium text-atlas-navy-1 mb-2">
                  Diferencial (%)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="diferencialMixto"
                    value={formData.diferencial !== undefined ? formatPercentage(formData.diferencial) : ''}
                    onChange={(e) => updateFormData({ diferencial: parseNumber(e.target.value) })}
                    placeholder="0,85"
                    className="w-full border shadow-sm focus:ring-atlas-blue pr-8 border-gray-300 focus:border-atlas-blue"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-text-gray text-sm">%</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-4">
              <label className="block text-sm font-medium text-atlas-navy-1 mb-2">
                Revisión del tramo variable
              </label>
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => updateFormData({ revision: 6 })}
                  className={`px-4 py-2 border-2 transition-all ${
                    formData.revision === 6
                      ? 'border-atlas-blue bg-primary-50 text-atlas-blue'
                      : 'border-gray-200 hover:border-gray-300 text-atlas-navy-1'
                  }`}
                >
                  6 meses
                </button>
                <button
                  type="button"
                  onClick={() => updateFormData({ revision: 12 })}
                  className={`px-4 py-2 border-2 transition-all ${
                    formData.revision === 12
                      ? 'border-atlas-blue bg-primary-50 text-atlas-blue'
                      : 'border-gray-200 hover:border-gray-300 text-atlas-navy-1'
                  }`}
                >
                  12 meses
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Commissions */}
      <div>
        <h4 className="font-medium text-atlas-navy-1 mb-4">Comisiones</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="comisionApertura" className="block text-sm font-medium text-atlas-navy-1 mb-2">
              Apertura (%)
            </label>
            <div className="relative">
              <input
                type="text"
                id="comisionApertura"
                value={formData.comisionApertura ? formatPercentage(formData.comisionApertura) : ''}
                onChange={(e) => updateFormData({ comisionApertura: parseNumber(e.target.value) || undefined })}
                placeholder="0,00"
                className="w-full border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue pr-8"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-text-gray text-sm">%</span>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="comisionMantenimiento" className="block text-sm font-medium text-atlas-navy-1 mb-2">
              Mantenimiento (€/mes)
            </label>
            <div className="relative">
              <input
                type="text"
                id="comisionMantenimiento"
                value={formData.comisionMantenimiento ? formatNumber(formData.comisionMantenimiento) : ''}
                onChange={(e) => updateFormData({ comisionMantenimiento: parseNumber(e.target.value) || undefined })}
                placeholder="0,00"
                className="w-full border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue pr-8"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-text-gray text-sm">€</span>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="comisionAmortizacionAnticipada" className="block text-sm font-medium text-atlas-navy-1 mb-2">
              Amortización anticipada (%)
            </label>
            <div className="relative">
              <input
                type="text"
                id="comisionAmortizacionAnticipada"
                value={formData.comisionAmortizacionAnticipada ? formatPercentage(formData.comisionAmortizacionAnticipada) : ''}
                onChange={(e) => updateFormData({ comisionAmortizacionAnticipada: parseNumber(e.target.value) || undefined })}
                placeholder="0,00"
                className="w-full border-gray-300 shadow-sm focus:border-atlas-blue focus:ring-atlas-blue pr-8"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-text-gray text-sm">%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Calculation Display */}
      {calculoLive && (
        <div className="bg-ok-50 border border-ok-200 p-4">
          <h4 className="font-medium text-ok-700 mb-3 flex items-center">
            <Calculator className="h-4 w-4 mr-2" />
            Cálculo en vivo
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-text-gray block">Cuota estimada</span>
              <span className="font-semibold text-atlas-navy-1">{formatNumber(calculoLive.cuotaEstimada)} €/mes</span>
            </div>
            <div>
              <span className="text-text-gray block">TAE aproximada</span>
              <span className="font-semibold text-atlas-navy-1">{formatPercentage(calculoLive.taeAproximada)} %</span>
            </div>
            <div>
              <span className="text-text-gray block">TIN efectivo</span>
              <span className="font-semibold text-atlas-navy-1">{formatPercentage(calculoLive.tinEfectivo)} %</span>
            </div>
            {calculoLive.proximaFechaRevision && (
              <div>
                <span className="text-text-gray block">Próxima revisión</span>
                <span className="font-semibold text-atlas-navy-1">
                  {new Date(calculoLive.proximaFechaRevision).toLocaleDateString('es-ES')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CondicionesFinancierasBlock;