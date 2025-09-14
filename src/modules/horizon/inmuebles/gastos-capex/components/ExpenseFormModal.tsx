import React, { useState, useEffect } from 'react';
import { XIcon } from 'lucide-react';
import { ExpenseH5, Property, AEATFiscalType, AEATBox, ProrationMethod, ExpenseStatus } from '../../../../../services/db';
import { AEAT_FISCAL_TYPES, AEAT_BOXES, getSuggestedAEATBox } from '../../../../../utils/aeatUtils';
import { formatEuro, parseEuroInput } from '../../../../../utils/formatUtils';
import toast from 'react-hot-toast';

interface ExpenseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: ExpenseH5) => void;
  expense?: ExpenseH5;
  properties: Property[];
}

const ExpenseFormModal: React.FC<ExpenseFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  expense,
  properties
}) => {
  const [formData, setFormData] = useState<Partial<ExpenseH5>>({
    date: new Date().toISOString().split('T')[0],
    provider: '',
    providerNIF: '',
    concept: '',
    amount: 0,
    fiscalType: 'reparacion-conservacion',
    aeatBox: undefined,
    taxYear: new Date().getFullYear(),
    taxIncluded: true,
    propertyId: properties[0]?.id || 0,
    unit: 'completo',
    prorationMethod: 'metros-cuadrados',
    prorationDetail: '100',
    status: 'pendiente',
    origin: 'manual'
  });

  const [amountInput, setAmountInput] = useState('');

  useEffect(() => {
    if (expense) {
      setFormData(expense);
      setAmountInput(formatEuro(expense.amount));
    } else {
      // Reset form for new expense
      setFormData({
        date: new Date().toISOString().split('T')[0],
        provider: '',
        providerNIF: '',
        concept: '',
        amount: 0,
        fiscalType: 'reparacion-conservacion',
        aeatBox: undefined,
        taxYear: new Date().getFullYear(),
        taxIncluded: true,
        propertyId: properties[0]?.id || 0,
        unit: 'completo',
        prorationMethod: 'metros-cuadrados',
        prorationDetail: '100',
        status: 'pendiente',
        origin: 'manual'
      });
      setAmountInput('');
    }
  }, [expense, properties, isOpen]);

  // Auto-suggest AEAT box when fiscal type changes
  useEffect(() => {
    if (formData.fiscalType) {
      const suggestedBox = getSuggestedAEATBox(formData.fiscalType);
      if (suggestedBox) {
        setFormData(prev => ({ ...prev, aeatBox: suggestedBox }));
      }
    }
  }, [formData.fiscalType]);

  const handleAmountChange = (value: string) => {
    setAmountInput(value);
    const parsedAmount = parseEuroInput(value);
    if (parsedAmount !== null) {
      setFormData(prev => ({ ...prev, amount: parsedAmount }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.provider || !formData.concept || !formData.amount || !formData.propertyId) {
      toast.error('Por favor, completa todos los campos obligatorios');
      return;
    }

    try {
      const now = new Date().toISOString();
      const expenseData: ExpenseH5 = {
        ...formData,
        ...(expense?.id && { id: expense.id }), // Only include id if editing existing expense
        date: formData.date!,
        provider: formData.provider!,
        concept: formData.concept!,
        amount: formData.amount!,
        currency: formData.currency || 'EUR',
        fiscalType: formData.fiscalType!,
        taxYear: formData.taxYear!,
        taxIncluded: formData.taxIncluded!,
        propertyId: formData.propertyId!,
        unit: formData.unit!,
        prorationMethod: formData.prorationMethod!,
        prorationDetail: formData.prorationDetail!,
        status: formData.status!,
        origin: formData.origin!,
        // UNICORNIO REFACTOR: Required unified fields
        tipo_gasto: formData.tipo_gasto || 'otros',
        destino: formData.propertyId ? 'inmueble' : 'personal',
        destino_id: formData.propertyId,
        estado_conciliacion: 'pendiente',
        createdAt: expense?.createdAt || now,
        updatedAt: now
      };

      onSave(expenseData);
      onClose();
    } catch (error) {
      console.error('Error saving expense:', error);
      toast.error('Error al guardar el gasto');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-200 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {expense ? 'Editar gasto' : 'Añadir gasto'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha *
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Proveedor *
              </label>
              <input
                type="text"
                value={formData.provider}
                onChange={(e) => setFormData(prev => ({ ...prev, provider: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                placeholder="Nombre del proveedor"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                NIF Proveedor
              </label>
              <input
                type="text"
                value={formData.providerNIF || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, providerNIF: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                placeholder="12345678Z"
              />
            </div>
          </div>

          {/* Concept and Amount */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Concepto *
              </label>
              <input
                type="text"
                value={formData.concept}
                onChange={(e) => setFormData(prev => ({ ...prev, concept: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                placeholder="Descripción del gasto"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Importe (€) *
              </label>
              <input
                type="text"
                value={amountInput}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent text-right"
                placeholder="1.234,56"
                required
              />
            </div>
          </div>

          {/* Tax Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo fiscal *
              </label>
              <select
                value={formData.fiscalType}
                onChange={(e) => setFormData(prev => ({ ...prev, fiscalType: e.target.value as AEATFiscalType }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                required
              >
                {AEAT_FISCAL_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Casilla AEAT
              </label>
              <select
                value={formData.aeatBox || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, aeatBox: e.target.value as AEATBox || undefined }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              >
                <option value="">Sin especificar</option>
                {AEAT_BOXES.map(box => (
                  <option key={box.value} value={box.value}>
                    {box.label} - {box.description}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ejercicio devengo
              </label>
              <input
                type="number"
                value={formData.taxYear}
                onChange={(e) => setFormData(prev => ({ ...prev, taxYear: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                min="2020"
                max="2030"
              />
            </div>
          </div>

          {/* Property and Unit */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Inmueble *
              </label>
              <select
                value={formData.propertyId}
                onChange={(e) => setFormData(prev => ({ ...prev, propertyId: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                required
              >
                {properties.map(property => (
                  <option key={property.id} value={property.id}>
                    {property.alias}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unidad
              </label>
              <input
                type="text"
                value={formData.unit}
                onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                placeholder="completo, habitacion-1, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prorrateo
              </label>
              <select
                value={formData.prorationMethod}
                onChange={(e) => setFormData(prev => ({ ...prev, prorationMethod: e.target.value as ProrationMethod }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              >
                <option value="metros-cuadrados">Metros cuadrados</option>
                <option value="unidades">Unidades</option>
                <option value="porcentaje-manual">% Manual</option>
                <option value="ocupacion">Ocupación</option>
              </select>
            </div>
          </div>

          {/* Status and Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                % aplicado / detalle
              </label>
              <input
                type="text"
                value={formData.prorationDetail}
                onChange={(e) => setFormData(prev => ({ ...prev, prorationDetail: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                placeholder="100, 50%, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as ExpenseStatus }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              >
                <option value="validado">Validado</option>
                <option value="pendiente">Pendiente</option>
                <option value="por-revisar">Por revisar</option>
              </select>
            </div>

            <div className="flex items-center pt-6">
              <input
                type="checkbox"
                id="taxIncluded"
                checked={formData.taxIncluded}
                onChange={(e) => setFormData(prev => ({ ...prev, taxIncluded: e.target.checked }))}
                className="h-4 w-4 text-brand-navy focus:ring-brand-navy border-gray-300 rounded"
              />
              <label htmlFor="taxIncluded" className="ml-2 text-sm text-gray-700">
                Impuesto incluido
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-brand-navy text-white rounded-md hover:bg-navy-800 transition-colors"
            >
              {expense ? 'Actualizar' : 'Crear'} gasto
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExpenseFormModal;