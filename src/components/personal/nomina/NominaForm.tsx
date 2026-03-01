import React, { useState, useEffect } from 'react';
import { AtlasModal } from '../../atlas/AtlasComponents';
import { nominaService } from '../../../services/nominaService';
import { personalDataService } from '../../../services/personalDataService';
import { cuentasService } from '../../../services/cuentasService';
import { Account } from '../../../services/db';
import {
  Nomina,
  Variable,
  Bonus,
  ReglaDia,
  RetencionNomina,
  PlanPensionesNomina,
  BeneficioSocial,
  DeduccionNomina,
} from '../../../types/personal';
import { getBaseMaxima, getSSDefaults } from '../../../constants/cotizacionSS';
import { Plus, X, Settings } from 'lucide-react';
import toast from 'react-hot-toast';

interface NominaFormProps {
  isOpen: boolean;
  onClose: () => void;
  nomina?: Nomina | null;
  onSaved: (nomina: Nomina) => void;
}

const CURRENT_YEAR = new Date().getFullYear();
const SS_DEFAULTS = getSSDefaults(CURRENT_YEAR);

function buildDefaultRetencion(): RetencionNomina {
  return {
    irpfPorcentaje: 24,
    ss: {
      baseCotizacionMensual: getBaseMaxima(CURRENT_YEAR),
      contingenciasComunes: SS_DEFAULTS.contingenciasComunes.trabajador,
      desempleo: SS_DEFAULTS.desempleo.trabajador,
      formacionProfesional: SS_DEFAULTS.formacionProfesional.trabajador,
      mei: SS_DEFAULTS.mei.trabajador,
      overrideManual: false,
    },
  };
}

const NominaForm: React.FC<NominaFormProps> = ({ isOpen, onClose, nomina, onSaved }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [personalDataId, setPersonalDataId] = useState<number | null>(null);
  const [cuentas, setCuentas] = useState<Account[]>([]);

  const [formData, setFormData] = useState({
    titular: 'yo' as 'yo' | 'pareja',
    nombre: '',
    fechaAntiguedad: '',
    fechaAntiguedadReconocida: '',
    salarioBrutoAnual: '',
    distribucion: {
      tipo: 'doce' as 'doce' | 'catorce' | 'personalizado',
      meses: 12,
    },
    variables: [] as Variable[],
    bonus: [] as Bonus[],
    beneficiosSociales: [] as BeneficioSocial[],
    retencion: buildDefaultRetencion(),
    tienePlanPensiones: false,
    planPensiones: undefined as PlanPensionesNomina | undefined,
    deduccionesAdicionales: [] as DeduccionNomina[],
    cuentaAbono: 0,
    reglaCobroDia: { tipo: 'fijo', dia: 25 } as ReglaDia,
    activa: true,
  });

  const [showVariableForm, setShowVariableForm] = useState(false);
  const [showBonusForm, setShowBonusForm] = useState(false);
  const [showBeneficioForm, setShowBeneficioForm] = useState(false);
  const [showDeduccionForm, setShowDeduccionForm] = useState(false);
  const [editingVariable, setEditingVariable] = useState<Variable | null>(null);
  const [editingBonus, setEditingBonus] = useState<Bonus | null>(null);

  useEffect(() => {
    loadPersonalDataId();
    loadCuentas();
    if (nomina) {
      const retencionMigrated: RetencionNomina = nomina.retencion as any;
      setFormData({
        titular: nomina.titular ?? 'yo',
        nombre: nomina.nombre,
        fechaAntiguedad: nomina.fechaAntiguedad ?? '',
        fechaAntiguedadReconocida: nomina.fechaAntiguedadReconocida ?? '',
        salarioBrutoAnual: nomina.salarioBrutoAnual.toString(),
        distribucion: nomina.distribucion,
        variables: nomina.variables,
        bonus: nomina.bonus,
        beneficiosSociales: nomina.beneficiosSociales ?? [],
        retencion: retencionMigrated ?? buildDefaultRetencion(),
        tienePlanPensiones: !!nomina.planPensiones,
        planPensiones: nomina.planPensiones,
        deduccionesAdicionales: nomina.deduccionesAdicionales ?? [],
        cuentaAbono: nomina.cuentaAbono,
        reglaCobroDia: nomina.reglaCobroDia,
        activa: nomina.activa,
      });
    } else {
      setFormData({
        titular: 'yo',
        nombre: '',
        fechaAntiguedad: '',
        fechaAntiguedadReconocida: '',
        salarioBrutoAnual: '',
        distribucion: { tipo: 'doce', meses: 12 },
        variables: [],
        bonus: [],
        beneficiosSociales: [],
        retencion: buildDefaultRetencion(),
        tienePlanPensiones: false,
        planPensiones: undefined,
        deduccionesAdicionales: [],
        cuentaAbono: 0,
        reglaCobroDia: { tipo: 'fijo', dia: 25 },
        activa: true,
      });
      setStep(1);
    }
  }, [nomina, isOpen]);

  const loadPersonalDataId = async () => {
    try {
      const personalData = await personalDataService.getPersonalData();
      if (personalData?.id) setPersonalDataId(personalData.id);
    } catch (error) {
      console.error('Error loading personal data ID:', error);
    }
  };

  const loadCuentas = async () => {
    try {
      const allCuentas = await cuentasService.list();
      setCuentas(allCuentas.filter((c: Account) => c.activa));
    } catch (error) {
      console.error('Error loading cuentas:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personalDataId) {
      toast.error('Error: No se encontraron datos personales');
      return;
    }
    if (!formData.nombre || !formData.salarioBrutoAnual) {
      toast.error('Por favor, completa todos los campos obligatorios');
      return;
    }
    const salarioBrutoAnual = parseFloat(formData.salarioBrutoAnual);
    if (isNaN(salarioBrutoAnual) || salarioBrutoAnual <= 0) {
      toast.error('El salario bruto anual debe ser un número válido');
      return;
    }

    setLoading(true);
    try {
      const nominaData: Omit<Nomina, 'id' | 'fechaCreacion' | 'fechaActualizacion'> = {
        personalDataId,
        titular: formData.titular,
        nombre: formData.nombre,
        fechaAntiguedad: formData.fechaAntiguedad || new Date().toISOString().split('T')[0],
        fechaAntiguedadReconocida: formData.fechaAntiguedadReconocida || undefined,
        salarioBrutoAnual,
        distribucion: formData.distribucion,
        variables: formData.variables,
        bonus: formData.bonus,
        beneficiosSociales: formData.beneficiosSociales,
        retencion: formData.retencion,
        planPensiones: formData.tienePlanPensiones ? formData.planPensiones : undefined,
        deduccionesAdicionales: formData.deduccionesAdicionales,
        cuentaAbono: formData.cuentaAbono,
        reglaCobroDia: formData.reglaCobroDia,
        activa: formData.activa,
      };

      let savedNomina: Nomina;
      if (nomina?.id) {
        savedNomina = await nominaService.updateNomina(nomina.id, nominaData);
      } else {
        savedNomina = await nominaService.saveNomina(nominaData);
      }

      toast.success(nomina ? 'Nómina actualizada correctamente' : 'Nómina creada correctamente');
      onSaved(savedNomina);
      onClose();
    } catch (error) {
      console.error('Error saving nomina:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      toast.error(`Error al guardar la nómina: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddVariable = (variable: Variable) => {
    setFormData(prev => ({ ...prev, variables: [...prev.variables, { ...variable, id: Date.now().toString() }] }));
    setShowVariableForm(false);
    setEditingVariable(null);
  };
  const handleEditVariable = (variable: Variable) => { setEditingVariable(variable); setShowVariableForm(true); };
  const handleUpdateVariable = (updated: Variable) => {
    setFormData(prev => ({ ...prev, variables: prev.variables.map(v => v.id === updated.id ? updated : v) }));
    setShowVariableForm(false);
    setEditingVariable(null);
  };
  const handleDeleteVariable = (id: string) => setFormData(prev => ({ ...prev, variables: prev.variables.filter(v => v.id !== id) }));

  const handleAddBonus = (bonus: Bonus) => {
    setFormData(prev => ({ ...prev, bonus: [...prev.bonus, { ...bonus, id: Date.now().toString() }] }));
    setShowBonusForm(false);
    setEditingBonus(null);
  };
  const handleEditBonus = (bonus: Bonus) => { setEditingBonus(bonus); setShowBonusForm(true); };
  const handleUpdateBonus = (updated: Bonus) => {
    setFormData(prev => ({ ...prev, bonus: prev.bonus.map(b => b.id === updated.id ? updated : b) }));
    setShowBonusForm(false);
    setEditingBonus(null);
  };
  const handleDeleteBonus = (id: string) => setFormData(prev => ({ ...prev, bonus: prev.bonus.filter(b => b.id !== id) }));

  const handleAddBeneficio = (beneficio: BeneficioSocial) => {
    setFormData(prev => ({ ...prev, beneficiosSociales: [...prev.beneficiosSociales, beneficio] }));
    setShowBeneficioForm(false);
  };
  const handleDeleteBeneficio = (id: string) => setFormData(prev => ({ ...prev, beneficiosSociales: prev.beneficiosSociales.filter(b => b.id !== id) }));

  const handleAddDeduccion = (deduccion: DeduccionNomina) => {
    setFormData(prev => ({ ...prev, deduccionesAdicionales: [...prev.deduccionesAdicionales, deduccion] }));
    setShowDeduccionForm(false);
  };
  const handleDeleteDeduccion = (id: string) => setFormData(prev => ({ ...prev, deduccionesAdicionales: prev.deduccionesAdicionales.filter(d => d.id !== id) }));

  const brutoBase = parseFloat(formData.salarioBrutoAnual) || 0;
  const totalVariables = formData.variables.reduce((sum, v) => {
    return sum + (v.tipo === 'porcentaje' ? (brutoBase * v.valor) / 100 : v.valor);
  }, 0);
  const totalBonus = formData.bonus.reduce((sum, b) => sum + b.importe, 0);
  const brutoTotal = brutoBase + totalVariables + totalBonus;

  const ssTotalMensual = (() => {
    const { ss, cuotaSolidaridadMensual = 0 } = formData.retencion;
    const pct = (ss.contingenciasComunes + ss.desempleo + ss.formacionProfesional + (ss.mei ?? 0)) / 100;
    return ss.baseCotizacionMensual * pct + cuotaSolidaridadMensual;
  })();

  const resetSSDefaults = () => {
    setFormData(prev => ({
      ...prev,
      retencion: {
        ...prev.retencion,
        ss: {
          ...prev.retencion.ss,
          baseCotizacionMensual: getBaseMaxima(CURRENT_YEAR),
          contingenciasComunes: SS_DEFAULTS.contingenciasComunes.trabajador,
          desempleo: SS_DEFAULTS.desempleo.trabajador,
          formacionProfesional: SS_DEFAULTS.formacionProfesional.trabajador,
          mei: SS_DEFAULTS.mei.trabajador,
          overrideManual: false,
        },
      },
    }));
  };

  const stepLabels = ['Retribución', 'Retención y Deducciones', 'Cobro y Resumen'];

  return (
    <>
      <AtlasModal
        isOpen={isOpen}
        onClose={onClose}
        title={nomina ? 'Editar Nómina' : 'Nueva Nómina'}
        size="xl"
      >
        <div className="flex items-center justify-between mb-4">
          {stepLabels.map((label, idx) => {
            const s = idx + 1;
            return (
              <React.Fragment key={s}>
                <button
                  type="button"
                  onClick={() => setStep(s)}
                  className={`flex flex-col items-center text-xs font-medium transition-colors ${
                    step === s ? 'text-brand-navy' : step > s ? 'text-success-600' : 'text-neutral-400'
                  }`}
                >
                  <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center mb-1 text-sm font-bold ${
                    step === s
                      ? 'border-brand-navy bg-brand-navy text-white'
                      : step > s
                      ? 'border-success-600 bg-success-50 text-success-600'
                      : 'border-neutral-300 text-neutral-400'
                  }`}>{s}</span>
                  <span className="hidden sm:block">{label}</span>
                </button>
                {idx < stepLabels.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${step > s ? 'bg-success-400' : 'bg-neutral-200'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <form onSubmit={handleSubmit}>
          {step === 1 && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Titular *</label>
                  <select
                    value={formData.titular}
                    onChange={(e) => setFormData(prev => ({ ...prev, titular: e.target.value as 'yo' | 'pareja' }))}
                    className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy px-3 py-2"
                  >
                    <option value="yo">Yo</option>
                    <option value="pareja">Pareja</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Nombre de la Nómina *</label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                    className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy px-3 py-2"
                    placeholder="Ej: Nómina Principal"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Fecha de Antigüedad *</label>
                  <input
                    type="date"
                    value={formData.fechaAntiguedad}
                    onChange={(e) => setFormData(prev => ({ ...prev, fechaAntiguedad: e.target.value }))}
                    className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Antigüedad Reconocida <span className="text-neutral-400 font-normal">(opcional)</span>
                  </label>
                  <input
                    type="date"
                    value={formData.fechaAntiguedadReconocida}
                    onChange={(e) => setFormData(prev => ({ ...prev, fechaAntiguedadReconocida: e.target.value }))}
                    className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Salario Bruto Anual Base (€) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.salarioBrutoAnual}
                  onChange={(e) => setFormData(prev => ({ ...prev, salarioBrutoAnual: e.target.value }))}
                  className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy px-3 py-2"
                  placeholder="50000.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-3">Distribución del Salario</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(['doce', 'catorce', 'personalizado'] as const).map((tipo) => (
                    <label key={tipo} className="flex items-center space-x-3 p-3 border border-neutral-200 rounded-lg cursor-pointer hover:bg-neutral-50">
                      <input
                        type="radio"
                        name="distribucion"
                        value={tipo}
                        checked={formData.distribucion.tipo === tipo}
                        onChange={() => setFormData(prev => ({
                          ...prev,
                          distribucion: { tipo, meses: tipo === 'doce' ? 12 : tipo === 'catorce' ? 14 : prev.distribucion.meses }
                        }))}
                        className="h-4 w-4 text-brand-navy focus:ring-brand-navy"
                      />
                      <span className="text-sm font-medium">
                        {tipo === 'doce' ? '12 meses' : tipo === 'catorce' ? '14 meses (pagas extra)' : 'Personalizado'}
                      </span>
                    </label>
                  ))}
                </div>
                {formData.distribucion.tipo === 'personalizado' && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Número de meses</label>
                    <input
                      type="number" min="1" max="24"
                      value={formData.distribucion.meses}
                      onChange={(e) => setFormData(prev => ({ ...prev, distribucion: { ...prev.distribucion, meses: parseInt(e.target.value) } }))}
                      className="w-32 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy px-3 py-2"
                    />
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-neutral-700">Variables Anuales</label>
                  <button type="button" onClick={() => setShowVariableForm(true)} className="inline-flex items-center atlas-btn-primary text-sm rounded-md">
                    <Plus className="w-4 h-4 mr-1" />Añadir Variable
                  </button>
                </div>
                {formData.variables.length > 0 && (
                  <div className="space-y-2">
                    {formData.variables.map(variable => (
                      <div key={variable.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                        <div>
                          <span className="font-medium">{variable.nombre}</span>
                          <span className="text-sm text-neutral-600 ml-2">({variable.tipo === 'porcentaje' ? `${variable.valor}%` : `${variable.valor}€`})</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button type="button" onClick={() => handleEditVariable(variable)} className="p-1 text-neutral-600 hover:text-brand-navy"><Settings className="w-4 h-4" /></button>
                          <button type="button" onClick={() => handleDeleteVariable(variable.id!)} className="p-1 text-neutral-600 hover:text-error-600"><X className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-neutral-700">Bonus Puntuales</label>
                  <button type="button" onClick={() => setShowBonusForm(true)} className="inline-flex items-center atlas-btn-primary text-sm rounded-md">
                    <Plus className="w-4 h-4 mr-1" />Añadir Bonus
                  </button>
                </div>
                {formData.bonus.length > 0 && (
                  <div className="space-y-2">
                    {formData.bonus.map(bonus => (
                      <div key={bonus.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                        <div>
                          <span className="font-medium">{bonus.descripcion}</span>
                          <span className="text-sm text-neutral-600 ml-2">{bonus.importe}€ - {new Date(2024, bonus.mes - 1).toLocaleDateString('es-ES', { month: 'long' })}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button type="button" onClick={() => handleEditBonus(bonus)} className="p-1 text-neutral-600 hover:text-brand-navy"><Settings className="w-4 h-4" /></button>
                          <button type="button" onClick={() => handleDeleteBonus(bonus.id!)} className="p-1 text-neutral-600 hover:text-error-600"><X className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-neutral-700">Beneficios Sociales (Especie)</label>
                  <button type="button" onClick={() => setShowBeneficioForm(true)} className="inline-flex items-center atlas-btn-primary text-sm rounded-md">
                    <Plus className="w-4 h-4 mr-1" />Añadir Beneficio
                  </button>
                </div>
                {formData.beneficiosSociales.length > 0 && (
                  <div className="space-y-2">
                    {formData.beneficiosSociales.map(b => (
                      <div key={b.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                        <div>
                          <span className="font-medium">{b.concepto}</span>
                          <span className="text-sm text-neutral-600 ml-2">{b.importeMensual}€/mes</span>
                          {b.incrementaBaseIRPF && <span className="text-xs text-amber-600 ml-2">+IRPF</span>}
                        </div>
                        <button type="button" onClick={() => handleDeleteBeneficio(b.id)} className="p-1 text-neutral-600 hover:text-error-600"><X className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-brand-navy/5 rounded-lg p-4">
                <p className="text-sm text-neutral-600">Bruto total anual estimado (base + variables + bonus)</p>
                <p className="text-xl font-bold text-brand-navy">{brutoTotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</p>
              </div>

              <div className="flex justify-end pt-2">
                <button type="button" onClick={() => setStep(2)} className="atlas-btn-primary rounded-md">Siguiente →</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-base font-semibold text-neutral-900">Retención IRPF</h3>
                <p className="text-sm text-neutral-500">Porcentaje de retención que figura en tu nómina.</p>
                <div className="flex items-center gap-3">
                  <input
                    type="number" step="0.01" min="0" max="50"
                    value={formData.retencion.irpfPorcentaje}
                    onChange={(e) => setFormData(prev => ({ ...prev, retencion: { ...prev.retencion, irpfPorcentaje: parseFloat(e.target.value) || 0 } }))}
                    className="w-28 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy px-3 py-2"
                    placeholder="24"
                  />
                  <span className="text-sm text-neutral-500">% (rango habitual: 15–45%)</span>
                </div>
              </div>

              <div className="space-y-3 border-t border-neutral-100 pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-semibold text-neutral-900">Seguridad Social</h3>
                    <span className="text-sm text-neutral-600">Total: <span className="font-semibold text-neutral-900">{ssTotalMensual.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €/mes</span></span>
                  </div>
                  <button type="button" onClick={resetSSDefaults} className="text-xs text-brand-navy underline hover:text-brand-navy/70">
                    Restaurar defaults {CURRENT_YEAR}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Base cotización mensual (€)</label>
                    <input
                      type="number" step="0.01" min="0"
                      value={formData.retencion.ss.baseCotizacionMensual}
                      onChange={(e) => setFormData(prev => ({ ...prev, retencion: { ...prev.retencion, ss: { ...prev.retencion.ss, baseCotizacionMensual: parseFloat(e.target.value) || 0, overrideManual: true } } }))}
                      className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Contingencias Comunes (%)</label>
                    <input
                      type="number" step="0.01" min="0"
                      value={formData.retencion.ss.contingenciasComunes}
                      onChange={(e) => setFormData(prev => ({ ...prev, retencion: { ...prev.retencion, ss: { ...prev.retencion.ss, contingenciasComunes: parseFloat(e.target.value) || 0, overrideManual: true } } }))}
                      className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Desempleo (%)</label>
                    <input
                      type="number" step="0.01" min="0"
                      value={formData.retencion.ss.desempleo}
                      onChange={(e) => setFormData(prev => ({ ...prev, retencion: { ...prev.retencion, ss: { ...prev.retencion.ss, desempleo: parseFloat(e.target.value) || 0, overrideManual: true } } }))}
                      className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Formación Profesional (%)</label>
                    <input
                      type="number" step="0.01" min="0"
                      value={formData.retencion.ss.formacionProfesional}
                      onChange={(e) => setFormData(prev => ({ ...prev, retencion: { ...prev.retencion, ss: { ...prev.retencion.ss, formacionProfesional: parseFloat(e.target.value) || 0, overrideManual: true } } }))}
                      className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">MEI (%)</label>
                    <input
                      type="number" step="0.01" min="0"
                      value={formData.retencion.ss.mei ?? SS_DEFAULTS.mei.trabajador}
                      onChange={(e) => setFormData(prev => ({ ...prev, retencion: { ...prev.retencion, ss: { ...prev.retencion.ss, mei: parseFloat(e.target.value) || 0, overrideManual: true } } }))}
                      className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Cuota Solidaridad (€/mes)</label>
                    <input
                      type="number" step="0.01" min="0"
                      value={formData.retencion.cuotaSolidaridadMensual ?? 0}
                      onChange={(e) => setFormData(prev => ({ ...prev, retencion: { ...prev.retencion, cuotaSolidaridadMensual: parseFloat(e.target.value) || 0 } }))}
                      className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy px-3 py-2"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 border-t border-neutral-100 pt-4">
                <h3 className="text-base font-semibold text-neutral-900">Plan de Pensiones</h3>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.tienePlanPensiones}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setFormData(prev => ({
                        ...prev,
                        tienePlanPensiones: checked,
                        planPensiones: checked && !prev.planPensiones ? {
                          aportacionEmpresa: { tipo: 'porcentaje', valor: 0 },
                          aportacionEmpleado: { tipo: 'porcentaje', valor: 0 },
                        } : prev.planPensiones,
                      }));
                    }}
                    className="h-4 w-4 text-brand-navy focus:ring-brand-navy border-neutral-300 rounded"
                  />
                  <span className="text-sm font-medium text-neutral-700">Mi empresa aporta a un plan de pensiones</span>
                </label>

                {formData.tienePlanPensiones && formData.planPensiones && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-7">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-neutral-700">Aportación Empresa</p>
                      <div className="flex gap-2">
                        <select
                          value={formData.planPensiones.aportacionEmpresa.tipo}
                          onChange={(e) => setFormData(prev => ({ ...prev, planPensiones: { ...prev.planPensiones!, aportacionEmpresa: { ...prev.planPensiones!.aportacionEmpresa, tipo: e.target.value as 'porcentaje' | 'importe' } } }))}
                          className="border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy px-2 py-2 text-sm"
                        >
                          <option value="porcentaje">%</option>
                          <option value="importe">€/mes</option>
                        </select>
                        <input
                          type="number" step="0.01" min="0"
                          value={formData.planPensiones.aportacionEmpresa.valor}
                          onChange={(e) => setFormData(prev => ({ ...prev, planPensiones: { ...prev.planPensiones!, aportacionEmpresa: { ...prev.planPensiones!.aportacionEmpresa, valor: parseFloat(e.target.value) || 0 } } }))}
                          className="flex-1 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy px-3 py-2"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-neutral-700">Aportación Empleado (se descuenta del líquido)</p>
                      <div className="flex gap-2">
                        <select
                          value={formData.planPensiones.aportacionEmpleado.tipo}
                          onChange={(e) => setFormData(prev => ({ ...prev, planPensiones: { ...prev.planPensiones!, aportacionEmpleado: { ...prev.planPensiones!.aportacionEmpleado, tipo: e.target.value as 'porcentaje' | 'importe' } } }))}
                          className="border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy px-2 py-2 text-sm"
                        >
                          <option value="porcentaje">%</option>
                          <option value="importe">€/mes</option>
                        </select>
                        <input
                          type="number" step="0.01" min="0"
                          value={formData.planPensiones.aportacionEmpleado.valor}
                          onChange={(e) => setFormData(prev => ({ ...prev, planPensiones: { ...prev.planPensiones!, aportacionEmpleado: { ...prev.planPensiones!.aportacionEmpleado, valor: parseFloat(e.target.value) || 0 } } }))}
                          className="flex-1 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy px-3 py-2"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3 border-t border-neutral-100 pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-neutral-900">Otras Deducciones</h3>
                  <button type="button" onClick={() => setShowDeduccionForm(true)} className="inline-flex items-center atlas-btn-primary text-sm rounded-md">
                    <Plus className="w-4 h-4 mr-1" />Añadir
                  </button>
                </div>
                {formData.deduccionesAdicionales.length > 0 && (
                  <div className="space-y-2">
                    {formData.deduccionesAdicionales.map(d => (
                      <div key={d.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                        <div>
                          <span className="font-medium">{d.concepto}</span>
                          <span className="text-sm text-neutral-600 ml-2">{d.importeMensual}€/mes</span>
                          <span className="text-xs text-neutral-400 ml-2">{d.esRecurrente ? 'recurrente' : `mes ${d.mes}`}</span>
                        </div>
                        <button type="button" onClick={() => handleDeleteDeduccion(d.id)} className="p-1 text-neutral-600 hover:text-error-600"><X className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-2">
                <button type="button" onClick={() => setStep(1)} className="text-neutral-700 border border-neutral-300 rounded-md px-4 py-2 hover:bg-neutral-50">← Anterior</button>
                <button type="button" onClick={() => setStep(3)} className="atlas-btn-primary rounded-md">Siguiente →</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Cuenta Bancaria de Cobro</label>
                <select
                  value={formData.cuentaAbono || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, cuentaAbono: parseInt(e.target.value) || 0 }))}
                  className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy px-3 py-2"
                >
                  <option value="">— Sin cuenta asignada —</option>
                  {cuentas.map(cuenta => (
                    <option key={cuenta.id} value={cuenta.id}>
                      {cuenta.alias || cuenta.ibanMasked || cuenta.iban}{cuenta.banco?.name ? ` · ${cuenta.banco.name}` : ''}
                    </option>
                  ))}
                </select>
                {cuentas.length === 0 && <p className="text-xs text-neutral-400 mt-1">No hay cuentas bancarias configuradas.</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-3">Regla de Día de Cobro</label>
                <div className="space-y-3">
                  <label className="flex items-center space-x-3">
                    <input type="radio" name="reglaCobroDia" checked={formData.reglaCobroDia.tipo === 'fijo'}
                      onChange={() => setFormData(prev => ({ ...prev, reglaCobroDia: { tipo: 'fijo', dia: 25 } }))}
                      className="h-4 w-4 text-brand-navy focus:ring-brand-navy" />
                    <span className="text-sm">Día fijo del mes</span>
                    {formData.reglaCobroDia.tipo === 'fijo' && (
                      <input type="number" min="1" max="31"
                        value={formData.reglaCobroDia.dia || 25}
                        onChange={(e) => setFormData(prev => ({ ...prev, reglaCobroDia: { ...prev.reglaCobroDia, dia: parseInt(e.target.value) } }))}
                        className="w-16 border border-neutral-300 rounded text-sm px-2 py-1" />
                    )}
                  </label>
                  <label className="flex items-center space-x-3">
                    <input type="radio" name="reglaCobroDia" checked={formData.reglaCobroDia.tipo === 'ultimo-habil'}
                      onChange={() => setFormData(prev => ({ ...prev, reglaCobroDia: { tipo: 'ultimo-habil' } }))}
                      className="h-4 w-4 text-brand-navy focus:ring-brand-navy" />
                    <span className="text-sm">Último día hábil del mes</span>
                  </label>
                  <label className="flex items-center space-x-3">
                    <input type="radio" name="reglaCobroDia" checked={formData.reglaCobroDia.tipo === 'n-esimo-habil'}
                      onChange={() => setFormData(prev => ({ ...prev, reglaCobroDia: { tipo: 'n-esimo-habil', posicion: -2 } }))}
                      className="h-4 w-4 text-brand-navy focus:ring-brand-navy" />
                    <span className="text-sm">N-ésimo día hábil desde fin de mes</span>
                    {formData.reglaCobroDia.tipo === 'n-esimo-habil' && (
                      <input
                        type="number"
                        max={-1}
                        value={formData.reglaCobroDia.posicion ?? -2}
                        onChange={(e) => setFormData(prev => ({ ...prev, reglaCobroDia: { ...prev.reglaCobroDia, posicion: parseInt(e.target.value) } }))}
                        className="w-20 border border-neutral-300 rounded text-sm px-2 py-1"
                        placeholder="-2"
                      />
                    )}
                  </label>
                </div>
              </div>

              <div>
                <label className="flex items-center space-x-3">
                  <input type="checkbox" checked={formData.activa}
                    onChange={(e) => setFormData(prev => ({ ...prev, activa: e.target.checked }))}
                    className="h-4 w-4 text-brand-navy focus:ring-brand-navy border-neutral-300 rounded" />
                  <span className="text-sm font-medium text-neutral-700">Nómina activa</span>
                </label>
                <p className="text-xs text-neutral-500 mt-1">Puedes tener múltiples nóminas activas simultáneamente.</p>
              </div>

              {(() => {
                const bruto = parseFloat(formData.salarioBrutoAnual) || 0;
                const tempNomina: Nomina = {
                  personalDataId: personalDataId ?? 0,
                  titular: formData.titular,
                  nombre: formData.nombre || 'temp',
                  salarioBrutoAnual: bruto,
                  distribucion: formData.distribucion,
                  variables: formData.variables,
                  bonus: formData.bonus,
                  beneficiosSociales: formData.beneficiosSociales,
                  retencion: formData.retencion,
                  planPensiones: formData.tienePlanPensiones ? formData.planPensiones : undefined,
                  deduccionesAdicionales: formData.deduccionesAdicionales,
                  cuentaAbono: formData.cuentaAbono,
                  reglaCobroDia: formData.reglaCobroDia,
                  activa: formData.activa,
                  fechaAntiguedad: formData.fechaAntiguedad || new Date().toISOString(),
                  fechaCreacion: new Date().toISOString(),
                  fechaActualizacion: new Date().toISOString(),
                };
                const calculo = nominaService.calculateSalary(tempNomina);
                // Typical month: first month without paga extra or bonus; fall back to averages
                const mesTipico = calculo.distribucionMensual.find(m => m.pagaExtra === 0 && m.bonus === 0);
                const avg = mesTipico ? null : calculo.distribucionMensual.reduce(
                  (acc, m) => ({ ss: acc.ss + m.ssTotal, irpf: acc.irpf + m.irpfImporte, pp: acc.pp + m.ppEmpleado }),
                  { ss: 0, irpf: 0, pp: 0 }
                );
                const ssM = mesTipico ? mesTipico.ssTotal : avg!.ss / 12;
                const irpfM = mesTipico ? mesTipico.irpfImporte : avg!.irpf / 12;
                const ppM = mesTipico ? mesTipico.ppEmpleado : avg!.pp / 12;
                const netoM = mesTipico ? mesTipico.netoTotal : calculo.netoMensual;
                const fmt = (v: number) => v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                return (
                  <div className="bg-brand-navy/5 rounded-xl p-5 space-y-3">
                    <h4 className="font-semibold text-neutral-900">Resumen estimado</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-neutral-600">Bruto anual:</div><div className="font-medium text-right">{fmt(calculo.totalAnualBruto)} €</div>
                      <div className="text-neutral-600">SS €/mes:</div><div className="font-medium text-right">− {fmt(ssM)} €</div>
                      <div className="text-neutral-600">IRPF €/mes:</div><div className="font-medium text-right">− {fmt(irpfM)} €</div>
                      {ppM > 0 && <><div className="text-neutral-600">PP Empleado €/mes:</div><div className="font-medium text-right">− {fmt(ppM)} €</div></>}
                      <div className="border-t border-neutral-300 pt-2 font-semibold text-neutral-900">Líquido mes típico:</div>
                      <div className="border-t border-neutral-300 pt-2 font-bold text-brand-navy text-right">{fmt(netoM)} €</div>
                      <div className="text-neutral-600">Neto anual estimado:</div><div className="font-medium text-right">{fmt(calculo.totalAnualNeto)} €</div>
                    </div>
                  </div>
                );
              })()}

              <div className="flex justify-between pt-2">
                <button type="button" onClick={() => setStep(2)} className="text-neutral-700 border border-neutral-300 rounded-md px-4 py-2 hover:bg-neutral-50">← Anterior</button>
                <div className="flex space-x-3">
                  <button type="button" onClick={onClose} className="text-neutral-700 border border-neutral-300 rounded-md px-4 py-2 hover:bg-neutral-50">Cancelar</button>
                  <button type="submit" disabled={loading} className="atlas-btn-primary rounded-md disabled:opacity-50">
                    {loading ? 'Guardando...' : (nomina ? 'Actualizar' : 'Crear')} Nómina
                  </button>
                </div>
              </div>
            </div>
          )}
        </form>
      </AtlasModal>

      {showVariableForm && (
        <VariableForm
          isOpen={showVariableForm}
          onClose={() => { setShowVariableForm(false); setEditingVariable(null); }}
          variable={editingVariable}
          onSaved={editingVariable ? handleUpdateVariable : handleAddVariable}
        />
      )}
      {showBonusForm && (
        <BonusForm
          isOpen={showBonusForm}
          onClose={() => { setShowBonusForm(false); setEditingBonus(null); }}
          bonus={editingBonus}
          onSaved={editingBonus ? handleUpdateBonus : handleAddBonus}
        />
      )}
      {showBeneficioForm && (
        <BeneficioSocialForm
          isOpen={showBeneficioForm}
          onClose={() => setShowBeneficioForm(false)}
          onSaved={handleAddBeneficio}
        />
      )}
      {showDeduccionForm && (
        <DeduccionForm
          isOpen={showDeduccionForm}
          onClose={() => setShowDeduccionForm(false)}
          onSaved={handleAddDeduccion}
        />
      )}
    </>
  );
};

interface VariableFormProps {
  isOpen: boolean;
  onClose: () => void;
  variable?: Variable | null;
  onSaved: (variable: Variable) => void;
}

const VariableForm: React.FC<VariableFormProps> = ({ isOpen, onClose, variable, onSaved }) => {
  const [formData, setFormData] = useState({
    nombre: '',
    tipo: 'porcentaje' as 'porcentaje' | 'importe',
    valor: '',
    distribucionMeses: Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, porcentaje: 0 }))
  });

  useEffect(() => {
    if (variable) {
      setFormData({
        nombre: variable.nombre,
        tipo: variable.tipo,
        valor: variable.valor.toString(),
        distribucionMeses: variable.distribucionMeses.length > 0
          ? variable.distribucionMeses
          : Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, porcentaje: 0 }))
      });
    } else {
      setFormData({ nombre: '', tipo: 'porcentaje', valor: '', distribucionMeses: Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, porcentaje: 0 })) });
    }
  }, [variable, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre || !formData.valor) { toast.error('Por favor, completa todos los campos obligatorios'); return; }
    const valor = parseFloat(formData.valor);
    if (isNaN(valor) || valor <= 0) { toast.error('El valor debe ser un número válido mayor que 0'); return; }
    const totalDistribucion = formData.distribucionMeses.reduce((sum, d) => sum + d.porcentaje, 0);
    if (totalDistribucion === 0) { toast.error('Debe distribuir al menos en un mes'); return; }
    onSaved({ id: variable?.id || Date.now().toString(), nombre: formData.nombre, tipo: formData.tipo, valor, distribucionMeses: formData.distribucionMeses.filter(d => d.porcentaje > 0) });
  };

  const updateDistribucion = (mes: number, porcentaje: number) =>
    setFormData(prev => ({ ...prev, distribucionMeses: prev.distribucionMeses.map(d => d.mes === mes ? { ...d, porcentaje } : d) }));

  const totalPorcentaje = formData.distribucionMeses.reduce((sum, d) => sum + d.porcentaje, 0);
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  return (
    <AtlasModal isOpen={isOpen} onClose={onClose} title={variable ? 'Editar Variable' : 'Nueva Variable'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Nombre de la Variable *</label>
            <input type="text" value={formData.nombre} onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
              className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy px-3 py-2" placeholder="Ej: Productividad" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Tipo y Valor *</label>
            <div className="flex space-x-2">
              <select value={formData.tipo} onChange={(e) => setFormData(prev => ({ ...prev, tipo: e.target.value as 'porcentaje' | 'importe' }))}
                className="border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy px-2 py-2">
                <option value="porcentaje">% del salario</option>
                <option value="importe">Importe fijo (€)</option>
              </select>
              <input type="number" step="0.01" value={formData.valor} onChange={(e) => setFormData(prev => ({ ...prev, valor: e.target.value }))}
                className="flex-1 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy px-3 py-2" placeholder={formData.tipo === 'porcentaje' ? '15' : '5000'} required />
            </div>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-3">Distribución por Meses (Total: {totalPorcentaje}%)</label>
          {totalPorcentaje !== 100 && <p className="text-sm text-amber-600 mb-3">⚠️ La distribución suma {totalPorcentaje}%</p>}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {formData.distribucionMeses.map((dist, index) => (
              <div key={dist.mes} className="text-center">
                <label className="block text-xs text-neutral-600 mb-1">{meses[index]}</label>
                <input type="number" min="0" max="100" step="0.1" value={dist.porcentaje}
                  onChange={(e) => updateDistribucion(dist.mes, parseFloat(e.target.value) || 0)}
                  className="w-full text-xs border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-navy px-1 py-1" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end space-x-3 pt-4 border-t border-neutral-200">
          <button type="button" onClick={onClose} className="text-neutral-700 border border-neutral-300 rounded-md px-4 py-2 hover:bg-neutral-50">Cancelar</button>
          <button type="submit" className="atlas-btn-primary rounded-md">{variable ? 'Actualizar' : 'Añadir'} Variable</button>
        </div>
      </form>
    </AtlasModal>
  );
};

interface BonusFormProps {
  isOpen: boolean;
  onClose: () => void;
  bonus?: Bonus | null;
  onSaved: (bonus: Bonus) => void;
}

const BonusForm: React.FC<BonusFormProps> = ({ isOpen, onClose, bonus, onSaved }) => {
  const [formData, setFormData] = useState({ descripcion: '', importe: '', mes: 6 });

  useEffect(() => {
    if (bonus) {
      setFormData({ descripcion: bonus.descripcion, importe: bonus.importe.toString(), mes: bonus.mes });
    } else {
      setFormData({ descripcion: '', importe: '', mes: 6 });
    }
  }, [bonus, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.descripcion || !formData.importe) { toast.error('Por favor, completa todos los campos obligatorios'); return; }
    const importe = parseFloat(formData.importe);
    if (isNaN(importe) || importe <= 0) { toast.error('El importe debe ser un número válido mayor que 0'); return; }
    onSaved({ id: bonus?.id || Date.now().toString(), descripcion: formData.descripcion, importe, mes: formData.mes });
  };

  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  return (
    <AtlasModal isOpen={isOpen} onClose={onClose} title={bonus ? 'Editar Bonus' : 'Nuevo Bonus'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Descripción *</label>
          <input type="text" value={formData.descripcion} onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
            className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy px-3 py-2" placeholder="Ej: Bonus de objetivos Q2" required />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Importe (€) *</label>
            <input type="number" step="0.01" value={formData.importe} onChange={(e) => setFormData(prev => ({ ...prev, importe: e.target.value }))}
              className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy px-3 py-2" placeholder="1500.00" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Mes de Pago</label>
            <select value={formData.mes} onChange={(e) => setFormData(prev => ({ ...prev, mes: parseInt(e.target.value) }))}
              className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy px-3 py-2">
              {meses.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end space-x-3 pt-4 border-t border-neutral-200">
          <button type="button" onClick={onClose} className="text-neutral-700 border border-neutral-300 rounded-md px-4 py-2 hover:bg-neutral-50">Cancelar</button>
          <button type="submit" className="atlas-btn-primary rounded-md">{bonus ? 'Actualizar' : 'Añadir'} Bonus</button>
        </div>
      </form>
    </AtlasModal>
  );
};

interface BeneficioSocialFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (beneficio: BeneficioSocial) => void;
}

const TIPO_BENEFICIO_OPTIONS: { value: BeneficioSocial['tipo']; label: string }[] = [
  { value: 'seguro-vida', label: 'Seguro de vida' },
  { value: 'seguro-medico', label: 'Seguro médico' },
  { value: 'cheque-guarderia', label: 'Cheque guardería (exento)' },
  { value: 'gasolina', label: 'Gasolina' },
  { value: 'vehiculo-empresa', label: 'Vehículo de empresa' },
  { value: 'telefono', label: 'Teléfono' },
  { value: 'formacion', label: 'Formación' },
  { value: 'conciliacion', label: 'Conciliación' },
  { value: 'otro', label: 'Otro' },
];

const BeneficioSocialForm: React.FC<BeneficioSocialFormProps> = ({ isOpen, onClose, onSaved }) => {
  const [formData, setFormData] = useState({
    concepto: '',
    tipo: 'seguro-medico' as BeneficioSocial['tipo'],
    importeMensual: '',
    incrementaBaseIRPF: true,
  });

  useEffect(() => {
    setFormData({ concepto: '', tipo: 'seguro-medico', importeMensual: '', incrementaBaseIRPF: true });
  }, [isOpen]);

  useEffect(() => {
    if (formData.tipo === 'cheque-guarderia') {
      setFormData(prev => ({ ...prev, incrementaBaseIRPF: false }));
    } else {
      setFormData(prev => ({ ...prev, incrementaBaseIRPF: true }));
    }
  }, [formData.tipo]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const importe = parseFloat(formData.importeMensual);
    if (!formData.concepto || isNaN(importe) || importe <= 0) { toast.error('Completa todos los campos'); return; }
    onSaved({ id: Date.now().toString(), concepto: formData.concepto, tipo: formData.tipo, importeMensual: importe, incrementaBaseIRPF: formData.incrementaBaseIRPF });
  };

  return (
    <AtlasModal isOpen={isOpen} onClose={onClose} title="Nuevo Beneficio Social" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Concepto *</label>
          <input type="text" value={formData.concepto} onChange={(e) => setFormData(prev => ({ ...prev, concepto: e.target.value }))}
            className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy px-3 py-2" placeholder="Ej: Seguro médico familiar" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Tipo</label>
            <select value={formData.tipo} onChange={(e) => setFormData(prev => ({ ...prev, tipo: e.target.value as BeneficioSocial['tipo'] }))}
              className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy px-3 py-2">
              {TIPO_BENEFICIO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Importe mensual (€) *</label>
            <input type="number" step="0.01" min="0" value={formData.importeMensual} onChange={(e) => setFormData(prev => ({ ...prev, importeMensual: e.target.value }))}
              className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy px-3 py-2" placeholder="50.00" required />
          </div>
        </div>
        <label className="flex items-center space-x-3 cursor-pointer">
          <input type="checkbox" checked={formData.incrementaBaseIRPF} onChange={(e) => setFormData(prev => ({ ...prev, incrementaBaseIRPF: e.target.checked }))}
            className="h-4 w-4 text-brand-navy focus:ring-brand-navy border-neutral-300 rounded" />
          <span className="text-sm text-neutral-700">Incrementa base IRPF</span>
        </label>
        <div className="flex justify-end space-x-3 pt-4 border-t border-neutral-200">
          <button type="button" onClick={onClose} className="text-neutral-700 border border-neutral-300 rounded-md px-4 py-2 hover:bg-neutral-50">Cancelar</button>
          <button type="submit" className="atlas-btn-primary rounded-md">Añadir Beneficio</button>
        </div>
      </form>
    </AtlasModal>
  );
};

interface DeduccionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (deduccion: DeduccionNomina) => void;
}

const DeduccionForm: React.FC<DeduccionFormProps> = ({ isOpen, onClose, onSaved }) => {
  const [formData, setFormData] = useState({ concepto: '', importeMensual: '', esRecurrente: true, mes: 1 });

  useEffect(() => {
    setFormData({ concepto: '', importeMensual: '', esRecurrente: true, mes: 1 });
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const importe = parseFloat(formData.importeMensual);
    if (!formData.concepto || isNaN(importe) || importe <= 0) { toast.error('Completa todos los campos'); return; }
    onSaved({ id: Date.now().toString(), concepto: formData.concepto, importeMensual: importe, esRecurrente: formData.esRecurrente, mes: formData.esRecurrente ? undefined : formData.mes });
  };

  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  return (
    <AtlasModal isOpen={isOpen} onClose={onClose} title="Nueva Deducción" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Concepto *</label>
          <input type="text" value={formData.concepto} onChange={(e) => setFormData(prev => ({ ...prev, concepto: e.target.value }))}
            className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy px-3 py-2" placeholder="Ej: Anticipos" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Importe mensual (€) *</label>
          <input type="number" step="0.01" min="0" value={formData.importeMensual} onChange={(e) => setFormData(prev => ({ ...prev, importeMensual: e.target.value }))}
            className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy px-3 py-2" placeholder="100.00" required />
        </div>
        <label className="flex items-center space-x-3 cursor-pointer">
          <input type="checkbox" checked={formData.esRecurrente} onChange={(e) => setFormData(prev => ({ ...prev, esRecurrente: e.target.checked }))}
            className="h-4 w-4 text-brand-navy focus:ring-brand-navy border-neutral-300 rounded" />
          <span className="text-sm text-neutral-700">Deducción recurrente (todos los meses)</span>
        </label>
        {!formData.esRecurrente && (
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Mes</label>
            <select value={formData.mes} onChange={(e) => setFormData(prev => ({ ...prev, mes: parseInt(e.target.value) }))}
              className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy px-3 py-2">
              {meses.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>
        )}
        <div className="flex justify-end space-x-3 pt-4 border-t border-neutral-200">
          <button type="button" onClick={onClose} className="text-neutral-700 border border-neutral-300 rounded-md px-4 py-2 hover:bg-neutral-50">Cancelar</button>
          <button type="submit" className="atlas-btn-primary rounded-md">Añadir Deducción</button>
        </div>
      </form>
    </AtlasModal>
  );
};

export default NominaForm;
