import React, { useState, useEffect } from 'react';
import { PersonalData, SituacionLaboral } from '../../types/personal';
import { personalDataService } from '../../services/personalDataService';
import toast from 'react-hot-toast';

interface PersonalDataFormProps {
  onDataSaved?: (data: PersonalData) => void;
}

const PersonalDataForm: React.FC<PersonalDataFormProps> = ({ onDataSaved }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    apellidos: '',
    dni: '',
    direccion: '',
    situacionPersonal: 'soltero' as PersonalData['situacionPersonal'],
    situacionLaboral: [] as SituacionLaboral[]
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
          situacionLaboral: data.situacionLaboral
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
    const newSituaciones = checked
      ? [...formData.situacionLaboral, situacion]
      : formData.situacionLaboral.filter(s => s !== situacion);

    // Validate the combination
    const validation = personalDataService.validateSituacionLaboral(newSituaciones);
    if (!validation.isValid) {
      toast.error(validation.error!);
      return;
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
            <div className="btn-secondary-horizon atlas-atlas-atlas-btn-primary mt-3 p-3 ">
              <p className="text-sm text-blue-700">
                <strong>Secciones que se mostrarán:</strong>
                {formData.situacionLaboral.includes('asalariado') && ' Nómina,'}
                {formData.situacionLaboral.includes('autonomo') && ' Autónomo,'}
                {' Planes de Pensiones e Inversiones, Otros Ingresos'}
              </p>
            </div>
          )}
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