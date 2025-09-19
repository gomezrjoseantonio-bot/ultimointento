import React, { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { Document, Property, OCRResult } from '../services/db';
import { formatEuro } from '../utils/formatUtils';
import { categorizeOCRLineItem } from '../services/invoiceCategorizationService';
import toast from 'react-hot-toast';

// H-OCR-REFORM: Types for invoice breakdown
export type InvoiceCategory = 'mejora' | 'reparacion-conservacion' | 'mobiliario';

export interface InvoiceLineItem {
  id: string;
  description: string;
  baseAmount: number;
  ivaRate: number; // 21, 10, 4, 0
  ivaAmount: number;
  totalAmount: number;
  category: InvoiceCategory;
  confidence?: number; // OCR confidence for auto-suggestions
}

export interface InvoiceBreakdown {
  lineItems: InvoiceLineItem[];
  fechaFinObra?: string; // Required for 'mejora' category
  fechaAltaMobiliario?: string; // Required for 'mobiliario' category
  inmuebleId: number;
  proveedorSugerido?: string;
  menorCuantiaActivated: boolean; // Toggle for amounts ≤ 300€ → R&C
}

interface InvoiceBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (breakdown: InvoiceBreakdown) => void;
  document: Document;
  properties: Property[];
  ocrResult?: OCRResult;
  autoSaveEnabled?: boolean;
}

// Helper function to group line item fields
const groupLineItemFields = (fields: any[]) => {
  const groups: any[] = [];
  const processed = new Set();
  
  fields.forEach(field => {
    if (processed.has(field.name)) return;
    
    const lineNumber = extractLineNumber(field.name);
    if (lineNumber !== null) {
      const group = {
        description: fields.find(f => f.name === `line_item_description_${lineNumber}`)?.value || '',
        amount: fields.find(f => f.name === `line_item_amount_${lineNumber}`)?.value || '',
        quantity: fields.find(f => f.name === `line_item_quantity_${lineNumber}`)?.value || '1',
        confidence: field.confidence || 0
      };
      
      groups.push(group);
      
      // Mark related fields as processed
      [`line_item_description_${lineNumber}`, `line_item_amount_${lineNumber}`, `line_item_quantity_${lineNumber}`]
        .forEach(name => processed.add(name));
    }
  });
  
  return groups;
};

const extractLineNumber = (fieldName: string): number | null => {
  const match = fieldName.match(/line_item_.*_(\d+)$/);
  return match ? parseInt(match[1]) : null;
};

const InvoiceBreakdownModal: React.FC<InvoiceBreakdownModalProps> = ({
  isOpen,
  onClose,
  onSave,
  document,
  properties,
  ocrResult,
  autoSaveEnabled = false
}) => {
  const [breakdown, setBreakdown] = useState<InvoiceBreakdown>({
    lineItems: [],
    inmuebleId: properties[0]?.id || 0,
    menorCuantiaActivated: true
  });

  const [distributionMode, setDistributionMode] = useState<'lines' | 'percentage'>('lines');
  const [percentageDistribution, setPercentageDistribution] = useState({
    mejora: 70,
    reparacionConservacion: 20,
    mobiliario: 10
  });

  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Initialize breakdown from OCR data or create single line
  const initializeFromOCR = useCallback(() => {
    const lineItems: InvoiceLineItem[] = [];
    
    // Extract line items from OCR result
    const lineItemFields = ocrResult!.fields.filter(f => f.name.startsWith('line_item'));
    
    if (lineItemFields.length > 0) {
      // Group line item fields by line
      const lineGroups = groupLineItemFields(lineItemFields);
      
      lineGroups.forEach((group, index) => {
        const description = group.description || `Línea ${index + 1}`;
        const amount = parseFloat(group.amount || '0');
        const quantity = parseFloat(group.quantity || '1');
        const baseAmount = amount * quantity;
        
        // Auto-categorize using heuristics
        const category = categorizeOCRLineItem(description);
        
        lineItems.push({
          id: `line-${index}`,
          description,
          baseAmount,
          ivaRate: 21, // Default VAT rate
          ivaAmount: baseAmount * 0.21,
          totalAmount: baseAmount * 1.21,
          category,
          confidence: group.confidence
        });
      });
    } else {
      // No line items detected, create single line from totals
      const totalAmount = ocrResult!.fields.find(f => f.name === 'total_amount')?.value || '0';
      const amount = parseFloat(totalAmount.replace(/[^0-9.,]/g, '').replace(',', '.'));
      
      lineItems.push({
        id: 'total-line',
        description: 'Total factura',
        baseAmount: amount / 1.21, // Assume 21% VAT
        ivaRate: 21,
        ivaAmount: amount - (amount / 1.21),
        totalAmount: amount,
        category: 'reparacion-conservacion' // Default to R&C
      });
    }

    // Get suggested supplier
    const supplier = ocrResult!.fields.find(f => f.name === 'supplier_name')?.value || '';

    setBreakdown(prev => ({
      ...prev,
      lineItems,
      proveedorSugerido: supplier
    }));
  }, [ocrResult]);

  const initializeManualEntry = useCallback(() => {
    // Create single line for manual distribution
    const amount = document.metadata.financialData?.amount || 0;
    
    setBreakdown(prev => ({
      ...prev,
      lineItems: [{
        id: 'manual-line',
        description: 'Total factura para repartir',
        baseAmount: amount / 1.21, // Assume 21% VAT
        ivaRate: 21,
        ivaAmount: amount - (amount / 1.21),
        totalAmount: amount,
        category: 'reparacion-conservacion'
      }]
    }));
  }, [document.metadata.financialData?.amount]);

  useEffect(() => {
    if (!isOpen) return;

    if (ocrResult) {
      initializeFromOCR();
    } else {
      initializeManualEntry();
    }
  }, [isOpen, ocrResult, initializeFromOCR, initializeManualEntry]);

  const updateLineItem = (id: string, updates: Partial<InvoiceLineItem>) => {
    setBreakdown(prev => ({
      ...prev,
      lineItems: prev.lineItems.map(item => {
        if (item.id === id) {
          const updated = { ...item, ...updates };
          
          // Recalculate IVA amount when rate or base changes
          if ('ivaRate' in updates || 'baseAmount' in updates) {
            updated.ivaAmount = updated.baseAmount * (updated.ivaRate / 100);
            updated.totalAmount = updated.baseAmount + updated.ivaAmount;
          }
          
          return updated;
        }
        return item;
      })
    }));
  };

  const applyPercentageDistribution = () => {
    const totalAmount = breakdown.lineItems.reduce((sum, item) => sum + item.totalAmount, 0);
    
    if (totalAmount === 0) {
      toast.error('No hay importe total para distribuir');
      return;
    }

    const mejoraAmount = (totalAmount * percentageDistribution.mejora) / 100;
    const rcAmount = (totalAmount * percentageDistribution.reparacionConservacion) / 100;
    const mobiliarioAmount = (totalAmount * percentageDistribution.mobiliario) / 100;

    const newLineItems: InvoiceLineItem[] = [
      {
        id: 'mejora-dist',
        description: 'Mejora (distribución %)',
        baseAmount: mejoraAmount / 1.21,
        ivaRate: 21,
        ivaAmount: mejoraAmount - (mejoraAmount / 1.21),
        totalAmount: mejoraAmount,
        category: 'mejora'
      },
      {
        id: 'rc-dist',
        description: 'Reparación & Conservación (distribución %)',
        baseAmount: rcAmount / 1.21,
        ivaRate: 21,
        ivaAmount: rcAmount - (rcAmount / 1.21),
        totalAmount: rcAmount,
        category: 'reparacion-conservacion'
      },
      {
        id: 'mobiliario-dist',
        description: 'Mobiliario (distribución %)',
        baseAmount: mobiliarioAmount / 1.21,
        ivaRate: 21,
        ivaAmount: mobiliarioAmount - (mobiliarioAmount / 1.21),
        totalAmount: mobiliarioAmount,
        category: 'mobiliario'
      }
    ];

    setBreakdown(prev => ({
      ...prev,
      lineItems: newLineItems
    }));
  };

  const validateBreakdown = (): string[] => {
    const errors: string[] = [];
    
    // Check that totals match ±0.01€
    const documentTotal = document.metadata.financialData?.amount || 0;
    const breakdownTotal = breakdown.lineItems.reduce((sum, item) => sum + item.totalAmount, 0);
    
    if (Math.abs(documentTotal - breakdownTotal) > 0.01) {
      errors.push(`Los totales no cuadran: ${formatEuro(breakdownTotal)} ≠ ${formatEuro(documentTotal)} (diferencia: ${formatEuro(Math.abs(documentTotal - breakdownTotal))})`);
    }

    // Check required dates
    const hasMejora = breakdown.lineItems.some(item => item.category === 'mejora');
    const hasMobiliario = breakdown.lineItems.some(item => item.category === 'mobiliario');
    
    if (hasMejora && !breakdown.fechaFinObra) {
      errors.push('Falta la fecha de fin de obra para las mejoras');
    }
    
    if (hasMobiliario && !breakdown.fechaAltaMobiliario) {
      errors.push('Falta la fecha de alta para el mobiliario');
    }

    // Check property selection
    if (!breakdown.inmuebleId) {
      errors.push('Debe seleccionar un inmueble');
    }

    return errors;
  };

  const handleSave = () => {
    const errors = validateBreakdown();
    setValidationErrors(errors);

    if (errors.length === 0) {
      onSave(breakdown);
      onClose();
      toast.success('Desglose guardado correctamente');
    } else if (autoSaveEnabled) {
      // Auto-save mode: save what's valid, warn about incomplete data
      onSave(breakdown);
      toast.error('Guardado con advertencias. Revisar en Pendientes.');
    } else {
      toast.error('Corrige los errores antes de guardar');
    }
  };

  const getTotalsByCategory = () => {
    const totals = {
      mejora: 0,
      reparacionConservacion: 0,
      mobiliario: 0
    };

    breakdown.lineItems.forEach(item => {
      if (item.category === 'mejora') totals.mejora += item.totalAmount;
      else if (item.category === 'reparacion-conservacion') totals.reparacionConservacion += item.totalAmount;
      else if (item.category === 'mobiliario') totals.mobiliario += item.totalAmount;
    });

    return totals;
  };

  const applyMinorAmountRule = useCallback(() => {
    if (!breakdown.menorCuantiaActivated) return;

    setBreakdown(prev => ({
      ...prev,
      lineItems: prev.lineItems.map(item => ({
        ...item,
        category: item.totalAmount <= 300 ? 'reparacion-conservacion' : item.category
      }))
    }));
  }, [breakdown.menorCuantiaActivated]);

  useEffect(() => {
    applyMinorAmountRule();
  }, [applyMinorAmountRule]);

  if (!isOpen) return null;

  const totals = getTotalsByCategory();

  return (
    <div className="fixed inset-0 bg-gray-200 flex items-center justify-center z-50 p-4">
      <div className="bg-white max-w-7xl w-full max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Desglose por conceptos
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Mejora · Reparación & Conservación · Mobiliario
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Top Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Property Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Inmueble *
              </label>
              <select
                value={breakdown.inmuebleId}
                onChange={(e) => setBreakdown(prev => ({ ...prev, inmuebleId: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                required
              >
                {properties.map(property => (
                  <option key={property.id} value={property.id}>
                    {property.alias}
                  </option>
                ))}
              </select>
            </div>

            {/* Distribution Mode */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Modo de reparto
              </label>
              <div className="flex border border-gray-300">
                <button
                  type="button"
                  onClick={() => setDistributionMode('lines')}
                  className={`flex-1 px-3 py-2 text-sm font-medium-md ${
                    distributionMode === 'lines'
                      ? 'bg-brand-navy'
                      : 'bg-white text-gray-700
                  }`}
                >
                  Por líneas
                </button>
                <button
                  type="button"
                  onClick={() => setDistributionMode('percentage')}
                  className={`flex-1 px-3 py-2 text-sm font-medium-md ${
                    distributionMode === 'percentage'
                      ? 'bg-brand-navy'
                      : 'bg-white text-gray-700
                  }`}
                >
                  Por %
                </button>
              </div>
            </div>

            {/* Minor Amount Rule */}
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={breakdown.menorCuantiaActivated}
                  onChange={(e) => setBreakdown(prev => ({ ...prev, menorCuantiaActivated: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">
                  Menor cuantía → R&C (≤ 300€)
                </span>
              </label>
            </div>
          </div>

          {/* Percentage Distribution Panel */}
          {distributionMode === 'percentage' && (
            <div className="bg-gray-50 p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-900">Distribución porcentual</h3>
                <button
                  onClick={applyPercentageDistribution}
                  className="px-3 py-1 bg-brand-navy text-sm rounded >
                  Aplicar
                </button>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Mejora (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={percentageDistribution.mejora}
                    onChange={(e) => setPercentageDistribution(prev => ({ ...prev, mejora: parseInt(e.target.value) || 0 }))}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">R&C (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={percentageDistribution.reparacionConservacion}
                    onChange={(e) => setPercentageDistribution(prev => ({ ...prev, reparacionConservacion: parseInt(e.target.value) || 0 }))}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Mobiliario (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={percentageDistribution.mobiliario}
                    onChange={(e) => setPercentageDistribution(prev => ({ ...prev, mobiliario: parseInt(e.target.value) || 0 }))}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-600">
                Total: {percentageDistribution.mejora + percentageDistribution.reparacionConservacion + percentageDistribution.mobiliario}%
              </div>
            </div>
          )}

          {/* Three-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Mejora Column */}
            <div className="border border-gray-200">
              <div className="btn-primary-horizon px-4 py-3 border-b border-gray-200">
                <h3 className="font-semibold text-primary-900">Mejora</h3>
                <p className="text-sm text-primary-700">Incrementa valor construcción</p>
                <div className="mt-2 text-lg font-bold text-primary-900">
                  {formatEuro(totals.mejora)}
                </div>
              </div>
              <div className="p-4 space-y-3">
                {breakdown.lineItems
                  .filter(item => item.category === 'mejora')
                  .map(item => (
                    <LineItemCard
                      key={item.id}
                      item={item}
                      onUpdate={(updates) => updateLineItem(item.id, updates)}
                      onCategoryChange={(category) => updateLineItem(item.id, { category })}
                    />
                  ))}
                {totals.mejora > 0 && (
                  <div className="pt-2 border-t border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha fin de obra *
                    </label>
                    <input
                      type="date"
                      value={breakdown.fechaFinObra || ''}
                      onChange={(e) => setBreakdown(prev => ({ ...prev, fechaFinObra: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 text-sm"
                      required
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Reparación & Conservación Column */}
            <div className="border border-gray-200">
              <div className="bg-success-50 px-4 py-3 border-b border-gray-200">
                <h3 className="font-semibold text-success-900">Reparación & Conservación</h3>
                <p className="text-sm text-success-700">Gasto deducible del ejercicio</p>
                <div className="mt-2 text-lg font-bold text-success-900">
                  {formatEuro(totals.reparacionConservacion)}
                </div>
              </div>
              <div className="p-4 space-y-3">
                {breakdown.lineItems
                  .filter(item => item.category === 'reparacion-conservacion')
                  .map(item => (
                    <LineItemCard
                      key={item.id}
                      item={item}
                      onUpdate={(updates) => updateLineItem(item.id, updates)}
                      onCategoryChange={(category) => updateLineItem(item.id, { category })}
                    />
                  ))}
              </div>
            </div>

            {/* Mobiliario Column */}
            <div className="border border-gray-200">
              <div className="bg-purple-50 px-4 py-3 border-b border-gray-200">
                <h3 className="font-semibold text-purple-900">Mobiliario</h3>
                <p className="text-sm text-purple-700">Amortización 10 años</p>
                <div className="mt-2 text-lg font-bold text-purple-900">
                  {formatEuro(totals.mobiliario)}
                </div>
              </div>
              <div className="p-4 space-y-3">
                {breakdown.lineItems
                  .filter(item => item.category === 'mobiliario')
                  .map(item => (
                    <LineItemCard
                      key={item.id}
                      item={item}
                      onUpdate={(updates) => updateLineItem(item.id, updates)}
                      onCategoryChange={(category) => updateLineItem(item.id, { category })}
                    />
                  ))}
                {totals.mobiliario > 0 && (
                  <div className="pt-2 border-t border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha de alta *
                    </label>
                    <input
                      type="date"
                      value={breakdown.fechaAltaMobiliario || ''}
                      onChange={(e) => setBreakdown(prev => ({ ...prev, fechaAltaMobiliario: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 text-sm"
                      required
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="mb-6 p-4 bg-error-50 border border-error-200">
              <h4 className="font-medium text-error-900 mb-2">Errores de validación:</h4>
              <ul className="list-disc list-inside text-sm text-error-700 space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Summary */}
          <div className="bg-gray-50 p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Resumen</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Total Mejora:</span>
                <div className="font-semibold text-primary-600">{formatEuro(totals.mejora)}</div>
              </div>
              <div>
                <span className="text-gray-600">Total R&C:</span>
                <div className="font-semibold text-success-600">{formatEuro(totals.reparacionConservacion)}</div>
              </div>
              <div>
                <span className="text-gray-600">Total Mobiliario:</span>
                <div className="font-semibold text-purple-600">{formatEuro(totals.mobiliario)}</div>
              </div>
              <div>
                <span className="text-gray-600">Total General:</span>
                <div className="font-semibold text-gray-900">
                  {formatEuro(totals.mejora + totals.reparacionConservacion + totals.mobiliario)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-brand-navy
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};

// Component for individual line items
interface LineItemCardProps {
  item: InvoiceLineItem;
  onUpdate: (updates: Partial<InvoiceLineItem>) => void;
  onCategoryChange: (category: InvoiceCategory) => void;
}

const LineItemCard: React.FC<LineItemCardProps> = ({ item, onUpdate, onCategoryChange }) => {
  return (
    <div className="bg-white border border-gray-200 rounded p-3 space-y-2">
      <div>
        <input
          type="text"
          value={item.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
          placeholder="Descripción del concepto"
        />
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Base</label>
          <input
            type="number"
            step="0.01"
            value={item.baseAmount.toFixed(2)}
            onChange={(e) => onUpdate({ baseAmount: parseFloat(e.target.value) || 0 })}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">IVA (%)</label>
          <select
            value={item.ivaRate}
            onChange={(e) => onUpdate({ ivaRate: parseInt(e.target.value) })}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
          >
            <option value={21}>21%</option>
            <option value={10}>10%</option>
            <option value={4}>4%</option>
            <option value={0}>0%</option>
          </select>
        </div>
      </div>
      
      <div className="flex justify-between items-center text-xs text-gray-600">
        <span>IVA: {formatEuro(item.ivaAmount)}</span>
        <span className="font-semibold text-gray-900">Total: {formatEuro(item.totalAmount)}</span>
      </div>
      
      <div className="flex space-x-1">
        {(['mejora', 'reparacion-conservacion', 'mobiliario'] as InvoiceCategory[]).map(category => (
          <button
            key={category}
            onClick={() => onCategoryChange(category)}
            className={`px-2 py-1 text-xs rounded ${
              item.category === category
                ? 'bg-brand-navy'
                : 'bg-gray-100 text-gray-600
            }`}
          >
            {category === 'mejora' ? 'M' : category === 'reparacion-conservacion' ? 'R&C' : 'Mob'}
          </button>
        ))}
      </div>
    </div>
  );
};

export default InvoiceBreakdownModal;