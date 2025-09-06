// H-HOTFIX: Reform Breakdown Component
// Handles multi-category breakdown for reform invoices (Mejora/Mobiliario/Reparación y conservación)

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Calculator, Info } from 'lucide-react';
import { ReformBreakdown } from '../types/inboxTypes';

interface ReformBreakdownProps {
  totalAmount: number;
  onBreakdownChange: (breakdown: ReformBreakdown) => void;
  initialBreakdown?: ReformBreakdown;
  lineItems?: Array<{
    description: string;
    amount: number;
    suggestedCategory?: keyof ReformBreakdown;
  }>;
}

const ReformBreakdownComponent: React.FC<ReformBreakdownProps> = ({
  totalAmount,
  onBreakdownChange,
  initialBreakdown,
  lineItems = []
}) => {
  const [mode, setMode] = useState<'manual' | 'by_lines'>('manual');
  const [breakdown, setBreakdown] = useState<ReformBreakdown>(
    initialBreakdown || { mejora: 0, mobiliario: 0, reparacion_conservacion: 0 }
  );
  const [usePercentages, setUsePercentages] = useState(true);

  // Keywords for automatic categorization suggestions
  const categoryKeywords = {
    mejora: [
      'sustitución integral', 'ampliación', 'renovación completa', 'reforma integral',
      'instalación nueva', 'cambio sistema', 'mejora', 'ampliacion', 'nueva instalación'
    ],
    mobiliario: [
      'sofá', 'sofa', 'mueble', 'mesa', 'silla', 'armario', 'electrodoméstico', 
      'frigorífico', 'lavadora', 'lavavajillas', 'microondas', 'tv', 'televisión',
      'aire acondicionado', 'calefacción', 'radiador', 'mobiliario', 'decoración'
    ],
    reparacion_conservacion: [
      'reparación', 'reparacion', 'fontanería', 'fontaneria', 'pintura', 'mantenimiento',
      'arreglo', 'limpieza', 'conservación', 'conservacion', 'pequeña reparación',
      'retoques', 'goteras', 'grifo', 'enchufe', 'bombilla'
    ]
  };

  const suggestCategory = (description: string): keyof ReformBreakdown => {
    const desc = description.toLowerCase();
    
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => desc.includes(keyword))) {
        return category as keyof ReformBreakdown;
      }
    }
    
    return 'reparacion_conservacion'; // Default
  };

  const calculateTotalAssigned = (): number => {
    return breakdown.mejora + breakdown.mobiliario + breakdown.reparacion_conservacion;
  };

  const calculatePercentages = (): Record<keyof ReformBreakdown, number> => {
    const total = calculateTotalAssigned();
    if (total === 0) return { mejora: 0, mobiliario: 0, reparacion_conservacion: 0 };
    
    return {
      mejora: (breakdown.mejora / total) * 100,
      mobiliario: (breakdown.mobiliario / total) * 100,
      reparacion_conservacion: (breakdown.reparacion_conservacion / total) * 100
    };
  };

  const updateBreakdown = (newBreakdown: ReformBreakdown) => {
    setBreakdown(newBreakdown);
    onBreakdownChange(newBreakdown);
  };

  const handleManualUpdate = (category: keyof ReformBreakdown, value: number) => {
    const newBreakdown = { ...breakdown, [category]: value };
    updateBreakdown(newBreakdown);
  };

  const handlePercentageUpdate = (category: keyof ReformBreakdown, percentage: number) => {
    const amount = (totalAmount * percentage) / 100;
    handleManualUpdate(category, amount);
  };

  const autoDistribute = () => {
    if (lineItems.length > 0) {
      // Distribute by line items
      const newBreakdown: ReformBreakdown = { mejora: 0, mobiliario: 0, reparacion_conservacion: 0 };
      
      lineItems.forEach(item => {
        const category = item.suggestedCategory || suggestCategory(item.description);
        newBreakdown[category] += item.amount;
      });
      
      updateBreakdown(newBreakdown);
    } else {
      // Default distribution: 60% repairs, 30% improvements, 10% furniture
      const newBreakdown: ReformBreakdown = {
        mejora: totalAmount * 0.3,
        mobiliario: totalAmount * 0.1,
        reparacion_conservacion: totalAmount * 0.6
      };
      updateBreakdown(newBreakdown);
    }
  };

  const totalAssigned = calculateTotalAssigned();
  const remaining = totalAmount - totalAssigned;
  const percentages = calculatePercentages();
  const isValid = Math.abs(remaining) < 0.01; // Allow 1 cent tolerance

  useEffect(() => {
    const currentTotalAssigned = calculateTotalAssigned();
    if (lineItems.length > 0 && currentTotalAssigned === 0) {
      setMode('by_lines');
      autoDistribute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineItems]); // Only trigger on lineItems change

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-900">Clasificación fiscal reforma</h4>
        <div className="flex items-center space-x-2">
          <Info className="w-4 h-4 text-primary-500" />
          <span className="text-xs text-gray-600">Total: {totalAmount.toFixed(2)}€</span>
        </div>
      </div>

      {/* Mode selection */}
      {lineItems.length > 0 && (
        <div className="flex space-x-4 text-sm">
          <label className="flex items-center">
            <input
              type="radio"
              checked={mode === 'by_lines'}
              onChange={() => setMode('by_lines')}
              className="mr-2"
            />
            Por líneas de factura
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              checked={mode === 'manual'}
              onChange={() => setMode('manual')}
              className="mr-2"
            />
            Reparto manual
          </label>
        </div>
      )}

      {/* Line items view */}
      {mode === 'by_lines' && lineItems.length > 0 && (
        <div className="space-y-2">
          {lineItems.map((item, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <div className="flex-1">
                <span className="text-sm">{item.description}</span>
                <span className="text-xs text-gray-600 ml-2">{item.amount.toFixed(2)}€</span>
              </div>
              <select
                value={item.suggestedCategory || suggestCategory(item.description)}
                onChange={(e) => {
                  const category = e.target.value as keyof ReformBreakdown;
                  item.suggestedCategory = category;
                  autoDistribute();
                }}
                className="text-xs px-2 py-1 border rounded"
              >
                <option value="mejora">Mejora</option>
                <option value="mobiliario">Mobiliario</option>
                <option value="reparacion_conservacion">Reparación y conservación</option>
              </select>
            </div>
          ))}
        </div>
      )}

      {/* Manual breakdown */}
      {mode === 'manual' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span>Modo:</span>
            <div className="flex space-x-2">
              <button
                onClick={() => setUsePercentages(false)}
                className={`px-2 py-1 rounded ${!usePercentages ? 'bg-primary-100 text-primary-700' : 'bg-gray-100'}`}
              >
                Importes
              </button>
              <button
                onClick={() => setUsePercentages(true)}
                className={`px-2 py-1 rounded ${usePercentages ? 'bg-primary-100 text-primary-700' : 'bg-gray-100'}`}
              >
                Porcentajes
              </button>
            </div>
          </div>

          {/* Category inputs */}
          <div className="space-y-2">
            {/* Mejora */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700">Mejora</label>
                <p className="text-xs text-gray-500">Incrementa valor del inmueble (amortizable)</p>
              </div>
              <div className="flex items-center space-x-2">
                {usePercentages ? (
                  <>
                    <input
                      type="number"
                      value={percentages.mejora.toFixed(1)}
                      onChange={(e) => handlePercentageUpdate('mejora', parseFloat(e.target.value) || 0)}
                      className="w-16 px-2 py-1 text-sm border rounded text-right"
                      min="0"
                      max="100"
                      step="0.1"
                    />
                    <span className="text-xs">%</span>
                  </>
                ) : (
                  <>
                    <input
                      type="number"
                      value={breakdown.mejora.toFixed(2)}
                      onChange={(e) => handleManualUpdate('mejora', parseFloat(e.target.value) || 0)}
                      className="w-20 px-2 py-1 text-sm border rounded text-right"
                      min="0"
                      max={totalAmount}
                      step="0.01"
                    />
                    <span className="text-xs">€</span>
                  </>
                )}
              </div>
            </div>

            {/* Mobiliario */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700">Mobiliario</label>
                <p className="text-xs text-gray-500">Amortización mobiliario (10 años)</p>
              </div>
              <div className="flex items-center space-x-2">
                {usePercentages ? (
                  <>
                    <input
                      type="number"
                      value={percentages.mobiliario.toFixed(1)}
                      onChange={(e) => handlePercentageUpdate('mobiliario', parseFloat(e.target.value) || 0)}
                      className="w-16 px-2 py-1 text-sm border rounded text-right"
                      min="0"
                      max="100"
                      step="0.1"
                    />
                    <span className="text-xs">%</span>
                  </>
                ) : (
                  <>
                    <input
                      type="number"
                      value={breakdown.mobiliario.toFixed(2)}
                      onChange={(e) => handleManualUpdate('mobiliario', parseFloat(e.target.value) || 0)}
                      className="w-20 px-2 py-1 text-sm border rounded text-right"
                      min="0"
                      max={totalAmount}
                      step="0.01"
                    />
                    <span className="text-xs">€</span>
                  </>
                )}
              </div>
            </div>

            {/* Reparación y conservación */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700">Reparación y conservación</label>
                <p className="text-xs text-gray-500">Gasto deducible inmediato</p>
              </div>
              <div className="flex items-center space-x-2">
                {usePercentages ? (
                  <>
                    <input
                      type="number"
                      value={percentages.reparacion_conservacion.toFixed(1)}
                      onChange={(e) => handlePercentageUpdate('reparacion_conservacion', parseFloat(e.target.value) || 0)}
                      className="w-16 px-2 py-1 text-sm border rounded text-right"
                      min="0"
                      max="100"
                      step="0.1"
                    />
                    <span className="text-xs">%</span>
                  </>
                ) : (
                  <>
                    <input
                      type="number"
                      value={breakdown.reparacion_conservacion.toFixed(2)}
                      onChange={(e) => handleManualUpdate('reparacion_conservacion', parseFloat(e.target.value) || 0)}
                      className="w-20 px-2 py-1 text-sm border rounded text-right"
                      min="0"
                      max={totalAmount}
                      step="0.01"
                    />
                    <span className="text-xs">€</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Auto-distribute button */}
          <button
            onClick={autoDistribute}
            className="w-full flex items-center justify-center px-3 py-2 text-sm bg-primary-100 text-primary-700 rounded hover:bg-blue-200"
          >
            <Calculator className="w-4 h-4 mr-2" />
            Distribución automática
          </button>
        </div>
      )}

      {/* Summary */}
      <div className="p-3 bg-gray-50 rounded border">
        <div className="flex justify-between text-sm mb-2">
          <span>Total asignado:</span>
          <span className={isValid ? 'text-success-600' : 'text-error-600'}>
            {totalAssigned.toFixed(2)}€
          </span>
        </div>
        {!isValid && (
          <div className="flex items-center text-xs text-error-600">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Diferencia: {remaining.toFixed(2)}€
          </div>
        )}
        {isValid && (
          <div className="text-xs text-success-600">
            ✓ Distribución correcta
          </div>
        )}
      </div>
    </div>
  );
};

export default ReformBreakdownComponent;