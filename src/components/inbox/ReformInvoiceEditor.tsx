import React, { useState, useEffect, useCallback } from 'react';
import { X, Calculator, AlertCircle, Check, Euro, Percent } from 'lucide-react';

interface ReformInvoiceEditorProps {
  isOpen: boolean;
  onClose: () => void;
  document: any;
  onSave: (splitData: ReformSplitData) => void;
}

interface ReformSplitData {
  mejora: {
    amount: number;
    percentage: number;
    description: string;
  };
  mobiliario: {
    amount: number;
    percentage: number;
    description: string;
  };
  reparacionConservacion: {
    amount: number;
    percentage: number;
    description: string;
  };
  totalAmount: number;
  splitMethod: 'amount' | 'percentage';
  notes?: string;
}

const ReformInvoiceEditor: React.FC<ReformInvoiceEditorProps> = ({
  isOpen,
  onClose,
  document,
  onSave
}) => {
  const [splitMethod, setSplitMethod] = useState<'amount' | 'percentage'>('percentage');
  const [splitData, setSplitData] = useState<ReformSplitData>({
    mejora: { amount: 0, percentage: 0, description: '' },
    mobiliario: { amount: 0, percentage: 0, description: '' },
    reparacionConservacion: { amount: 0, percentage: 100, description: '' },
    totalAmount: 0,
    splitMethod: 'percentage'
  });
  const [errors, setErrors] = useState<string[]>([]);

  // Get total amount from document
  const totalAmount = document?.metadata?.financialData?.amount || 
                     document?.metadata?.importe || 
                     parseFloat(document?.metadata?.ocr?.fields?.find((f: any) => f.name === 'total_amount')?.value || '0');

  // Initialize split data when component opens
  useEffect(() => {
    if (isOpen && totalAmount > 0) {
      setSplitData(prev => ({
        ...prev,
        totalAmount,
        reparacionConservacion: {
          ...prev.reparacionConservacion,
          amount: totalAmount,
          percentage: 100
        }
      }));
    }
  }, [isOpen, totalAmount]);

  const validateSplit = useCallback((): string[] => {
    const errors: string[] = [];
    
    if (splitMethod === 'percentage') {
      const totalPercentage = splitData.mejora.percentage + 
                             splitData.mobiliario.percentage + 
                             splitData.reparacionConservacion.percentage;
      
      if (Math.abs(totalPercentage - 100) > 0.01) {
        errors.push(`El total debe ser 100%. Actual: ${totalPercentage.toFixed(2)}%`);
      }
    } else {
      const totalSplitAmount = splitData.mejora.amount + 
                              splitData.mobiliario.amount + 
                              splitData.reparacionConservacion.amount;
      
      if (Math.abs(totalSplitAmount - totalAmount) > 0.01) {
        errors.push(`El total debe ser ${formatCurrency(totalAmount)}. Actual: ${formatCurrency(totalSplitAmount)}`);
      }
    }

    // At least one category must have value
    const hasValue = splitData.mejora.amount > 0 || 
                    splitData.mejora.percentage > 0 ||
                    splitData.mobiliario.amount > 0 || 
                    splitData.mobiliario.percentage > 0 ||
                    splitData.reparacionConservacion.amount > 0 || 
                    splitData.reparacionConservacion.percentage > 0;
    
    if (!hasValue) {
      errors.push('Debe asignar al menos una cantidad a alguna categoría');
    }

    return errors;
  }, [splitData, splitMethod, totalAmount]);

  useEffect(() => {
    setErrors(validateSplit());
  }, [validateSplit]);

  const formatCurrency = (amount: number): string => {
    return amount.toLocaleString('es-ES', { 
      style: 'currency', 
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    });
  };

  const formatPercentage = (percentage: number): string => {
    return `${percentage.toFixed(2)}%`;
  };

  const handlePercentageChange = (category: keyof Omit<ReformSplitData, 'totalAmount' | 'splitMethod' | 'notes'>, value: number) => {
    const newSplitData = { ...splitData };
    newSplitData[category].percentage = value;
    newSplitData[category].amount = (value / 100) * totalAmount;

    setSplitData(newSplitData);
  };

  const handleAmountChange = (category: keyof Omit<ReformSplitData, 'totalAmount' | 'splitMethod' | 'notes'>, value: number) => {
    const newSplitData = { ...splitData };
    newSplitData[category].amount = value;
    newSplitData[category].percentage = totalAmount > 0 ? (value / totalAmount) * 100 : 0;

    setSplitData(newSplitData);
  };

  const autoDistribute = () => {
    // Simple auto-distribution based on keywords in document
    const description = document?.metadata?.concepto || 
                       document?.metadata?.ocr?.fields?.find((f: any) => f.name === 'concepto')?.value || '';
    
    let mejoraPerc = 0;
    let mobiliarioPerc = 0;
    let reparacionPerc = 100;

    // Keyword-based distribution
    const lowerDesc = description.toLowerCase();
    
    if (lowerDesc.includes('cocina') || lowerDesc.includes('baño') || lowerDesc.includes('reforma integral')) {
      mejoraPerc = 60;
      mobiliarioPerc = 20;
      reparacionPerc = 20;
    } else if (lowerDesc.includes('pintura') || lowerDesc.includes('mantenimiento')) {
      reparacionPerc = 100;
    } else if (lowerDesc.includes('mueble') || lowerDesc.includes('electrodoméstico')) {
      mobiliarioPerc = 100;
      reparacionPerc = 0;
    } else if (lowerDesc.includes('instalación') || lowerDesc.includes('mejora')) {
      mejoraPerc = 80;
      reparacionPerc = 20;
    }

    setSplitData(prev => ({
      ...prev,
      mejora: {
        ...prev.mejora,
        percentage: mejoraPerc,
        amount: (mejoraPerc / 100) * totalAmount
      },
      mobiliario: {
        ...prev.mobiliario,
        percentage: mobiliarioPerc,
        amount: (mobiliarioPerc / 100) * totalAmount
      },
      reparacionConservacion: {
        ...prev.reparacionConservacion,
        percentage: reparacionPerc,
        amount: (reparacionPerc / 100) * totalAmount
      }
    }));
  };

  const handleSave = () => {
    const validationErrors = validateSplit();
    if (validationErrors.length === 0) {
      onSave({
        ...splitData,
        splitMethod
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-200 flex items-center justify-center z-50">
      <div className="bg-white shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">
              Editor de Reformas
            </h2>
            <p className="text-sm text-neutral-600">
              Reparto en categorías AEAT: Mejora, Mobiliario y Reparación & Conservación
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Document info */}
          <div className="mb-6 p-4 bg-neutral-50">
            <h3 className="font-medium text-neutral-900 mb-2">Documento</h3>
            <div className="space-y-1 text-sm text-neutral-600">
              <div>Archivo: {document?.filename}</div>
              <div>Proveedor: {document?.metadata?.proveedor || 'No identificado'}</div>
              <div>Total: <strong className="text-neutral-900">{formatCurrency(totalAmount)}</strong></div>
              <div>Concepto: {document?.metadata?.concepto || 'No disponible'}</div>
            </div>
          </div>

          {/* Split method selector */}
          <div className="mb-6">
            <h3 className="font-medium text-neutral-900 mb-3">Método de reparto</h3>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="percentage"
                  checked={splitMethod === 'percentage'}
                  onChange={(e) => setSplitMethod(e.target.value as 'percentage')}
                  className="mr-2 h-4 w-4 text-primary-600"
                />
                <Percent className="w-4 h-4 mr-1" />
                Por porcentaje
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="amount"
                  checked={splitMethod === 'amount'}
                  onChange={(e) => setSplitMethod(e.target.value as 'amount')}
                  className="mr-2 h-4 w-4 text-primary-600"
                />
                <Euro className="w-4 h-4 mr-1" />
                Por importe
              </label>
            </div>
          </div>

          {/* Auto-distribution */}
          <div className="mb-6">
            <button
              onClick={autoDistribute}
              className="atlas-atlas-atlas-btn-primary atlas-atlas-atlas-btn-primary flex items-center gap-2 px-4 py-2 text-primary-700 hover: "
            >
              <Calculator className="w-4 h-4" />
              Distribución automática
            </button>
            <p className="text-xs text-neutral-500 mt-1">
              Distribuye automáticamente según el concepto del documento
            </p>
          </div>

          {/* Categories */}
          <div className="space-y-6">
            {/* Mejora */}
            <div className="border border-neutral-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-medium text-success-700">Mejora</h4>
                  <p className="text-xs text-neutral-600">
                    Obras que aumentan el valor del inmueble de forma permanente
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-medium text-success-700">
                    {formatCurrency(splitData.mejora.amount)}
                  </div>
                  <div className="text-xs text-neutral-600">
                    {formatPercentage(splitData.mejora.percentage)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    {splitMethod === 'percentage' ? 'Porcentaje (%)' : 'Importe (€)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={splitMethod === 'percentage' ? "100" : undefined}
                    step={splitMethod === 'percentage' ? "0.01" : "0.01"}
                    value={splitMethod === 'percentage' ? splitData.mejora.percentage : splitData.mejora.amount}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      if (splitMethod === 'percentage') {
                        handlePercentageChange('mejora', value);
                      } else {
                        handleAmountChange('mejora', value);
                      }
                    }}
                    className="w-full border border-neutral-200 px-3 py-2 focus:border-success-500 focus:ring-2 focus:ring-success-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Descripción (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="ej. Reforma de cocina"
                    value={splitData.mejora.description}
                    onChange={(e) => setSplitData(prev => ({
                      ...prev,
                      mejora: { ...prev.mejora, description: e.target.value }
                    }))}
                    className="w-full border border-neutral-200 px-3 py-2 focus:border-success-500 focus:ring-2 focus:ring-success-200"
                  />
                </div>
              </div>
            </div>

            {/* Mobiliario */}
            <div className="border border-neutral-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-medium text-purple-700">Mobiliario (10a)</h4>
                  <p className="text-xs text-neutral-600">
                    Muebles, electrodomésticos y equipamiento
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-medium text-purple-700">
                    {formatCurrency(splitData.mobiliario.amount)}
                  </div>
                  <div className="text-xs text-neutral-600">
                    {formatPercentage(splitData.mobiliario.percentage)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    {splitMethod === 'percentage' ? 'Porcentaje (%)' : 'Importe (€)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={splitMethod === 'percentage' ? "100" : undefined}
                    step={splitMethod === 'percentage' ? "0.01" : "0.01"}
                    value={splitMethod === 'percentage' ? splitData.mobiliario.percentage : splitData.mobiliario.amount}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      if (splitMethod === 'percentage') {
                        handlePercentageChange('mobiliario', value);
                      } else {
                        handleAmountChange('mobiliario', value);
                      }
                    }}
                    className="w-full border border-neutral-200 px-3 py-2 focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Descripción (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="ej. Electrodomésticos"
                    value={splitData.mobiliario.description}
                    onChange={(e) => setSplitData(prev => ({
                      ...prev,
                      mobiliario: { ...prev.mobiliario, description: e.target.value }
                    }))}
                    className="w-full border border-neutral-200 px-3 py-2 focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                  />
                </div>
              </div>
            </div>

            {/* Reparación y Conservación */}
            <div className="border border-neutral-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-medium text-orange-700">Reparación y Conservación</h4>
                  <p className="text-xs text-neutral-600">
                    Mantenimiento, pintura, reparaciones menores
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-medium text-orange-700">
                    {formatCurrency(splitData.reparacionConservacion.amount)}
                  </div>
                  <div className="text-xs text-neutral-600">
                    {formatPercentage(splitData.reparacionConservacion.percentage)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    {splitMethod === 'percentage' ? 'Porcentaje (%)' : 'Importe (€)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={splitMethod === 'percentage' ? "100" : undefined}
                    step={splitMethod === 'percentage' ? "0.01" : "0.01"}
                    value={splitMethod === 'percentage' ? splitData.reparacionConservacion.percentage : splitData.reparacionConservacion.amount}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      if (splitMethod === 'percentage') {
                        handlePercentageChange('reparacionConservacion', value);
                      } else {
                        handleAmountChange('reparacionConservacion', value);
                      }
                    }}
                    className="w-full border border-neutral-200 px-3 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Descripción (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="ej. Pintura y mantenimiento"
                    value={splitData.reparacionConservacion.description}
                    onChange={(e) => setSplitData(prev => ({
                      ...prev,
                      reparacionConservacion: { ...prev.reparacionConservacion, description: e.target.value }
                    }))}
                    className="w-full border border-neutral-200 px-3 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="mt-6 p-4 bg-neutral-50">
            <h4 className="font-medium text-neutral-900 mb-3">Resumen</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-neutral-600">Mejora (CAPEX)</div>
                <div className="font-medium text-success-700">
                  {formatCurrency(splitData.mejora.amount)}
                </div>
              </div>
              <div>
                <div className="text-neutral-600">Mobiliario (CAPEX)</div>
                <div className="font-medium text-purple-700">
                  {formatCurrency(splitData.mobiliario.amount)}
                </div>
              </div>
              <div>
                <div className="text-neutral-600">R&C (Gastos)</div>
                <div className="font-medium text-orange-700">
                  {formatCurrency(splitData.reparacionConservacion.amount)}
                </div>
              </div>
              <div>
                <div className="text-neutral-600">Total</div>
                <div className="font-medium text-neutral-900">
                  {formatCurrency(splitData.mejora.amount + splitData.mobiliario.amount + splitData.reparacionConservacion.amount)}
                </div>
              </div>
            </div>
          </div>

          {/* Validation errors */}
          {errors.length > 0 && (
            <div className="mt-4 p-4 bg-error-50 border border-error-200">
              <div className="flex items-center gap-2 text-error-800 mb-2">
                <AlertCircle className="w-4 h-4" />
                <span className="font-medium">Errores de validación</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-sm text-error-700">
                {errors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Success indicator */}
          {errors.length === 0 && totalAmount > 0 && (
            <div className="mt-4 p-3 bg-success-50 border border-success-200">
              <div className="flex items-center gap-2 text-success-800">
                <Check className="w-4 h-4" />
                <span className="text-sm font-medium">Reparto válido - Listo para publicar</span>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Notas adicionales (opcional)
            </label>
            <textarea
              value={splitData.notes || ''}
              onChange={(e) => setSplitData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Información adicional sobre el reparto..."
              rows={3}
              className="btn-secondary-horizon w-full "
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-neutral-200">
          <div className="text-sm text-neutral-600">
            Se crearán {[splitData.mejora.amount, splitData.mobiliario.amount, splitData.reparacionConservacion.amount].filter(a => a > 0).length} apuntes contables
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-neutral-600 hover:text-neutral-800"
            >
              Cancelar
            </button>
            
            <button
              onClick={handleSave}
              disabled={errors.length > 0}
              className="atlas-atlas-atlas-btn-primary px-4 py-2 disabled:bg-neutral-300 disabled:cursor-not-allowed"
            >
              Guardar reparto
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReformInvoiceEditor;