// H9-FISCAL: Property Improvements Management Component
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Calendar, Edit3, Save, X } from 'lucide-react';
import { 
  addPropertyImprovement, 
  getPropertyImprovements, 
  deletePropertyImprovement,
  formatEsCurrency 
} from '../../services/aeatAmortizationService';
import { PropertyImprovement } from '../../services/db';
import { parseEuroInput } from '../../utils/formatUtils';
import MoneyInput from '../common/MoneyInput';
import toast from 'react-hot-toast';
import { confirmDelete } from '../../services/confirmationService';

interface PropertyImprovementsProps {
  propertyId: number;
  onImprovementsChange?: () => void;
}

interface ImprovementFormData {
  year: string;
  amount: string;
  date: string;
  daysInYear: string;
  providerNIF: string;
  description: string;
}

const PropertyImprovements: React.FC<PropertyImprovementsProps> = ({ 
  propertyId, 
  onImprovementsChange 
}) => {
  const [improvements, setImprovements] = useState<PropertyImprovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<ImprovementFormData>({
    year: new Date().getFullYear().toString(),
    amount: '',
    date: '',
    daysInYear: '',
    providerNIF: '',
    description: ''
  });

  const loadImprovements = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPropertyImprovements(propertyId);
      setImprovements(data.sort((a, b) => b.year - a.year)); // Sort by year descending
    } catch (error) {
      console.error('Error loading improvements:', error);
      toast.error('Error al cargar las mejoras');
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    loadImprovements();
  }, [loadImprovements]);

  const resetForm = async () => {
    setFormData({
      year: new Date().getFullYear().toString(),
      amount: '',
      date: '',
      daysInYear: '',
      providerNIF: '',
      description: ''
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const amount = parseEuroInput(formData.amount);
    if (!amount || amount <= 0) {
      toast.error('El importe debe ser mayor que 0');
      return;
    }

    if (!formData.description.trim()) {
      toast.error('La descripción es obligatoria');
      return;
    }

    try {
      setLoading(true);
      
      const improvement = {
        propertyId,
        year: parseInt(formData.year),
        amount,
        date: formData.date || undefined,
        daysInYear: formData.daysInYear ? parseInt(formData.daysInYear) : undefined,
        counterpartyNIF: formData.providerNIF.trim() || undefined,
        description: formData.description.trim()
      };

      if (editingId) {
        // For editing, we'd need an update function - for now just add new
        toast.error('Edición no implementada aún');
        return;
      } else {
        await addPropertyImprovement(improvement);
        toast.success('Mejora añadida correctamente');
      }

      await loadImprovements();
      onImprovementsChange?.();
      resetForm();
    } catch (error) {
      console.error('Error saving improvement:', error);
      toast.error('Error al guardar la mejora');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (improvementId: number) => {
    const confirmed = await confirmDelete('Está seguro de que desea eliminar esta mejora');
    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);
      await deletePropertyImprovement(improvementId);
      await loadImprovements();
      onImprovementsChange?.();
      toast.success('Mejora eliminada correctamente');
    } catch (error) {
      console.error('Error deleting improvement:', error);
      toast.error('Error al eliminar la mejora');
    } finally {
      setLoading(false);
    }
  };

  const calculateDaysInYear = (year: number, date?: string): number => {
    if (!date) return 365; // Default if no date provided
    
    const improvementDate = new Date(date);
    const yearEnd = new Date(year, 11, 31);
    
    if (improvementDate.getFullYear() !== year) {
      return 365; // If date is from different year, use full year
    }
    
    const daysDifference = Math.ceil((yearEnd.getTime() - improvementDate.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, daysDifference + 1); // At least 1 day
  };

  const getTotalImprovements = (): number => {
    return improvements.reduce((total, imp) => total + imp.amount, 0);
  };

  return (
    <div className="bg-white border border-neutral-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Edit3 className="w-5 h-5 text-brand-navy" />
          <h3 className="text-lg font-semibold text-neutral-900">Mejoras del inmueble</h3>
        </div>
        <button
          onClick={() => setShowForm(true)}
          disabled={loading || showForm}
          className="flex items-center gap-2 px-3 py-2 bg-brand-navy disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Añadir mejora
        </button>
      </div>

      {/* Summary */}
      {improvements.length > 0 && (
        <div className="btn-secondary-horizon atlas-atlas-btn-primary mb-6 p-4 ">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-neutral-900">Total invertido en mejoras:</span>
            <span className="text-lg font-bold text-brand-navy">
              {formatEsCurrency(getTotalImprovements())}
            </span>
          </div>
          <p className="text-xs text-neutral-600 mt-1">
            Las mejoras incrementan la base amortizable desde el año siguiente a su realización
          </p>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 border border-neutral-200 bg-neutral-50">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-neutral-900">
              {editingId ? 'Editar mejora' : 'Nueva mejora'}
            </h4>
            <button
              type="button"
              onClick={resetForm}
              className="text-neutral-500 hover:text-neutral-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Año *
              </label>
              <input
                type="number"
                min="2000"
                max={new Date().getFullYear()}
                value={formData.year}
                onChange={(e) => setFormData(prev => ({ ...prev, year: e.target.value }))}
                className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Importe *
              </label>
              <MoneyInput
                value={formData.amount}
                onChange={(value) => setFormData(prev => ({ ...prev, amount: value }))}
                placeholder="15.000,00"
                aria-label="Importe de la mejora"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Fecha (opcional)
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, date: e.target.value }));
                  // Auto-calculate days in year if same year
                  if (e.target.value && parseInt(formData.year) === new Date(e.target.value).getFullYear()) {
                    const days = calculateDaysInYear(parseInt(formData.year), e.target.value);
                    setFormData(prev => ({ ...prev, daysInYear: days.toString() }));
                  }
                }}
                className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Días amortización año
              </label>
              <input
                type="number"
                min="1"
                max="366"
                value={formData.daysInYear}
                onChange={(e) => setFormData(prev => ({ ...prev, daysInYear: e.target.value }))}
                placeholder="365"
                className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              />
              <p className="text-xs text-neutral-500 mt-1">
                Solo si la mejora es del mismo año
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                NIF proveedor (opcional)
              </label>
              <input
                type="text"
                value={formData.providerNIF}
                onChange={(e) => setFormData(prev => ({ ...prev, providerNIF: e.target.value }))}
                placeholder="12345678Z"
                className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2 lg:col-span-1">
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Descripción *
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Reforma cocina, cambio ventanas..."
                className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-neutral-600 border border-neutral-300"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-brand-navy disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Guardando...' : 'Guardar mejora'}
            </button>
          </div>
        </form>
      )}

      {/* Improvements List */}
      {loading && improvements.length === 0 ? (
        <div className="text-center py-8">
          <div className="animate-spin h-8 w-8 border-b-2 border-brand-navy mx-auto"></div>
          <p className="text-neutral-600 mt-2">Cargando mejoras...</p>
        </div>
      ) : improvements.length === 0 ? (
        <div className="text-center py-8 text-neutral-500">
          <Edit3 className="w-12 h-12 mx-auto mb-2 text-neutral-400" />
          <p>No hay mejoras registradas</p>
          <p className="text-sm">Las mejoras incrementan la base amortizable del inmueble</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Año</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-neutral-500 uppercase">Importe</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Descripción</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-neutral-500 uppercase">Fecha</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-neutral-500 uppercase">Días año</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-neutral-500 uppercase">Proveedor</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-neutral-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {improvements.map((improvement) => (
                <tr key={improvement.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2 text-neutral-900 font-medium">
                    {improvement.year}
                  </td>
                  <td className="px-3 py-2 text-right text-neutral-900 font-medium">
                    {formatEsCurrency(improvement.amount)}
                  </td>
                  <td className="px-3 py-2 text-neutral-900">
                    {improvement.description}
                  </td>
                  <td className="px-3 py-2 text-center text-neutral-600">
                    {improvement.date ? new Date(improvement.date).toLocaleDateString('es-ES') : '-'}
                  </td>
                  <td className="px-3 py-2 text-center text-neutral-600">
                    {improvement.daysInYear || '-'}
                  </td>
                  <td className="px-3 py-2 text-center text-neutral-600">
                    {improvement.counterpartyNIF || '-'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => handleDelete(improvement.id!)}
                      disabled={loading}
                      className="text-error-600 hover:text-error-800 disabled:opacity-50"
                      title="Eliminar mejora"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Help text */}
      <div className="btn-secondary-horizon atlas-atlas-btn-primary mt-4 p-3 ">
        <div className="flex items-start gap-2">
          <Calendar className="w-4 h-4 text-primary-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-primary-800">
            <p className="font-medium mb-1">Sobre las mejoras:</p>
            <ul className="space-y-1 text-xs">
              <li>• Las mejoras incrementan la base amortizable desde el año siguiente</li>
              <li>• Si la mejora es del mismo año, se puede amortizar proporcionalmente</li>
              <li>• Las reparaciones no son mejoras (van como gasto del año)</li>
              <li>• El NIF del proveedor es opcional pero recomendado para trazabilidad</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyImprovements;