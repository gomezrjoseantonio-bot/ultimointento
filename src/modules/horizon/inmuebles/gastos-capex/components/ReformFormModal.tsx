import React, { useState, useEffect } from 'react';
import { XIcon } from 'lucide-react';
import { Reform, Property, ReformStatus } from '../../../../../services/db';
import toast from 'react-hot-toast';

interface ReformFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (reform: Reform) => void;
  reform?: Reform;
  properties: Property[];
}

const ReformFormModal: React.FC<ReformFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  reform,
  properties
}) => {
  const [formData, setFormData] = useState<Partial<Reform>>({
    title: '',
    propertyId: properties[0]?.id || 0,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    notes: '',
    status: 'abierta'
  });

  useEffect(() => {
    if (reform) {
      setFormData(reform);
    } else {
      // Reset form for new reform
      setFormData({
        title: '',
        propertyId: properties[0]?.id || 0,
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        notes: '',
        status: 'abierta'
      });
    }
  }, [reform, properties, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.propertyId || !formData.startDate) {
      toast.error('Por favor, completa todos los campos obligatorios');
      return;
    }

    try {
      const now = new Date().toISOString();
      const reformData: Reform = {
        ...formData,
        id: reform?.id,
        title: formData.title!,
        propertyId: formData.propertyId!,
        startDate: formData.startDate!,
        status: formData.status!,
        createdAt: reform?.createdAt || now,
        updatedAt: now
      };

      onSave(reformData);
      onClose();
    } catch (error) {
      console.error('Error saving reform:', error);
      toast.error('Error al guardar la reforma');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-200 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {reform ? 'Editar reforma' : 'Nueva reforma'}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Título *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                >
                placeholder="Reforma cocina, Ampliación salón, etc."
                required
              />
            </div>

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
                Estado
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as ReformStatus }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              >
                <option value="abierta">Abierta</option>
                <option value="cerrada">Cerrada</option>
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha inicio *
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            required
          />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha fin
              </label>
              <input
                type="date"
                value={formData.endDate || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
          >
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas
            </label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              >
              rows={3}
              placeholder="Descripción de la reforma, detalles adicionales..."
            />
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
              {reform ? 'Actualizar' : 'Crear'} reforma
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReformFormModal;