import React, { useState, useEffect } from 'react';
import { AtlasModal } from '../../atlas/AtlasComponents';
import { planesPensionesService } from '../../../services/planesPensionesService';
import { personalDataService } from '../../../services/personalDataService';
import type { PlanPensiones, TipoAdministrativo, EstadoPlan } from '../../../types/planesPensiones';
import toast from 'react-hot-toast';

interface PlanFormProps {
  isOpen: boolean;
  onClose: () => void;
  plan?: PlanPensiones | null;
  onSaved: (plan: PlanPensiones) => void;
}

const TIPOS_ADMIN: { value: TipoAdministrativo; label: string; desc: string }[] = [
  { value: 'PPI', label: 'PPI — Individual', desc: 'Plan de Pensiones Individual · aportación libre del titular' },
  { value: 'PPE', label: 'PPE — Empleo', desc: 'Plan de Pensiones de Empleo · empresa promotora' },
  { value: 'PPES', label: 'PPES — Empleo Simplificado', desc: 'Plan de Pensiones de Empleo Simplificado · sectorial' },
  { value: 'PPA', label: 'PPA — Asegurado', desc: 'Plan de Previsión Asegurado · garantizado por aseguradora' },
];

const emptyForm = () => ({
  nombre: '',
  tipoAdministrativo: 'PPI' as TipoAdministrativo,
  gestoraActual: '',
  isinActual: '',
  fechaContratacion: new Date().toISOString().split('T')[0],
  importeInicial: '',
  valorActual: '',
  titular: 'yo' as 'yo' | 'pareja',
  estado: 'activo' as EstadoPlan,
});

const PlanForm: React.FC<PlanFormProps> = ({ isOpen, onClose, plan, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [personalDataId, setPersonalDataId] = useState<number | null>(null);
  const [formData, setFormData] = useState(emptyForm());

  useEffect(() => {
    (async () => {
      try {
        const pd = await personalDataService.getPersonalData();
        if (pd?.id) setPersonalDataId(pd.id);
      } catch {/* ignore */}
    })();
  }, []);

  useEffect(() => {
    if (plan) {
      setFormData({
        nombre: plan.nombre,
        tipoAdministrativo: plan.tipoAdministrativo,
        gestoraActual: plan.gestoraActual,
        isinActual: plan.isinActual ?? '',
        fechaContratacion: plan.fechaContratacion,
        importeInicial: plan.importeInicial?.toString() ?? '',
        valorActual: plan.valorActual?.toString() ?? '',
        titular: plan.titular,
        estado: plan.estado,
      });
    } else {
      setFormData(emptyForm());
    }
  }, [plan, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personalDataId) { toast.error('Error: No se encontraron datos personales'); return; }
    if (!formData.nombre.trim() || !formData.gestoraActual.trim() || !formData.fechaContratacion) {
      toast.error('Por favor, completa todos los campos obligatorios');
      return;
    }

    setLoading(true);
    try {
      const planData: Omit<PlanPensiones, 'id' | 'fechaCreacion' | 'fechaActualizacion'> = {
        personalDataId,
        nombre: formData.nombre.trim(),
        tipoAdministrativo: formData.tipoAdministrativo,
        gestoraActual: formData.gestoraActual.trim(),
        isinActual: formData.isinActual.trim() || undefined,
        fechaContratacion: formData.fechaContratacion,
        importeInicial: formData.importeInicial ? parseFloat(formData.importeInicial) : undefined,
        valorActual: formData.valorActual ? parseFloat(formData.valorActual) : undefined,
        titular: formData.titular,
        estado: formData.estado,
        origen: 'manual',
      };

      const savedPlan = plan?.id
        ? await planesPensionesService.updatePlan(plan.id, planData)
        : await planesPensionesService.createPlan(planData);

      toast.success(plan ? 'Plan actualizado correctamente' : 'Plan creado correctamente');
      onSaved(savedPlan);
      onClose();
    } catch (error) {
      console.error('Error saving plan:', error);
      toast.error('Error al guardar el plan de pensiones');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AtlasModal
      isOpen={isOpen}
      onClose={onClose}
      title={plan ? 'Editar Plan de Pensiones' : 'Nuevo Plan de Pensiones'}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Tipo administrativo */}
        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">
            Tipo administrativo *
          </label>
          <div className="grid grid-cols-2 gap-3">
            {TIPOS_ADMIN.map(({ value, label, desc }) => (
              <button
                key={value}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, tipoAdministrativo: value }))}
                className={[
                  'text-left p-3 border-2 rounded-lg transition-colors',
                  formData.tipoAdministrativo === value
                    ? 'border-blue-700 bg-blue-50'
                    : 'border-neutral-200 hover:border-neutral-400',
                ].join(' ')}
              >
                <div className="font-semibold text-sm text-neutral-800">{label}</div>
                <div className="text-xs text-neutral-500 mt-0.5">{desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Nombre y gestora */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Nombre del plan *</label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
              className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-700"
              placeholder="Ej: Plan Naranja IRPF"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Entidad gestora *</label>
            <input
              type="text"
              value={formData.gestoraActual}
              onChange={(e) => setFormData(prev => ({ ...prev, gestoraActual: e.target.value }))}
              className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-700"
              placeholder="Ej: ING, Caixabank, Renta 4..."
              required
            />
          </div>
        </div>

        {/* ISIN y fecha */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">ISIN (opcional)</label>
            <input
              type="text"
              value={formData.isinActual}
              onChange={(e) => setFormData(prev => ({ ...prev, isinActual: e.target.value }))}
              className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-700"
              placeholder="Ej: ES0123456789"
              maxLength={12}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Fecha de apertura *</label>
            <input
              type="date"
              value={formData.fechaContratacion}
              onChange={(e) => setFormData(prev => ({ ...prev, fechaContratacion: e.target.value }))}
              className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-700"
              required
            />
          </div>
        </div>

        {/* Valores */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Valor inicial (€)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.importeInicial}
              onChange={(e) => setFormData(prev => ({ ...prev, importeInicial: e.target.value }))}
              className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-700"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Valor actual (€)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.valorActual}
              onChange={(e) => setFormData(prev => ({ ...prev, valorActual: e.target.value }))}
              className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-700"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Titular y estado */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Titular</label>
            <select
              value={formData.titular}
              onChange={(e) => setFormData(prev => ({ ...prev, titular: e.target.value as 'yo' | 'pareja' }))}
              className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-700"
            >
              <option value="yo">Yo</option>
              <option value="pareja">Pareja</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Estado del plan</label>
            <select
              value={formData.estado}
              onChange={(e) => setFormData(prev => ({ ...prev, estado: e.target.value as EstadoPlan }))}
              className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-700"
            >
              <option value="activo">Activo</option>
              <option value="rescatado_total">Rescatado (total)</option>
              <option value="rescatado_parcial">Rescatado (parcial)</option>
              <option value="traspasado_externo">Traspasado a externo</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded hover:bg-neutral-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-800 disabled:opacity-50"
          >
            {loading ? 'Guardando...' : plan ? 'Actualizar plan' : 'Crear plan'}
          </button>
        </div>
      </form>
    </AtlasModal>
  );
};

export default PlanForm;
