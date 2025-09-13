// Step 3: Coste de adquisición - Régimen, Precio, Gastos, Impuestos (en valores absolutos €)
// Following Horizon design system with automatic tax calculations

import React, { useState, useEffect, useCallback } from 'react';
import { CurrencyEuroIcon, CalculatorIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { InmuebleStep3, RegimenCompra } from '../../types/inmueble';
import { validateStep3, calculateTotalTaxes, calculateTotalTaxAmount, formatEuroAmount, detectPercentageInput } from '../../utils/inmuebleUtils';

interface Step3CosteProps {
  data: InmuebleStep3;
  onChange: (data: InmuebleStep3) => void;
  direccionCa?: string; // Para cálculo automático de impuestos
  errors?: string[];
}

const Step3Coste: React.FC<Step3CosteProps> = ({
  data,
  onChange,
  direccionCa,
  errors = []
}) => {
  const [localErrors, setLocalErrors] = useState<string[]>([]);
  const [percentageMessage, setPercentageMessage] = useState<string>('');

  const updateCompra = useCallback((field: string, value: any) => {
    const updatedCompra = {
      ...data.compra,
      [field]: value
    };

    // Recalculate totals
    if (field === 'gastos' || field === 'impuestos' || field === 'precio_compra') {
      const gastos = updatedCompra.gastos || {
        notaria: 0,
        registro: 0,
        gestoria: 0,
        inmobiliaria: 0,
        psi: 0,
        otros: 0
      };
      updatedCompra.total_gastos = 
        (gastos.notaria || 0) + 
        (gastos.registro || 0) + 
        (gastos.gestoria || 0) + 
        (gastos.inmobiliaria || 0) + 
        (gastos.psi || 0) + 
        (gastos.otros || 0);

      updatedCompra.total_impuestos = updatedCompra.impuestos ? 
        calculateTotalTaxAmount(updatedCompra.impuestos) : 0;

      updatedCompra.coste_total_compra = 
        (updatedCompra.precio_compra || 0) + 
        updatedCompra.total_gastos + 
        updatedCompra.total_impuestos;
    }

    onChange({
      ...data,
      compra: updatedCompra
    });
  }, [data, onChange]);

  // Validate on data change
  useEffect(() => {
    const validation = validateStep3(data);
    setLocalErrors(validation.errors);
  }, [data]);

  // Auto-calculate taxes when regime, price, or CCAA changes (only if not manually set)
  useEffect(() => {
    if (data.compra?.regimen && data.compra?.precio_compra && direccionCa) {
      const taxes = calculateTotalTaxes(
        data.compra.precio_compra,
        data.compra.regimen,
        direccionCa as any
      );
      
      // Only set calculated values if user hasn't manually entered them
      const currentTaxes = data.compra.impuestos;
      const shouldUpdate = !currentTaxes || 
        (data.compra.regimen === 'USADA_ITP' && currentTaxes.itp_importe === undefined) ||
        (data.compra.regimen === 'NUEVA_IVA_AJD' && (currentTaxes.iva_importe === undefined || currentTaxes.ajd_importe === undefined));
      
      if (shouldUpdate) {
        const newTaxes = { ...taxes };
        
        if (data.compra.regimen === 'USADA_ITP') {
          // If user has manually set ITP amount, keep it
          if (currentTaxes?.itp_importe !== undefined) {
            newTaxes.itp_importe = currentTaxes.itp_importe;
          }
        } else if (data.compra.regimen === 'NUEVA_IVA_AJD') {
          // If user has manually set IVA or AJD, keep them
          if (currentTaxes?.iva_importe !== undefined) {
            newTaxes.iva_importe = currentTaxes.iva_importe;
          }
          if (currentTaxes?.ajd_importe !== undefined) {
            newTaxes.ajd_importe = currentTaxes.ajd_importe;
          }
        }
        
        updateCompra('impuestos', newTaxes);
      }
    }
  }, [data.compra?.regimen, data.compra?.precio_compra, data.compra?.impuestos, direccionCa, updateCompra]);

  const allErrors = [...errors, ...localErrors];

  const updateGasto = (gastoField: string, value: number) => {
    const gastos = {
      ...data.compra?.gastos,
      [gastoField]: value
    };
    updateCompra('gastos', gastos);
  };

  const formatCurrency = (value: number | undefined): string => {
    return value ? formatEuroAmount(value) : '0,00 €';
  };

  // Helper function to handle tax input with percentage detection
  const handleTaxInput = (taxType: 'itp_importe' | 'iva_importe' | 'ajd_importe', inputValue: string) => {
    const numericValue = parseFloat(inputValue) || 0;
    const precioCompra = data.compra?.precio_compra || 0;
    
    // Check for percentage detection
    const detection = detectPercentageInput(numericValue, precioCompra);
    
    if (detection.isPercentage && detection.convertedAmount && detection.message) {
      // Show conversion message
      setPercentageMessage(detection.message);
      setTimeout(() => setPercentageMessage(''), 3000); // Clear message after 3 seconds
      
      // Update with converted amount
      updateCompra('impuestos', {
        ...data.compra?.impuestos,
        [taxType]: detection.convertedAmount
      });
    } else {
      // Clear any previous message
      setPercentageMessage('');
      
      // Update with entered value
      updateCompra('impuestos', {
        ...data.compra?.impuestos,
        [taxType]: Math.round(numericValue * 100) / 100
      });
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-hz-text mb-2 font-inter">
          Paso 3 · Coste de adquisición
        </h2>
        <p className="text-sm text-gray-600">
          Régimen de compra, precio y gastos asociados
        </p>
      </div>

      <div className="space-y-6">
        
        {/* Régimen de compra */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center mb-4">
            <DocumentTextIcon className="w-5 h-5 text-hz-primary mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Régimen de compra *</h3>
          </div>
          
          <div className="space-y-3">
            <label className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="radio"
                value="USADA_ITP"
                checked={data.compra?.regimen === 'USADA_ITP'}
                onChange={(e) => updateCompra('regimen', e.target.value as RegimenCompra)}
                className="mr-3 text-hz-primary focus:ring-hz-primary"
              />
              <div>
                <div className="font-medium text-gray-900">Vivienda usada (ITP)</div>
                <div className="text-sm text-gray-600">Se aplica Impuesto de Transmisiones Patrimoniales</div>
              </div>
            </label>
            
            <label className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="radio"
                value="NUEVA_IVA_AJD"
                checked={data.compra?.regimen === 'NUEVA_IVA_AJD'}
                onChange={(e) => updateCompra('regimen', e.target.value as RegimenCompra)}
                className="mr-3 text-hz-primary focus:ring-hz-primary"
              />
              <div>
                <div className="font-medium text-gray-900">Obra nueva (IVA + AJD)</div>
                <div className="text-sm text-gray-600">Se aplica IVA y Actos Jurídicos Documentados</div>
              </div>
            </label>
          </div>
        </div>

        {/* Precio de compra */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center mb-4">
            <CurrencyEuroIcon className="w-5 h-5 text-hz-primary mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Precio de compra *</h3>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Precio de adquisición
            </label>
            <div className="relative">
              <input
                type="number"
                value={data.compra?.precio_compra || ''}
                onChange={(e) => updateCompra('precio_compra', parseFloat(e.target.value) || 0)}
                placeholder="Ej: 250000"
                min="0"
                step="0.01"
                className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-md shadow-sm focus:ring-hz-primary focus:border-hz-primary"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                <span className="text-gray-500 text-sm">€</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Precio de compra sin impuestos ni gastos
            </p>
          </div>
        </div>

        {/* Gastos asociados */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center mb-4">
            <CalculatorIcon className="w-5 h-5 text-hz-primary mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Gastos asociados</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notaría
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={data.compra?.gastos?.notaria || ''}
                  onChange={(e) => updateGasto('notaria', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md shadow-sm focus:ring-hz-primary focus:border-hz-primary"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                  <span className="text-gray-500 text-xs">€</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Registro
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={data.compra?.gastos?.registro || ''}
                  onChange={(e) => updateGasto('registro', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md shadow-sm focus:ring-hz-primary focus:border-hz-primary"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                  <span className="text-gray-500 text-xs">€</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gestoría
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={data.compra?.gastos?.gestoria || ''}
                  onChange={(e) => updateGasto('gestoria', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md shadow-sm focus:ring-hz-primary focus:border-hz-primary"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                  <span className="text-gray-500 text-xs">€</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Inmobiliaria
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={data.compra?.gastos?.inmobiliaria || ''}
                  onChange={(e) => updateGasto('inmobiliaria', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md shadow-sm focus:ring-hz-primary focus:border-hz-primary"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                  <span className="text-gray-500 text-xs">€</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PSI
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={data.compra?.gastos?.psi || ''}
                  onChange={(e) => updateGasto('psi', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md shadow-sm focus:ring-hz-primary focus:border-hz-primary"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                  <span className="text-gray-500 text-xs">€</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">Personal Shopper Inmobiliario</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Otros
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={data.compra?.gastos?.otros || ''}
                  onChange={(e) => updateGasto('otros', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md shadow-sm focus:ring-hz-primary focus:border-hz-primary"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                  <span className="text-gray-500 text-xs">€</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Impuestos - Editables con sugerencias calculadas */}
        {data.compra?.regimen && data.compra?.precio_compra && direccionCa && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <div className="flex items-center mb-4">
              <CalculatorIcon className="w-5 h-5 text-[#042C5E] mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Impuestos *</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Importes calculados automáticamente según CCAA. Puedes editar los valores finales en €.
            </p>
            
            {data.compra.regimen === 'USADA_ITP' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ITP - {direccionCa} *
                    <span className="text-xs text-gray-500 ml-2">
                      (Sugerido: {data.compra.impuestos?.itp_porcentaje_info?.toFixed(2)}%)
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={data.compra.impuestos?.itp_importe || ''}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        updateCompra('impuestos', {
                          ...data.compra?.impuestos,
                          itp_importe: value,
                          itp_porcentaje_info: data.compra.impuestos?.itp_porcentaje_info
                        });
                      }}
                      onBlur={(e) => {
                        handleTaxInput('itp_importe', e.target.value);
                      }}
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#042C5E] focus:border-[#042C5E] pr-12"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 text-sm">€</span>
                    </div>
                  </div>
                  {data.compra.impuestos?.itp_importe && data.compra?.precio_compra && (
                    <p className="text-xs text-gray-500 mt-1">
                      Equivale al {((data.compra.impuestos.itp_importe / data.compra.precio_compra) * 100).toFixed(2)}% del precio de compra
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    IVA (10% obra nueva) *
                    <span className="text-xs text-gray-500 ml-2">
                      (Sugerido: {data.compra.impuestos?.iva_porcentaje_info?.toFixed(2)}%)
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={data.compra.impuestos?.iva_importe || ''}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        updateCompra('impuestos', {
                          ...data.compra?.impuestos,
                          iva_importe: value,
                          iva_porcentaje_info: data.compra.impuestos?.iva_porcentaje_info
                        });
                      }}
                      onBlur={(e) => {
                        handleTaxInput('iva_importe', e.target.value);
                      }}
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#042C5E] focus:border-[#042C5E] pr-12"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 text-sm">€</span>
                    </div>
                  </div>
                  {data.compra.impuestos?.iva_importe && data.compra?.precio_compra && (
                    <p className="text-xs text-gray-500 mt-1">
                      Equivale al {((data.compra.impuestos.iva_importe / data.compra.precio_compra) * 100).toFixed(2)}% del precio de compra
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    AJD (1.5% estándar) *
                    <span className="text-xs text-gray-500 ml-2">
                      (Sugerido: {data.compra.impuestos?.ajd_porcentaje_info?.toFixed(2)}%)
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={data.compra.impuestos?.ajd_importe || ''}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        updateCompra('impuestos', {
                          ...data.compra?.impuestos,
                          ajd_importe: value,
                          ajd_porcentaje_info: data.compra.impuestos?.ajd_porcentaje_info
                        });
                      }}
                      onBlur={(e) => {
                        handleTaxInput('ajd_importe', e.target.value);
                      }}
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#042C5E] focus:border-[#042C5E] pr-12"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 text-sm">€</span>
                    </div>
                  </div>
                  {data.compra.impuestos?.ajd_importe && data.compra?.precio_compra && (
                    <p className="text-xs text-gray-500 mt-1">
                      Equivale al {((data.compra.impuestos.ajd_importe / data.compra.precio_compra) * 100).toFixed(2)}% del precio de compra
                    </p>
                  )}
                </div>
              </div>
            )}
            
            {/* Percentage conversion message */}
            {percentageMessage && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mt-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-blue-700">{percentageMessage}</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="border-t border-gray-200 mt-4 pt-4">
              <div className="flex justify-between items-center font-medium">
                <span>Total impuestos:</span>
                <span className="text-[#042C5E]">
                  {formatCurrency(data.compra.total_impuestos)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Resumen de costes */}
        {data.compra?.precio_compra && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Resumen de costes</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Precio de compra:</span>
                <span className="font-medium">{formatCurrency(data.compra.precio_compra)}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Total gastos:</span>
                <span className="font-medium">{formatCurrency(data.compra.total_gastos)}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Total impuestos:</span>
                <span className="font-medium">{formatCurrency(data.compra.total_impuestos)}</span>
              </div>
              
              <div className="border-t border-gray-200 pt-3">
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span className="text-gray-900">Coste total:</span>
                  <span className="text-hz-primary">{formatCurrency(data.compra.coste_total_compra)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Fecha de compra */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Fecha de compra *</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha de adquisición
            </label>
            <input
              type="date"
              value={data.compra?.fecha_compra || ''}
              onChange={(e) => updateCompra('fecha_compra', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-hz-primary focus:border-hz-primary"
            />
            <p className="text-xs text-gray-500 mt-1">
              Fecha de escrituración o contrato de compraventa
            </p>
          </div>
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

export default Step3Coste;