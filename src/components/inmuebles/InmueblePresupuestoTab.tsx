import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, AlertCircle, Landmark, Zap, Building, Shield, Wrench, Settings, MoreHorizontal } from 'lucide-react';
import toast from 'react-hot-toast';
import { OpexRule, Account, initDB } from '../../services/db';
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

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  impuesto: Landmark,
  suministro: Zap,
  comunidad: Building,
  seguro: Shield,
  servicio: Wrench,
  gestion: Settings,
  otro: MoreHorizontal,
};

const formatEuroLocal = (amount: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);

const getAnnualAmount = (rule: OpexRule): number => {
  const cyclesPerYear: Record<string, number> = {
    semanal: 52,
    mensual: 12,
    bimestral: 6,
    trimestral: 4,
    semestral: 2,
    anual: 1,
    meses_especificos: rule.mesesCobro?.length ?? 1,
  };
  const cycles = cyclesPerYear[rule.frecuencia] ?? 1;
  if (rule.frecuencia === 'meses_especificos' && rule.asymmetricPayments?.length) {
    return rule.asymmetricPayments.reduce((sum, p) => sum + p.importe, 0);
  }
  return rule.importeEstimado * cycles;
};

type ExpenseBusinessType = 'recurrente' | 'reparacion' | 'mejora' | 'mobiliario';

const BUSINESS_TYPE_LABELS: Record<ExpenseBusinessType, string> = {
  recurrente: 'Gasto recurrente',
  reparacion: 'Reparación y conservación',
  mejora: 'Mejora (CAPEX)',
  mobiliario: 'Mobiliario y equipamiento',
};

const detectExpenseBusinessType = (rule: OpexRule): ExpenseBusinessType => {
  const concept = (rule.concepto || '').toLowerCase();
  if (/mobili|mueble|electro|equipamiento|menaje/.test(concept)) return 'mobiliario';
  if (/mejora|reforma|capex|obra/.test(concept)) return 'mejora';
  if (/repar|conserv|manten|aver[ií]a|pintura|fontaner|electric/.test(concept)) return 'reparacion';
  return 'recurrente';
};

const InmueblePresupuestoTab: React.FC<InmueblePresupuestoTabProps> = ({ propertyId }) => {
  const [rules, setRules] = useState<OpexRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<OpexRule | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    initDB().then((db) => {
      db.getAll('accounts').then((all) => {
        setAccounts(all.filter((a) => a.activa && a.status !== 'DELETED'));
      }).catch((err) => console.error('Error loading accounts:', err));
    }).catch((err) => console.error('Error initializing DB:', err));
  }, []);

  const getAccountName = (accountId?: number): string => {
    if (!accountId) return '—';
    const acc = accounts.find((a) => a.id === accountId);
    if (!acc) return '—';
    if (acc.alias) return acc.alias;
    const iban = acc.iban ?? '';
    const last4 = iban.length >= 4 ? iban.slice(-4) : iban;
    if (acc.banco?.name) return `${acc.banco.name} ···${last4}`;
    return last4 ? `···${last4}` : '—';
  };

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

  const activeRules = rules.filter((r) => r.activo);
  const annualTotal = activeRules.reduce((sum, r) => sum + getAnnualAmount(r), 0);
  const annualTotalsByType = activeRules.reduce<Record<ExpenseBusinessType, number>>((acc, rule) => {
    const type = detectExpenseBusinessType(rule);
    acc[type] += getAnnualAmount(rule);
    return acc;
  }, {
    recurrente: 0,
    reparacion: 0,
    mejora: 0,
    mobiliario: 0,
  });

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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {(Object.entries(BUSINESS_TYPE_LABELS) as [ExpenseBusinessType, string][]).map(([type, label]) => (
          <div key={type} className="rounded-lg border border-neutral-200 bg-white p-3">
            <p className="text-xs text-neutral-500">{label}</p>
            <p className="text-sm font-semibold text-neutral-900">{formatEuroLocal(annualTotalsByType[type])}</p>
          </div>
        ))}
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
                  Categoría
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Concepto
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
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
                  <td className="px-4 py-3">
                    {(() => {
                      const Icon = CATEGORY_ICONS[rule.categoria] ?? MoreHorizontal;
                      return (
                        <span className="inline-flex items-center gap-1.5 text-gray-700">
                          <Icon className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                          {CATEGORY_LABELS[rule.categoria] ?? rule.categoria}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{rule.concepto}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {BUSINESS_TYPE_LABELS[detectExpenseBusinessType(rule)]}
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
                  <td className="px-4 py-3 text-gray-600 text-sm">
                    {getAccountName(rule.accountId)}
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
