import React, { useState, useEffect } from 'react';
import { PersonalData, SituacionLaboral, EmploymentStatus, MaritalStatus, HousingType } from '../../types/personal';
import { personalDataService } from '../../services/personalDataService';
import toast from 'react-hot-toast';

interface PersonalDataFormProps {
  onDataSaved?: (data: PersonalData) => void;
}

const PersonalDataForm: React.FC<PersonalDataFormProps> = ({ onDataSaved }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<{
    nombre: string;
    apellidos: string;
    dni: string;
    direccion: string;
    situacionPersonal: PersonalData['situacionPersonal'];
    situacionLaboral: SituacionLaboral[];
    employmentStatus: EmploymentStatus | undefined;
    maritalStatus: MaritalStatus | undefined;
    housingType: HousingType | undefined;
    hasVehicle: boolean;
    hasChildren: boolean | number;
  }>({
    nombre: '',
    apellidos: '',
    dni: '',
    direccion: '',
    situacionPersonal: 'soltero',
    situacionLaboral: [],
    employmentStatus: undefined,
    maritalStatus: undefined,
    housingType: undefined,
    hasVehicle: false,
    hasChildren: false
  });

  const situacionPersonalOptions = [
    { value: 'soltero', label: 'Soltero/a' },
    { value: 'casado', label: 'Casado/a' },
    { value: 'pareja-hecho', label: 'Pareja de hecho' },
    { value: 'divorciado', label: 'Divorciado/a' }
  ];

  const situacionLaboralOptions = [
    { value: 'asalariado', label: 'Asalariado' },
    { value: 'autonomo', label: 'Autónomo' },
    { value: 'desempleado', label: 'Desempleado' },
    { value: 'jubilado', label: 'Jubilado' }
  ];

  const employmentStatusOptions: { value: EmploymentStatus; label: string }[] = [
    { value: 'employed', label: 'Asalariado / Por cuenta ajena' },
    { value: 'self_employed', label: 'Autónomo / Por cuenta propia' },
    { value: 'retired', label: 'Jubilado / Pensionista' },
    { value: 'unemployed', label: 'Desempleado / Sin ingresos laborales' }
  ];

  const maritalStatusOptions: { value: MaritalStatus; label: string }[] = [
    { value: 'single', label: 'Soltero/a' },
    { value: 'married', label: 'Casado/a o Pareja de hecho' },
    { value: 'divorced', label: 'Divorciado/a o Separado/a' },
    { value: 'widowed', label: 'Viudo/a' }
  ];

  const housingTypeOptions: { value: HousingType; label: string; description: string }[] = [
    { value: 'rent', label: 'Alquiler', description: 'Pago mensual de arrendamiento' },
    { value: 'ownership_with_mortgage', label: 'Propiedad con hipoteca', description: 'Vivienda propia con préstamo hipotecario' },
    { value: 'ownership_without_mortgage', label: 'Propiedad sin hipoteca', description: 'Vivienda propia libre de cargas' },
    { value: 'living_with_parents', label: 'En casa familiar', description: 'Sin gastos de vivienda principales' }
  ];

  useEffect(() => {
    loadPersonalData();
  }, []);

  const loadPersonalData = async () => {
    setLoading(true);
    try {
      const data = await personalDataService.getPersonalData();
      if (data) {
        setFormData({
          nombre: data.nombre,
          apellidos: data.apellidos,
          dni: data.dni,
          direccion: data.direccion,
          situacionPersonal: data.situacionPersonal,
          situacionLaboral: data.situacionLaboral,
          employmentStatus: data.employmentStatus,
          maritalStatus: data.maritalStatus,
          housingType: data.housingType,
          hasVehicle: data.hasVehicle ?? false,
          hasChildren: data.hasChildren ?? false
        });
      }
    } catch (error) {
      console.error('Error loading personal data:', error);
      toast.error('Error al cargar los datos personales');
    } finally {
      setLoading(false);
    }
  };

  const handleSituacionLaboralChange = (situacion: SituacionLaboral, checked: boolean) => {
    let newSituaciones: SituacionLaboral[];

    if (!checked) {
      newSituaciones = formData.situacionLaboral.filter(s => s !== situacion);
    } else if (situacion === 'desempleado' || situacion === 'jubilado') {
      // Exclusive statuses: selecting them clears all others
      newSituaciones = [situacion];
    } else {
      // Selecting an active status while an exclusive one is set removes the exclusive one
      const withoutExclusive = formData.situacionLaboral.filter(
        s => s !== 'desempleado' && s !== 'jubilado'
      );
      newSituaciones = [...withoutExclusive, situacion];
    }

    setFormData(prev => ({
      ...prev,
      situacionLaboral: newSituaciones
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nombre || !formData.apellidos || !formData.dni) {
      toast.error('Por favor, completa todos los campos obligatorios');
      return;
    }

    if (formData.situacionLaboral.length === 0) {
      toast.error('Debe seleccionar al menos una situación laboral');
      return;
    }

    setSaving(true);
    try {
      const savedData = await personalDataService.savePersonalData(formData);
      toast.success('Datos personales guardados correctamente');
      onDataSaved?.(savedData);
    } catch (error) {
      console.error('Error saving personal data:', error);
      toast.error('Error al guardar los datos personales');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-neutral-200 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin h-8 w-8 border-2 border-brand-navy border-t-transparent"></div>
          <span className="ml-2 text-neutral-600">Cargando datos personales...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-neutral-200 p-6">
      <h2 className="text-lg font-semibold text-neutral-900 mb-4">Datos Personales</h2>
      <p className="text-neutral-600 mb-6">
        Configura tus datos personales para personalizar el módulo Personal según tu situación.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Nombre *
            </label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
              className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Apellidos *
            </label>
            <input
              type="text"
              value={formData.apellidos}
              onChange={(e) => setFormData(prev => ({ ...prev, apellidos: e.target.value }))}
              className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              DNI *
            </label>
            <input
              type="text"
              value={formData.dni}
              onChange={(e) => setFormData(prev => ({ ...prev, dni: e.target.value }))}
              className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              placeholder="12345678A"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Situación Personal
            </label>
            <select
              value={formData.situacionPersonal}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                situacionPersonal: e.target.value as PersonalData['situacionPersonal'] 
              }))}
              className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            >
              {situacionPersonalOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Dirección
          </label>
          <textarea
            value={formData.direccion}
            onChange={(e) => setFormData(prev => ({ ...prev, direccion: e.target.value }))}
            rows={2}
            className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            placeholder="Calle, número, ciudad, código postal"
          />
        </div>

        {/* Employment Situation */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-3">
            Situación Laboral *
          </label>
          <p className="text-sm text-neutral-500 mb-3">
            Selecciona todas las situaciones que apliquen. Según tu selección, se mostrarán las secciones correspondientes en el módulo Personal.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {situacionLaboralOptions.map(option => (
              <label key={option.value} className="flex items-center space-x-3 p-3 border border-neutral-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.situacionLaboral.includes(option.value as SituacionLaboral)}
                  onChange={(e) => handleSituacionLaboralChange(option.value as SituacionLaboral, e.target.checked)}
                  className="h-4 w-4 text-brand-navy focus:ring-brand-navy border-neutral-300 rounded"
                />
                <span className="text-sm font-medium text-neutral-700">{option.label}</span>
              </label>
            ))}
          </div>
          {formData.situacionLaboral.length > 0 && (
            <div className="btn-secondary-horizon atlas-atlas-atlas-atlas-atlas-atlas-btn-primary mt-3 p-3 ">
              <p className="text-sm text-primary-700">
                <strong>Secciones que se mostrarán:</strong>
                {formData.situacionLaboral.includes('asalariado') && ' Nómina,'}
                {formData.situacionLaboral.includes('autonomo') && ' Autónomo,'}
                {' Planes de Pensiones e Inversiones, Otros Ingresos'}
              </p>
            </div>
          )}
        </div>

        {/* ── Situación Personal Detallada ── */}
        <div className="border-t border-neutral-200 pt-6">
          <h3 className="text-base font-semibold text-neutral-900 mb-1">Situación Personal Detallada</h3>
          <p className="text-sm text-neutral-500 mb-5">
            Esta información permite a ATLAS personalizar las plantillas de gastos y secciones del módulo Personal según tu realidad.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* employmentStatus */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Estado laboral principal
              </label>
              <p className="text-xs text-neutral-500 mb-2">Determina qué secciones de ingresos se activan (Nómina, Autónomo, Pensión).</p>
              <select
                value={formData.employmentStatus ?? ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  employmentStatus: (e.target.value as EmploymentStatus) || undefined
                }))}
                className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              >
                <option value="">— Selecciona —</option>
                {employmentStatusOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* maritalStatus */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Estado civil
              </label>
              <p className="text-xs text-neutral-500 mb-2">Se usará en futuras funcionalidades de perfil de cónyuge.</p>
              <select
                value={formData.maritalStatus ?? ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  maritalStatus: (e.target.value as MaritalStatus) || undefined
                }))}
                className="w-full px-3 py-2 border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              >
                <option value="">— Selecciona —</option>
                {maritalStatusOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* housingType */}
          <div className="mt-5">
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Tipo de vivienda
            </label>
            <p className="text-xs text-neutral-500 mb-3">Indica si ATLAS debe incluir gastos de alquiler o hipoteca en tus plantillas.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {housingTypeOptions.map(opt => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    formData.housingType === opt.value
                      ? 'border-brand-navy bg-brand-navy/5'
                      : 'border-neutral-200 hover:border-neutral-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="housingType"
                    value={opt.value}
                    checked={formData.housingType === opt.value}
                    onChange={() => setFormData(prev => ({ ...prev, housingType: opt.value as HousingType }))}
                    className="mt-0.5 h-4 w-4 text-brand-navy focus:ring-brand-navy border-neutral-300"
                  />
                  <div>
                    <span className="text-sm font-medium text-neutral-800">{opt.label}</span>
                    <p className="text-xs text-neutral-500 mt-0.5">{opt.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* hasVehicle & hasChildren toggles */}
          <div className="mt-5 space-y-4">
            {/* hasVehicle */}
            <div className="flex items-center justify-between p-4 border border-neutral-200 rounded-lg">
              <div>
                <p className="text-sm font-medium text-neutral-800">¿Tienes vehículo propio?</p>
                <p className="text-xs text-neutral-500 mt-0.5">ATLAS incluirá gastos de gasolina, seguro y mantenimiento en tus plantillas.</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, hasVehicle: !prev.hasVehicle }))}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-navy focus:ring-offset-2 ${
                  formData.hasVehicle ? 'bg-brand-navy' : 'bg-neutral-200'
                }`}
                role="switch"
                aria-checked={!!formData.hasVehicle}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    formData.hasVehicle ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* hasChildren */}
            <div className="flex items-center justify-between p-4 border border-neutral-200 rounded-lg">
              <div>
                <p className="text-sm font-medium text-neutral-800">¿Tienes hijos o personas a cargo?</p>
                <p className="text-xs text-neutral-500 mt-0.5">ATLAS incluirá gastos de colegio, guardería y actividades en tus plantillas.</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, hasChildren: !prev.hasChildren }))}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-navy focus:ring-offset-2 ${
                  formData.hasChildren ? 'bg-brand-navy' : 'bg-neutral-200'
                }`}
                role="switch"
                aria-checked={!!formData.hasChildren}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    formData.hasChildren ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-4 border-t border-neutral-200">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-brand-navy text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-navy focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Guardando...' : 'Guardar Datos Personales'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PersonalDataForm;