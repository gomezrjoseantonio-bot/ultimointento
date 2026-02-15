import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { AtlasModal } from '../../atlas/AtlasComponents';
import { GastoRecurrente, CategoriaGasto } from '../../../types/personal';
import { gastosPersonalesService } from '../../../services/gastosPersonalesService';

interface GastoRecurrenteFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (gasto: GastoRecurrente) => void;
  gasto: GastoRecurrente | null;
  personalDataId: number;
}

const GastoRecurrenteForm: React.FC<GastoRecurrenteFormProps> = ({
  isOpen,
  onClose,
  onSave,
  gasto,
  personalDataId
}) => {
  const [formData, setFormData] = useState({
    nombre: '',
    importe: '',
    frecuencia: 'mensual' as GastoRecurrente['frecuencia'],
    categoria: 'otros' as CategoriaGasto,
    diaCobro: '1',
    fechaInicio: new Date().toISOString().split('T')[0],
    fechaFin: '',
    activo: true,
    notas: ''
  });

  const categorias = gastosPersonalesService.getCategorias();
  const frecuencias = [
    { value: 'mensual', label: 'Mensual' },
    { value: 'bimestral', label: 'Bimestral' },
    { value: 'trimestral', label: 'Trimestral' },
    { value: 'semestral', label: 'Semestral' },
    { value: 'anual', label: 'Anual' }
  ];

  useEffect(() => {
    if (gasto) {
      setFormData({
        nombre: gasto.nombre,
        importe: gasto.importe.toString(),
        frecuencia: gasto.frecuencia,
        categoria: gasto.categoria,
        diaCobro: gasto.diaCobro.toString(),
        fechaInicio: gasto.fechaInicio.split('T')[0],
        fechaFin: gasto.fechaFin ? gasto.fechaFin.split('T')[0] : '',
        activo: gasto.activo,
        notas: gasto.notas || ''
      });
    }
  }, [gasto]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const gastoData: GastoRecurrente = {
      ...(gasto?.id && { id: gasto.id }),
      personalDataId,
      nombre: formData.nombre,
      importe: parseFloat(formData.importe),
      frecuencia: formData.frecuencia,
      categoria: formData.categoria,
      diaCobro: parseInt(formData.diaCobro),
      fechaInicio: formData.fechaInicio,
      ...(formData.fechaFin && { fechaFin: formData.fechaFin }),
      activo: formData.activo,
      ...(formData.notas && { notas: formData.notas }),
      fechaCreacion: gasto?.fechaCreacion || new Date().toISOString(),
      fechaActualizacion: new Date().toISOString()
    };

    onSave(gastoData);
  };

  return (
    <AtlasModal
      isOpen={isOpen}
      onClose={onClose}
      title={gasto ? 'Editar Gasto Recurrente' : 'Nuevo Gasto Recurrente'}
      size="large"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Nombre */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre del Gasto *
          </label>
          <input
            type="text"
            value={formData.nombre}
            onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy"
            placeholder="Ej: Hipoteca vivienda habitual"
            required
          />
        </div>

        {/* Importe y Frecuencia */}
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
              placeholder="850.00"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Frecuencia *
            </label>
            <select
              value={formData.frecuencia}
              onChange={(e) => setFormData(prev => ({ ...prev, frecuencia: e.target.value as any }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy"
            >
              {frecuencias.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
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

        {/* Día de Cobro */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Día de Cobro (1-31) *
          </label>
          <input
            type="number"
            min="1"
            max="31"
            value={formData.diaCobro}
            onChange={(e) => setFormData(prev => ({ ...prev, diaCobro: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy"
            required
          />
        </div>

        {/* Fechas */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de Inicio *
            </label>
            <input
              type="date"
              value={formData.fechaInicio}
              onChange={(e) => setFormData(prev => ({ ...prev, fechaInicio: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de Fin (opcional)
            </label>
            <input
              type="date"
              value={formData.fechaFin}
              onChange={(e) => setFormData(prev => ({ ...prev, fechaFin: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy"
            />
          </div>
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

        {/* Estado Activo */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="activo"
            checked={formData.activo}
            onChange={(e) => setFormData(prev => ({ ...prev, activo: e.target.checked }))}
            className="h-4 w-4 text-brand-navy focus:ring-brand-navy border-gray-300 rounded"
          />
          <label htmlFor="activo" className="ml-2 block text-sm text-gray-700">
            Gasto activo
          </label>
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
            {gasto ? 'Actualizar' : 'Crear'} Gasto
          </button>
        </div>
      </form>
    </AtlasModal>
  );
};

export default GastoRecurrenteForm;
