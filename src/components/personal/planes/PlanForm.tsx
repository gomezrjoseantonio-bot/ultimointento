import React, { useState, useEffect } from 'react';
import { AtlasModal } from '../../atlas/AtlasComponents';
import { planesInversionService } from '../../../services/planesInversionService';
import { personalDataService } from '../../../services/personalDataService';
import { PlanPensionInversion, AportacionPeriodica } from '../../../types/personal';
import toast from 'react-hot-toast';

interface PlanFormProps {
  isOpen: boolean;
  onClose: () => void;
  plan?: PlanPensionInversion | null;
  onSaved: (plan: PlanPensionInversion) => void;
}

const PlanForm: React.FC<PlanFormProps> = ({ isOpen, onClose, plan, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [personalDataId, setPersonalDataId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    tipo: 'plan-pensiones' as PlanPensionInversion['tipo'],
    aportacionesRealizadas: '',
    unidades: '',
    valorCompra: '',
    valorActual: '',
    titularidad: 'yo' as PlanPensionInversion['titularidad'],
    esHistorico: false,
    aportacionPeriodica: {
      importe: '',
      frecuencia: 'mensual' as 'mensual' | 'trimestral' | 'semestral' | 'anual',
      cuentaAbono: 0,
      reglasDia: {
        tipo: 'fijo' as 'fijo' | 'ultimo-habil' | 'n-esimo-habil',
        dia: 1 as number | undefined
      },
      activa: true
    }
  });

  useEffect(() => {
    loadPersonalDataId();
    if (plan) {
      setFormData({
        nombre: plan.nombre,
        tipo: plan.tipo,
        aportacionesRealizadas: plan.aportacionesRealizadas.toString(),
        unidades: plan.unidades?.toString() || '',
        valorCompra: plan.valorCompra.toString(),
        valorActual: plan.valorActual.toString(),
        titularidad: plan.titularidad,
        esHistorico: plan.esHistorico,
        aportacionPeriodica: plan.aportacionPeriodica ? {
          importe: plan.aportacionPeriodica.importe.toString(),
          frecuencia: plan.aportacionPeriodica.frecuencia,
          cuentaAbono: plan.aportacionPeriodica.cuentaAbono,
          reglasDia: {
            tipo: plan.aportacionPeriodica.reglasDia.tipo,
            dia: plan.aportacionPeriodica.reglasDia.dia || undefined
          },
          activa: plan.aportacionPeriodica.activa
        } : {
          importe: '',
          frecuencia: 'mensual' as 'mensual' | 'trimestral' | 'semestral' | 'anual',
          cuentaAbono: 0,
          reglasDia: {
            tipo: 'fijo' as 'fijo' | 'ultimo-habil' | 'n-esimo-habil',
            dia: 1 as number | undefined
          },
          activa: true
        }
      });
    }
  }, [plan]);

  const loadPersonalDataId = async () => {
    try {
      const personalData = await personalDataService.getPersonalData();
      if (personalData?.id) {
        setPersonalDataId(personalData.id);
      }
    } catch (error) {
      console.error('Error loading personal data ID:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!personalDataId) {
      toast.error('Error: No se encontraron datos personales');
      return;
    }

    if (!formData.nombre || !formData.aportacionesRealizadas || !formData.valorActual) {
      toast.error('Por favor, completa todos los campos obligatorios');
      return;
    }

    const aportacionesRealizadas = parseFloat(formData.aportacionesRealizadas);
    const valorCompra = parseFloat(formData.valorCompra) || aportacionesRealizadas;
    const valorActual = parseFloat(formData.valorActual);
    const unidades = formData.unidades ? parseFloat(formData.unidades) : undefined;

    if (isNaN(aportacionesRealizadas) || aportacionesRealizadas < 0) {
      toast.error('Las aportaciones realizadas deben ser un número válido');
      return;
    }

    if (isNaN(valorActual) || valorActual < 0) {
      toast.error('El valor actual debe ser un número válido');
      return;
    }

    // Validate periodic contribution if not historical
    let aportacionPeriodica: AportacionPeriodica | undefined;
    if (!formData.esHistorico && formData.aportacionPeriodica.activa && formData.aportacionPeriodica.importe) {
      const importe = parseFloat(formData.aportacionPeriodica.importe);
      if (isNaN(importe) || importe <= 0) {
        toast.error('El importe de la aportación periódica debe ser válido');
        return;
      }

      aportacionPeriodica = {
        importe,
        frecuencia: formData.aportacionPeriodica.frecuencia,
        cuentaAbono: formData.aportacionPeriodica.cuentaAbono,
        reglasDia: formData.aportacionPeriodica.reglasDia,
        activa: formData.aportacionPeriodica.activa
      };
    }

    setLoading(true);
    try {
      const planData: Omit<PlanPensionInversion, 'id' | 'fechaCreacion' | 'fechaActualizacion'> = {
        personalDataId,
        nombre: formData.nombre,
        tipo: formData.tipo,
        aportacionesRealizadas,
        unidades,
        valorCompra,
        valorActual,
        titularidad: formData.titularidad,
        aportacionPeriodica,
        esHistorico: formData.esHistorico
      };

      let savedPlan: PlanPensionInversion;
      if (plan?.id) {
        savedPlan = await planesInversionService.updatePlan(plan.id, planData);
      } else {
        savedPlan = await planesInversionService.savePlan(planData);
      }

      toast.success(plan ? 'Plan actualizado correctamente' : 'Plan creado correctamente');
      onSaved(savedPlan);
      onClose();
    } catch (error) {
      console.error('Error saving plan:', error);
      toast.error('Error al guardar el plan');
    } finally {
      setLoading(false);
    }
  };

  const tiposProducto = [
    { value: 'plan-pensiones', label: 'Plan de Pensiones' },
    { value: 'inversion', label: 'Inversión General' },
    { value: 'fondo-indexado', label: 'Fondo Indexado' },
    { value: 'acciones', label: 'Acciones' },
    { value: 'otros', label: 'Otros' }
  ];

  const frecuencias = [
    { value: 'mensual', label: 'Mensual' },
    { value: 'trimestral', label: 'Trimestral' },
    { value: 'semestral', label: 'Semestral' },
    { value: 'anual', label: 'Anual' }
  ];

  const cuentas = [
    { value: 0, label: 'Seleccionar cuenta' },
    { value: 1, label: 'Cuenta Principal' },
    { value: 2, label: 'Cuenta Ahorros' },
    { value: 3, label: 'Cuenta Inversiones' }
  ];

  // Calculate current profit/loss
  const aportaciones = parseFloat(formData.aportacionesRealizadas) || 0;
  const valorActual = parseFloat(formData.valorActual) || 0;
  const plusvalia = valorActual - aportaciones;
  const rentabilidad = aportaciones > 0 ? (plusvalia / aportaciones) * 100 : 0;

  return (
    <AtlasModal
      isOpen={isOpen}
      onClose={onClose}
      title={plan ? 'Editar Plan' : 'Nuevo Plan de Pensión o Inversión'}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Nombre del Producto *
            </label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
              className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              placeholder="Ej: Plan de Pensiones BBVA"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Tipo de Producto *
            </label>
            <select
              value={formData.tipo}
              onChange={(e) => setFormData(prev => ({ ...prev, tipo: e.target.value as PlanPensionInversion['tipo'] }))}
              className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              required
            >
              {tiposProducto.map(tipo => (
                <option key={tipo.value} value={tipo.value}>
                  {tipo.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Investment Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Aportaciones Realizadas (€) *
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.aportacionesRealizadas}
              onChange={(e) => setFormData(prev => ({ ...prev, aportacionesRealizadas: e.target.value }))}
              className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              placeholder="10000.00"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Valor Compra (€)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.valorCompra}
              onChange={(e) => setFormData(prev => ({ ...prev, valorCompra: e.target.value }))}
              className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              placeholder="Iguala aportaciones si vacío"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Valor Actual (€) *
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.valorActual}
              onChange={(e) => setFormData(prev => ({ ...prev, valorActual: e.target.value }))}
              className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              placeholder="12000.00"
              required
            />
          </div>
        </div>

        {/* Units (optional) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Unidades (opcional)
            </label>
            <input
              type="number"
              step="0.0001"
              value={formData.unidades}
              onChange={(e) => setFormData(prev => ({ ...prev, unidades: e.target.value }))}
              className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              placeholder="Para fondos con participaciones"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Titularidad
            </label>
            <select
              value={formData.titularidad}
              onChange={(e) => setFormData(prev => ({ ...prev, titularidad: e.target.value as PlanPensionInversion['titularidad'] }))}
              className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            >
              <option value="yo">Mío</option>
              <option value="pareja">Pareja</option>
              <option value="ambos">Ambos</option>
            </select>
          </div>
        </div>

        {/* Current Performance Summary */}
        {formData.aportacionesRealizadas && formData.valorActual && (
          <div className="bg-gray-50 p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Resumen Actual</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Plusvalía/Pérdida</p>
                <p className={`font-medium ${plusvalia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {(plusvalia >= 0 ? '+' : '')}{plusvalia.toFixed(2)}€
                </p>
              </div>
              <div>
                <p className="text-gray-600">Rentabilidad</p>
                <p className={`font-medium ${rentabilidad >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {(rentabilidad >= 0 ? '+' : '')}{rentabilidad.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-gray-600">Valor Total</p>
                <p className="font-medium">{valorActual.toFixed(2)}€</p>
              </div>
            </div>
          </div>
        )}

        {/* Historical vs Active */}
        <div className="border border-neutral-200 p-4">
          <div className="flex items-center space-x-3 mb-3">
            <input
              type="checkbox"
              id="esHistorico"
              checked={formData.esHistorico}
              onChange={(e) => setFormData(prev => ({ ...prev, esHistorico: e.target.checked }))}
              className="h-4 w-4 text-brand-navy focus:ring-brand-navy border-neutral-300 rounded"
            />
            <label htmlFor="esHistorico" className="text-sm font-medium text-neutral-700">
              Solo seguimiento (histórico)
            </label>
          </div>
          <p className="text-xs text-neutral-500">
            Marca esta opción si solo quieres hacer seguimiento del valor sin aportaciones periódicas activas.
          </p>
        </div>

        {/* Periodic Contribution (only if not historical) */}
        {!formData.esHistorico && (
          <div className="border border-neutral-200 p-4">
            <div className="flex items-center space-x-3 mb-4">
              <input
                type="checkbox"
                id="aportacionActiva"
                checked={formData.aportacionPeriodica.activa}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  aportacionPeriodica: { ...prev.aportacionPeriodica, activa: e.target.checked }
                }))}
                className="h-4 w-4 text-brand-navy focus:ring-brand-navy border-neutral-300 rounded"
              />
              <label htmlFor="aportacionActiva" className="text-sm font-medium text-neutral-700">
                Aportación Periódica Activa
              </label>
            </div>

            {formData.aportacionPeriodica.activa && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Importe por Aportación (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.aportacionPeriodica.importe}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        aportacionPeriodica: { ...prev.aportacionPeriodica, importe: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                      placeholder="100.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Frecuencia
                    </label>
                    <select
                      value={formData.aportacionPeriodica.frecuencia}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        aportacionPeriodica: { ...prev.aportacionPeriodica, frecuencia: e.target.value as any }
                      }))}
                      className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                    >
                      {frecuencias.map(freq => (
                        <option key={freq.value} value={freq.value}>
                          {freq.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Cuenta de Débito
                    </label>
                    <select
                      value={formData.aportacionPeriodica.cuentaAbono}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        aportacionPeriodica: { ...prev.aportacionPeriodica, cuentaAbono: parseInt(e.target.value) }
                      }))}
                      className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                    >
                      {cuentas.map(cuenta => (
                        <option key={cuenta.value} value={cuenta.value}>
                          {cuenta.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Día de Aportación
                    </label>
                    <div className="flex space-x-2">
                      <select
                        value={formData.aportacionPeriodica.reglasDia.tipo}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          aportacionPeriodica: {
                            ...prev.aportacionPeriodica,
                            reglasDia: {
                              tipo: e.target.value as any,
                              dia: e.target.value === 'fijo' ? 1 : undefined
                            }
                          }
                        }))}
                        className="flex-1 px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy"
                      >
                        <option value="fijo">Día fijo</option>
                        <option value="ultimo-habil">Último hábil</option>
                      </select>
                      {formData.aportacionPeriodica.reglasDia.tipo === 'fijo' && (
                        <input
                          type="number"
                          min="1"
                          max="28"
                          value={formData.aportacionPeriodica.reglasDia.dia || 1}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            aportacionPeriodica: {
                              ...prev.aportacionPeriodica,
                              reglasDia: { ...prev.aportacionPeriodica.reglasDia, dia: parseInt(e.target.value) }
                            }
                          }))}
                          className="w-16 px-2 py-2 border border-neutral-300 text-center"
                        />
                      )}
                    </div>
                  </div>
                </div>

                {formData.aportacionPeriodica.importe && (
                  <div className="btn-primary-horizon p-3">
                    <p className="text-sm text-blue-700">
                      <strong>Aportación anual estimada:</strong> {
                        (parseFloat(formData.aportacionPeriodica.importe) * 
                        (formData.aportacionPeriodica.frecuencia === 'mensual' ? 12 :
                         formData.aportacionPeriodica.frecuencia === 'trimestral' ? 4 :
                         formData.aportacionPeriodica.frecuencia === 'semestral' ? 2 : 1)).toFixed(2)
                      }€
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Submit buttons */}
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
            className="px-4 py-2 bg-brand-navy disabled:opacity-50"
          >
            {loading ? 'Guardando...' : (plan ? 'Actualizar' : 'Crear')} Plan
          </button>
        </div>
      </form>
    </AtlasModal>
  );
};

export default PlanForm;