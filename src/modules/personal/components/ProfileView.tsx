import React, { useState, useEffect } from 'react';
import { PersonalData, SituacionLaboral, MaritalStatus, HousingType, NivelDiscapacidad, TipoTributacion, Descendiente, Ascendiente } from '../../../types/personal';
import { personalDataService } from '../../../services/personalDataService';
import { personalExpensesService } from '../../../services/personalExpensesService';
import toast from 'react-hot-toast';

interface ProfileViewProps {
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

const isMarried = (ms: MaritalStatus | undefined) =>
  ms === 'married';

const ProfileView: React.FC<ProfileViewProps> = ({ onDataSaved }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<{
    nombre: string;
    apellidos: string;
    dni: string;
    direccion: string;
    situacionPersonal: PersonalData['situacionPersonal'];
    situacionLaboral: SituacionLaboral[];
    situacionLaboralConyugue: SituacionLaboral[];
    maritalStatus: MaritalStatus | undefined;
    spouseName: string;
    housingType: HousingType | undefined;
    hasVehicle: boolean;
    hasChildren: boolean | number;
    comunidadAutonoma: string;
    // IRPF personal minimums
    descendientes: Descendiente[];
    ascendientes: Ascendiente[];
    discapacidad: NivelDiscapacidad;
    tributacion: TipoTributacion;
    tieneAscendientes: boolean;
  }>({
    nombre: '',
    apellidos: '',
    dni: '',
    direccion: '',
    situacionPersonal: 'soltero',
    situacionLaboral: [],
    situacionLaboralConyugue: [],
    maritalStatus: undefined,
    spouseName: '',
    housingType: undefined,
    hasVehicle: false,
    hasChildren: false,
    comunidadAutonoma: '',
    descendientes: [],
    ascendientes: [],
    discapacidad: 'ninguna',
    tributacion: 'individual',
    tieneAscendientes: false,
  });

  const situacionLaboralOptions = [
    { value: 'asalariado', label: 'Asalariado' },
    { value: 'autonomo', label: 'Autónomo' },
    { value: 'jubilado', label: 'Pensionista' },
    { value: 'desempleado', label: 'Desempleado' },
  ];

  const maritalStatusOptions: { value: MaritalStatus; label: string }[] = [
    { value: 'single', label: 'Soltero/a' },
    { value: 'married', label: 'Casado/a o Pareja de hecho' },
    { value: 'divorced', label: 'Divorciado/a o Separado/a' },
    { value: 'widowed', label: 'Viudo/a' },
  ];

  const comunidadesAutonomas = [
    'Andalucía',
    'Aragón',
    'Asturias (Principado de)',
    'Baleares (Illes)',
    'Canarias',
    'Cantabria',
    'Castilla-La Mancha',
    'Castilla y León',
    'Cataluña',
    'Comunidad Valenciana',
    'Extremadura',
    'Galicia',
    'La Rioja',
    'Madrid (Comunidad de)',
    'Murcia (Región de)',
    'Navarra (Comunidad Foral de)',
    'País Vasco',
  ];

  const housingTypeOptions: { value: HousingType; label: string }[] = [
    { value: 'rent', label: 'Alquiler' },
    { value: 'ownership_with_mortgage', label: 'Hipoteca' },
    { value: 'ownership_without_mortgage', label: 'Libre' },
    { value: 'living_with_parents', label: 'Familiar' },
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
          situacionLaboralConyugue: data.situacionLaboralConyugue ?? [],
          maritalStatus: data.maritalStatus,
          spouseName: data.spouseName ?? '',
          housingType: data.housingType,
          hasVehicle: data.hasVehicle ?? false,
          hasChildren: data.hasChildren ?? false,
          comunidadAutonoma: data.comunidadAutonoma ?? '',
          descendientes: data.descendientes ?? [],
          ascendientes: data.ascendientes ?? [],
          discapacidad: data.discapacidad ?? 'ninguna',
          tributacion: data.tributacion ?? 'individual',
          tieneAscendientes: (data.ascendientes?.length ?? 0) > 0,
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
      ? formData.situacionLaboral.includes(situacion)
        ? formData.situacionLaboral
        : [...formData.situacionLaboral, situacion]
      : formData.situacionLaboral.filter(s => s !== situacion);
    setFormData(prev => ({ ...prev, situacionLaboral: newSituaciones }));
  };

  const handleSituacionLaboralConyugueChange = (situacion: SituacionLaboral, checked: boolean) => {
    const newSituaciones = checked
      ? formData.situacionLaboralConyugue.includes(situacion)
        ? formData.situacionLaboralConyugue
        : [...formData.situacionLaboralConyugue, situacion]
      : formData.situacionLaboralConyugue.filter(s => s !== situacion);
    setFormData(prev => ({ ...prev, situacionLaboralConyugue: newSituaciones }));
  };

  const maritalToSituacionPersonal = (ms: MaritalStatus | undefined): PersonalData['situacionPersonal'] => {
    if (ms === 'married') return 'casado';
    if (ms === 'divorced') return 'divorciado';
    return 'soltero';
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
      const dataToSave: Omit<PersonalData, 'id' | 'fechaCreacion' | 'fechaActualizacion'> = {
        ...formData,
        situacionPersonal: maritalToSituacionPersonal(formData.maritalStatus),
        spouseName: isMarried(formData.maritalStatus) ? formData.spouseName : undefined,
        descendientes: formData.hasChildren ? formData.descendientes : [],
        ascendientes: formData.tieneAscendientes ? formData.ascendientes : [],
        discapacidad: formData.discapacidad,
        tributacion: formData.tributacion,
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

  const married = isMarried(formData.maritalStatus);
  const spouseLabel = formData.spouseName?.trim()
    ? `Situación Laboral de ${formData.spouseName.trim()}`
    : 'Situación Laboral del Cónyuge/Pareja';

  const employmentButtonClass = (isSelected: boolean) =>
    `flex items-center gap-1.5 px-2 py-1.5 border rounded cursor-pointer transition-colors text-xs ${
      isSelected
        ? 'border-brand-navy bg-primary-50 text-brand-navy font-medium'
        : 'border-gray-200 text-neutral-700 hover:border-gray-400'
    }`;

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

        {/* Row 2 – Estado Civil + Comunidad Autónoma + ¿Hijos? */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">
              Estado Civil
            </label>
            <select
              value={formData.maritalStatus ?? ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                maritalStatus: (e.target.value as MaritalStatus) || undefined,
                spouseName: (e.target.value === 'married') ? prev.spouseName : '',
              }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            >
              <option value="">— Selecciona —</option>
              {maritalStatusOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">
              Comunidad Autónoma
            </label>
            <select
              value={formData.comunidadAutonoma}
              onChange={(e) => setFormData(prev => ({ ...prev, comunidadAutonoma: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            >
              <option value="">— Selecciona —</option>
              {comunidadesAutonomas.map(ccaa => (
                <option key={ccaa} value={ccaa}>{ccaa}</option>
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

        {/* Descendientes — expandable when hasChildren is true */}
        {!!formData.hasChildren && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Descendientes a cargo</h4>
              <button
                type="button"
                onClick={() => {
                  const newDesc: Descendiente = { id: Date.now().toString(), fechaNacimiento: '', discapacidad: 'ninguna' };
                  setFormData(prev => ({ ...prev, descendientes: [...prev.descendientes, newDesc] }));
                }}
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                + Añadir hijo/a
              </button>
            </div>
            {formData.descendientes.map((d, i) => (
              <div key={d.id} className="grid grid-cols-2 gap-3 items-end border-t border-gray-200 pt-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de nacimiento</label>
                  <input
                    type="date"
                    value={d.fechaNacimiento}
                    onChange={e => {
                      const updated = [...formData.descendientes];
                      updated[i] = { ...d, fechaNacimiento: e.target.value };
                      setFormData(prev => ({ ...prev, descendientes: updated }));
                    }}
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Discapacidad</label>
                  <select
                    value={d.discapacidad}
                    onChange={e => {
                      const updated = [...formData.descendientes];
                      updated[i] = { ...d, discapacidad: e.target.value as NivelDiscapacidad };
                      setFormData(prev => ({ ...prev, descendientes: updated }));
                    }}
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md"
                  >
                    <option value="ninguna">Sin discapacidad</option>
                    <option value="hasta33">Hasta 33%</option>
                    <option value="entre33y65">Entre 33% y 65%</option>
                    <option value="mas65">Más del 65%</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, descendientes: prev.descendientes.filter((_, j) => j !== i) }))}
                  className="text-xs text-red-500 hover:underline col-span-2"
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Row 3 – Spouse name (conditional) */}
        {married && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">
                Nombre del cónyuge / pareja
              </label>
              <input
                type="text"
                value={formData.spouseName}
                onChange={(e) => setFormData(prev => ({ ...prev, spouseName: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                placeholder="Nombre de tu pareja"
              />
            </div>
          </div>
        )}

        {/* Row 4 – Employment status (side-by-side with spouse when married) */}
        <div className={married ? 'grid grid-cols-2 gap-4' : ''}>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">
              Situación Laboral <span className="text-error-500">*</span>
              <span className="text-neutral-400 font-normal ml-1">(selección múltiple)</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {situacionLaboralOptions.map(option => {
                const isSelected = formData.situacionLaboral.includes(option.value as SituacionLaboral);
                return (
                  <label key={option.value} className={employmentButtonClass(isSelected)}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleSituacionLaboralChange(option.value as SituacionLaboral, e.target.checked)}
                      className="h-3 w-3 text-brand-navy focus:ring-brand-navy border-neutral-300 rounded"
                    />
                    {option.label}
                  </label>
                );
              })}
            </div>
          </div>

          {married && (
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                {spouseLabel}
                <span className="text-neutral-400 font-normal ml-1">(selección múltiple)</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {situacionLaboralOptions.map(option => {
                  const isSelected = formData.situacionLaboralConyugue.includes(option.value as SituacionLaboral);
                  return (
                    <label key={option.value} className={employmentButtonClass(isSelected)}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleSituacionLaboralConyugueChange(option.value as SituacionLaboral, e.target.checked)}
                        className="h-3 w-3 text-brand-navy focus:ring-brand-navy border-neutral-300 rounded"
                      />
                      {option.label}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Row 5 – Tipo de Vivienda + Vehículo propio */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">
              Tipo de Vivienda
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {housingTypeOptions.map(opt => {
                const isSelected = formData.housingType === opt.value;
                return (
                  <label key={opt.value} className={employmentButtonClass(isSelected)}>
                    <input
                      type="radio"
                      name="housingType"
                      value={opt.value}
                      checked={isSelected}
                      onChange={() => setFormData(prev => ({ ...prev, housingType: opt.value as HousingType }))}
                      className="h-3 w-3 text-brand-navy focus:ring-brand-navy border-neutral-300"
                    />
                    {opt.label}
                  </label>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col justify-end">
            <Toggle
              checked={!!formData.hasVehicle}
              onChange={() => setFormData(prev => ({ ...prev, hasVehicle: !prev.hasVehicle }))}
              label="¿Tienes vehículo propio?"
              description="Activa gastos de gasolina, seguro y mantenimiento"
            />
          </div>
        </div>

        {/* IRPF — Ascendientes a cargo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col justify-end">
            <Toggle
              checked={formData.tieneAscendientes}
              onChange={() => setFormData(prev => ({ ...prev, tieneAscendientes: !prev.tieneAscendientes }))}
              label="¿Ascendientes a cargo?"
              description="Padres/abuelos que conviven contigo (mínimo IRPF)"
            />
          </div>
        </div>

        {formData.tieneAscendientes && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Ascendientes a cargo</h4>
              <button
                type="button"
                onClick={() => {
                  const newAsc: Ascendiente = { id: Date.now().toString(), edad: 65, convive: true, discapacidad: 'ninguna' };
                  setFormData(prev => ({ ...prev, ascendientes: [...prev.ascendientes, newAsc] }));
                }}
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                + Añadir ascendiente
              </button>
            </div>
            {formData.ascendientes.map((a, i) => (
              <div key={a.id} className="grid grid-cols-3 gap-3 items-end border-t border-gray-200 pt-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Edad</label>
                  <input
                    type="number"
                    value={a.edad}
                    min={0}
                    max={120}
                    onChange={e => {
                      const updated = [...formData.ascendientes];
                      updated[i] = { ...a, edad: Number(e.target.value) };
                      setFormData(prev => ({ ...prev, ascendientes: updated }));
                    }}
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Discapacidad</label>
                  <select
                    value={a.discapacidad}
                    onChange={e => {
                      const updated = [...formData.ascendientes];
                      updated[i] = { ...a, discapacidad: e.target.value as NivelDiscapacidad };
                      setFormData(prev => ({ ...prev, ascendientes: updated }));
                    }}
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md"
                  >
                    <option value="ninguna">Sin discapacidad</option>
                    <option value="hasta33">Hasta 33%</option>
                    <option value="entre33y65">Entre 33% y 65%</option>
                    <option value="mas65">Más del 65%</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pb-1.5">
                  <input
                    type="checkbox"
                    id={`convive-${i}`}
                    checked={a.convive}
                    onChange={e => {
                      const updated = [...formData.ascendientes];
                      updated[i] = { ...a, convive: e.target.checked };
                      setFormData(prev => ({ ...prev, ascendientes: updated }));
                    }}
                    className="h-3.5 w-3.5 text-brand-navy border-gray-300 rounded"
                  />
                  <label htmlFor={`convive-${i}`} className="text-xs text-gray-600">Convive</label>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, ascendientes: prev.ascendientes.filter((_, j) => j !== i) }))}
                  className="text-xs text-red-500 hover:underline col-span-3"
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        )}

        {/* IRPF — Discapacidad y Tributación */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">
              Discapacidad del contribuyente
            </label>
            <select
              value={formData.discapacidad}
              onChange={e => setFormData(prev => ({ ...prev, discapacidad: e.target.value as NivelDiscapacidad }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            >
              <option value="ninguna">Sin discapacidad</option>
              <option value="hasta33">Hasta 33%</option>
              <option value="entre33y65">Entre 33% y 65%</option>
              <option value="mas65">Más del 65%</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">
              Tributación IRPF
            </label>
            <select
              value={formData.tributacion}
              onChange={e => setFormData(prev => ({ ...prev, tributacion: e.target.value as TipoTributacion }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            >
              <option value="individual">Individual</option>
              <option value="conjunta">Conjunta</option>
            </select>
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

export default ProfileView;
