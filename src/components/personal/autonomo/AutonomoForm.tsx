import React, { useState, useEffect, useCallback } from 'react';
import { AtlasModal } from '../../atlas/AtlasComponents';
import { autonomoService } from '../../../services/autonomoService';
import { personalDataService } from '../../../services/personalDataService';
import { cuentasService } from '../../../services/cuentasService';
import { Account } from '../../../services/db';
import { Autonomo, PersonalData } from '../../../types/personal';
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
  const [personalData, setPersonalData] = useState<PersonalData | null>(null);
  const [bankAccounts, setBankAccounts] = useState<Account[]>([]);
  const [formData, setFormData] = useState({
    titular: '',
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
    }
  });

  const loadPersonalData = useCallback(async () => {
    try {
      const data = await personalDataService.getPersonalData();
      if (data?.id) {
        setPersonalDataId(data.id);
        setPersonalData(data);
        if (!autonomo) {
          const conyugueEsAutonomo = (data.situacionLaboralConyugue || []).includes('autonomo');
          const onlyOneTitular = !conyugueEsAutonomo || !data.spouseName;
          if (onlyOneTitular) {
            setFormData(prev => ({ ...prev, titular: data.nombre || '' }));
          }
        }
      }
    } catch (error) {
      console.error('Error loading personal data:', error);
    }
  }, [autonomo]);

  const loadAccounts = useCallback(async () => {
    try {
      const accounts = await cuentasService.list();
      setBankAccounts(accounts.filter(a => a.activa));
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  }, []);

  useEffect(() => {
    loadPersonalData();
    loadAccounts();
  }, [loadPersonalData, loadAccounts]);

  useEffect(() => {
    if (autonomo) {
      setFormData({
        titular: autonomo.titular || autonomo.nombre || '',
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
        }
      });
    }
  }, [autonomo]);

  const getTitularOptions = () => {
    const options: { value: string; label: string }[] = [];
    if (personalData?.nombre) {
      options.push({ value: personalData.nombre, label: personalData.nombre });
    }
    const conyugueEsAutonomo = (personalData?.situacionLaboralConyugue || []).includes('autonomo');
    if (conyugueEsAutonomo && personalData?.spouseName) {
      options.push({ value: personalData.spouseName, label: `${personalData.spouseName} (Cónyuge)` });
    }
    return options;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!personalDataId) {
      toast.error('Error: No se encontraron datos personales');
      return;
    }

    if (!formData.titular || !formData.cuotaAutonomos) {
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
        nombre: formData.titular,
        titular: formData.titular,
        cuotaAutonomos,
        cuentaCobro: formData.cuentaCobro,
        cuentaPago: formData.cuentaPago,
        reglaCobroDia: formData.reglaCobroDia,
        reglaPagoDia: formData.reglaPagoDia,
        ingresosFacturados: autonomo?.ingresosFacturados || [],
        gastosDeducibles: autonomo?.gastosDeducibles || [],
        fuentesIngreso: autonomo?.fuentesIngreso || [],
        gastosRecurrentesActividad: autonomo?.gastosRecurrentesActividad || [],
        activo: autonomo?.activo ?? true
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
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      toast.error(`Error al guardar la configuración: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const titularOptions = getTitularOptions();

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
              Titular *
            </label>
            {titularOptions.length > 0 ? (
              <select
                value={formData.titular}
                onChange={(e) => setFormData(prev => ({ ...prev, titular: e.target.value }))}
                className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                required
              >
                <option value="">Seleccionar titular</option>
                {titularOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={formData.titular}
                onChange={(e) => setFormData(prev => ({ ...prev, titular: e.target.value }))}
                className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                placeholder="Nombre del titular de la actividad"
                required
              />
            )}
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
              Cuenta de Cobro de Facturas
            </label>
            <select
              value={formData.cuentaCobro}
              onChange={(e) => setFormData(prev => ({ ...prev, cuentaCobro: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            >
              <option value={0}>Seleccionar cuenta</option>
              {bankAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.alias || acc.name || acc.ibanMasked || acc.iban}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Cuenta de Pago de Cuota SS
            </label>
            <select
              value={formData.cuentaPago}
              onChange={(e) => setFormData(prev => ({ ...prev, cuentaPago: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            >
              <option value={0}>Seleccionar cuenta</option>
              {bankAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.alias || acc.name || acc.ibanMasked || acc.iban}
                </option>
              ))}
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
            className="px-4 py-2 bg-brand-navy text-white disabled:opacity-50"
          >
            {loading ? 'Guardando...' : (autonomo ? 'Actualizar' : 'Crear')} Configuración
          </button>
        </div>
      </form>
    </AtlasModal>
  );
};

export default AutonomoForm;
