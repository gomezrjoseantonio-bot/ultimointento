import React, { useState } from 'react';
import { AtlasModal } from '../../atlas/AtlasComponents';
import { GastoPuntual, CategoriaGasto } from '../../../types/personal';
import { gastosPersonalesService } from '../../../services/gastosPersonalesService';

interface GastoPuntualFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (gasto: GastoPuntual) => void;
  personalDataId: number;
}

const GastoPuntualForm: React.FC<GastoPuntualFormProps> = ({
  isOpen,
  onClose,
  onSave,
  personalDataId
}) => {
  const [formData, setFormData] = useState({
    descripcion: '',
    importe: '',
    fecha: new Date().toISOString().split('T')[0],
    categoria: 'otros' as CategoriaGasto,
    notas: ''
  });

  const categorias = gastosPersonalesService.getCategorias();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const gastoData: GastoPuntual = {
      personalDataId,
      descripcion: formData.descripcion,
      importe: parseFloat(formData.importe),
      fecha: formData.fecha,
      categoria: formData.categoria,
      ...(formData.notas && { notas: formData.notas }),
      fechaCreacion: new Date().toISOString()
    };

    onSave(gastoData);
  };

  return (
    <AtlasModal
      isOpen={isOpen}
      onClose={onClose}
      title="Nuevo Gasto Puntual"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Descripción */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descripción *
          </label>
          <input
            type="text"
            value={formData.descripcion}
            onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy"
            placeholder="Ej: Reparación del coche"
            required
          />
        </div>

        {/* Importe y Fecha */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Importe (€) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.importe}
              onChange={(e) => setFormData(prev => ({ ...prev, importe: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy"
              placeholder="150.00"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha *
            </label>
            <input
              type="date"
              value={formData.fecha}
              onChange={(e) => setFormData(prev => ({ ...prev, fecha: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy"
              required
            />
          </div>
        </div>

        {/* Categoría */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Categoría *
          </label>
          <select
            value={formData.categoria}
            onChange={(e) => setFormData(prev => ({ ...prev, categoria: e.target.value as CategoriaGasto }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy"
          >
            {categorias.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>

        {/* Notas */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notas (opcional)
          </label>
          <textarea
            value={formData.notas}
            onChange={(e) => setFormData(prev => ({ ...prev, notas: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy"
            placeholder="Añade notas adicionales..."
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-brand-navy text-white rounded-md hover:bg-opacity-90"
          >
            Registrar Gasto
          </button>
        </div>
      </form>
    </AtlasModal>
  );
};

export default GastoPuntualForm;
