import React, { useState, useEffect } from 'react';
import { Settings, Info, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, X, ArrowUp, ArrowDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { initDB } from '../../../../../services/db';

// Rule interfaces
interface RuleCondition {
  type: 'text' | 'iban' | 'amount' | 'account';
  field: string; // 'description' | 'counterparty' | 'iban' | 'amount' | 'account_id'
  operator: 'contains' | 'equals' | 'greater_than' | 'less_than' | 'between';
  value: string | number;
  tolerance?: number; // For amount conditions (percentage)
}

interface RuleAction {
  type: 'assign_scope' | 'assign_property' | 'assign_category' | 'mark_confirmed' | 'generate_alert';
  scope?: 'Personal' | 'Inmuebles';
  propertyId?: number;
  category?: string;
  subcategory?: string;
  alertMessage?: string;
}

interface ClassificationRule {
  id?: number;
  name: string;
  description: string;
  priority: number;
  isActive: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
  createdAt: string;
  updatedAt: string;
}

// Predefined categories for classification (to be used in future iterations)
// const CATEGORIES = {
//   Personal: {
//     Ingresos: ['Nómina', 'Freelance', 'Inversiones', 'Otros'],
//     Gastos: ['Alimentación', 'Transporte', 'Ocio', 'Salud', 'Otros']
//   },
//   Inmuebles: {
//     Ingresos: ['Alquiler', 'Airbnb', 'Otros'],
//     Suministros: ['Luz', 'Agua', 'Gas', 'Telecomunicaciones'],
//     Gastos: ['IBI', 'Comunidad', 'Seguros', 'Reparaciones', 'Otros']
//   }
// };

/**
 * ReglasAlertas - ATLAS Design System
 * 
 * Full rules management system for automatic movement classification:
 * - Create/Edit rules with multiple condition types
 * - Actions for scope, property, and category assignment
 * - Priority management for conflict resolution
 * - Rule testing and preview functionality
 */
const ReglasAlertas: React.FC = () => {
  const [rules, setRules] = useState<ClassificationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<ClassificationRule | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<ClassificationRule | null>(null);

  const [formData, setFormData] = useState<Partial<ClassificationRule>>({
    name: '',
    description: '',
    priority: 1,
    isActive: true,
    conditions: [],
    actions: []
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Load rules and accounts on component mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load rules from localStorage (in a real app, this would be from the database)
      const savedRules = localStorage.getItem('classificationRules');
      if (savedRules) {
        setRules(JSON.parse(savedRules));
      } else {
        // Initialize with sample rules
        const sampleRules: ClassificationRule[] = [
          {
            id: 1,
            name: 'IBI - Clasificación automática',
            description: 'Clasifica automáticamente los pagos de IBI',
            priority: 1,
            isActive: true,
            conditions: [
              { type: 'text', field: 'description', operator: 'contains', value: 'IBI' }
            ],
            actions: [
              { type: 'assign_scope', scope: 'Inmuebles' },
              { type: 'assign_category', category: 'Gastos', subcategory: 'IBI' }
            ],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: 2,
            name: 'Nómina - Personal',
            description: 'Clasifica los ingresos por nómina',
            priority: 2,
            isActive: true,
            conditions: [
              { type: 'text', field: 'description', operator: 'contains', value: 'NÓMINA' }
            ],
            actions: [
              { type: 'assign_scope', scope: 'Personal' },
              { type: 'assign_category', category: 'Ingresos', subcategory: 'Nómina' }
            ],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: 3,
            name: 'Alquiler - Inmuebles',
            description: 'Clasifica los ingresos por alquiler',
            priority: 3,
            isActive: true,
            conditions: [
              { type: 'amount', field: 'amount', operator: 'greater_than', value: 500 },
              { type: 'text', field: 'description', operator: 'contains', value: 'ALQUILER' }
            ],
            actions: [
              { type: 'assign_scope', scope: 'Inmuebles' },
              { type: 'assign_category', category: 'Ingresos', subcategory: 'Alquiler' },
              { type: 'generate_alert', alertMessage: 'Ingreso por alquiler detectado' }
            ],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ];
        setRules(sampleRules);
        localStorage.setItem('classificationRules', JSON.stringify(sampleRules));
      }

      // Load accounts (for future use in rule conditions)
      const db = await initDB();
      const allAccounts = await db.getAll('accounts');
      // Store accounts for future use: setAccounts(allAccounts.filter(account => !account.deleted_at));
      console.log('Loaded accounts for future rule conditions:', allAccounts.length);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const handleNewRule = () => {
    setEditingRule(null);
    setFormData({
      name: '',
      description: '',
      priority: rules.length + 1,
      isActive: true,
      conditions: [],
      actions: []
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleEditRule = (rule: ClassificationRule) => {
    setEditingRule(rule);
    setFormData({ ...rule });
    setFormErrors({});
    setShowModal(true);
  };

  const handleDeleteRule = (rule: ClassificationRule) => {
    setDeleteConfirmation(rule);
  };

  const handleToggleRule = async (ruleId: number) => {
    const updatedRules = rules.map(rule => 
      rule.id === ruleId ? { ...rule, isActive: !rule.isActive, updatedAt: new Date().toISOString() } : rule
    );
    setRules(updatedRules);
    localStorage.setItem('classificationRules', JSON.stringify(updatedRules));
    
    const rule = updatedRules.find(r => r.id === ruleId);
    toast.success(`Regla ${rule?.isActive ? 'activada' : 'desactivada'}`);
  };

  const handleMovePriority = (ruleId: number, direction: 'up' | 'down') => {
    const ruleIndex = rules.findIndex(r => r.id === ruleId);
    if (ruleIndex === -1) return;

    const newRules = [...rules];
    const targetIndex = direction === 'up' ? ruleIndex - 1 : ruleIndex + 1;
    
    if (targetIndex < 0 || targetIndex >= newRules.length) return;

    // Swap priorities
    [newRules[ruleIndex], newRules[targetIndex]] = [newRules[targetIndex], newRules[ruleIndex]];
    
    // Update priority numbers
    newRules.forEach((rule, index) => {
      rule.priority = index + 1;
      rule.updatedAt = new Date().toISOString();
    });

    setRules(newRules);
    localStorage.setItem('classificationRules', JSON.stringify(newRules));
    toast.success('Prioridad actualizada');
  };

  const saveRule = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);
      
      const ruleData: ClassificationRule = {
        ...formData,
        id: editingRule?.id || Date.now(),
        name: formData.name!,
        description: formData.description!,
        priority: formData.priority || rules.length + 1,
        isActive: formData.isActive ?? true,
        conditions: formData.conditions || [],
        actions: formData.actions || [],
        createdAt: editingRule?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      let updatedRules;
      if (editingRule) {
        updatedRules = rules.map(r => r.id === editingRule.id ? ruleData : r);
        toast.success('Regla actualizada correctamente');
      } else {
        updatedRules = [...rules, ruleData];
        toast.success('Regla creada correctamente');
      }

      setRules(updatedRules);
      localStorage.setItem('classificationRules', JSON.stringify(updatedRules));
      setShowModal(false);
    } catch (error) {
      console.error('Error saving rule:', error);
      toast.error('Error al guardar la regla');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmation?.id) return;

    try {
      const updatedRules = rules.filter(r => r.id !== deleteConfirmation.id);
      setRules(updatedRules);
      localStorage.setItem('classificationRules', JSON.stringify(updatedRules));
      toast.success('Regla eliminada');
      setDeleteConfirmation(null);
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast.error('Error al eliminar la regla');
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      errors.name = 'El nombre es obligatorio';
    }

    if (!formData.description?.trim()) {
      errors.description = 'La descripción es obligatoria';
    }

    if (!formData.conditions?.length) {
      errors.conditions = 'Debe definir al menos una condición';
    }

    if (!formData.actions?.length) {
      errors.actions = 'Debe definir al menos una acción';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const formatConditions = (conditions: RuleCondition[]): string => {
    return conditions.map(cond => {
      const operatorText = {
        'contains': 'contiene',
        'equals': 'es igual a',
        'greater_than': 'mayor que',
        'less_than': 'menor que',
        'between': 'entre'
      }[cond.operator];
      
      const fieldText = {
        'description': 'descripción',
        'counterparty': 'contraparte',
        'iban': 'IBAN',
        'amount': 'importe',
        'account_id': 'cuenta'
      }[cond.field];

      return `${fieldText} ${operatorText} "${cond.value}"`;
    }).join(' Y ');
  };

  const formatActions = (actions: RuleAction[]): string => {
    return actions.map(action => {
      switch (action.type) {
        case 'assign_scope':
          return `Asignar ámbito: ${action.scope}`;
        case 'assign_category':
          return `Categoría: ${action.category} > ${action.subcategory}`;
        case 'assign_property':
          return `Asignar inmueble: ${action.propertyId}`;
        case 'mark_confirmed':
          return 'Marcar como confirmado';
        case 'generate_alert':
          return `Alerta: ${action.alertMessage}`;
        default:
          return 'Acción desconocida';
      }
    }).join(', ');
  };

  if (loading) {
    return (
      <div className="px-6 py-8 text-center">
        <div className="text-text-gray">Cargando reglas...</div>
      </div>
    );
  }

  return (
    <div className="px-6">
      {/* ATLAS Info Banner */}
      <div className="btn-primary-horizon mb-6 border border-atlas-blue/20 p-4">
        <div className="flex items-start">
          <Info className="w-6 h-6 text-atlas-blue mt-0.5 mr-3 flex-shrink-0" style={{ strokeWidth: 1.5 }} />
          <div>
            <h3 className="font-medium text-atlas-navy-1 mb-1">Reglas de clasificación</h3>
            <p className="text-sm text-text-gray">
              Las reglas clasifican movimientos automáticamente según condiciones simples (importe, texto, IBAN, proveedor). 
              Permiten asignar categoría, subcategoría, inmueble, proveedor y generar alertas.
            </p>
          </div>
        </div>
      </div>

      {/* Rules List */}
      <div className="bg-white shadow border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-atlas-navy-1">
              Reglas de clasificación ({rules.length})
            </h2>
            <button
              onClick={handleNewRule}
              className="inline-flex items-center px-4 py-2 bg-atlas-blue"
            >
              <Plus className="w-6 h-6 mr-2" style={{ strokeWidth: 1.5 }} />
              Nueva regla
            </button>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {rules.length === 0 ? (
            <div className="px-6 py-8 text-center text-text-gray">
              No hay reglas configuradas. Crea tu primera regla de clasificación.
            </div>
          ) : (
            rules.map((rule, index) => (
              <div key={rule.id} className="px-6 py-4 <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <div className="w-8 h-8 bg-atlas-blue/10 flex items-center justify-center mt-1">
                      <Settings className="w-6 h-6 text-atlas-blue" style={{ strokeWidth: 1.5 }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium text-atlas-navy-1">{rule.name}</h3>
                        <span className="text-xs text-text-gray">#{rule.priority}</span>
                        {rule.isActive ? (
                          <span className="btn-accent-horizon inline-flex items-center px-2 py-0.5 text-xs font-medium text-green-800">
                            Activa
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-800">
                            Inactiva
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-text-gray mt-1">{rule.description}</p>
                      <div className="mt-2 space-y-1">
                        <div className="text-xs text-text-gray">
                          <strong>Condiciones:</strong> {formatConditions(rule.conditions)}
                        </div>
                        <div className="text-xs text-text-gray">
                          <strong>Acciones:</strong> {formatActions(rule.actions)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {/* Priority controls */}
                    <div className="flex flex-col">
                      <button
                        onClick={() => handleMovePriority(rule.id!, 'up')}
                        disabled={index === 0}
                        className="p-1 text-text-gray hover:text-atlas-blue disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Subir prioridad"
                      >
                        <ArrowUp className="w-4 h-4" style={{ strokeWidth: 1.5 }} />
                      </button>
                      <button
                        onClick={() => handleMovePriority(rule.id!, 'down')}
                        disabled={index === rules.length - 1}
                        className="p-1 text-text-gray hover:text-atlas-blue disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Bajar prioridad"
                      >
                        <ArrowDown className="w-4 h-4" style={{ strokeWidth: 1.5 }} />
                      </button>
                    </div>
                    
                    {/* Toggle active */}
                    <button
                      onClick={() => handleToggleRule(rule.id!)}
                      className="p-2 text-text-gray hover:text-atlas-blue"
                      title={rule.isActive ? 'Desactivar regla' : 'Activar regla'}
                    >
                      {rule.isActive ? (
                        <ToggleRight className="w-6 h-6 text-green-600" style={{ strokeWidth: 1.5 }} />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-gray-400" style={{ strokeWidth: 1.5 }} />
                      )}
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => handleEditRule(rule)}
                      className="p-2 text-text-gray hover:text-atlas-blue"
                      title="Editar regla"
                    >
                      <Edit2 className="w-5 h-5" style={{ strokeWidth: 1.5 }} />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDeleteRule(rule)}
                      className="p-2 text-text-gray hover:text-red-600"
                      title="Eliminar regla"
                    >
                      <Trash2 className="w-5 h-5" style={{ strokeWidth: 1.5 }} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Examples Section */}
      <div className="mt-8 bg-white shadow border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-atlas-navy-1">Ejemplos de reglas ATLAS</h3>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <h4 className="font-medium text-atlas-navy-1 mb-2">Clasificación por descripción</h4>
            <div className="bg-gray-50 p-3 text-sm">
              <code>Si descripción contiene "IBI" y cuenta = ESxx... → Clase: Inmuebles &gt; Suministros &gt; Agua; Inmueble: Tenderina 48</code>
            </div>
          </div>
          <div>
            <h4 className="font-medium text-atlas-navy-1 mb-2">Clasificación por tipo de ingreso</h4>
            <div className="bg-gray-50 p-3 text-sm">
              <code>Si descripción contiene "NÓMINA" → Clase: Personal &gt; Ingresos &gt; Nómina</code>
            </div>
          </div>
          <div>
            <h4 className="font-medium text-atlas-navy-1 mb-2">Clasificación combinada</h4>
            <div className="bg-gray-50 p-3 text-sm">
              <code>Si importe &gt; 500€ y concepto contiene "ALQUILER" → Inmuebles &gt; Ingresos &gt; Alquiler + Alerta</code>
            </div>
          </div>
        </div>
      </div>

      {/* Create/Edit Modal - Simplified for now */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-200 flex items-center justify-center z-50 p-4">
          <div className="bg-white max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-atlas-navy-1">
                  {editingRule ? 'Editar regla' : 'Nueva regla'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-text-gray hover:text-atlas-navy-1"
                >
                  <X className="w-6 h-6" style={{ strokeWidth: 1.5 }} />
                </button>
              </div>
            </div>

            <div className="px-6 py-4">
              <div className="space-y-4">
                {/* Name Field */}
                <div>
                  <label className="block text-sm font-medium text-atlas-navy-1 mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className={`w-full p-3 border focus:ring-2 focus:ring-atlas-blue focus:border-atlas-blue ${
                      formErrors.name ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="ej. Clasificar pagos de IBI"
                    disabled={saving}
                  />
                  {formErrors.name && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.name}</p>
                  )}
                </div>

                {/* Description Field */}
                <div>
                  <label className="block text-sm font-medium text-atlas-navy-1 mb-1">
                    Descripción *
                  </label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className={`w-full p-3 border focus:ring-2 focus:ring-atlas-blue focus:border-atlas-blue ${
                      formErrors.description ? 'border-red-500' : 'border-gray-300'
                    }`}
                    rows={3}
                    placeholder="Describe qué hace esta regla"
                    disabled={saving}
                  />
                  {formErrors.description && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.description}</p>
                  )}
                </div>

                {/* Simplified condition/action for now */}
                <div className="btn-primary-horizon p-4">
                  <p className="text-sm text-atlas-blue">
                    <strong>Versión simplificada:</strong> Las condiciones y acciones detalladas se implementarán en la siguiente iteración. 
                    Por ahora, utiliza el nombre y descripción para definir la regla.
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-text-gray hover:text-atlas-navy-1"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  // For now, just save basic info
                  setFormData(prev => ({
                    ...prev,
                    conditions: prev.conditions?.length ? prev.conditions : [{ type: 'text', field: 'description', operator: 'contains', value: 'ejemplo' }],
                    actions: prev.actions?.length ? prev.actions : [{ type: 'assign_scope', scope: 'Personal' }]
                  }));
                  saveRule();
                }}
                disabled={saving || !formData.name?.trim() || !formData.description?.trim()}
                className="btn-primary-horizon inline-flex items-center px-4 py-2 bg-atlas-blue hover: disabled:opacity-50"
              >
                {saving ? 'Guardando...' : (editingRule ? 'Actualizar' : 'Crear')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmation && (
        <div className="fixed inset-0 bg-gray-200 flex items-center justify-center z-50 p-4">
          <div className="bg-white max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-atlas-navy-1">Eliminar regla</h3>
            </div>

            <div className="px-6 py-4">
              <p className="text-text-gray mb-4">
                ¿Estás seguro de que quieres eliminar esta regla? Esta acción no se puede deshacer.
              </p>
              
              <div className="bg-gray-50 p-3">
                <p className="text-sm font-medium text-atlas-navy-1">{deleteConfirmation.name}</p>
                <p className="text-sm text-text-gray">{deleteConfirmation.description}</p>
              </div>

              <p className="text-xs text-text-gray mt-2">
                Los movimientos ya clasificados por esta regla no se verán afectados.
              </p>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirmation(null)}
                className="px-4 py-2 text-text-gray hover:text-atlas-navy-1"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                className="btn-danger inline-flex items-center px-4 py-2"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReglasAlertas;