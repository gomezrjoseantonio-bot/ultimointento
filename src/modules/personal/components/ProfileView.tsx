import React, { useState, useEffect } from 'react';
import { User, Home, FileText, Info } from 'lucide-react';
import { PersonalData, SituacionLaboral, MaritalStatus, HousingType, NivelDiscapacidad, TipoTributacion, Descendiente, Ascendiente } from '../../../types/personal';
import { personalDataService } from '../../../services/personalDataService';
import { patronGastosPersonalesService } from '../../../services/patronGastosPersonalesService';
import toast from 'react-hot-toast';

interface ProfileViewProps {
  onDataSaved?: (data: PersonalData) => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  fontSize: '0.875rem',
  border: '1px solid var(--hz-neutral-300)',
  borderRadius: '0.375rem',
  outline: 'none',
  color: 'var(--atlas-navy-1)',
  backgroundColor: '#fff',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 500,
  color: 'var(--text-gray)',
  marginBottom: '0.25rem',
};

const Toggle: React.FC<{
  checked: boolean;
  onChange: () => void;
  label: string;
  description?: string;
}> = ({ checked, onChange, label, description }) => (
  <div
    className="flex items-center justify-between p-3 rounded-lg h-full"
    style={{ border: '1px solid var(--hz-neutral-300)' }}
  >
    <div className="mr-3">
      <p className="text-sm font-medium" style={{ color: 'var(--atlas-navy-1)' }}>{label}</p>
      {description && <p className="text-xs mt-0.5" style={{ color: 'var(--text-gray)' }}>{description}</p>}
    </div>
    <button
      type="button"
      onClick={onChange}
      className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2"
      style={{
        backgroundColor: checked ? 'var(--atlas-blue)' : '#D1D5DB',
        ...({ '--tw-ring-color': 'var(--atlas-blue)' } as React.CSSProperties & Record<string, string>),
      }}
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
    fechaNacimiento: string;
    discapacidad: NivelDiscapacidad;
    tributacion: TipoTributacion;
    tieneAscendientes: boolean;
  }>({
    nombre: '',
    apellidos: '',
    dni: '',
    fechaNacimiento: '',
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
          fechaNacimiento: data.fechaNacimiento ?? '',
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
        fechaNacimiento: formData.fechaNacimiento || undefined,
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
          await patronGastosPersonalesService.smartSyncTemplatePatrones(savedData.id, savedData);
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
      <div className="bg-white rounded-lg p-6" style={{ border: '1px solid var(--hz-neutral-300)' }}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin h-8 w-8 rounded-full border-2 border-t-transparent" style={{ borderColor: 'var(--atlas-blue)' }}></div>
          <span className="ml-2 text-sm" style={{ color: 'var(--text-gray)' }}>Cargando datos personales...</span>
        </div>
      </div>
    );
  }

  const married = isMarried(formData.maritalStatus);
  const spouseLabel = formData.spouseName?.trim()
    ? `Situación Laboral de ${formData.spouseName.trim()}`
    : 'Situación Laboral del Cónyuge/Pareja';

  const employmentButtonStyle = (isSelected: boolean): React.CSSProperties =>
    isSelected
      ? {
          display: 'flex', alignItems: 'center', gap: '0.375rem',
          padding: '0.375rem 0.5rem', borderRadius: '0.25rem', cursor: 'pointer',
          fontSize: '0.75rem', fontWeight: 500,
          border: '1px solid var(--atlas-blue)',
          backgroundColor: 'rgba(4, 44, 94, 0.05)',
          color: 'var(--atlas-blue)',
        }
      : {
          display: 'flex', alignItems: 'center', gap: '0.375rem',
          padding: '0.375rem 0.5rem', borderRadius: '0.25rem', cursor: 'pointer',
          fontSize: '0.75rem',
          border: '1px solid var(--hz-neutral-300)',
          color: 'var(--atlas-navy-1)',
        };

  const sectionStyle: React.CSSProperties = {
    border: '1px solid var(--hz-neutral-300)',
    borderRadius: '0.5rem',
    backgroundColor: '#fff',
    padding: '1.25rem',
  };

  const sectionHeaderIconStyle: React.CSSProperties = {
    color: 'var(--atlas-blue)',
  };

  return (
    <div className="bg-white rounded-lg p-6" style={{ border: '1px solid var(--hz-neutral-300)' }}>
      <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--atlas-navy-1)' }}>Perfil de Usuario</h2>
      <p className="text-sm mb-5" style={{ color: 'var(--text-gray)' }}>
        Personaliza ATLAS según tu situación personal y laboral.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── Section 1: Datos Personales ── */}
        <div style={sectionStyle}>
          <div className="flex items-start gap-2 mb-1">
            <User size={20} strokeWidth={1.5} style={sectionHeaderIconStyle} />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--atlas-navy-1)' }}>Datos Personales</p>
              <p className="text-sm" style={{ color: 'var(--text-gray)' }}>Tu identidad en ATLAS</p>
            </div>
          </div>
          <div className="space-y-4 mt-4">
            {/* Nombre + Apellidos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label style={labelStyle}>
                  Nombre <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                  style={inputStyle}
                  placeholder="Tu nombre"
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>
                  Apellidos <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={formData.apellidos}
                  onChange={(e) => setFormData(prev => ({ ...prev, apellidos: e.target.value }))}
                  style={inputStyle}
                  placeholder="Tus apellidos"
                  required
                />
              </div>
            </div>

            {/* NIF + Fecha nacimiento */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label style={labelStyle}>NIF / NIE</label>
                <input
                  type="text"
                  value={formData.dni}
                  onChange={(e) => setFormData(prev => ({ ...prev, dni: e.target.value }))}
                  style={inputStyle}
                  placeholder="Ej: 12345678X"
                />
              </div>
              <div>
                <label style={labelStyle}>Fecha de nacimiento</label>
                <input
                  type="date"
                  value={formData.fechaNacimiento}
                  onChange={(e) => setFormData(prev => ({ ...prev, fechaNacimiento: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Estado Civil */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label style={labelStyle}>Estado Civil</label>
                <select
                  value={formData.maritalStatus ?? ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    maritalStatus: (e.target.value as MaritalStatus) || undefined,
                    spouseName: (e.target.value === 'married') ? prev.spouseName : '',
                  }))}
                  style={inputStyle}
                >
                  <option value="">— Selecciona —</option>
                  {maritalStatusOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Nombre cónyuge (conditional) */}
            {married && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>Nombre del cónyuge / pareja</label>
                  <input
                    type="text"
                    value={formData.spouseName}
                    onChange={(e) => setFormData(prev => ({ ...prev, spouseName: e.target.value }))}
                    style={inputStyle}
                    placeholder="Nombre de tu pareja"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Section 2: Tu situación y estilo de vida ── */}
        <div style={sectionStyle}>
          <div className="flex items-start gap-2 mb-1">
            <Home size={20} strokeWidth={1.5} style={sectionHeaderIconStyle} />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--atlas-navy-1)' }}>Tu situación y estilo de vida</p>
              <p className="text-sm" style={{ color: 'var(--text-gray)' }}>Personaliza los módulos de ingresos y gastos de ATLAS</p>
            </div>
          </div>
          <div className="space-y-4 mt-4">

            {/* Situación Laboral (side-by-side with spouse when married) */}
            <div className={married ? 'grid grid-cols-2 gap-4' : ''}>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-gray)' }}>
                  Situación Laboral <span style={{ color: 'var(--error)' }}>*</span>
                  <span className="font-normal ml-1" style={{ color: 'var(--text-gray)' }}>(selección múltiple)</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {situacionLaboralOptions.map(option => {
                    const isSelected = formData.situacionLaboral.includes(option.value as SituacionLaboral);
                    return (
                      <label key={option.value} style={employmentButtonStyle(isSelected)}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleSituacionLaboralChange(option.value as SituacionLaboral, e.target.checked)}
                          className="h-3 w-3 rounded"
                          style={{ borderColor: 'var(--hz-neutral-300)' }}
                        />
                        {option.label}
                      </label>
                    );
                  })}
                </div>
                <p className="flex items-center gap-1 text-xs mt-1.5" style={{ color: 'var(--text-gray)' }}>
                  <Info size={14} strokeWidth={1.5} style={{ color: 'var(--text-gray)', flexShrink: 0 }} />
                  Activa las pestañas de Nómina, Autónomos o Pensión en el módulo Personal
                </p>
              </div>

              {married && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-gray)' }}>
                    {spouseLabel}
                    <span className="font-normal ml-1" style={{ color: 'var(--text-gray)' }}>(selección múltiple)</span>
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {situacionLaboralOptions.map(option => {
                      const isSelected = formData.situacionLaboralConyugue.includes(option.value as SituacionLaboral);
                      return (
                        <label key={option.value} style={employmentButtonStyle(isSelected)}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleSituacionLaboralConyugueChange(option.value as SituacionLaboral, e.target.checked)}
                            className="h-3 w-3 rounded"
                            style={{ borderColor: 'var(--hz-neutral-300)' }}
                          />
                          {option.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Tipo de Vivienda + Dirección */}
            <div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-gray)' }}>
                    Tipo de Vivienda
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {housingTypeOptions.map(opt => {
                      const isSelected = formData.housingType === opt.value;
                      return (
                        <label key={opt.value} style={employmentButtonStyle(isSelected)}>
                          <input
                            type="radio"
                            name="housingType"
                            value={opt.value}
                            checked={isSelected}
                            onChange={() => setFormData(prev => ({ ...prev, housingType: opt.value as HousingType }))}
                            className="h-3 w-3"
                            style={{ borderColor: 'var(--hz-neutral-300)' }}
                          />
                          {opt.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="md:col-span-3">
                  <label style={labelStyle}>Dirección de la vivienda</label>
                  <input
                    type="text"
                    value={formData.direccion}
                    onChange={(e) => setFormData(prev => ({ ...prev, direccion: e.target.value }))}
                    style={inputStyle}
                    placeholder="Ej: C/ Gran Vía 15, Pozuelo de Alarcón"
                  />
                </div>
              </div>
              <p className="flex items-center gap-1 text-xs mt-1.5" style={{ color: 'var(--text-gray)' }}>
                <Info size={14} strokeWidth={1.5} style={{ color: 'var(--text-gray)', flexShrink: 0 }} />
                Activa gastos de vivienda (alquiler, luz, agua, gas). La dirección ayuda a identificar tus recibos bancarios.
              </p>
            </div>

            {/* Vehículo propio */}
            <Toggle
              checked={!!formData.hasVehicle}
              onChange={() => setFormData(prev => ({ ...prev, hasVehicle: !prev.hasVehicle }))}
              label="¿Tienes vehículo propio?"
              description="Activa gastos de gasolina, seguro y taller. Desactiva abono de transporte público."
            />

            {/* ¿Hijos? + Descendientes */}
            <div>
              <Toggle
                checked={!!formData.hasChildren}
                onChange={() => setFormData(prev => ({ ...prev, hasChildren: !prev.hasChildren }))}
                label="¿Hijos o personas a cargo?"
                description="Activa gastos de colegio, guardería, extraescolares y ropa infantil. También activa mínimos personales IRPF por descendientes."
              />
              {!!formData.hasChildren && (
                <div className="mt-3 rounded-lg p-4 space-y-3" style={{ backgroundColor: 'var(--hz-neutral-100)', border: '1px solid var(--hz-neutral-300)' }}>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--atlas-navy-1)' }}>Descendientes a cargo</h4>
                    <button
                      type="button"
                      onClick={() => {
                        const newDesc: Descendiente = { id: Date.now().toString(), fechaNacimiento: '', discapacidad: 'ninguna' };
                        setFormData(prev => ({ ...prev, descendientes: [...prev.descendientes, newDesc] }));
                      }}
                      className="text-xs font-medium hover:underline"
                      style={{ color: 'var(--atlas-blue)' }}
                    >
                      + Añadir hijo/a
                    </button>
                  </div>
                  {formData.descendientes.map((d, i) => (
                    <div key={d.id} className="grid grid-cols-2 gap-3 items-end pt-3" style={{ borderTop: '1px solid var(--hz-neutral-300)' }}>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-gray)' }}>Fecha de nacimiento</label>
                        <input
                          type="date"
                          value={d.fechaNacimiento}
                          onChange={e => {
                            const updated = [...formData.descendientes];
                            updated[i] = { ...d, fechaNacimiento: e.target.value };
                            setFormData(prev => ({ ...prev, descendientes: updated }));
                          }}
                          className="w-full px-2 py-1.5 text-sm rounded-md"
                          style={{ border: '1px solid var(--hz-neutral-300)' }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-gray)' }}>Discapacidad</label>
                        <select
                          value={d.discapacidad}
                          onChange={e => {
                            const updated = [...formData.descendientes];
                            updated[i] = { ...d, discapacidad: e.target.value as NivelDiscapacidad };
                            setFormData(prev => ({ ...prev, descendientes: updated }));
                          }}
                          className="w-full px-2 py-1.5 text-sm rounded-md"
                          style={{ border: '1px solid var(--hz-neutral-300)' }}
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
                        className="text-xs hover:underline col-span-2"
                        style={{ color: 'var(--error)' }}
                      >
                        Eliminar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Section 3: Datos fiscales (IRPF) ── */}
        <div style={sectionStyle}>
          <div className="flex items-start gap-2 mb-1">
            <FileText size={20} strokeWidth={1.5} style={sectionHeaderIconStyle} />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--atlas-navy-1)' }}>Datos fiscales (IRPF)</p>
              <p className="text-sm" style={{ color: 'var(--text-gray)' }}>Para el cálculo de tu declaración de la renta</p>
            </div>
          </div>
          <div className="space-y-4 mt-4">

            {/* Comunidad Autónoma + Tributación */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label style={labelStyle}>Comunidad Autónoma</label>
                <select
                  value={formData.comunidadAutonoma}
                  onChange={(e) => setFormData(prev => ({ ...prev, comunidadAutonoma: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">— Selecciona —</option>
                  {comunidadesAutonomas.map(ccaa => (
                    <option key={ccaa} value={ccaa}>{ccaa}</option>
                  ))}
                </select>
                <p className="flex items-center gap-1 text-xs mt-1" style={{ color: 'var(--text-gray)' }}>
                  <Info size={14} strokeWidth={1.5} style={{ color: 'var(--text-gray)', flexShrink: 0 }} />
                  Determina los tramos autonómicos y deducciones aplicables.
                </p>
              </div>
              <div>
                <label style={labelStyle}>Tributación IRPF</label>
                <select
                  value={formData.tributacion}
                  onChange={e => setFormData(prev => ({ ...prev, tributacion: e.target.value as TipoTributacion }))}
                  style={inputStyle}
                >
                  <option value="individual">Individual</option>
                  <option value="conjunta">Conjunta</option>
                </select>
              </div>
            </div>

            {/* Discapacidad */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label style={labelStyle}>Discapacidad del contribuyente</label>
                <select
                  value={formData.discapacidad}
                  onChange={e => setFormData(prev => ({ ...prev, discapacidad: e.target.value as NivelDiscapacidad }))}
                  style={inputStyle}
                >
                  <option value="ninguna">Sin discapacidad</option>
                  <option value="hasta33">Hasta 33%</option>
                  <option value="entre33y65">Entre 33% y 65%</option>
                  <option value="mas65">Más del 65%</option>
                </select>
              </div>
            </div>

            {/* Ascendientes */}
            <div>
              <Toggle
                checked={formData.tieneAscendientes}
                onChange={() => setFormData(prev => ({ ...prev, tieneAscendientes: !prev.tieneAscendientes }))}
                label="¿Ascendientes a cargo?"
                description="Padres/abuelos que conviven contigo (+65 años). Genera mínimos personales en el IRPF."
              />
              {formData.tieneAscendientes && (
                <div className="mt-3 rounded-lg p-4 space-y-3" style={{ backgroundColor: 'var(--hz-neutral-100)', border: '1px solid var(--hz-neutral-300)' }}>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--atlas-navy-1)' }}>Ascendientes a cargo</h4>
                    <button
                      type="button"
                      onClick={() => {
                        const newAsc: Ascendiente = { id: Date.now().toString(), edad: 65, convive: true, discapacidad: 'ninguna' };
                        setFormData(prev => ({ ...prev, ascendientes: [...prev.ascendientes, newAsc] }));
                      }}
                      className="text-xs font-medium hover:underline"
                      style={{ color: 'var(--atlas-blue)' }}
                    >
                      + Añadir ascendiente
                    </button>
                  </div>
                  {formData.ascendientes.map((a, i) => (
                    <div key={a.id} className="grid grid-cols-3 gap-3 items-end pt-3" style={{ borderTop: '1px solid var(--hz-neutral-300)' }}>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-gray)' }}>Edad</label>
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
                          className="w-full px-2 py-1.5 text-sm rounded-md"
                          style={{ border: '1px solid var(--hz-neutral-300)' }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-gray)' }}>Discapacidad</label>
                        <select
                          value={a.discapacidad}
                          onChange={e => {
                            const updated = [...formData.ascendientes];
                            updated[i] = { ...a, discapacidad: e.target.value as NivelDiscapacidad };
                            setFormData(prev => ({ ...prev, ascendientes: updated }));
                          }}
                          className="w-full px-2 py-1.5 text-sm rounded-md"
                          style={{ border: '1px solid var(--hz-neutral-300)' }}
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
                          className="h-3.5 w-3.5 rounded"
                          style={{ borderColor: 'var(--hz-neutral-300)' }}
                        />
                        <label htmlFor={`convive-${i}`} className="text-xs" style={{ color: 'var(--text-gray)' }}>Convive</label>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, ascendientes: prev.ascendientes.filter((_, j) => j !== i) }))}
                        className="text-xs hover:underline col-span-3"
                        style={{ color: 'var(--error)' }}
                      >
                        Eliminar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-3" style={{ borderTop: '1px solid var(--hz-neutral-300)' }}>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 text-white text-sm font-medium rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            style={{ backgroundColor: 'var(--atlas-blue)' }}
          >
            {saving ? 'Guardando...' : 'Guardar Datos Personales'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProfileView;
