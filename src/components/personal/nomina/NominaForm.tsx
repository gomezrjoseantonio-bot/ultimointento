import React, { useState, useEffect } from 'react';
import { AtlasModal } from '../../atlas/AtlasComponents';
import { nominaService } from '../../../services/nominaService';
import { personalDataService } from '../../../services/personalDataService';
import { Nomina, Variable, Bonus, ReglaDia } from '../../../types/personal';
import { Plus, X, Settings } from 'lucide-react';
import toast from 'react-hot-toast';

interface NominaFormProps {
  isOpen: boolean;
  onClose: () => void;
  nomina?: Nomina | null;
  onSaved: (nomina: Nomina) => void;
}

const NominaForm: React.FC<NominaFormProps> = ({ isOpen, onClose, nomina, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [personalDataId, setPersonalDataId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    salarioBrutoAnual: '',
    distribucion: {
      tipo: 'doce' as 'doce' | 'catorce' | 'personalizado',
      meses: 12
    },
    variables: [] as Variable[],
    bonus: [] as Bonus[],
    cuentaAbono: 0,
    reglaCobroDia: {
      tipo: 'fijo' as const,
      dia: 25
    } as ReglaDia,
    activa: true
  });

  const [showVariableForm, setShowVariableForm] = useState(false);
  const [showBonusForm, setShowBonusForm] = useState(false);
  const [editingVariable, setEditingVariable] = useState<Variable | null>(null);
  const [editingBonus, setEditingBonus] = useState<Bonus | null>(null);

  useEffect(() => {
    loadPersonalDataId();
    if (nomina) {
      setFormData({
        nombre: nomina.nombre,
        salarioBrutoAnual: nomina.salarioBrutoAnual.toString(),
        distribucion: nomina.distribucion,
        variables: nomina.variables,
        bonus: nomina.bonus,
        cuentaAbono: nomina.cuentaAbono,
        reglaCobroDia: nomina.reglaCobroDia,
        activa: nomina.activa
      });
    }
  }, [nomina]);

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
      const nominaData = {
        ...formData,
        personalDataId,
        salarioBrutoAnual
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
      toast.error('Error al guardar la nómina');
    } finally {
      setLoading(false);
    }
  };

  const handleAddVariable = (variable: Variable) => {
    setFormData(prev => ({
      ...prev,
      variables: [...prev.variables, { ...variable, id: Date.now().toString() }]
    }));
    setShowVariableForm(false);
    setEditingVariable(null);
  };

  const handleEditVariable = (variable: Variable) => {
    setEditingVariable(variable);
    setShowVariableForm(true);
  };

  const handleUpdateVariable = (updatedVariable: Variable) => {
    setFormData(prev => ({
      ...prev,
      variables: prev.variables.map(v => 
        v.id === updatedVariable.id ? updatedVariable : v
      )
    }));
    setShowVariableForm(false);
    setEditingVariable(null);
  };

  const handleDeleteVariable = (variableId: string) => {
    setFormData(prev => ({
      ...prev,
      variables: prev.variables.filter(v => v.id !== variableId)
    }));
  };

  const handleAddBonus = (bonus: Bonus) => {
    setFormData(prev => ({
      ...prev,
      bonus: [...prev.bonus, { ...bonus, id: Date.now().toString() }]
    }));
    setShowBonusForm(false);
    setEditingBonus(null);
  };

  const handleEditBonus = (bonus: Bonus) => {
    setEditingBonus(bonus);
    setShowBonusForm(true);
  };

  const handleUpdateBonus = (updatedBonus: Bonus) => {
    setFormData(prev => ({
      ...prev,
      bonus: prev.bonus.map(b => 
        b.id === updatedBonus.id ? updatedBonus : b
      )
    }));
    setShowBonusForm(false);
    setEditingBonus(null);
  };

  const handleDeleteBonus = (bonusId: string) => {
    setFormData(prev => ({
      ...prev,
      bonus: prev.bonus.filter(b => b.id !== bonusId)
    }));
  };

  return (
    <>
      <AtlasModal
        isOpen={isOpen}
        onClose={onClose}
        title={nomina ? 'Editar Nómina' : 'Nueva Nómina'}
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Nombre de la Nómina *
              </label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                placeholder="Ej: Nómina Principal"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Salario Bruto Anual (€) *
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.salarioBrutoAnual}
                onChange={(e) => setFormData(prev => ({ ...prev, salarioBrutoAnual: e.target.value }))}
                className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                placeholder="50000.00"
                required
              />
            </div>
          </div>

          {/* Distribution */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-3">
              Distribución del Salario
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="flex items-center space-x-3 p-3 border border-neutral-200 rounded-lg cursor-pointer hover:bg-neutral-50">
                <input
                  type="radio"
                  name="distribucion"
                  value="doce"
                  checked={formData.distribucion.tipo === 'doce'}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    distribucion: { tipo: 'doce', meses: 12 }
                  }))}
                  className="h-4 w-4 text-brand-navy focus:ring-brand-navy"
                />
                <span className="text-sm font-medium">12 meses</span>
              </label>

              <label className="flex items-center space-x-3 p-3 border border-neutral-200 rounded-lg cursor-pointer hover:bg-neutral-50">
                <input
                  type="radio"
                  name="distribucion"
                  value="catorce"
                  checked={formData.distribucion.tipo === 'catorce'}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    distribucion: { tipo: 'catorce', meses: 14 }
                  }))}
                  className="h-4 w-4 text-brand-navy focus:ring-brand-navy"
                />
                <span className="text-sm font-medium">14 meses (pagas extra)</span>
              </label>

              <label className="flex items-center space-x-3 p-3 border border-neutral-200 rounded-lg cursor-pointer hover:bg-neutral-50">
                <input
                  type="radio"
                  name="distribucion"
                  value="personalizado"
                  checked={formData.distribucion.tipo === 'personalizado'}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    distribucion: { tipo: 'personalizado', meses: formData.distribucion.meses || 12 }
                  }))}
                  className="h-4 w-4 text-brand-navy focus:ring-brand-navy"
                />
                <span className="text-sm font-medium">Personalizado</span>
              </label>
            </div>

            {formData.distribucion.tipo === 'personalizado' && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Número de meses
                </label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={formData.distribucion.meses}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    distribucion: { ...prev.distribucion, meses: parseInt(e.target.value) }
                  }))}
                  className="w-32 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                />
              </div>
            )}
          </div>

          {/* Variables Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-neutral-700">
                Variables Anuales
              </label>
              <button
                type="button"
                onClick={() => setShowVariableForm(true)}
                className="inline-flex items-center atlas-atlas-atlas-atlas-btn-primary  text-sm rounded-md hover:atlas-atlas-atlas-atlas-btn-primary"
              >
                <Plus className="w-4 h-4 mr-1" />
                Añadir Variable
              </button>
            </div>

            {formData.variables.length > 0 && (
              <div className="space-y-2">
                {formData.variables.map(variable => (
                  <div key={variable.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                    <div>
                      <span className="font-medium">{variable.nombre}</span>
                      <span className="text-sm text-neutral-600 ml-2">
                        ({variable.tipo === 'porcentaje' ? `${variable.valor}%` : `${variable.valor}€`})
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handleEditVariable(variable)}
                        className="p-1 text-neutral-600 hover:text-brand-navy"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteVariable(variable.id!)}
                        className="p-1 text-neutral-600 hover:text-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bonus Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-neutral-700">
                Bonus Puntuales
              </label>
              <button
                type="button"
                onClick={() => setShowBonusForm(true)}
                className="inline-flex items-center atlas-atlas-atlas-atlas-btn-primary  text-sm rounded-md hover:atlas-atlas-atlas-atlas-btn-primary"
              >
                <Plus className="w-4 h-4 mr-1" />
                Añadir Bonus
              </button>
            </div>

            {formData.bonus.length > 0 && (
              <div className="space-y-2">
                {formData.bonus.map(bonus => (
                  <div key={bonus.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                    <div>
                      <span className="font-medium">{bonus.descripcion}</span>
                      <span className="text-sm text-neutral-600 ml-2">
                        {bonus.importe}€ - {new Date(2024, bonus.mes - 1).toLocaleDateString('es-ES', { month: 'long' })}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handleEditBonus(bonus)}
                        className="p-1 text-neutral-600 hover:text-brand-navy"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteBonus(bonus.id!)}
                        className="p-1 text-neutral-600 hover:text-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payment Rules */}
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
                    reglaCobroDia: { tipo: 'fijo', dia: 25 }
                  }))}
                  className="h-4 w-4 text-brand-navy focus:ring-brand-navy"
                />
                <span className="text-sm">Día fijo del mes</span>
                {formData.reglaCobroDia.tipo === 'fijo' && (
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.reglaCobroDia.dia || 25}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      reglaCobroDia: { ...prev.reglaCobroDia, dia: parseInt(e.target.value) }
                    }))}
                    className="w-16 border border-neutral-300 rounded text-sm"
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
                    reglaCobroDia: { tipo: 'ultimo-habil' }
                  }))}
                  className="h-4 w-4 text-brand-navy focus:ring-brand-navy"
                />
                <span className="text-sm">Último día hábil del mes</span>
              </label>

              <label className="flex items-center space-x-3">
                <input
                  type="radio"
                  name="reglaCobroDia"
                  checked={formData.reglaCobroDia.tipo === 'n-esimo-habil'}
                  onChange={() => setFormData(prev => ({
                    ...prev,
                    reglaCobroDia: { tipo: 'n-esimo-habil', posicion: -2 }
                  }))}
                  className="h-4 w-4 text-brand-navy focus:ring-brand-navy"
                />
                <span className="text-sm">N-ésimo día hábil desde fin de mes</span>
                {formData.reglaCobroDia.tipo === 'n-esimo-habil' && (
                  <select
                    value={formData.reglaCobroDia.posicion || -2}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      reglaCobroDia: { ...prev.reglaCobroDia, posicion: parseInt(e.target.value) }
                    }))}
                    className="border border-neutral-300 rounded text-sm"
                  >
                    <option value={-1}>Último (-1)</option>
                    <option value={-2}>Penúltimo (-2)</option>
                    <option value={-3}>Antepenúltimo (-3)</option>
                    <option value={-4}>Cuarto desde final (-4)</option>
                  </select>
                )}
              </label>
            </div>
          </div>

          {/* Active checkbox */}
          <div>
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={formData.activa}
                onChange={(e) => setFormData(prev => ({ ...prev, activa: e.target.checked }))}
                className="h-4 w-4 text-brand-navy focus:ring-brand-navy border-neutral-300 rounded"
              />
              <span className="text-sm font-medium text-neutral-700">Nómina activa</span>
            </label>
            <p className="text-xs text-neutral-500 mt-1">
              Solo puede haber una nómina activa a la vez. Al activar esta, se desactivarán las demás.
            </p>
          </div>

          {/* Submit buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-neutral-200">
            <button
              type="button"
              onClick={onClose}
              className="text-neutral-700 border border-neutral-300 rounded-md hover:bg-neutral-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="atlas-atlas-atlas-atlas-btn-primary rounded-md hover:atlas-atlas-atlas-atlas-btn-primary disabled:opacity-50"
            >
              {loading ? 'Guardando...' : (nomina ? 'Actualizar' : 'Crear')} Nómina
            </button>
          </div>
        </form>
      </AtlasModal>

      {/* Variable Form Modal */}
      {showVariableForm && (
        <VariableForm
          isOpen={showVariableForm}
          onClose={() => {
            setShowVariableForm(false);
            setEditingVariable(null);
          }}
          variable={editingVariable}
          onSaved={editingVariable ? handleUpdateVariable : handleAddVariable}
        />
      )}

      {/* Bonus Form Modal */}
      {showBonusForm && (
        <BonusForm
          isOpen={showBonusForm}
          onClose={() => {
            setShowBonusForm(false);
            setEditingBonus(null);
          }}
          bonus={editingBonus}
          onSaved={editingBonus ? handleUpdateBonus : handleAddBonus}
        />
      )}
    </>
  );
};

// Variable Form Component
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
      // Reset form
      setFormData({
        nombre: '',
        tipo: 'porcentaje',
        valor: '',
        distribucionMeses: Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, porcentaje: 0 }))
      });
    }
  }, [variable, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nombre || !formData.valor) {
      toast.error('Por favor, completa todos los campos obligatorios');
      return;
    }

    const valor = parseFloat(formData.valor);
    if (isNaN(valor) || valor <= 0) {
      toast.error('El valor debe ser un número válido mayor que 0');
      return;
    }

    const totalDistribucion = formData.distribucionMeses.reduce((sum, d) => sum + d.porcentaje, 0);
    if (totalDistribucion === 0) {
      toast.error('Debe distribuir al menos en un mes');
      return;
    }

    const newVariable: Variable = {
      id: variable?.id || Date.now().toString(),
      nombre: formData.nombre,
      tipo: formData.tipo,
      valor,
      distribucionMeses: formData.distribucionMeses.filter(d => d.porcentaje > 0)
    };

    onSaved(newVariable);
  };

  const updateDistribucion = (mes: number, porcentaje: number) => {
    setFormData(prev => ({
      ...prev,
      distribucionMeses: prev.distribucionMeses.map(d => 
        d.mes === mes ? { ...d, porcentaje } : d
      )
    }));
  };

  const totalPorcentaje = formData.distribucionMeses.reduce((sum, d) => sum + d.porcentaje, 0);
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  return (
    <AtlasModal
      isOpen={isOpen}
      onClose={onClose}
      title={variable ? 'Editar Variable' : 'Nueva Variable'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Nombre de la Variable *
            </label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
              className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              placeholder="Ej: Productividad"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Tipo y Valor *
            </label>
            <div className="flex space-x-2">
              <select
                value={formData.tipo}
                onChange={(e) => setFormData(prev => ({ ...prev, tipo: e.target.value as 'porcentaje' | 'importe' }))}
                className="border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy"
              >
                <option value="porcentaje">% del salario</option>
                <option value="importe">Importe fijo (€)</option>
              </select>
              <input
                type="number"
                step="0.01"
                value={formData.valor}
                onChange={(e) => setFormData(prev => ({ ...prev, valor: e.target.value }))}
                className="flex-1 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                placeholder={formData.tipo === 'porcentaje' ? '15' : '5000'}
                required
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-3">
            Distribución por Meses (Total: {totalPorcentaje}%)
          </label>
          {totalPorcentaje !== 100 && (
            <p className="text-sm text-amber-600 mb-3">
              ⚠️ La distribución suma {totalPorcentaje}% (se permite diferente de 100%)
            </p>
          )}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {formData.distribucionMeses.map((dist, index) => (
              <div key={dist.mes} className="text-center">
                <label className="block text-xs text-neutral-600 mb-1">{meses[index]}</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={dist.porcentaje}
                  onChange={(e) => updateDistribucion(dist.mes, parseFloat(e.target.value) || 0)}
                  className="w-full text-xs border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-navy"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-neutral-200">
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-700 border border-neutral-300 rounded-md hover:bg-neutral-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="atlas-atlas-atlas-atlas-btn-primary rounded-md hover:atlas-atlas-atlas-atlas-btn-primary"
          >
            {variable ? 'Actualizar' : 'Añadir'} Variable
          </button>
        </div>
      </form>
    </AtlasModal>
  );
};

// Bonus Form Component
interface BonusFormProps {
  isOpen: boolean;
  onClose: () => void;
  bonus?: Bonus | null;
  onSaved: (bonus: Bonus) => void;
}

const BonusForm: React.FC<BonusFormProps> = ({ isOpen, onClose, bonus, onSaved }) => {
  const [formData, setFormData] = useState({
    descripcion: '',
    importe: '',
    mes: 6
  });

  useEffect(() => {
    if (bonus) {
      setFormData({
        descripcion: bonus.descripcion,
        importe: bonus.importe.toString(),
        mes: bonus.mes
      });
    } else {
      setFormData({
        descripcion: '',
        importe: '',
        mes: 6
      });
    }
  }, [bonus, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.descripcion || !formData.importe) {
      toast.error('Por favor, completa todos los campos obligatorios');
      return;
    }

    const importe = parseFloat(formData.importe);
    if (isNaN(importe) || importe <= 0) {
      toast.error('El importe debe ser un número válido mayor que 0');
      return;
    }

    const newBonus: Bonus = {
      id: bonus?.id || Date.now().toString(),
      descripcion: formData.descripcion,
      importe,
      mes: formData.mes
    };

    onSaved(newBonus);
  };

  const meses = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' }
  ];

  return (
    <AtlasModal
      isOpen={isOpen}
      onClose={onClose}
      title={bonus ? 'Editar Bonus' : 'Nuevo Bonus'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Descripción *
          </label>
          <input
            type="text"
            value={formData.descripcion}
            onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
            className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            placeholder="Ej: Bonus de objetivos Q2"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Importe (€) *
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.importe}
              onChange={(e) => setFormData(prev => ({ ...prev, importe: e.target.value }))}
              className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
              placeholder="1500.00"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Mes de Pago
            </label>
            <select
              value={formData.mes}
              onChange={(e) => setFormData(prev => ({ ...prev, mes: parseInt(e.target.value) }))}
              className="w-full border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent"
            >
              {meses.map(mes => (
                <option key={mes.value} value={mes.value}>
                  {mes.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-neutral-200">
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-700 border border-neutral-300 rounded-md hover:bg-neutral-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="atlas-atlas-atlas-atlas-btn-primary rounded-md hover:atlas-atlas-atlas-atlas-btn-primary"
          >
            {bonus ? 'Actualizar' : 'Añadir'} Bonus
          </button>
        </div>
      </form>
    </AtlasModal>
  );
};

export default NominaForm;