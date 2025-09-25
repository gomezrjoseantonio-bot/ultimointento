// H9-FISCAL: AEAT Amortization Detail Component
import React, { useState, useEffect, useCallback } from 'react';
import { Calculator, Info, TrendingDown } from 'lucide-react';
import { 
  calculateAEATAmortization, 
  formatEsCurrency, 
  formatEsPercentage,
  AEATAmortizationCalculation 
} from '../../services/aeatAmortizationService';
import { initDB, Property } from '../../services/db';

interface AmortizationDetailProps {
  propertyId: number;
  exerciseYear: number;
  onCalculationUpdate?: (calculation: AEATAmortizationCalculation) => void;
}

const AmortizationDetail: React.FC<AmortizationDetailProps> = ({ 
  propertyId, 
  exerciseYear, 
  onCalculationUpdate 
}) => {
  const [loading, setLoading] = useState(false);
  const [calculation, setCalculation] = useState<AEATAmortizationCalculation | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [daysRented, setDaysRented] = useState<number>(365);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const db = await initDB();
      const prop = await db.get('properties', propertyId);
      
      if (!prop) {
        setError('Propiedad no encontrada');
        return;
      }
      
      setProperty(prop);
      
      if (!prop.aeatAmortization || !prop.aeatAmortization.acquisitionType) {
        setError('No hay datos de amortización AEAT configurados para esta propiedad');
        return;
      }

      // Calculate amortization
      const calc = await calculateAEATAmortization(propertyId, exerciseYear, daysRented);
      setCalculation(calc);
      onCalculationUpdate?.(calc);
      
    } catch (err) {
      console.error('Error loading amortization data:', err);
      setError('Error al cargar los datos de amortización');
    } finally {
      setLoading(false);
    }
  }, [propertyId, exerciseYear, daysRented, onCalculationUpdate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const recalculate = useCallback(async () => {
    if (!property?.aeatAmortization) return;
    
    try {
      setLoading(true);
      const calc = await calculateAEATAmortization(propertyId, exerciseYear, daysRented);
      setCalculation(calc);
      onCalculationUpdate?.(calc);
    } catch (err) {
      console.error('Error recalculating:', err);
      setError('Error al recalcular la amortización');
    } finally {
      setLoading(false);
    }
  }, [property?.aeatAmortization, propertyId, exerciseYear, daysRented, onCalculationUpdate]);

  if (loading && !calculation) {
    return (
      <div className="bg-white border border-neutral-200 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin h-8 w-8 border-b-2 border-brand-navy"></div>
          <span className="ml-3 text-neutral-600">Calculando amortización...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-neutral-200 p-6">
        <div className="flex items-center gap-3 text-warning-600 mb-4">
          <Info className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Amortización AEAT</h3>
        </div>
        <div className="bg-orange-50 border border-orange-200 p-4">
          <p className="text-orange-800">{error}</p>
          <p className="text-sm text-warning-600 mt-2">
            Configure los datos de amortización AEAT en la ficha del inmueble para ver el cálculo detallado.
          </p>
        </div>
      </div>
    );
  }

  if (!calculation) return null;

  const isSpecialCase = calculation.calculationMethod === 'special';

  return (
    <div className="bg-white border border-neutral-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calculator className="w-5 h-5 text-brand-navy" />
          <h3 className="text-lg font-semibold text-neutral-900">Amortización AEAT {exerciseYear}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 text-xs font-medium ${
            isSpecialCase 
              ? 'bg-warning-100 text-orange-700' 
              : 'bg-success-100 text-success-700'
          }`}>
            {isSpecialCase ? 'Caso especial' : 'Regla general'}
          </span>
        </div>
      </div>

      {/* Días de alquiler */}
      <div className="btn-secondary-horizon btn-primary-horizon mb-6 p-4 ">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-neutral-700">
            Días de arrendamiento en {exerciseYear}
          </label>
          <button
            onClick={recalculate}
            disabled={loading}
            className="text-xs text-brand-navy hover:text-brand-navy/80 underline disabled:opacity-50"
          >
            {loading ? 'Recalculando...' : 'Recalcular'}
          </button>
        </div>
        <input
          type="number"
          min="0"
          max={calculation.daysAvailable}
          value={daysRented}
          onChange={(e) => setDaysRented(parseInt(e.target.value) || 0)}
          onBlur={recalculate}
          className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent" />
        <p className="text-xs text-neutral-500 mt-1">
          De {calculation.daysAvailable} días disponibles en {exerciseYear}
        </p>
      </div>

      {/* Cálculo base */}
      <div className="mb-6">
        <h4 className="font-medium text-neutral-900 mb-3">Base de cálculo</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Concepto</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-neutral-500 uppercase">Importe</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-neutral-500 uppercase">Seleccionado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              <tr>
                <td className="px-3 py-2 text-neutral-900">Coste construcción (oneroso + mejoras)</td>
                <td className="px-3 py-2 text-right text-neutral-900">
                  {formatEsCurrency(calculation.breakdown.constructionCost)}
                </td>
                <td className="px-3 py-2 text-center">
                  {calculation.breakdown.selectedBase === 'construction-cost' && (
                    <span className="inline-flex items-center justify-center w-4 h-4 bg-success-500">
                      <span className="text-xs">✓</span>
                    </span>
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2 text-neutral-900">Valor catastral construcción</td>
                <td className="px-3 py-2 text-right text-neutral-900">
                  {formatEsCurrency(calculation.breakdown.cadastralConstructionValue)}
                </td>
                <td className="px-3 py-2 text-center">
                  {calculation.breakdown.selectedBase === 'cadastral-value' && (
                    <span className="inline-flex items-center justify-center w-4 h-4 bg-success-500">
                      <span className="text-xs">✓</span>
                    </span>
                  )}
                </td>
              </tr>
              <tr className="bg-success-50">
                <td className="px-3 py-2 font-medium text-neutral-900">Base amortizable (mayor)</td>
                <td className="px-3 py-2 text-right font-medium text-neutral-900">
                  {formatEsCurrency(calculation.baseAmount)}
                </td>
                <td className="px-3 py-2 text-center">
                  <span className="inline-flex items-center justify-center w-4 h-4 bg-success-500">
                    <span className="text-xs">✓</span>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        {calculation.breakdown.historicalImprovements > 0 && (
          <div className="mt-2 text-xs text-neutral-600">
            <span className="font-medium">Incluye mejoras históricas:</span> {formatEsCurrency(calculation.breakdown.historicalImprovements)}
          </div>
        )}
      </div>

      {/* Cálculo amortización */}
      <div className="mb-6">
        <h4 className="font-medium text-neutral-900 mb-3">Amortización calculada</h4>
        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-neutral-50">
            <div>
              <span className="text-sm font-medium text-neutral-900">Inmueble</span>
              <div className="text-xs text-neutral-600">
                {formatEsCurrency(calculation.baseAmount)} × {formatEsPercentage(calculation.percentageApplied)} × {calculation.daysRented}/{calculation.daysAvailable} días
              </div>
            </div>
            <span className="text-lg font-semibold text-neutral-900">
              {formatEsCurrency(calculation.propertyAmortization)}
            </span>
          </div>

          {calculation.improvementsAmortization > 0 && (
            <div className="btn-primary-horizon flex justify-between items-center p-3">
              <div>
                <span className="text-sm font-medium text-neutral-900">Mejoras del año</span>
                <div className="text-xs text-neutral-600">Amortización prorrateada</div>
              </div>
              <span className="text-lg font-semibold text-neutral-900">
                {formatEsCurrency(calculation.improvementsAmortization)}
              </span>
            </div>
          )}

          {calculation.furnitureAmortization > 0 && (
            <div className="flex justify-between items-center p-3 bg-purple-50">
              <div>
                <span className="text-sm font-medium text-neutral-900">Mobiliario</span>
                <div className="text-xs text-neutral-600">10% anual lineal</div>
              </div>
              <span className="text-lg font-semibold text-neutral-900">
                {formatEsCurrency(calculation.furnitureAmortization)}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center p-4 bg-brand-navy/10 border-2 border-brand-navy/20">
            <div>
              <span className="text-base font-semibold text-neutral-900">Total amortización</span>
              <div className="text-xs text-neutral-600">Deducible en {exerciseYear}</div>
            </div>
            <span className="text-xl font-bold text-brand-navy">
              {formatEsCurrency(calculation.totalAmortization)}
            </span>
          </div>
        </div>
      </div>

      {/* Caso especial */}
      {isSpecialCase && calculation.specialCaseJustification && (
        <div className="mb-6 p-4 bg-orange-50 border border-orange-200">
          <h4 className="font-medium text-neutral-900 mb-2 flex items-center gap-2">
            <Info className="w-4 h-4 text-warning-600" />
            Justificación caso especial
          </h4>
          <p className="text-sm text-orange-800">{calculation.specialCaseJustification}</p>
        </div>
      )}

      {/* Tracking para futuras ventas */}
      <div className="p-4 bg-neutral-50 border border-neutral-200">
        <h4 className="font-medium text-neutral-900 mb-3 flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-neutral-600" />
          Acumulado para futuras ventas
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-neutral-600">Deducido este año:</span>
            <div className="font-medium text-neutral-900">
              {formatEsCurrency(calculation.accumulatedActual)}
            </div>
          </div>
          <div>
            <span className="text-neutral-600">Acumulado al 3% (minoración):</span>
            <div className="font-medium text-neutral-900">
              {formatEsCurrency(calculation.accumulatedStandard)}
            </div>
          </div>
        </div>
        {Math.abs(calculation.accumulatedStandard - calculation.accumulatedActual) > 0.01 && (
          <div className="mt-2 text-xs text-neutral-600">
            <strong>Nota:</strong> Se registran ambos importes para trazabilidad de plusvalías futuras
          </div>
        )}
      </div>
    </div>
  );
};

export default AmortizationDetail;