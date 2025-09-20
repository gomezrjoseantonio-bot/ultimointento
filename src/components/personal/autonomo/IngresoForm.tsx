import React, { useState } from 'react';
import { AtlasModal } from '../../atlas/AtlasComponents';
import { autonomoService } from '../../../services/autonomoService';
import { IngresosAutonomo } from '../../../types/personal';
import toast from 'react-hot-toast';

interface IngresoFormProps {
  isOpen: boolean;
  onClose: () => void;
  autonomoId: number;
  onSaved: () => void;
}

const IngresoForm: React.FC<IngresoFormProps> = ({ isOpen, onClose, autonomoId, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    descripcion: '',
    importe: '',
    fecha: new Date().toISOString().split('T')[0],
    numeroFactura: '',
    cliente: '',
    conIva: false,
    tipoIva: 21
  });

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

    setLoading(true);
    try {
      const ingreso: Omit<IngresosAutonomo, 'id'> = {
        descripcion: formData.descripcion,
        importe,
        fecha: formData.fecha,
        numeroFactura: formData.numeroFactura,
        cliente: formData.cliente,
        conIva: formData.conIva,
        tipoIva: formData.conIva ? formData.tipoIva : undefined
      };

      await autonomoService.addIngreso(autonomoId, ingreso);
      toast.success('Ingreso añadido correctamente');
      
      // Reset form
      setFormData({
        descripcion: '',
        importe: '',
        fecha: new Date().toISOString().split('T')[0],
        numeroFactura: '',
        cliente: '',
        conIva: false,
        tipoIva: 21
      });
      
      onSaved();
      onClose();
    } catch (error) {
      console.error('Error adding ingreso:', error);
      toast.error('Error al añadir el ingreso');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AtlasModal
      isOpen={isOpen}
      onClose={onClose}
      title="Nuevo Ingreso Facturado"
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
            placeholder="Ej: Desarrollo web aplicación"
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
              placeholder="1500.00"
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Número de Factura
            </label>
            <input
              type="text"
              value={formData.numeroFactura}
              onChange={(e) => setFormData(prev => ({ ...prev, numeroFactura: e.target.value }))}
              className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              placeholder="2024-001"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Cliente
            </label>
            <input
              type="text"
              value={formData.cliente}
              onChange={(e) => setFormData(prev => ({ ...prev, cliente: e.target.value }))}
              className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              placeholder="Empresa XYZ"
            />
          </div>
        </div>

        {/* IVA Configuration */}
        <div className="border border-neutral-200 p-4">
          <div className="flex items-center space-x-3 mb-3">
            <input
              type="checkbox"
              id="conIva"
              checked={formData.conIva}
              onChange={(e) => setFormData(prev => ({ ...prev, conIva: e.target.checked }))}
              className="h-4 w-4 text-brand-navy focus:ring-brand-navy border-neutral-300 rounded"
            />
            <label htmlFor="conIva" className="text-sm font-medium text-neutral-700">
              Incluye IVA
            </label>
          </div>

          {formData.conIva && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Tipo de IVA (%)
              </label>
              <select
                value={formData.tipoIva}
                onChange={(e) => setFormData(prev => ({ ...prev, tipoIva: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy"
              >
                <option value={4}>4% (Libros, medicamentos)</option>
                <option value={10}>10% (Alimentos, transporte)</option>
                <option value={21}>21% (General)</option>
              </select>
              {formData.conIva && formData.importe && (
                <p className="text-xs text-neutral-500 mt-1">
                  Base imponible: {(parseFloat(formData.importe || '0') / (1 + formData.tipoIva / 100)).toFixed(2)}€ + 
                  IVA ({formData.tipoIva}%): {(parseFloat(formData.importe || '0') * formData.tipoIva / (100 + formData.tipoIva)).toFixed(2)}€
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-neutral-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-neutral-700 border border-neutral-300"
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-accent-horizon px-4 py-2 disabled:opacity-50"
          >
            {loading ? 'Añadiendo...' : 'Añadir Ingreso'}
          </button>
        </div>
      </form>
    </AtlasModal>
  );
};

export default IngresoForm;