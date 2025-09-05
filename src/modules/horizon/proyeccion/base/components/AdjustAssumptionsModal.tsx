import React, { useState } from 'react';
import { X, Save, RotateCcw } from 'lucide-react';
import { formatPercentage } from '../../../../../utils/formatUtils';
import type { BaseAssumptions } from '../services/proyeccionService';

interface AdjustAssumptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  assumptions: BaseAssumptions;
  onSave: (assumptions: BaseAssumptions) => void;
}

const AdjustAssumptionsModal: React.FC<AdjustAssumptionsModalProps> = ({
  isOpen,
  onClose,
  assumptions,
  onSave
}) => {
  const [formData, setFormData] = useState<BaseAssumptions>({ ...assumptions });
  const [hasChanges, setHasChanges] = useState(false);

  const handleInputChange = (field: keyof BaseAssumptions, value: number) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    setHasChanges(JSON.stringify(newData) !== JSON.stringify(assumptions));
  };

  const handleSave = () => {
    onSave(formData);
  };

  const handleReset = () => {
    setFormData({ ...assumptions });
    setHasChanges(false);
  };

  const resetToDefaults = () => {
    const defaults = {
      rentGrowth: 3.5,
      expenseInflation: 2.5,
      propertyAppreciation: 4.0,
      vacancyRate: 5.0,
      referenceRate: 4.5,
      lastModified: new Date().toISOString()
    };
    setFormData(defaults);
    setHasChanges(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Overlay */}
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative inline-block w-full max-w-2xl px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-xl shadow-xl sm:my-8 sm:align-middle sm:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-[#0F172A]">
                Ajustar supuestos base
              </h3>
              <p className="text-sm text-[#6B7280] mt-1">
                Modifica los parámetros globales para la proyección baseline
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[#F8F9FA] transition-colors"
            >
              <X className="h-5 w-5 text-[#6B7280]" />
            </button>
          </div>

          {/* Form */}
          <div className="space-y-6">
            {/* Rent Growth */}
            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-2">
                Crecimiento rentas anual: {formatPercentage(formData.rentGrowth / 100)}
              </label>
              <input
                type="range"
                min="0"
                max="10"
                step="0.1"
                value={formData.rentGrowth}
                onChange={(e) => handleInputChange('rentGrowth', parseFloat(e.target.value))}
                className="w-full h-2 bg-[#F8F9FA] rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #022D5E 0%, #022D5E ${formData.rentGrowth * 10}%, #F8F9FA ${formData.rentGrowth * 10}%, #F8F9FA 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-[#6B7280] mt-1">
                <span>0%</span>
                <span>10%</span>
              </div>
            </div>

            {/* Expense Inflation */}
            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-2">
                Inflación gastos anual: {formatPercentage(formData.expenseInflation / 100)}
              </label>
              <input
                type="range"
                min="0"
                max="8"
                step="0.1"
                value={formData.expenseInflation}
                onChange={(e) => handleInputChange('expenseInflation', parseFloat(e.target.value))}
                className="w-full h-2 bg-[#F8F9FA] rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #022D5E 0%, #022D5E ${(formData.expenseInflation / 8) * 100}%, #F8F9FA ${(formData.expenseInflation / 8) * 100}%, #F8F9FA 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-[#6B7280] mt-1">
                <span>0%</span>
                <span>8%</span>
              </div>
            </div>

            {/* Property Appreciation */}
            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-2">
                Revalorización activos anual: {formatPercentage(formData.propertyAppreciation / 100)}
              </label>
              <input
                type="range"
                min="0"
                max="12"
                step="0.1"
                value={formData.propertyAppreciation}
                onChange={(e) => handleInputChange('propertyAppreciation', parseFloat(e.target.value))}
                className="w-full h-2 bg-[#F8F9FA] rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #022D5E 0%, #022D5E ${(formData.propertyAppreciation / 12) * 100}%, #F8F9FA ${(formData.propertyAppreciation / 12) * 100}%, #F8F9FA 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-[#6B7280] mt-1">
                <span>0%</span>
                <span>12%</span>
              </div>
            </div>

            {/* Vacancy Rate */}
            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-2">
                Vacancia: {formatPercentage(formData.vacancyRate / 100)}
              </label>
              <input
                type="range"
                min="0"
                max="20"
                step="0.5"
                value={formData.vacancyRate}
                onChange={(e) => handleInputChange('vacancyRate', parseFloat(e.target.value))}
                className="w-full h-2 bg-[#F8F9FA] rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #022D5E 0%, #022D5E ${(formData.vacancyRate / 20) * 100}%, #F8F9FA ${(formData.vacancyRate / 20) * 100}%, #F8F9FA 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-[#6B7280] mt-1">
                <span>0%</span>
                <span>20%</span>
              </div>
            </div>

            {/* Reference Rate */}
            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-2">
                Tipo de interés de referencia: {formatPercentage(formData.referenceRate / 100)}
              </label>
              <input
                type="range"
                min="0"
                max="15"
                step="0.1"
                value={formData.referenceRate}
                onChange={(e) => handleInputChange('referenceRate', parseFloat(e.target.value))}
                className="w-full h-2 bg-[#F8F9FA] rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #022D5E 0%, #022D5E ${(formData.referenceRate / 15) * 100}%, #F8F9FA ${(formData.referenceRate / 15) * 100}%, #F8F9FA 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-[#6B7280] mt-1">
                <span>0%</span>
                <span>15%</span>
              </div>
              <p className="text-xs text-[#6B7280] mt-2">
                Solo para forecast de hipotecas con tipo variable
              </p>
            </div>

            {/* Reset to Defaults */}
            <div className="pt-4 border-t border-[#D7DEE7]">
              <button
                onClick={resetToDefaults}
                className="flex items-center space-x-2 text-sm text-[#6B7280] hover:text-[#022D5E] transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Restaurar valores por defecto</span>
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 mt-8 pt-6 border-t border-[#D7DEE7]">
            <button
              onClick={hasChanges ? handleReset : onClose}
              className="px-4 py-2 text-sm font-medium text-[#6B7280] hover:text-[#022D5E] transition-colors"
            >
              {hasChanges ? 'Cancelar' : 'Cerrar'}
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className="flex items-center space-x-2 px-4 py-2 bg-[#022D5E] text-white text-sm font-medium rounded-lg hover:bg-[#1a365d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4" />
              <span>Guardar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdjustAssumptionsModal;