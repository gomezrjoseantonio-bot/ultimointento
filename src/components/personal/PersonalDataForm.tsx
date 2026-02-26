import React, { useState, useEffect } from 'react';
import { PersonalData, SituacionLaboral, MaritalStatus, HousingType } from '../../types/personal';
import { personalDataService } from '../../services/personalDataService';
import { personalExpensesService } from '../../services/personalExpensesService';
import toast from 'react-hot-toast';

interface PersonalDataFormProps {
  onDataSaved?: (data: PersonalData) => void;
}

const Toggle: React.FC<{
  checked: boolean;
  onChange: () => void;
  label: string;
  description?: string;
}> = ({ checked, onChange, label, description }) => (
  <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg h-full">
    <div className="mr-3">
      <p className="text-sm font-medium text-neutral-800">{label}</p>
      {description && <p className="text-xs text-neutral-500 mt-0.5">{description}</p>}
    </div>
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-navy focus:ring-offset-2 ${
        checked ? 'bg-brand-navy' : 'bg-neutral-200'
      }`}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  </div>
);

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
    maritalStatus: undefined,
    housingType: undefined,
    hasVehicle: false,
    hasChildren: false
  });

  const situacionLaboralOptions = [
    { value: 'asalariado', label: 'Asalariado' },
    { value: 'autonomo', label: 'Autónomo' },
    { value: 'desempleado', label: 'Desempleado' },
    { value: 'jubilado', label: 'Jubilado' }
  ];

  const maritalStatusOptions: { value: MaritalStatus; label: string }[] = [
    { value: 'single', label: 'Soltero/a' },
    { value: 'married', label: 'Casado/a o Pareja de hecho' },
    { value: 'divorced', label: 'Divorciado/a o Separado/a' },
    { value: 'widowed', label: 'Viudo/a' }
  ];

  const housingTypeOptions: { value: HousingType; label: string }[] = [
    { value: 'rent', label: 'Alquiler' },
    { value: 'ownership_with_mortgage', label: 'Hipoteca' },
    { value: 'ownership_without_mortgage', label: 'Libre' },
    { value: 'living_with_parents', label: 'Familiar' }
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
      newSituaciones = [situacion];
    } else {
      const withoutExclusive = formData.situacionLaboral.filter(
        s => s !== 'desempleado' && s !== 'jubilado'
      );
      newSituaciones = [...withoutExclusive, situacion];
    }

    setFormData(prev => ({ ...prev, situacionLaboral: newSituaciones }));
  };

  // Maps the new maritalStatus field back to the legacy situacionPersonal field required by the
  // PersonalData type. 'widowed' has no direct equivalent, so it falls back to 'soltero'.
  const maritalToSituacionPersonal = (ms: MaritalStatus | undefined): PersonalData['situacionPersonal'] => {
    if (ms === 'married') return 'casado';
    if (ms === 'divorced') return 'divorciado';
    return 'soltero'; // covers 'single', 'widowed', and undefined
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nombre || !formData.apellidos) {
      toast.error('Por favor, completa los campos de nombre y apellidos');
      return;
    }

    if (formData.situacionLaboral.length === 0) {
      toast.error('Debe seleccionar al menos una situación laboral');
      return;
    }

    setSaving(true);
    try {
      const dataToSave = {
        ...formData,
        situacionPersonal: maritalToSituacionPersonal(formData.maritalStatus)
      };
      const savedData = await personalDataService.savePersonalData(dataToSave);
      if (savedData.id) {
        try {
          await personalExpensesService.smartSyncTemplateExpenses(savedData.id, savedData);
        } catch (mergeError) {
          console.error('Error merging expense template:', mergeError);
        }
      }
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
      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin h-8 w-8 border-2 border-brand-navy border-t-transparent rounded-full"></div>
          <span className="ml-2 text-neutral-600">Cargando datos personales...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
      <h2 className="text-lg font-semibold text-neutral-900 mb-1">Perfil de Usuario</h2>
      <p className="text-sm text-neutral-500 mb-5">
        Personaliza ATLAS según tu situación personal y laboral.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Row 1 – Identity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">
              Nombre <span className="text-error-500">*</span>
            </label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              placeholder="Tu nombre"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">
              Apellidos <span className="text-error-500">*</span>
            </label>
            <input
              type="text"
              value={formData.apellidos}
              onChange={(e) => setFormData(prev => ({ ...prev, apellidos: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              placeholder="Tus apellidos"
              required
            />
          </div>
        </div>

        {/* Row 2 – Estado Civil + hasChildren */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">
              Estado Civil
            </label>
            <select
              value={formData.maritalStatus ?? ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                maritalStatus: (e.target.value as MaritalStatus) || undefined
              }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            >
              <option value="">— Selecciona —</option>
              {maritalStatusOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col justify-end">
            <Toggle
              checked={!!formData.hasChildren}
              onChange={() => setFormData(prev => ({ ...prev, hasChildren: !prev.hasChildren }))}
              label="¿Hijos o personas a cargo?"
              description="Activa gastos de colegio y guardería"
            />
          </div>
        </div>

        {/* Row 3 – hasVehicle */}
        <Toggle
          checked={!!formData.hasVehicle}
          onChange={() => setFormData(prev => ({ ...prev, hasVehicle: !prev.hasVehicle }))}
          label="¿Tienes vehículo propio?"
          description="Activa gastos de gasolina, seguro y mantenimiento"
        />

        {/* Situación Laboral */}
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-2">
            Situación Laboral <span className="text-error-500">*</span>
            <span className="text-neutral-400 font-normal ml-1">(selección múltiple)</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {situacionLaboralOptions.map(option => {
              const isSelected = formData.situacionLaboral.includes(option.value as SituacionLaboral);
              return (
                <label
                  key={option.value}
                  className={`flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer transition-colors text-sm ${
                    isSelected
                      ? 'border-brand-navy bg-primary-50 text-brand-navy font-medium'
                      : 'border-gray-200 text-neutral-700 hover:border-gray-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => handleSituacionLaboralChange(option.value as SituacionLaboral, e.target.checked)}
                    className="h-3.5 w-3.5 text-brand-navy focus:ring-brand-navy border-neutral-300 rounded"
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        </div>

        {/* Tipo de Vivienda */}
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-2">
            Tipo de Vivienda
          </label>
          <div className="grid grid-cols-2 gap-2">
            {housingTypeOptions.map(opt => {
              const isSelected = formData.housingType === opt.value;
              return (
                <label
                  key={opt.value}
                  className={`flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer transition-colors text-sm ${
                    isSelected
                      ? 'border-brand-navy bg-primary-50 text-brand-navy font-medium'
                      : 'border-gray-200 text-neutral-700 hover:border-gray-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="housingType"
                    value={opt.value}
                    checked={isSelected}
                    onChange={() => setFormData(prev => ({ ...prev, housingType: opt.value as HousingType }))}
                    className="h-3.5 w-3.5 text-brand-navy focus:ring-brand-navy border-neutral-300"
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-3 border-t border-gray-200">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-brand-navy text-white text-sm font-medium rounded-md hover:bg-brand-navy/90 focus:outline-none focus:ring-2 focus:ring-brand-navy focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Guardando...' : 'Guardar Datos Personales'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PersonalDataForm;