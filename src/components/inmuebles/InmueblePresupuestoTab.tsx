import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  Landmark,
  Zap,
  Building,
  Shield,
  Wrench,
  Settings,
  MoreHorizontal,
  Eye,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { OpexRule, Account, initDB, OpexCategory, ExpenseBusinessType } from '../../services/db';
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

interface OneOffExpenseFormData {
  concepto: string;
  amount: string;
  date: string;
  accountId: string;
}

type ExpenseFilter = 'todos' | ExpenseBusinessType;

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

const BUSINESS_TYPE_LABELS: Record<ExpenseBusinessType, string> = {
  recurrente: 'Gasto recurrente',
  reparacion: 'Reparación',
  mejora: 'Mejoras',
  mobiliario: 'Mobiliario y equipamiento',
};

const FILTER_PILLS: { id: ExpenseFilter; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'recurrente', label: 'Recurrentes' },
  { id: 'reparacion', label: 'Reparación' },
  { id: 'mejora', label: 'Mejoras' },
  { id: 'mobiliario', label: 'Mobiliario y equipamiento' },
];

const detectExpenseBusinessType = (rule: OpexRule): ExpenseBusinessType => {
  if (rule.businessType) return rule.businessType;
  const concept = (rule.concepto || '').toLowerCase();
  if (/mobili|mueble|electro|equipamiento|menaje/.test(concept)) return 'mobiliario';
  if (/mejora|reforma|capex|obra/.test(concept)) return 'mejora';
  if (/repar|conserv|manten|aver[ií]a|pintura|fontaner|electric/.test(concept)) return 'reparacion';
  return 'recurrente';
};

const getCategoryByType = (type: ExpenseBusinessType): OpexCategory => {
  switch (type) {
    case 'reparacion':
      return 'servicio';
    case 'mejora':
      return 'gestion';
    case 'mobiliario':
      return 'otro';
    default:
      return 'otro';
  }
};

const emptyOneOffForm: OneOffExpenseFormData = {
  concepto: '',
  amount: '',
  date: '',
  accountId: '',
};

const InmueblePresupuestoTab: React.FC<InmueblePresupuestoTabProps> = ({ propertyId }) => {
  const [rules, setRules] = useState<OpexRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<OpexRule | undefined>(undefined);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showOneOffForm, setShowOneOffForm] = useState(false);
  const [selectedType, setSelectedType] = useState<ExpenseBusinessType>('recurrente');
  const [activeFilter, setActiveFilter] = useState<ExpenseFilter>('todos');
  const [selectedRule, setSelectedRule] = useState<OpexRule | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [oneOffForm, setOneOffForm] = useState<OneOffExpenseFormData>(emptyOneOffForm);

  useEffect(() => {
    initDB().then((db) => {
      db
        .getAll('accounts')
        .then((all) => {
          setAccounts(all.filter((a) => a.activa && a.status !== 'DELETED'));
        })
        .catch((err) => console.error('Error loading accounts:', err));
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
        await generateBaseOpexForProperty(propertyId);
        const generated = await getOpexRulesForProperty(propertyId);
        setRules(generated);
      } else {
        setRules(data);
      }
    } catch (error) {
      console.error('Error loading OPEX rules:', error);
      toast.error('Error al cargar los gastos');
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const openCreateFlow = () => {
    setEditingRule(undefined);
    setShowTypePicker(true);
  };

  const resetOneOffForm = () => {
    setOneOffForm(emptyOneOffForm);
    setEditingRule(undefined);
    setShowOneOffForm(false);
  };

  const handleTypeSelection = (type: ExpenseBusinessType) => {
    setSelectedType(type);
    setShowTypePicker(false);

    if (type === 'recurrente') {
      setEditingRule(undefined);
      setShowRuleForm(true);
      return;
    }

    setOneOffForm(emptyOneOffForm);
    setShowOneOffForm(true);
  };

  const handleEdit = (rule: OpexRule) => {
    const type = detectExpenseBusinessType(rule);
    setSelectedType(type);
    if (type === 'recurrente') {
      setEditingRule(rule);
      setShowRuleForm(true);
      return;
    }

    setEditingRule(rule);
    setOneOffForm({
      concepto: rule.concepto,
      amount: String(rule.importeEstimado),
      date: '',
      accountId: rule.accountId ? String(rule.accountId) : '',
    });
    setShowOneOffForm(true);
  };

  const handleDelete = async (rule: OpexRule) => {
    if (!rule.id) return;
    if (!window.confirm(`¿Eliminar el gasto "${rule.concepto}"?`)) return;
    try {
      await deleteOpexRule(rule.id);
      toast.success('Gasto eliminado');
      await loadRules();
    } catch {
      toast.error('Error al eliminar el gasto');
    }
  };

  const handleSaveRule = async (
    formData: Omit<OpexRule, 'createdAt' | 'updatedAt'> & { id?: number }
  ) => {
    try {
      await saveOpexRule({ ...formData, businessType: selectedType } as OpexRule);
      toast.success(formData.id ? 'Gasto actualizado' : 'Gasto creado');
      setShowRuleForm(false);
      setEditingRule(undefined);
      await loadRules();
    } catch {
      toast.error('Error al guardar el gasto');
    }
  };

  const handleSaveOneOff = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(oneOffForm.amount);
    if (!oneOffForm.concepto.trim()) {
      toast.error('El concepto es obligatorio');
      return;
    }
    if (!amount || amount <= 0) {
      toast.error('El importe debe ser mayor que 0');
      return;
    }

    const selectedDate = oneOffForm.date ? new Date(oneOffForm.date) : null;

    const payload: OpexRule = {
      id: editingRule?.id,
      propertyId,
      categoria: getCategoryByType(selectedType),
      concepto: oneOffForm.concepto.trim(),
      importeEstimado: amount,
      frecuencia: 'anual',
      diaCobro: selectedDate ? selectedDate.getDate() : 1,
      mesInicio: selectedDate ? selectedDate.getMonth() + 1 : undefined,
      activo: true,
      accountId: oneOffForm.accountId ? Number(oneOffForm.accountId) : undefined,
      businessType: selectedType,
      createdAt: editingRule?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveOpexRule(payload);
      toast.success(editingRule?.id ? 'Gasto actualizado' : 'Gasto creado');
      resetOneOffForm();
      await loadRules();
    } catch {
      toast.error('Error al guardar el gasto');
    }
  };

  const handleCancelRuleForm = () => {
    setShowRuleForm(false);
    setEditingRule(undefined);
  };

  const activeRules = rules.filter((r) => r.activo);
  const annualTotal = activeRules.reduce((sum, r) => sum + getAnnualAmount(r), 0);
  const annualTotalsByType = activeRules.reduce<Record<ExpenseBusinessType, number>>(
    (acc, rule) => {
      const type = detectExpenseBusinessType(rule);
      acc[type] += getAnnualAmount(rule);
      return acc;
    },
    {
      recurrente: 0,
      reparacion: 0,
      mejora: 0,
      mobiliario: 0,
    }
  );

  const visibleRules = rules.filter((rule) => {
    if (activeFilter === 'todos') return true;
    return detectExpenseBusinessType(rule) === activeFilter;
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
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            Presupuesto anual estimado:{' '}
            <span className="font-semibold text-gray-900">{formatEuroLocal(annualTotal)}</span>
          </p>
        </div>
        <button
          onClick={openCreateFlow}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-atlas-blue rounded-md hover:bg-atlas-blue/90"
        >
          <Plus className="h-4 w-4" />
          Añadir gasto
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

      <div className="flex flex-wrap gap-2">
        {FILTER_PILLS.map((pill) => (
          <button
            key={pill.id}
            onClick={() => setActiveFilter(pill.id)}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              activeFilter === pill.id
                ? 'bg-atlas-blue text-white border-atlas-blue'
                : 'bg-white text-gray-700 border-gray-300 hover:border-atlas-blue'
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <AlertCircle className="h-8 w-8 text-gray-400 mb-2" />
          <p className="text-sm text-gray-500">No hay gastos para este inmueble.</p>
          <button onClick={openCreateFlow} className="mt-3 text-sm text-atlas-blue hover:underline">
            Añadir el primer gasto
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Concepto</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Importe/ciclo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Frecuencia</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cuenta</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {visibleRules.map((rule) => (
                <tr key={rule.id} className={`hover:bg-gray-50 transition-colors ${!rule.activo ? 'opacity-50' : ''}`}>
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
                  <td className="px-4 py-3 text-gray-600">{BUSINESS_TYPE_LABELS[detectExpenseBusinessType(rule)]}</td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {rule.frecuencia === 'meses_especificos' && rule.asymmetricPayments?.length ? (
                      <span title="Pagos asimétricos por mes">
                        {formatEuroLocal(rule.asymmetricPayments.reduce((s, p) => s + p.importe, 0))}
                        <span className="ml-1 text-xs text-gray-400">(total anual)</span>
                      </span>
                    ) : (
                      formatEuroLocal(rule.importeEstimado)
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{FREQUENCY_LABELS[rule.frecuencia] ?? rule.frecuencia}</td>
                  <td className="px-4 py-3 text-gray-600 text-sm">{getAccountName(rule.accountId)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setSelectedRule(rule)}
                        className="p-1 text-gray-400 hover:text-atlas-blue transition-colors"
                        title="Ver detalle"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleEdit(rule)} className="p-1 text-gray-400 hover:text-atlas-blue transition-colors" title="Editar gasto">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(rule)} className="p-1 text-gray-400 hover:text-red-500 transition-colors" title="Eliminar gasto">
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

      {showTypePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--n-300)]/60 px-4">
          <div className="w-full max-w-lg bg-white rounded-lg shadow-xl p-5">
            <h3 className="text-lg font-semibold text-gray-900">Selecciona tipo de gasto</h3>
            <p className="text-sm text-gray-500 mt-1">Elige cómo quieres registrar el gasto.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4">
              {(Object.entries(BUSINESS_TYPE_LABELS) as [ExpenseBusinessType, string][]).map(([type, label]) => (
                <button
                  key={type}
                  onClick={() => handleTypeSelection(type)}
                  className="text-left px-4 py-3 border border-gray-300 rounded-md hover:border-atlas-blue hover:bg-atlas-blue/5"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-4 text-right">
              <button onClick={() => setShowTypePicker(false)} className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-md">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showRuleForm && (
        <OpexRuleForm
          propertyId={propertyId}
          rule={editingRule}
          onSave={handleSaveRule}
          onCancel={handleCancelRuleForm}
        />
      )}

      {showOneOffForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--n-300)]/60 px-4">
          <div className="w-full max-w-lg bg-white rounded-lg shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">
                {editingRule?.id ? 'Editar gasto' : `Nuevo gasto de ${BUSINESS_TYPE_LABELS[selectedType].toLowerCase()}`}
              </h3>
              <button onClick={resetOneOffForm} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSaveOneOff} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Concepto</label>
                <input
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                  value={oneOffForm.concepto}
                  onChange={(e) => setOneOffForm((prev) => ({ ...prev, concepto: e.target.value }))}
                  placeholder="Describe el gasto"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Importe (€)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                  value={oneOffForm.amount}
                  onChange={(e) => setOneOffForm((prev) => ({ ...prev, amount: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha (opcional)</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                  value={oneOffForm.date}
                  onChange={(e) => setOneOffForm((prev) => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta bancaria</label>
                <select
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                  value={oneOffForm.accountId}
                  onChange={(e) => setOneOffForm((prev) => ({ ...prev, accountId: e.target.value }))}
                >
                  <option value="">Sin vincular</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.alias ?? acc.banco?.name ?? `Cuenta …${acc.iban.slice(-4)}`} – {acc.ibanMasked ?? acc.iban}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={resetOneOffForm} className="px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-600">
                  Cancelar
                </button>
                <button type="submit" className="px-3 py-2 text-sm rounded-md text-white bg-atlas-blue hover:bg-atlas-blue/90">
                  Guardar gasto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--n-300)]/60 px-4">
          <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-5">
            <h3 className="text-base font-semibold text-gray-900">Detalle del gasto</h3>
            <div className="mt-4 space-y-2 text-sm">
              <p><span className="text-gray-500">Concepto:</span> <span className="text-gray-900 font-medium">{selectedRule.concepto}</span></p>
              <p><span className="text-gray-500">Tipo:</span> {BUSINESS_TYPE_LABELS[detectExpenseBusinessType(selectedRule)]}</p>
              <p><span className="text-gray-500">Categoría:</span> {CATEGORY_LABELS[selectedRule.categoria] ?? selectedRule.categoria}</p>
              <p><span className="text-gray-500">Importe:</span> {formatEuroLocal(selectedRule.importeEstimado)}</p>
              <p><span className="text-gray-500">Frecuencia:</span> {FREQUENCY_LABELS[selectedRule.frecuencia] ?? selectedRule.frecuencia}</p>
              <p><span className="text-gray-500">Cuenta:</span> {getAccountName(selectedRule.accountId)}</p>
            </div>
            <div className="mt-4 text-right">
              <button onClick={() => setSelectedRule(null)} className="px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-600">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InmueblePresupuestoTab;
