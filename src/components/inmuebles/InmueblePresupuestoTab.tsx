import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { OpexRule } from '../../services/db';
import {
  getOpexRulesForProperty,
  generateBaseOpexForProperty,
  deleteOpexRule,
  saveOpexRule,
} from '../../services/opexService';
import OpexRuleForm from './OpexRuleForm';

interface InmueblePresupuestoTabProps {
  propertyId: number;
}

const FREQUENCY_LABELS: Record<string, string> = {
  semanal: 'Semanal',
  mensual: 'Mensual',
  bimestral: 'Bimestral',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
  meses_especificos: 'Meses específicos',
};

const CATEGORY_LABELS: Record<string, string> = {
  impuesto: 'Impuesto',
  suministro: 'Suministro',
  comunidad: 'Comunidad',
  seguro: 'Seguro',
  servicio: 'Servicio',
  gestion: 'Gestión',
  otro: 'Otro',
};

const CATEGORY_COLORS: Record<string, string> = {
  impuesto: 'bg-red-100 text-red-700',
  suministro: 'bg-blue-100 text-blue-700',
  comunidad: 'bg-purple-100 text-purple-700',
  seguro: 'bg-green-100 text-green-700',
  servicio: 'bg-orange-100 text-orange-700',
  gestion: 'bg-yellow-100 text-yellow-700',
  otro: 'bg-gray-100 text-gray-700',
};

const formatEuroLocal = (amount: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);

const InmueblePresupuestoTab: React.FC<InmueblePresupuestoTabProps> = ({ propertyId }) => {
  const [rules, setRules] = useState<OpexRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<OpexRule | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);

  const loadRules = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getOpexRulesForProperty(propertyId);
      if (data.length === 0) {
        // Auto-generate base template when no rules exist
        await generateBaseOpexForProperty(propertyId);
        const generated = await getOpexRulesForProperty(propertyId);
        setRules(generated);
      } else {
        setRules(data);
      }
    } catch (error) {
      console.error('Error loading OPEX rules:', error);
      toast.error('Error al cargar las reglas OPEX');
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const handleAddNew = () => {
    setEditingRule(undefined);
    setShowForm(true);
  };

  const handleEdit = (rule: OpexRule) => {
    setEditingRule(rule);
    setShowForm(true);
  };

  const handleDelete = async (rule: OpexRule) => {
    if (!rule.id) return;
    if (!window.confirm(`¿Eliminar la regla "${rule.concepto}"?`)) return;
    try {
      await deleteOpexRule(rule.id);
      toast.success('Regla eliminada');
      await loadRules();
    } catch {
      toast.error('Error al eliminar la regla');
    }
  };

  const handleSave = async (
    formData: Omit<OpexRule, 'createdAt' | 'updatedAt'> & { id?: number }
  ) => {
    try {
      await saveOpexRule(formData as OpexRule);
      toast.success(formData.id ? 'Regla actualizada' : 'Regla creada');
      setShowForm(false);
      setEditingRule(undefined);
      await loadRules();
    } catch {
      toast.error('Error al guardar la regla');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingRule(undefined);
  };

  // Calculate annual total
  const annualTotal = rules
    .filter((r) => r.activo)
    .reduce((sum, r) => {
      const cyclesPerYear: Record<string, number> = {
        semanal: 52,
        mensual: 12,
        bimestral: 6,
        trimestral: 4,
        semestral: 2,
        anual: 1,
        meses_especificos: r.mesesCobro?.length ?? 1,
      };
      const cycles = cyclesPerYear[r.frecuencia] ?? 1;
      // For asymmetric payments, use the sum of all monthly amounts
      if (r.frecuencia === 'meses_especificos' && r.asymmetricPayments?.length) {
        return sum + r.asymmetricPayments.reduce((s, p) => s + p.importe, 0);
      }
      return sum + r.importeEstimado * cycles;
    }, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 border-2 border-atlas-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            Presupuesto anual estimado:{' '}
            <span className="font-semibold text-gray-900">{formatEuroLocal(annualTotal)}</span>
          </p>
        </div>
        <button
          onClick={handleAddNew}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-atlas-blue rounded-md hover:bg-atlas-blue/90"
        >
          <Plus className="h-4 w-4" />
          Añadir regla
        </button>
      </div>

      {/* Rules table */}
      {rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <AlertCircle className="h-8 w-8 text-gray-400 mb-2" />
          <p className="text-sm text-gray-500">No hay reglas OPEX para este inmueble.</p>
          <button
            onClick={handleAddNew}
            className="mt-3 text-sm text-atlas-blue hover:underline"
          >
            Añadir la primera regla
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Concepto
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Categoría
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Importe/ciclo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Frecuencia
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cuenta
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {rules.map((rule) => (
                <tr
                  key={rule.id}
                  className={`hover:bg-gray-50 transition-colors ${!rule.activo ? 'opacity-50' : ''}`}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{rule.concepto}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        CATEGORY_COLORS[rule.categoria] ?? 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {CATEGORY_LABELS[rule.categoria] ?? rule.categoria}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {rule.frecuencia === 'meses_especificos' && rule.asymmetricPayments?.length ? (
                      <span title="Pagos asimétricos por mes">
                        {formatEuroLocal(
                          rule.asymmetricPayments.reduce((s, p) => s + p.importe, 0)
                        )}
                        <span className="ml-1 text-xs text-gray-400">(total anual)</span>
                      </span>
                    ) : (
                      formatEuroLocal(rule.importeEstimado)
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {FREQUENCY_LABELS[rule.frecuencia] ?? rule.frecuencia}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {rule.accountId ? `#${rule.accountId}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleEdit(rule)}
                        className="p-1 text-gray-400 hover:text-atlas-blue transition-colors"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(rule)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit/Add modal */}
      {showForm && (
        <OpexRuleForm
          propertyId={propertyId}
          rule={editingRule}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
};

export default InmueblePresupuestoTab;
