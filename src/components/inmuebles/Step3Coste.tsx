// Step 3: Coste de adquisición - Régimen, Precio, Gastos, Impuestos (en valores absolutos €)
// Following Horizon design system with automatic tax calculations
// Enhanced with Spanish Euro formatting and improved ITP calculation per requirements

import React, { useState, useEffect, useCallback } from 'react';
import { Euro, Calculator, FileText } from 'lucide-react';
import { InmuebleStep3, RegimenCompra } from '../../types/inmueble';
import { validateStep3, calculateTotalTaxAmount } from '../../utils/inmuebleUtils';
import { 
  calculateITPWithBase, 
  calculateIVAAmount, 
  calculateAJDAmount,
  formatPercentageChip,
  formatEuroDisplay,
  parseSpanishEuroInput,
  getSpecialTaxWarning,
  getCCAAFromPostalCode,
  BaseITPConfig
} from '../../utils/taxCalculationUtils';
import { Tooltip } from '../common/Tooltip';

interface Step3CosteProps {
  data: InmuebleStep3;
  onChange: (data: InmuebleStep3) => void;
  direccionCp?: string; // Postal code for automatic tax calculations
  errors?: string[];
}

const Step3Coste: React.FC<Step3CosteProps> = ({
  data,
  onChange,
  direccionCp,
  errors = []
}) => {
  const [localErrors, setLocalErrors] = useState<string[]>([]);
  const [taxCalculationMode, setTaxCalculationMode] = useState<'auto' | 'manual'>('auto');
  const [baseItpConfig, setBaseItpConfig] = useState<BaseITPConfig>({ modo: 'auto', valor: null });
  const [manualItpBase, setManualItpBase] = useState<string>('');

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

  // Auto-calculate taxes when regime, price, or postal code changes (only if auto mode is active)
  const shouldRecalculate = useCallback(() => {
    return taxCalculationMode === 'auto' && 
           data.compra?.regimen && 
           data.compra?.precio_compra && 
           direccionCp;
  }, [taxCalculationMode, data.compra?.regimen, data.compra?.precio_compra, direccionCp]);

  useEffect(() => {
    if (!shouldRecalculate()) return;

    const precioCompra = data.compra!.precio_compra!;
    
    if (data.compra!.regimen === 'USADA_ITP') {
      const itpResult = calculateITPWithBase(precioCompra, direccionCp!, baseItpConfig);
      if (itpResult) {
        // Check if we need to update (avoid infinite loops)
        const currentItp = data.compra?.impuestos?.itp_importe;
        if (Math.abs((currentItp || 0) - itpResult.importe) > 0.01) {
          const newData = {
            ...data,
            compra: {
              ...data.compra!,
              impuestos: {
                ...data.compra?.impuestos,
                itp_importe: itpResult.importe,
                itp_porcentaje_info: itpResult.porcentaje
              },
              base_itp_modo: baseItpConfig.modo,
              base_itp_valor: baseItpConfig.valor
            }
          };
          
          // Recalculate totals
          const gastos = newData.compra.gastos || {
            notaria: 0, registro: 0, gestoria: 0, inmobiliaria: 0, psi: 0, otros: 0
          };
          newData.compra.total_gastos = Object.values(gastos).reduce((sum, val) => sum + (val || 0), 0);
          newData.compra.total_impuestos = calculateTotalTaxAmount(newData.compra.impuestos);
          newData.compra.coste_total_compra = precioCompra + (newData.compra.total_gastos || 0) + (newData.compra.total_impuestos || 0);
          
          onChange(newData);
        }
      }
    } else if (data.compra!.regimen === 'NUEVA_IVA_AJD') {
      const ivaResult = calculateIVAAmount(precioCompra);
      const ajdResult = calculateAJDAmount(precioCompra);
      
      // Check if we need to update (avoid infinite loops)
      const currentIva = data.compra?.impuestos?.iva_importe || 0;
      const currentAjd = data.compra?.impuestos?.ajd_importe || 0;
      if (Math.abs(currentIva - ivaResult.importe) > 0.01 || Math.abs(currentAjd - ajdResult.importe) > 0.01) {
        const newData = {
          ...data,
          compra: {
            ...data.compra!,
            impuestos: {
              ...data.compra?.impuestos,
              iva_importe: ivaResult.importe,
              iva_porcentaje_info: ivaResult.porcentaje,
              ajd_importe: ajdResult.importe,
              ajd_porcentaje_info: ajdResult.porcentaje
            }
          }
        };
        
        // Recalculate totals
        const gastos = newData.compra.gastos || {
          notaria: 0, registro: 0, gestoria: 0, inmobiliaria: 0, psi: 0, otros: 0
        };
        newData.compra.total_gastos = Object.values(gastos).reduce((sum, val) => sum + (val || 0), 0);
        newData.compra.total_impuestos = calculateTotalTaxAmount(newData.compra.impuestos);
        newData.compra.coste_total_compra = precioCompra + (newData.compra.total_gastos || 0) + (newData.compra.total_impuestos || 0);
        
        onChange(newData);
      }
    }
  }, [shouldRecalculate, baseItpConfig, direccionCp, data, onChange]);

  const allErrors = [...errors, ...localErrors];

  const updateGasto = (gastoField: string, value: number) => {
    const gastos = {
      ...data.compra?.gastos,
      [gastoField]: value
    };
    updateCompra('gastos', gastos);
  };

  const formatCurrency = (value: number | undefined): string => {
    return formatEuroDisplay(value);
  };

  // Handle manual ITP base input
  const handleManualItpBaseChange = (value: string) => {
    setManualItpBase(value);
    const parsedValue = parseSpanishEuroInput(value);
    setBaseItpConfig({
      modo: 'manual',
      valor: parsedValue > 0 ? parsedValue : null
    });
  };

  // Handle switching between auto and manual base
  const handleBaseItpModeChange = (isAuto: boolean) => {
    if (isAuto) {
      setBaseItpConfig({ modo: 'auto', valor: null });
      setManualItpBase('');
    } else {
      setBaseItpConfig({ modo: 'manual', valor: data.compra?.precio_compra || null });
      setManualItpBase(formatEuroDisplay(data.compra?.precio_compra || 0));
    }
  };

  // Get current CCAA info for display
  const ccaaInfo = direccionCp ? getCCAAFromPostalCode(direccionCp) : null;
  const specialWarning = ccaaInfo ? getSpecialTaxWarning(ccaaInfo.ccaa) : null;

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
        <div className="bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center mb-4">
            <FileText className="w-5 h-5 text-hz-primary mr-2" size={24}  />
            <Tooltip content="Define qué impuestos se aplican a la compra: ITP para vivienda usada, IVA+AJD para obra nueva" showIcon>
              <h3 className="text-lg font-medium text-gray-900">Régimen de compra *</h3>
            </Tooltip>
          </div>
          
          <div className="space-y-3">
            <label className="flex items-center p-3 border border-gray-200 cursor-pointer">
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
            
            <label className="flex items-center p-3 border border-gray-200 cursor-pointer">
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
        <div className="bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center mb-4">
            <Euro className="w-5 h-5 text-hz-primary mr-2" size={24}  />
            <h3 className="text-lg font-medium text-gray-900">Precio de compra *</h3>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Tooltip content="Precio escriturado sin incluir impuestos ni gastos de compraventa" showIcon>
                <span>Precio de adquisición</span>
              </Tooltip>
            </label>
            <div className="relative">
              <input
                type="number"
                value={data.compra?.precio_compra || ''}
                onChange={(e) => updateCompra('precio_compra', parseFloat(e.target.value) || 0)}
                placeholder="Ej: 250000"
                min="0"
                step="0.01"
                className="w-full px-3 py-2 pr-12 border border-gray-300 shadow-sm focus:ring-hz-primary focus:border-hz-primary"
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
        <div className="bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center mb-4">
            <Calculator className="w-5 h-5 text-hz-primary mr-2" size={24}  />
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
                  className="w-full px-3 py-2 pr-8 border border-gray-300 shadow-sm focus:ring-hz-primary focus:border-hz-primary"
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
                  className="w-full px-3 py-2 pr-8 border border-gray-300 shadow-sm focus:ring-hz-primary focus:border-hz-primary"
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
                  className="w-full px-3 py-2 pr-8 border border-gray-300 shadow-sm focus:ring-hz-primary focus:border-hz-primary"
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
                  className="w-full px-3 py-2 pr-8 border border-gray-300 shadow-sm focus:ring-hz-primary focus:border-hz-primary"
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
                  className="w-full px-3 py-2 pr-8 border border-gray-300 shadow-sm focus:ring-hz-primary focus:border-hz-primary"
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
                  className="w-full px-3 py-2 pr-8 border border-gray-300 shadow-sm focus:ring-hz-primary focus:border-hz-primary"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                  <span className="text-gray-500 text-xs">€</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Impuestos - Enhanced with Euro amounts and automatic calculation */}
        {data.compra?.regimen && data.compra?.precio_compra && direccionCp && (
          <div className="bg-white border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center mb-4">
              <Calculator className="w-5 h-5 text-atlas-blue mr-2" size={24}  />
              <h3 className="text-lg font-medium text-gray-900">Impuestos *</h3>
            </div>
            
            {/* Calculation Mode Toggle */}
            <div className="mb-4 p-3 bg-gray-50">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  Usar cálculo automático
                </label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={taxCalculationMode === 'auto'}
                    onChange={(e) => setTaxCalculationMode(e.target.checked ? 'auto' : 'manual')}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-hz-primary/20 peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-hz-primary"></div>
                </label>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {taxCalculationMode === 'auto' 
                  ? 'Los importes se calculan automáticamente según CCAA y régimen'
                  : 'Edita manualmente los importes finales'
                }
              </p>
            </div>

            {/* Base ITP Section (only for USADA_ITP) */}
            {data.compra.regimen === 'USADA_ITP' && (
              <div className="mb-4 p-3 border border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Base imponible ITP</h4>
                <div className="space-y-3">
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={baseItpConfig.modo === 'auto'}
                        onChange={() => handleBaseItpModeChange(true)}
                        className="mr-2 text-hz-primary focus:ring-hz-primary"
                      />
                      <span className="text-sm text-gray-700">Automática (precio de compra)</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={baseItpConfig.modo === 'manual'}
                        onChange={() => handleBaseItpModeChange(false)}
                        className="mr-2 text-hz-primary focus:ring-hz-primary"
                      />
                      <span className="text-sm text-gray-700">Manual</span>
                    </label>
                  </div>
                  
                  {baseItpConfig.modo === 'manual' && (
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        Base ITP manual
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={manualItpBase}
                          onChange={(e) => handleManualItpBaseChange(e.target.value)}
                          placeholder="Ej: 200.000,00"
                          className="w-full px-3 py-2 pr-8 border border-gray-300 shadow-sm focus:ring-hz-primary focus:border-hz-primary text-sm"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                          <span className="text-gray-500 text-xs">€</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {data.compra.regimen === 'USADA_ITP' ? (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      ITP *
                    </label>
                    {ccaaInfo && data.compra.impuestos?.itp_porcentaje_info && (
                      <span className="btn-primary-horizon inline-flex items-center px-2 py-1 text-xs font-medium text-primary-800">
                        ITP ({formatPercentageChip(data.compra.impuestos.itp_porcentaje_info)})
                      </span>
                    )}
                    {!ccaaInfo?.isKnown && (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800">
                        ITP (8%*)
                      </span>
                    )}
                  </div>
                  
                  <div className="relative">
                    <input
                      type="text"
                      value={formatEuroDisplay(data.compra.impuestos?.itp_importe || 0)}
                      onChange={(e) => {
                        if (taxCalculationMode === 'manual') {
                          const value = parseSpanishEuroInput(e.target.value);
                          updateCompra('impuestos', {
                            ...data.compra?.impuestos,
                            itp_importe: value
                          });
                        }
                      }}
                      disabled={taxCalculationMode === 'auto' || !data.compra?.precio_compra}
                      placeholder={!data.compra?.precio_compra ? "Completa precio y CCAA" : "0,00"}
                      className={`w-full px-3 py-2 border border-gray-300 shadow-sm focus:ring-hz-primary focus:border-hz-primary ${
                        taxCalculationMode === 'auto' || !data.compra?.precio_compra ? 'bg-gray-50 text-gray-500' : ''
                      }`}
                      title={!data.compra?.precio_compra ? "Completa precio y CCAA" : ""}
                    />
                  </div>
                  
                  {data.compra.impuestos?.itp_importe && data.compra?.precio_compra && (
                    <p className="text-xs text-gray-500 mt-1">
                      Equivale al {((data.compra.impuestos.itp_importe / data.compra.precio_compra) * 100).toFixed(2)}% del precio de compra
                    </p>
                  )}
                  
                  {!ccaaInfo?.isKnown && (
                    <p className="text-xs text-orange-600 mt-1">
                      * CCAA no detectada automáticamente. Se aplica tipo general 8%.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      IVA *
                    </label>
                    {data.compra.impuestos?.iva_porcentaje_info && (
                      <span className="btn-accent-horizon inline-flex items-center px-2 py-1 text-xs font-medium text-green-800">
                        IVA ({formatPercentageChip(data.compra.impuestos.iva_porcentaje_info)})
                      </span>
                    )}
                  </div>
                  
                  <div className="relative">
                    <input
                      type="text"
                      value={formatEuroDisplay(data.compra.impuestos?.iva_importe || 0)}
                      onChange={(e) => {
                        if (taxCalculationMode === 'manual') {
                          const value = parseSpanishEuroInput(e.target.value);
                          updateCompra('impuestos', {
                            ...data.compra?.impuestos,
                            iva_importe: value
                          });
                        }
                      }}
                      disabled={taxCalculationMode === 'auto'}
                      className={`w-full px-3 py-2 border border-gray-300 shadow-sm focus:ring-hz-primary focus:border-hz-primary ${
                        taxCalculationMode === 'auto' ? 'bg-gray-50 text-gray-500' : ''
                      }`}
                    />
                  </div>
                  
                  {data.compra.impuestos?.iva_importe && data.compra?.precio_compra && (
                    <p className="text-xs text-gray-500 mt-1">
                      Equivale al {((data.compra.impuestos.iva_importe / data.compra.precio_compra) * 100).toFixed(2)}% del precio de compra
                    </p>
                  )}
                </div>
                
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      AJD *
                    </label>
                    {data.compra.impuestos?.ajd_porcentaje_info && (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800">
                        AJD ({formatPercentageChip(data.compra.impuestos.ajd_porcentaje_info)})
                      </span>
                    )}
                  </div>
                  
                  <div className="relative">
                    <input
                      type="text"
                      value={formatEuroDisplay(data.compra.impuestos?.ajd_importe || 0)}
                      onChange={(e) => {
                        if (taxCalculationMode === 'manual') {
                          const value = parseSpanishEuroInput(e.target.value);
                          updateCompra('impuestos', {
                            ...data.compra?.impuestos,
                            ajd_importe: value
                          });
                        }
                      }}
                      disabled={taxCalculationMode === 'auto'}
                      className={`w-full px-3 py-2 border border-gray-300 shadow-sm focus:ring-hz-primary focus:border-hz-primary ${
                        taxCalculationMode === 'auto' ? 'bg-gray-50 text-gray-500' : ''
                      }`}
                    />
                  </div>
                  
                  {data.compra.impuestos?.ajd_importe && data.compra?.precio_compra && (
                    <p className="text-xs text-gray-500 mt-1">
                      Equivale al {((data.compra.impuestos.ajd_importe / data.compra.precio_compra) * 100).toFixed(2)}% del precio de compra
                    </p>
                  )}
                </div>
              </div>
            )}
            
            {/* Special tax warnings */}
            {specialWarning && (
              <div className="bg-yellow-50 border border-yellow-200 p-3 mt-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700">{specialWarning}</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="border-t border-gray-200 mt-4 pt-4">
              <div className="flex justify-between items-center font-medium">
                <span>Total impuestos:</span>
                <span className="text-atlas-blue">
                  {formatCurrency(data.compra.total_impuestos)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Resumen de costes */}
        {data.compra?.precio_compra && (
          <div className="bg-white border border-gray-200 p-6 shadow-sm">
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
        <div className="bg-white border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Fecha de compra *</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha de adquisición
            </label>
            <input
              type="date"
              value={data.compra?.fecha_compra || ''}
              onChange={(e) => updateCompra('fecha_compra', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 shadow-sm focus:ring-hz-primary focus:border-hz-primary"
            />
            <p className="text-xs text-gray-500 mt-1">
              Fecha de escrituración o contrato de compraventa
            </p>
          </div>
        </div>

        {/* Error Messages */}
        {allErrors.length > 0 && (
          <div className="bg-error-50 border border-error-200 p-4">
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