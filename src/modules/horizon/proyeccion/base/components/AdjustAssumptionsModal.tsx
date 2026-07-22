import React, { useState } from 'react';
import { X, Save, RotateCcw } from 'lucide-react';
import { formatPercentage } from '../../../../../utils/formatUtils';
import type { SupuestosProyeccion } from '../../../../../types/supuestosProyeccion';
import { SUPUESTOS_PROYECCION_DEFAULTS } from '../../../../../types/supuestosProyeccion';

interface AdjustAssumptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  assumptions: SupuestosProyeccion;
  onSave: (assumptions: SupuestosProyeccion) => void;
}

const AdjustAssumptionsModal: React.FC<AdjustAssumptionsModalProps> = ({
  isOpen,
  onClose,
  assumptions,
  onSave
}) => {
  const [formData, setFormData] = useState<SupuestosProyeccion>({ ...assumptions });
  const [hasChanges, setHasChanges] = useState(false);

  const handleInputChange = (field: keyof SupuestosProyeccion, value: number) => {
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
    // Defaults de la fuente única (C-PROY-5 · B1) · visibles, no copiados a mano
    setFormData({ ...SUPUESTOS_PROYECCION_DEFAULTS });
    setHasChanges(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Overlay */}
        <div 
          className="fixed inset-0 bg-gray-500 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative inline-block w-full max-w-2xl px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white shadow-xl sm:my-8 sm:align-middle sm:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">
                Ajustar supuestos base
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Modifica los parámetros globales para la proyección baseline
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Form */}
          <div className="space-y-6">
            {/* Rent Growth */}
            <div>
              <label className="block text-sm font-medium text-neutral-900 mb-2">
                Crecimiento rentas anual: {formatPercentage(formData.subidaRentasPct / 100)}
              </label>
              <input
                type="range"
                min="0"
                max="10"
                step="0.1"
                value={formData.subidaRentasPct}
                onChange={(e) => handleInputChange('subidaRentasPct', parseFloat(e.target.value))}
                className="w-full h-2 bg-hz-neutral-100 appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, var(--atlas-blue) 0%, var(--atlas-blue) ${formData.subidaRentasPct * 10}%, var(--bg) ${formData.subidaRentasPct * 10}%, var(--bg) 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0%</span>
                <span>10%</span>
              </div>
            </div>

            {/* Expense Inflation */}
            <div>
              <label className="block text-sm font-medium text-neutral-900 mb-2">
                Inflación gastos anual: {formatPercentage(formData.inflacionGastosPct / 100)}
              </label>
              <input
                type="range"
                min="0"
                max="8"
                step="0.1"
                value={formData.inflacionGastosPct}
                onChange={(e) => handleInputChange('inflacionGastosPct', parseFloat(e.target.value))}
                className="w-full h-2 bg-hz-neutral-100 appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, var(--atlas-blue) 0%, var(--atlas-blue) ${(formData.inflacionGastosPct / 8) * 100}%, var(--bg) ${(formData.inflacionGastosPct / 8) * 100}%, var(--bg) 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0%</span>
                <span>8%</span>
              </div>
            </div>

            {/* Property Appreciation */}
            <div>
              <label className="block text-sm font-medium text-neutral-900 mb-2">
                Revalorización inmuebles anual: {formatPercentage(formData.revalorizacionInmueblesPct / 100)}
              </label>
              <input
                type="range"
                min="0"
                max="12"
                step="0.1"
                value={formData.revalorizacionInmueblesPct}
                onChange={(e) => handleInputChange('revalorizacionInmueblesPct', parseFloat(e.target.value))}
                className="w-full h-2 bg-hz-neutral-100 appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, var(--atlas-blue) 0%, var(--atlas-blue) ${(formData.revalorizacionInmueblesPct / 12) * 100}%, var(--bg) ${(formData.revalorizacionInmueblesPct / 12) * 100}%, var(--bg) 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0%</span>
                <span>12%</span>
              </div>
            </div>

            {/* Vacancy Rate */}
            <div>
              <label className="block text-sm font-medium text-neutral-900 mb-2">
                Vacancia: {formatPercentage(formData.vacanciaPct / 100)}
              </label>
              <input
                type="range"
                min="0"
                max="20"
                step="0.5"
                value={formData.vacanciaPct}
                onChange={(e) => handleInputChange('vacanciaPct', parseFloat(e.target.value))}
                className="w-full h-2 bg-hz-neutral-100 appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, var(--atlas-blue) 0%, var(--atlas-blue) ${(formData.vacanciaPct / 20) * 100}%, var(--bg) ${(formData.vacanciaPct / 20) * 100}%, var(--bg) 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0%</span>
                <span>20%</span>
              </div>
            </div>

            {/* Reset to Defaults */}
            <div className="pt-4 border-t border-hz-neutral-300">
              <button
                onClick={resetToDefaults}
                className="flex items-center space-x-2 text-sm text-gray-500 hover:text-primary-700"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Restaurar valores por defecto</span>
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 mt-8 pt-6 border-t border-hz-neutral-300">
            <button
              onClick={hasChanges ? handleReset : onClose}
              className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-primary-700"
            >
              {hasChanges ? 'Cancelar' : 'Cerrar'}
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className="atlas-atlas-atlas-atlas-atlas-btn-primary flex items-center space-x-2 px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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