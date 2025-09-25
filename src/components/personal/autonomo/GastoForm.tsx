import React, { useState } from 'react';
import { AtlasModal } from '../../atlas/AtlasComponents';
import { autonomoService } from '../../../services/autonomoService';
import { GastoDeducible } from '../../../types/personal';
import toast from 'react-hot-toast';

interface GastoFormProps {
  isOpen: boolean;
  onClose: () => void;
  autonomoId: number;
  onSaved: () => void;
}

const GastoForm: React.FC<GastoFormProps> = ({ isOpen, onClose, autonomoId, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    descripcion: '',
    importe: '',
    fecha: new Date().toISOString().split('T')[0],
    categoria: 'material-oficina',
    proveedor: '',
    numeroFactura: '',
    porcentajeDeducible: 100
  });

  const categorias = [
    { value: 'material-oficina', label: 'Material de oficina' },
    { value: 'equipos-informaticos', label: 'Equipos informáticos' },
    { value: 'software', label: 'Software y licencias' },
    { value: 'formacion', label: 'Formación y cursos' },
    { value: 'marketing', label: 'Marketing y publicidad' },
    { value: 'viajes', label: 'Viajes y dietas' },
    { value: 'suministros', label: 'Suministros (luz, agua, gas)' },
    { value: 'telefono-internet', label: 'Teléfono e internet' },
    { value: 'alquiler', label: 'Alquiler de local' },
    { value: 'seguros', label: 'Seguros' },
    { value: 'asesoria', label: 'Asesoría y gestión' },
    { value: 'reparaciones', label: 'Reparaciones y mantenimiento' },
    { value: 'otros', label: 'Otros gastos' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.descripcion || !formData.importe || !formData.fecha) {
      toast.error('Por favor, completa todos los campos obligatorios');
      return;
    }

    const importe = parseFloat(formData.importe);
    if (isNaN(importe) || importe <= 0) {
      toast.error('El importe debe ser un número válido mayor que 0');
      return;
    }

    if (formData.porcentajeDeducible < 0 || formData.porcentajeDeducible > 100) {
      toast.error('El porcentaje deducible debe estar entre 0 y 100');
      return;
    }

    setLoading(true);
    try {
      const gasto: Omit<GastoDeducible, 'id'> = {
        descripcion: formData.descripcion,
        importe,
        fecha: formData.fecha,
        categoria: formData.categoria,
        proveedor: formData.proveedor,
        numeroFactura: formData.numeroFactura,
        porcentajeDeducible: formData.porcentajeDeducible
      };

      await autonomoService.addGasto(autonomoId, gasto);
      toast.success('Gasto añadido correctamente');
      
      // Reset form
      setFormData({
        descripcion: '',
        importe: '',
        fecha: new Date().toISOString().split('T')[0],
        categoria: 'material-oficina',
        proveedor: '',
        numeroFactura: '',
        porcentajeDeducible: 100
      });
      
      onSaved();
      onClose();
    } catch (error) {
      console.error('Error adding gasto:', error);
      toast.error('Error al añadir el gasto');
    } finally {
      setLoading(false);
    }
  };

  const importeDeducible = parseFloat(formData.importe || '0') * formData.porcentajeDeducible / 100;

  return (
    <AtlasModal
      isOpen={isOpen}
      onClose={onClose}
      title="Nuevo Gasto Deducible"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Descripción *
          </label>
          <input
            type="text"
            value={formData.descripcion}
            onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
            className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            >
            placeholder="Ej: Compra ordenador portátil"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Importe (€) *
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.importe}
              onChange={(e) => setFormData(prev => ({ ...prev, importe: e.target.value }))}
              className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              >
              placeholder="500.00"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Fecha *
            </label>
            <input
              type="date"
              value={formData.fecha}
              onChange={(e) => setFormData(prev => ({ ...prev, fecha: e.target.value }))}
              className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            required
          />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Categoría *
          </label>
          <select
            value={formData.categoria}
            onChange={(e) => setFormData(prev => ({ ...prev, categoria: e.target.value }))}
            className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            required
          >
            {categorias.map(categoria => (
              <option key={categoria.value} value={categoria.value}>
                {categoria.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Proveedor
            </label>
            <input
              type="text"
              value={formData.proveedor}
              onChange={(e) => setFormData(prev => ({ ...prev, proveedor: e.target.value }))}
              className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            placeholder="Nombre del proveedor"
          />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Número de Factura
            </label>
            <input
              type="text"
              value={formData.numeroFactura}
              onChange={(e) => setFormData(prev => ({ ...prev, numeroFactura: e.target.value }))}
              className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            placeholder="F-2024-001"
          />
          </div>
        </div>

        {/* Porcentaje Deducible */}
        <div className="border border-neutral-200 p-4">
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Porcentaje Deducible (%)
          </label>
          <div className="flex items-center space-x-4">
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={formData.porcentajeDeducible}
              onChange={(e) => setFormData(prev => ({ ...prev, porcentajeDeducible: parseInt(e.target.value) }))}
              className="flex-1"
          >
            />
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="0"
                max="100"
                value={formData.porcentajeDeducible}
                onChange={(e) => setFormData(prev => ({ ...prev, porcentajeDeducible: parseInt(e.target.value) || 0 }))}
                className="w-16 px-2 py-1 border border-neutral-300 rounded text-sm text-center"
          >
              />
              <span className="text-sm text-neutral-600">%</span>
            </div>
          </div>
          
          {formData.importe && (
            <div className="mt-2 text-sm text-neutral-600">
              <p>
                Importe deducible: <strong>{importeDeducible.toFixed(2)}€</strong>
                {formData.porcentajeDeducible < 100 && (
                  <span className="ml-2 text-neutral-500">
                    (de {formData.importe}€ total)
                  </span>
                )}
              </p>
            </div>
          )}
          
          <p className="text-xs text-neutral-500 mt-1">
            Algunos gastos pueden ser deducibles solo parcialmente según su uso profesional.
          </p>
        </div>

        {/* Common percentages helper */}
        <div className="bg-neutral-50 p-3">
          <p className="text-xs text-neutral-600 mb-2">
            <strong>Porcentajes comunes:</strong>
          </p>
          <div className="flex flex-wrap gap-2">
            {[100, 50, 30, 20].map(percentage => (
              <button
                key={percentage}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, porcentajeDeducible: percentage }))}
                className={`px-2 py-1 text-xs rounded border ${
                  formData.porcentajeDeducible === percentage
                    ? 'bg-brand-navy border-brand-navy'
                    : 'bg-white text-neutral-700 border-neutral-300'                }`}
              >
                {percentage}%
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-neutral-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-neutral-700 border border-neutral-300"
            >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-danger px-4 py-2 disabled:opacity-50"
          >
            {loading ? 'Añadiendo...' : 'Añadir Gasto'}
          </button>
        </div>
      </form>
    </AtlasModal>
  );
};

export default GastoForm;