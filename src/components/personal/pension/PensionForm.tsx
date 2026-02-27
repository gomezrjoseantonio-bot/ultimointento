import React, { useState, useEffect } from 'react';
import { AtlasModal } from '../../atlas/AtlasComponents';
import { pensionService } from '../../../services/pensionService';
import { personalDataService } from '../../../services/personalDataService';
import { PensionIngreso, TipoPension } from '../../../types/personal';
import toast from 'react-hot-toast';

interface PensionFormProps {
  isOpen: boolean;
  onClose: () => void;
  pension?: PensionIngreso | null;
  onSaved: (pension: PensionIngreso) => void;
}

const TIPO_PENSION_OPTIONS: { value: TipoPension; label: string }[] = [
  { value: 'jubilacion', label: 'Jubilación' },
  { value: 'viudedad', label: 'Viudedad' },
  { value: 'incapacidad', label: 'Incapacidad' },
  { value: 'orfandad', label: 'Orfandad' },
];

const PensionForm: React.FC<PensionFormProps> = ({ isOpen, onClose, pension, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [personalDataId, setPersonalDataId] = useState<number | null>(null);
  const [spouseName, setSpouseName] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('Yo');

  const [formData, setFormData] = useState({
    titular: 'yo' as 'yo' | 'pareja',
    tipoPension: 'jubilacion' as TipoPension,
    pensionBrutaAnual: '',
    numeroPagas: 14 as 12 | 14,
    irpfPorcentaje: '',
    activa: true,
  });

  useEffect(() => {
    loadPersonalData();
  }, []);

  useEffect(() => {
    if (pension) {
      setFormData({
        titular: pension.titular,
        tipoPension: pension.tipoPension,
        pensionBrutaAnual: pension.pensionBrutaAnual.toString(),
        numeroPagas: pension.numeroPagas,
        irpfPorcentaje: pension.irpfPorcentaje.toString(),
        activa: pension.activa,
      });
    } else {
      setFormData({
        titular: 'yo',
        tipoPension: 'jubilacion',
        pensionBrutaAnual: '',
        numeroPagas: 14,
        irpfPorcentaje: '',
        activa: true,
      });
    }
  }, [pension, isOpen]);

  const loadPersonalData = async () => {
    try {
      const personalData = await personalDataService.getPersonalData();
      if (personalData?.id) {
        setPersonalDataId(personalData.id);
        const nombre = personalData.nombre || 'Yo';
        setUserName(nombre);
        if (personalData.spouseName) {
          setSpouseName(personalData.spouseName);
        }
      }
    } catch (error) {
      console.error('Error loading personal data:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!personalDataId) {
      toast.error('Error: No se encontraron datos personales');
      return;
    }

    if (!formData.pensionBrutaAnual || !formData.irpfPorcentaje) {
      toast.error('Por favor, completa todos los campos obligatorios');
      return;
    }

    const pensionBrutaAnual = parseFloat(formData.pensionBrutaAnual);
    const irpfPorcentaje = parseFloat(formData.irpfPorcentaje);

    if (isNaN(pensionBrutaAnual) || pensionBrutaAnual <= 0) {
      toast.error('La pensión bruta anual debe ser un número válido');
      return;
    }
    if (isNaN(irpfPorcentaje) || irpfPorcentaje < 0 || irpfPorcentaje > 100) {
      toast.error('El porcentaje de IRPF debe ser un número entre 0 y 100');
      return;
    }

    setLoading(true);
    try {
      const pensionData = {
        personalDataId,
        titular: formData.titular,
        tipoPension: formData.tipoPension,
        pensionBrutaAnual,
        numeroPagas: formData.numeroPagas,
        irpfPorcentaje,
        activa: formData.activa,
      };

      let saved: PensionIngreso;
      if (pension?.id) {
        saved = await pensionService.updatePension(pension.id, pensionData);
      } else {
        saved = await pensionService.savePension(pensionData);
      }

      toast.success(pension ? 'Pensión actualizada correctamente' : 'Pensión creada correctamente');
      onSaved(saved);
      onClose();
    } catch (error) {
      console.error('Error saving pension:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      toast.error(`Error al guardar la pensión: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const titularOptions = [
    { value: 'yo', label: userName },
    ...(spouseName ? [{ value: 'pareja', label: spouseName }] : []),
  ];

  return (
    <AtlasModal
      isOpen={isOpen}
      onClose={onClose}
      title={pension ? 'Editar Pensión' : 'Nueva Pensión'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Titular */}
        {titularOptions.length > 1 && (
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Titular de la pensión *
            </label>
            <select
              value={formData.titular}
              onChange={(e) => setFormData(prev => ({ ...prev, titular: e.target.value as 'yo' | 'pareja' }))}
              className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            >
              {titularOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Tipo de Pensión */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Tipo de Pensión *
          </label>
          <select
            value={formData.tipoPension}
            onChange={(e) => setFormData(prev => ({ ...prev, tipoPension: e.target.value as TipoPension }))}
            className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
          >
            {TIPO_PENSION_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Importes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Pensión Bruta Anual (€) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.pensionBrutaAnual}
              onChange={(e) => setFormData(prev => ({ ...prev, pensionBrutaAnual: e.target.value }))}
              className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              placeholder="Ej: 18000"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Retención IRPF (%) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={formData.irpfPorcentaje}
              onChange={(e) => setFormData(prev => ({ ...prev, irpfPorcentaje: e.target.value }))}
              className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              placeholder="Ej: 10"
              required
            />
          </div>
        </div>

        {/* Número de Pagas */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Número de Pagas *
          </label>
          <div className="grid grid-cols-2 gap-3">
            {([12, 14] as const).map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, numeroPagas: n }))}
                className={`px-4 py-3 border text-sm font-medium transition-colors ${
                  formData.numeroPagas === n
                    ? 'border-brand-navy bg-brand-navy text-white'
                    : 'border-neutral-300 text-neutral-700 hover:border-brand-navy'
                }`}
              >
                {n} pagas
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {formData.numeroPagas === 14 ? '12 mensualidades + 2 pagas extra (habitual en España)' : '12 mensualidades sin pagas extra'}
          </p>
        </div>

        {/* Estado activa/inactiva */}
        <div className="flex items-center space-x-3">
          <input
            id="activa"
            type="checkbox"
            checked={formData.activa}
            onChange={(e) => setFormData(prev => ({ ...prev, activa: e.target.checked }))}
            className="h-4 w-4 text-brand-navy border-neutral-300 rounded"
          />
          <label htmlFor="activa" className="text-sm font-medium text-neutral-700">
            Pensión activa
          </label>
        </div>

        {/* Submit */}
        <div className="flex justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-neutral-300 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 btn-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Guardando...' : pension ? 'Actualizar' : 'Crear Pensión'}
          </button>
        </div>
      </form>
    </AtlasModal>
  );
};

export default PensionForm;
