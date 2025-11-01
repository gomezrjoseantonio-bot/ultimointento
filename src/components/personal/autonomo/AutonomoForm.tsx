import React, { useState, useEffect } from 'react';
import { AtlasModal } from '../../atlas/AtlasComponents';
import { autonomoService } from '../../../services/autonomoService';
import { personalDataService } from '../../../services/personalDataService';
import { Autonomo } from '../../../types/personal';
import toast from 'react-hot-toast';

interface AutonomoFormProps {
  isOpen: boolean;
  onClose: () => void;
  autonomo?: Autonomo | null;
  onSaved: (autonomo: Autonomo) => void;
}

const AutonomoForm: React.FC<AutonomoFormProps> = ({ isOpen, onClose, autonomo, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [personalDataId, setPersonalDataId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    cuotaAutonomos: '',
    cuentaCobro: 0,
    cuentaPago: 0,
    reglaCobroDia: {
      tipo: 'fijo' as 'fijo' | 'ultimo-habil' | 'n-esimo-habil',
      dia: 1 as number | undefined
    },
    reglaPagoDia: {
      tipo: 'fijo' as 'fijo' | 'ultimo-habil' | 'n-esimo-habil',
      dia: 5 as number | undefined
    },
    activo: true
  });

  useEffect(() => {
    loadPersonalDataId();
    if (autonomo) {
      setFormData({
        nombre: autonomo.nombre,
        cuotaAutonomos: autonomo.cuotaAutonomos.toString(),
        cuentaCobro: autonomo.cuentaCobro,
        cuentaPago: autonomo.cuentaPago,
        reglaCobroDia: {
          tipo: autonomo.reglaCobroDia.tipo,
          dia: autonomo.reglaCobroDia.dia || 1
        },
        reglaPagoDia: {
          tipo: autonomo.reglaPagoDia.tipo,
          dia: autonomo.reglaPagoDia.dia || 5
        },
        activo: autonomo.activo
      });
    }
  }, [autonomo]);

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

    if (!formData.nombre || !formData.cuotaAutonomos) {
      toast.error('Por favor, completa todos los campos obligatorios');
      return;
    }

    const cuotaAutonomos = parseFloat(formData.cuotaAutonomos);
    if (isNaN(cuotaAutonomos) || cuotaAutonomos <= 0) {
      toast.error('La cuota de autónomos debe ser un número válido');
      return;
    }

    setLoading(true);
    try {
      const autonomoData = {
        personalDataId,
        nombre: formData.nombre,
        cuotaAutonomos,
        cuentaCobro: formData.cuentaCobro,
        cuentaPago: formData.cuentaPago,
        reglaCobroDia: formData.reglaCobroDia,
        reglaPagoDia: formData.reglaPagoDia,
        ingresosFacturados: autonomo?.ingresosFacturados || [],
        gastosDeducibles: autonomo?.gastosDeducibles || [],
        activo: formData.activo
      };

      let savedAutonomo: Autonomo;
      if (autonomo?.id) {
        savedAutonomo = await autonomoService.updateAutonomo(autonomo.id, autonomoData);
      } else {
        savedAutonomo = await autonomoService.saveAutonomo(autonomoData);
      }

      toast.success(autonomo ? 'Configuración actualizada correctamente' : 'Configuración creada correctamente');
      onSaved(savedAutonomo);
      onClose();
    } catch (error) {
      console.error('Error saving autonomo:', error);
      toast.error('Error al guardar la configuración');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AtlasModal
      isOpen={isOpen}
      onClose={onClose}
      title={autonomo ? 'Editar Configuración de Autónomo' : 'Nueva Configuración de Autónomo'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Nombre de la Configuración *
            </label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
              className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              placeholder="Ej: Autónomo Principal 2024"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Cuota de Autónomos Mensual (€) *
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.cuotaAutonomos}
              onChange={(e) => setFormData(prev => ({ ...prev, cuotaAutonomos: e.target.value }))}
              className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              placeholder="294.00"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Cuenta de Cobro
            </label>
            <select
              value={formData.cuentaCobro}
              onChange={(e) => setFormData(prev => ({ ...prev, cuentaCobro: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            >
              <option value={0}>Seleccionar cuenta</option>
              <option value={1}>Cuenta Principal</option>
              <option value={2}>Cuenta Autónomos</option>
              <option value={3}>Cuenta Ahorros</option>
            </select>
          </div>
        </div>

        {/* Payment Rules */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Cobro Rules */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-3">
              Regla de Día de Cobro
            </label>
            <div className="space-y-3">
              <label className="flex items-center space-x-3">
                <input
                  type="radio"
                  name="reglaCobroDia"
                  checked={formData.reglaCobroDia.tipo === 'fijo'}
                  onChange={() => setFormData(prev => ({
                    ...prev,
                    reglaCobroDia: { tipo: 'fijo', dia: 1 }
                  }))}
                  className="h-4 w-4 text-brand-navy focus:ring-brand-navy"
                />
                <span className="text-sm">Día fijo del mes</span>
                {formData.reglaCobroDia.tipo === 'fijo' && (
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.reglaCobroDia.dia || 1}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      reglaCobroDia: { ...prev.reglaCobroDia, dia: parseInt(e.target.value) }
                    }))}
                    className="w-16 px-2 py-1 border border-neutral-300 rounded text-sm"
                  />
                )}
              </label>

              <label className="flex items-center space-x-3">
                <input
                  type="radio"
                  name="reglaCobroDia"
                  checked={formData.reglaCobroDia.tipo === 'ultimo-habil'}
                  onChange={() => setFormData(prev => ({
                    ...prev,
                    reglaCobroDia: { tipo: 'ultimo-habil', dia: undefined }
                  }))}
                  className="h-4 w-4 text-brand-navy focus:ring-brand-navy"
                />
                <span className="text-sm">Último día hábil del mes</span>
              </label>
            </div>
          </div>

          {/* Pago Rules */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-3">
              Regla de Día de Pago (Cuota)
            </label>
            <div className="space-y-3">
              <label className="flex items-center space-x-3">
                <input
                  type="radio"
                  name="reglaPagoDia"
                  checked={formData.reglaPagoDia.tipo === 'fijo'}
                  onChange={() => setFormData(prev => ({
                    ...prev,
                    reglaPagoDia: { tipo: 'fijo', dia: 5 }
                  }))}
                  className="h-4 w-4 text-brand-navy focus:ring-brand-navy"
                />
                <span className="text-sm">Día fijo del mes</span>
                {formData.reglaPagoDia.tipo === 'fijo' && (
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.reglaPagoDia.dia || 5}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      reglaPagoDia: { ...prev.reglaPagoDia, dia: parseInt(e.target.value) }
                    }))}
                    className="w-16 px-2 py-1 border border-neutral-300 rounded text-sm"
                  />
                )}
              </label>

              <label className="flex items-center space-x-3">
                <input
                  type="radio"
                  name="reglaPagoDia"
                  checked={formData.reglaPagoDia.tipo === 'ultimo-habil'}
                  onChange={() => setFormData(prev => ({
                    ...prev,
                    reglaPagoDia: { tipo: 'ultimo-habil', dia: undefined }
                  }))}
                  className="h-4 w-4 text-brand-navy focus:ring-brand-navy"
                />
                <span className="text-sm">Último día hábil del mes</span>
              </label>
            </div>
          </div>
        </div>

        {/* Active checkbox */}
        <div>
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={formData.activo}
              onChange={(e) => setFormData(prev => ({ ...prev, activo: e.target.checked }))}
              className="h-4 w-4 text-brand-navy focus:ring-brand-navy border-neutral-300 rounded"
            />
            <span className="text-sm font-medium text-neutral-700">Configuración activa</span>
          </label>
          <p className="text-xs text-neutral-500 mt-1">
            Solo puede haber una configuración activa a la vez. Al activar esta, se desactivarán las demás.
          </p>
        </div>

        {/* Information Note */}
        <div className="btn-secondary-horizon atlas-atlas-atlas-atlas-atlas-atlas-btn-primary ">
          <p className="text-sm text-primary-700">
            <strong>Nota:</strong> Esta configuración te permitirá registrar ingresos y gastos asociados a tu actividad como autónomo. 
            Los cálculos automáticos incluirán las deducciones por cuota de autónomos y gastos deducibles.
          </p>
        </div>

        {/* Submit buttons */}
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
            className="px-4 py-2 bg-brand-navy disabled:opacity-50"
          >
            {loading ? 'Guardando...' : (autonomo ? 'Actualizar' : 'Crear')} Configuración
          </button>
        </div>
      </form>
    </AtlasModal>
  );
};

export default AutonomoForm;