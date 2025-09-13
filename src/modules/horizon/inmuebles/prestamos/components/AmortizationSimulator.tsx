// Amortization Simulator Component

import React, { useState, useEffect, useCallback } from 'react';
import { X, Calculator, AlertTriangle, CheckCircle, TrendingDown, Calendar } from 'lucide-react';
import { formatEuro, formatDate } from '../../../../../utils/formatUtils';
import { Prestamo, CalculoAmortizacion } from '../../../../../types/prestamos';
import { prestamosService } from '../../../../../services/prestamosService';

interface AmortizationSimulatorProps {
  prestamo: Prestamo;
  onClose: () => void;
  onApply: (importe: number) => void;
}

const AmortizationSimulator: React.FC<AmortizationSimulatorProps> = ({ 
  prestamo, 
  onClose, 
  onApply 
}) => {
  const [importe, setImporte] = useState<string>('');
  const [fechaAmortizacion, setFechaAmortizacion] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [modo, setModo] = useState<'REDUCIR_PLAZO' | 'REDUCIR_CUOTA'>('REDUCIR_PLAZO');
  const [calculo, setCalculo] = useState<CalculoAmortizacion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const simulateAmortization = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const importeNumerico = parseFloat(importe);
      
      if (importeNumerico <= 0) {
        setError('El importe debe ser mayor que 0');
        return;
      }
      
      if (importeNumerico > prestamo.principalVivo) {
        setError('El importe no puede ser mayor que el principal vivo');
        return;
      }

      const resultado = await prestamosService.simulateAmortization(
        prestamo.id,
        importeNumerico,
        fechaAmortizacion,
        modo
      );
      
      setCalculo(resultado);
    } catch (err) {
      setError('Error al calcular la simulación');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [prestamo.id, prestamo.principalVivo, importe, fechaAmortizacion, modo]);

  useEffect(() => {
    if (importe && parseFloat(importe) > 0) {
      simulateAmortization();
    } else {
      setCalculo(null);
    }
  }, [importe, fechaAmortizacion, modo, simulateAmortization]);

  const handleApply = async () => {
    if (!calculo) return;
    
    try {
      await prestamosService.applyAmortization(prestamo.id, calculo.importeAmortizar);
      onApply(calculo.importeAmortizar);
    } catch (err) {
      setError('Error al aplicar la amortización');
      console.error(err);
    }
  };

  const isValidAmount = (): boolean => {
    const importeNumerico = parseFloat(importe) || 0;
    return importeNumerico > 0 && importeNumerico <= prestamo.principalVivo;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />
        
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          {/* Header */}
          <div className="bg-white px-6 py-4 border-b border-[#F3F4F6]">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Calculator className="h-6 w-6 text-atlas-blue" />
                <h3 className="text-lg font-semibold text-neutral-900">
                  Simulador de amortización
                </h3>
              </div>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="bg-white px-6 py-6 space-y-6">
            
            {/* Current loan info */}
            <div className="bg-[#F8F9FA] rounded-lg p-4">
              <h4 className="font-medium text-neutral-900 mb-2">Situación actual</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Principal vivo:</span>
                  <div className="font-medium text-neutral-900">{formatEuro(prestamo.principalVivo)}</div>
                </div>
                <div>
                  <span className="text-gray-500">Plazo restante:</span>
                  <div className="font-medium text-neutral-900">{prestamo.plazoMesesTotal} meses</div>
                </div>
              </div>
            </div>

            {/* Simulation inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Importe a amortizar
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={importe}
                    onChange={(e) => setImporte(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-atlas-blue focus:border-atlas-blue"
                    placeholder="0,00"
                    min="0"
                    max={prestamo.principalVivo}
                    step="0.01"
                  />
                  <span className="absolute right-3 top-2 text-gray-500 text-sm">€</span>
                </div>
                {!isValidAmount() && importe && (
                  <p className="mt-1 text-sm text-error-600">
                    Debe ser entre 0 y {formatEuro(prestamo.principalVivo)}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha de amortización
                </label>
                <input
                  type="date"
                  value={fechaAmortizacion}
                  onChange={(e) => setFechaAmortizacion(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-atlas-blue focus:border-atlas-blue"
                />
              </div>
            </div>

            {/* Mode selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Modalidad
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setModo('REDUCIR_PLAZO')}
                  className={`p-4 rounded-lg border-2 text-left transition-colors ${
                    modo === 'REDUCIR_PLAZO'
                      ? 'border-atlas-blue bg-[#F8F9FA]'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="flex items-center space-x-2 mb-2">
                    <Calendar className="h-5 w-5 text-atlas-blue" />
                    <span className="font-medium">Reducir plazo</span>
                  </div>
                  <p className="text-sm text-gray-500">
                    Mantener cuota, finalizar antes
                  </p>
                </button>

                <button
                  onClick={() => setModo('REDUCIR_CUOTA')}
                  className={`p-4 rounded-lg border-2 text-left transition-colors ${
                    modo === 'REDUCIR_CUOTA'
                      ? 'border-atlas-blue bg-[#F8F9FA]'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="flex items-center space-x-2 mb-2">
                    <TrendingDown className="h-5 w-5 text-atlas-blue" />
                    <span className="font-medium">Reducir cuota</span>
                  </div>
                  <p className="text-sm text-gray-500">
                    Mantener plazo, pagar menos
                  </p>
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="flex items-center space-x-2 p-3 bg-error-50 border border-error-200 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-error-600" />
                <p className="text-sm text-error-700">{error}</p>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-atlas-blue"></div>
              </div>
            )}

            {/* Results */}
            {calculo && !loading && (
              <div className="space-y-4">
                <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-lg p-4">
                  <h4 className="font-medium text-neutral-900 mb-3 flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-success-600" />
                    <span>Resultado de la simulación</span>
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Cost */}
                    <div className="bg-white rounded-lg p-3">
                      <h5 className="font-medium text-gray-700 mb-2">Coste de la operación</h5>
                      <div className="text-2xl font-bold text-error-500">
                        {formatEuro(calculo.penalizacion)}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        Comisión + gastos
                      </div>
                    </div>

                    {/* Main result */}
                    <div className="bg-white rounded-lg p-3">
                      <h5 className="font-medium text-gray-700 mb-2">
                        {modo === 'REDUCIR_PLAZO' ? 'Nuevo plazo' : 'Nueva cuota'}
                      </h5>
                      <div className="text-2xl font-bold text-success-600">
                        {modo === 'REDUCIR_PLAZO' 
                          ? `${calculo.nuevoplazo} meses`
                          : formatEuro(calculo.nuevaCuota || 0)
                        }
                      </div>
                      {modo === 'REDUCIR_PLAZO' && calculo.nuevaFechaFin && (
                        <div className="text-sm text-gray-500 mt-1">
                          Fin: {formatDate(calculo.nuevaFechaFin)}
                        </div>
                      )}
                    </div>

                    {/* Interest savings */}
                    <div className="bg-white rounded-lg p-3 md:col-span-2">
                      <h5 className="font-medium text-gray-700 mb-2">Intereses ahorrados</h5>
                      <div className="text-2xl font-bold text-success-600">
                        {formatEuro(calculo.interesesAhorrados)}
                      </div>
                      {calculo.puntoEquilibrio && (
                        <div className="text-sm text-gray-500 mt-1">
                          Punto de equilibrio: {calculo.puntoEquilibrio} meses
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-[#F8F9FA] rounded-lg p-4">
                  <h5 className="font-medium text-gray-700 mb-2">Resumen</h5>
                  <p className="text-sm text-gray-500">
                    Amortizando <strong>{formatEuro(calculo.importeAmortizar)}</strong> el {formatDate(calculo.fechaAmortizacion)}, 
                    {modo === 'REDUCIR_PLAZO' 
                      ? ` reduces el plazo en ${prestamo.plazoMesesTotal - (calculo.nuevoplazo || 0)} meses`
                      : ` reduces la cuota mensual`
                    } y ahorras <strong>{formatEuro(calculo.interesesAhorrados)}</strong> en intereses. 
                    Coste de la operación: <strong>{formatEuro(calculo.penalizacion)}</strong>.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-[#F8F9FA] px-6 py-4 flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors"
            >
              Cancelar
            </button>
            
            <div className="flex items-center space-x-3">
              {calculo && (
                <div className="text-sm text-gray-500">
                  Net: {formatEuro(calculo.interesesAhorrados - calculo.penalizacion)}
                </div>
              )}
              <button
                onClick={handleApply}
                disabled={!calculo || !isValidAmount()}
                className="px-6 py-2 bg-atlas-blue text-white rounded-lg hover:bg-[#033A73] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Aplicar amortización
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AmortizationSimulator;