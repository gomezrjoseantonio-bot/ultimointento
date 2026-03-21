import React, { useState, useEffect, useCallback } from 'react';
import { AtlasModal } from '../../atlas/AtlasComponents';
import { autonomoService } from '../../../services/autonomoService';
import { personalDataService } from '../../../services/personalDataService';
import { cuentasService } from '../../../services/cuentasService';
import { Account } from '../../../services/db';
import { Autonomo, PersonalData, TipoActividadAutonomo, ModalidadActividadAutonomo } from '../../../types/personal';
import toast from 'react-hot-toast';

interface AutonomoFormProps {
  isOpen: boolean;
  onClose: () => void;
  autonomo?: Autonomo | null;
  onSaved: (autonomo: Autonomo) => void;
}

type FormData = {
  titular: string;
  nombreActividad: string;
  tipoActividad: TipoActividadAutonomo;
  epigrafeIAE: string;
  modalidad: ModalidadActividadAutonomo;
  cuotaAutonomosCompartida: boolean;
  cuotaAutonomos: string;
  cuentaPago: number;
  reglaPagoDia: {
    tipo: 'fijo' | 'ultimo-habil' | 'n-esimo-habil';
    dia: number | undefined;
  };
};

const DEFAULT_FORM_DATA: FormData = {
  titular: '',
  nombreActividad: '',
  tipoActividad: 'A05',
  epigrafeIAE: '',
  modalidad: 'simplificada',
  cuotaAutonomosCompartida: true,
  cuotaAutonomos: '',
  cuentaPago: 0,
  reglaPagoDia: {
    tipo: 'fijo',
    dia: 5,
  },
};

const AutonomoForm: React.FC<AutonomoFormProps> = ({ isOpen, onClose, autonomo, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [personalDataId, setPersonalDataId] = useState<number | null>(null);
  const [personalData, setPersonalData] = useState<PersonalData | null>(null);
  const [bankAccounts, setBankAccounts] = useState<Account[]>([]);
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM_DATA);

  const loadPersonalData = useCallback(async () => {
    try {
      const data = await personalDataService.getPersonalData();
      if (!data?.id) return;

      setPersonalDataId(data.id);
      setPersonalData(data);

      if (!autonomo) {
        const conyugueEsAutonomo = (data.situacionLaboralConyugue || []).includes('autonomo');
        const onlyOneTitular = !conyugueEsAutonomo || !data.spouseName;
        if (onlyOneTitular) {
          setFormData(prev => ({ ...prev, titular: data.nombre || '' }));
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
    if (!autonomo) {
      setFormData(DEFAULT_FORM_DATA);
      return;
    }

    setFormData({
      titular: autonomo.titular || autonomo.nombre || '',
      nombreActividad: autonomo.descripcionActividad || autonomo.nombre || '',
      tipoActividad: autonomo.tipoActividad || 'A05',
      epigrafeIAE: autonomo.epigrafeIAE || '',
      modalidad: autonomo.modalidad || 'simplificada',
      cuotaAutonomosCompartida: autonomo.cuotaAutonomosCompartida ?? (autonomo.cuotaAutonomos ?? 0) > 0,
      cuotaAutonomos: autonomo.cuotaAutonomos ? autonomo.cuotaAutonomos.toString() : '',
      cuentaPago: autonomo.cuentaPago,
      reglaPagoDia: {
        tipo: autonomo.reglaPagoDia.tipo,
        dia: autonomo.reglaPagoDia.dia || 5,
      },
    });
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

    if (!formData.titular || !formData.nombreActividad.trim() || !formData.epigrafeIAE.trim()) {
      toast.error('Completa titular, nombre de actividad y epígrafe IAE');
      return;
    }

    const cuotaAutonomos = formData.cuotaAutonomosCompartida
      ? parseFloat(formData.cuotaAutonomos)
      : 0;

    if (formData.cuotaAutonomosCompartida && (isNaN(cuotaAutonomos) || cuotaAutonomos <= 0)) {
      toast.error('La cuota compartida de autónomos debe ser un número válido');
      return;
    }

    setLoading(true);
    try {
      const nombreActividad = formData.nombreActividad.trim();
      const autonomoData = {
        personalDataId,
        nombre: nombreActividad,
        titular: formData.titular,
        descripcionActividad: nombreActividad,
        tipoActividad: formData.tipoActividad,
        epigrafeIAE: formData.epigrafeIAE.trim(),
        modalidad: formData.modalidad,
        cuotaAutonomosCompartida: formData.cuotaAutonomosCompartida,
        cuotaAutonomos,
        cuentaCobro: formData.cuentaPago,
        cuentaPago: formData.cuentaPago,
        reglaCobroDia: formData.reglaPagoDia,
        reglaPagoDia: formData.reglaPagoDia,
        ingresosFacturados: autonomo?.ingresosFacturados || [],
        gastosDeducibles: autonomo?.gastosDeducibles || [],
        fuentesIngreso: autonomo?.fuentesIngreso || [],
        gastosRecurrentesActividad: autonomo?.gastosRecurrentesActividad || [],
        activo: autonomo?.activo ?? true,
      };

      const savedAutonomo = autonomo?.id
        ? await autonomoService.updateAutonomo(autonomo.id, autonomoData)
        : await autonomoService.saveAutonomo(autonomoData);

      toast.success(autonomo ? 'Actividad actualizada correctamente' : 'Actividad creada correctamente');
      onSaved(savedAutonomo);
      onClose();
    } catch (error) {
      console.error('Error saving autonomo:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      toast.error(`Error al guardar la actividad: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const titularOptions = getTitularOptions();

  return (
    <AtlasModal
      isOpen={isOpen}
      onClose={onClose}
      title={autonomo ? 'Editar actividad económica' : 'Nueva actividad económica'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
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
              Nombre / descripción de la actividad *
            </label>
            <input
              type="text"
              value={formData.nombreActividad}
              onChange={(e) => setFormData(prev => ({ ...prev, nombreActividad: e.target.value }))}
              className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              placeholder="Consultoría tecnológica"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Epígrafe IAE *
            </label>
            <input
              type="text"
              value={formData.epigrafeIAE}
              onChange={(e) => setFormData(prev => ({ ...prev, epigrafeIAE: e.target.value }))}
              className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              placeholder="724"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Tipo de actividad *
            </label>
            <select
              value={formData.tipoActividad}
              onChange={(e) => setFormData(prev => ({ ...prev, tipoActividad: e.target.value as TipoActividadAutonomo }))}
              className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            >
              <option value="A03">A03 — Empresarial</option>
              <option value="A05">A05 — Profesional</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Modalidad IRPF *
            </label>
            <select
              value={formData.modalidad}
              onChange={(e) => setFormData(prev => ({ ...prev, modalidad: e.target.value as ModalidadActividadAutonomo }))}
              className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            >
              <option value="simplificada">Estimación directa simplificada</option>
              <option value="normal">Estimación directa normal</option>
            </select>
          </div>
        </div>

        <div className="rounded border border-neutral-200 p-4 space-y-4 bg-neutral-50">
          <label className="flex items-start gap-3 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={formData.cuotaAutonomosCompartida}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                cuotaAutonomosCompartida: e.target.checked,
                cuotaAutonomos: e.target.checked ? prev.cuotaAutonomos : '',
              }))}
              className="mt-1 h-4 w-4 text-brand-navy focus:ring-brand-navy"
            />
            <span>
              Esta actividad registra la cuota compartida de la Seguridad Social.
              <span className="block text-xs text-neutral-500 mt-1">
                La cuota RETA se computa una sola vez aunque tengas varias actividades activas.
              </span>
            </span>
          </label>

          {formData.cuotaAutonomosCompartida && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Cuota de autónomos mensual (€) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.cuotaAutonomos}
                  onChange={(e) => setFormData(prev => ({ ...prev, cuotaAutonomos: e.target.value }))}
                  className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                  placeholder="294.00"
                  required={formData.cuotaAutonomosCompartida}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Cuenta de pago de cuota SS
                </label>
                <select
                  value={formData.cuentaPago}
                  onChange={(e) => setFormData(prev => ({ ...prev, cuentaPago: parseInt(e.target.value, 10) }))}
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
          )}
        </div>

        {formData.cuotaAutonomosCompartida && (
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-3">
                Regla de día de pago de la cuota
              </label>
              <div className="space-y-3">
                <label className="flex items-center space-x-3">
                  <input
                    type="radio"
                    name="reglaPagoDia"
                    checked={formData.reglaPagoDia.tipo === 'fijo'}
                    onChange={() => setFormData(prev => ({ ...prev, reglaPagoDia: { tipo: 'fijo', dia: 5 } }))}
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
                        reglaPagoDia: { ...prev.reglaPagoDia, dia: parseInt(e.target.value, 10) },
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
                    onChange={() => setFormData(prev => ({ ...prev, reglaPagoDia: { tipo: 'ultimo-habil', dia: undefined } }))}
                    className="h-4 w-4 text-brand-navy focus:ring-brand-navy"
                  />
                  <span className="text-sm">Último día hábil del mes</span>
                </label>
              </div>
            </div>
          </div>
        )}

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
            {loading ? 'Guardando...' : (autonomo ? 'Actualizar' : 'Crear')} actividad
          </button>
        </div>
      </form>
    </AtlasModal>
  );
};

export default AutonomoForm;
