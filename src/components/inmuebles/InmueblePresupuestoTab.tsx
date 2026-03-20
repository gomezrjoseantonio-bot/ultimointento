import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import {
  OpexRule,
  Account,
  initDB,
  OpexCategory,
  ExpenseBusinessType,
  OperacionFiscal,
  MejoraActivo,
  MobiliarioActivo,
} from '../../services/db';
import {
  getOpexRulesForProperty,
  generateBaseOpexForProperty,
  deleteOpexRule,
  saveOpexRule,
} from '../../services/opexService';
import {
  actualizarOperacionFiscal,
  crearOperacionFiscal,
  eliminarOperacionFiscal,
  generarOperacionesDesdeRecurrentes,
  getOperacionesPorInmuebleYEjercicio,
} from '../../services/operacionFiscalService';
import {
  actualizarMejora,
  crearMejora,
  eliminarMejora,
  getMejorasPorInmueble,
} from '../../services/mejoraActivoService';
import {
  actualizarMobiliario,
  crearMobiliario,
  eliminarMobiliario,
  getMobiliarioPorInmueble,
} from '../../services/mobiliarioActivoService';
import OpexRuleForm from './OpexRuleForm';

interface InmueblePresupuestoTabProps {
  propertyId: number;
}

interface OneOffExpenseFormData {
  concepto: string;
  amount: string;
  date: string;
  accountId: string;
  proveedorNIF: string;
  proveedorNombre: string;
  vidaUtil: number;
}

type ExpenseFilter = 'todos' | ExpenseBusinessType;
type ExpenseSource = 'opexRule' | 'operacionFiscal' | 'mejoraActivo' | 'mobiliarioActivo';

type BudgetExpenseRow = {
  id: number;
  source: ExpenseSource;
  businessType: ExpenseBusinessType;
  categoryLabel: string;
  concept: string;
  amount: number;
  frequencyLabel: string;
  accountLabel: string;
  dateLabel: string;
  providerNIF?: string;
  providerName?: string;
  raw: OpexRule | OperacionFiscal | MejoraActivo | MobiliarioActivo;
};

const currentExerciseYear = new Date().getFullYear();

const FREQUENCY_LABELS: Record<string, string> = {
  semanal: 'Semanal',
  mensual: 'Mensual',
  bimestral: 'Bimestral',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
  meses_especificos: 'Meses específicos',
  puntual: 'Puntual',
};

const CATEGORY_LABELS: Record<string, string> = {
  impuesto: 'Impuesto',
  suministro: 'Suministro',
  comunidad: 'Comunidad',
  seguro: 'Seguro',
  servicio: 'Servicio',
  gestion: 'Gestión',
  otro: 'Otro',
  reparacion: 'Reparación',
  mejora: 'Mejora',
  mobiliario: 'Mobiliario',
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  impuesto: Landmark,
  suministro: Zap,
  comunidad: Building,
  seguro: Shield,
  servicio: Wrench,
  gestion: Settings,
  otro: MoreHorizontal,
  reparacion: Wrench,
  mejora: Settings,
  mobiliario: Building,
};

const formatEuroLocal = (amount: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);

const formatDateLabel = (date?: string) => {
  if (!date) return '—';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat('es-ES').format(parsed);
};

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
  proveedorNIF: '',
  proveedorNombre: '',
  vidaUtil: 10,
};

const InmueblePresupuestoTab: React.FC<InmueblePresupuestoTabProps> = ({ propertyId }) => {
  const [rules, setRules] = useState<OpexRule[]>([]);
  const [repairOperations, setRepairOperations] = useState<OperacionFiscal[]>([]);
  const [improvements, setImprovements] = useState<MejoraActivo[]>([]);
  const [furniture, setFurniture] = useState<MobiliarioActivo[]>([]);
  const [propertyAlias, setPropertyAlias] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<OpexRule | undefined>(undefined);
  const [editingEntry, setEditingEntry] = useState<BudgetExpenseRow | null>(null);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showOneOffForm, setShowOneOffForm] = useState(false);
  const [selectedType, setSelectedType] = useState<ExpenseBusinessType>('recurrente');
  const [activeFilter, setActiveFilter] = useState<ExpenseFilter>('todos');
  const [selectedExpense, setSelectedExpense] = useState<BudgetExpenseRow | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [oneOffForm, setOneOffForm] = useState<OneOffExpenseFormData>(emptyOneOffForm);

  const getAccountName = useCallback((accountId?: number): string => {
    if (!accountId) return '—';
    const acc = accounts.find((a) => a.id === accountId);
    if (!acc) return '—';
    if (acc.alias) return acc.alias;
    const iban = acc.iban ?? '';
    const last4 = iban.length >= 4 ? iban.slice(-4) : iban;
    if (acc.banco?.name) return `${acc.banco.name} ···${last4}`;
    return last4 ? `···${last4}` : '—';
  }, [accounts]);

  const getAccountIdFromLabel = useCallback((label?: string): string => {
    if (!label || label === '—') return '';
    const match = accounts.find((account) => getAccountName(account.id) === label);
    return match?.id ? String(match.id) : '';
  }, [accounts, getAccountName]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const db = await initDB();
      const [allAccounts, property] = await Promise.all([
        db.getAll('accounts'),
        db.get('properties', propertyId),
      ]);
      setAccounts(allAccounts.filter((a) => a.activa && a.status !== 'DELETED'));
      setPropertyAlias(property?.alias || '');

      let opexRules = await getOpexRulesForProperty(propertyId);
      if (opexRules.length === 0) {
        await generateBaseOpexForProperty(propertyId);
        opexRules = await getOpexRulesForProperty(propertyId);
      }
      setRules(opexRules);

      await generarOperacionesDesdeRecurrentes(propertyId, currentExerciseYear);

      const [operaciones, mejoras, mobiliario] = await Promise.all([
        getOperacionesPorInmuebleYEjercicio(propertyId, currentExerciseYear),
        getMejorasPorInmueble(propertyId),
        getMobiliarioPorInmueble(propertyId),
      ]);

      setRepairOperations(operaciones.filter((op) => op.casillaAEAT === '0106'));
      setImprovements(mejoras);
      setFurniture(mobiliario);
    } catch (error) {
      console.error('Error loading budget expenses:', error);
      toast.error('Error al cargar los gastos');
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreateFlow = () => {
    setEditingRule(undefined);
    setEditingEntry(null);
    setShowTypePicker(true);
  };

  const resetOneOffForm = () => {
    setOneOffForm(emptyOneOffForm);
    setEditingEntry(null);
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

    setEditingEntry(null);
    setOneOffForm({ ...emptyOneOffForm, vidaUtil: 10 });
    setShowOneOffForm(true);
  };

  const rows = useMemo<BudgetExpenseRow[]>(() => {
    const recurrentRows: BudgetExpenseRow[] = rules.map((rule) => ({
      id: rule.id || 0,
      source: 'opexRule',
      businessType: detectExpenseBusinessType(rule),
      categoryLabel: CATEGORY_LABELS[rule.categoria] ?? rule.categoria,
      concept: rule.concepto,
      amount: rule.importeEstimado,
      frequencyLabel: FREQUENCY_LABELS[rule.frecuencia] ?? rule.frecuencia,
      accountLabel: getAccountName(rule.accountId),
      dateLabel: rule.mesInicio ? `Inicio ${rule.mesInicio}/${currentExerciseYear}` : '—',
      providerNIF: rule.proveedorNIF,
      providerName: rule.proveedorNombre,
      raw: rule,
    }));

    const repairRows: BudgetExpenseRow[] = repairOperations.map((op) => ({
      id: op.id || 0,
      source: 'operacionFiscal',
      businessType: 'reparacion',
      categoryLabel: CATEGORY_LABELS.reparacion,
      concept: op.concepto,
      amount: op.total,
      frequencyLabel: FREQUENCY_LABELS.puntual,
      accountLabel: op.cuentaBancaria || '—',
      dateLabel: formatDateLabel(op.fecha),
      providerNIF: op.proveedorNIF,
      providerName: op.proveedorNombre,
      raw: op,
    }));

    const improvementRows: BudgetExpenseRow[] = improvements.map((mejora) => ({
      id: mejora.id || 0,
      source: 'mejoraActivo',
      businessType: 'mejora',
      categoryLabel: CATEGORY_LABELS.mejora,
      concept: mejora.descripcion,
      amount: mejora.importe,
      frequencyLabel: FREQUENCY_LABELS.puntual,
      accountLabel: mejora.cuentaBancaria || '—',
      dateLabel: formatDateLabel(mejora.fecha),
      providerNIF: mejora.proveedorNIF,
      providerName: mejora.proveedorNombre,
      raw: mejora,
    }));

    const furnitureRows: BudgetExpenseRow[] = furniture.map((mueble) => ({
      id: mueble.id || 0,
      source: 'mobiliarioActivo',
      businessType: 'mobiliario',
      categoryLabel: CATEGORY_LABELS.mobiliario,
      concept: mueble.descripcion,
      amount: mueble.importe,
      frequencyLabel: `${FREQUENCY_LABELS.puntual} · ${mueble.vidaUtil} años`,
      accountLabel: mueble.cuentaBancaria || '—',
      dateLabel: formatDateLabel(mueble.fechaAlta),
      providerNIF: mueble.proveedorNIF,
      providerName: mueble.proveedorNombre,
      raw: mueble,
    }));

    return [...recurrentRows, ...repairRows, ...improvementRows, ...furnitureRows]
      .sort((a, b) => b.dateLabel.localeCompare(a.dateLabel));
  }, [rules, repairOperations, improvements, furniture, getAccountName]);

  const handleEdit = (row: BudgetExpenseRow) => {
    if (row.source === 'opexRule') {
      const rule = row.raw as OpexRule;
      const type = detectExpenseBusinessType(rule);
      setSelectedType(type);
      if (type === 'recurrente') {
        setEditingRule(rule);
        setShowRuleForm(true);
        return;
      }

      setEditingEntry(row);
      setOneOffForm({
        concepto: rule.concepto,
        amount: String(rule.importeEstimado),
        date: '',
        accountId: rule.accountId ? String(rule.accountId) : '',
        proveedorNIF: rule.proveedorNIF || '',
        proveedorNombre: rule.proveedorNombre || '',
        vidaUtil: 10,
      });
      setShowOneOffForm(true);
      return;
    }

    setSelectedType(row.businessType);
    setEditingEntry(row);

    if (row.source === 'operacionFiscal') {
      const op = row.raw as OperacionFiscal;
      setOneOffForm({
        concepto: op.concepto,
        amount: String(op.total),
        date: op.fecha,
        accountId: getAccountIdFromLabel(op.cuentaBancaria),
        proveedorNIF: op.proveedorNIF,
        proveedorNombre: op.proveedorNombre || '',
        vidaUtil: 10,
      });
    } else if (row.source === 'mejoraActivo') {
      const mejora = row.raw as MejoraActivo;
      setOneOffForm({
        concepto: mejora.descripcion,
        amount: String(mejora.importe),
        date: mejora.fecha || '',
        accountId: getAccountIdFromLabel(mejora.cuentaBancaria),
        proveedorNIF: mejora.proveedorNIF,
        proveedorNombre: mejora.proveedorNombre || '',
        vidaUtil: 10,
      });
    } else {
      const mueble = row.raw as MobiliarioActivo;
      setOneOffForm({
        concepto: mueble.descripcion,
        amount: String(mueble.importe),
        date: mueble.fechaAlta,
        accountId: getAccountIdFromLabel(mueble.cuentaBancaria),
        proveedorNIF: mueble.proveedorNIF,
        proveedorNombre: mueble.proveedorNombre || '',
        vidaUtil: mueble.vidaUtil || 10,
      });
    }

    setShowOneOffForm(true);
  };

  const handleDelete = async (row: BudgetExpenseRow) => {
    if (!row.id) return;
    if (!window.confirm(`¿Eliminar el gasto "${row.concept}"?`)) return;
    try {
      if (row.source === 'opexRule') {
        await deleteOpexRule(row.id);
      } else if (row.source === 'operacionFiscal') {
        await eliminarOperacionFiscal(row.id);
      } else if (row.source === 'mejoraActivo') {
        await eliminarMejora(row.id);
      } else {
        await eliminarMobiliario(row.id);
      }
      toast.success('Gasto eliminado');
      await loadData();
    } catch (error) {
      console.error('Error deleting expense:', error);
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
      await loadData();
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
    if (!oneOffForm.proveedorNIF.trim()) {
      toast.error('El NIF del proveedor es obligatorio');
      return;
    }

    const date = oneOffForm.date || new Date().toISOString().split('T')[0];
    const accountLabel = oneOffForm.accountId ? getAccountName(Number(oneOffForm.accountId)) : undefined;

    try {
      if (selectedType === 'reparacion') {
        if (editingEntry?.source === 'operacionFiscal' && editingEntry.id) {
          await actualizarOperacionFiscal(editingEntry.id, {
            fecha: date,
            concepto: oneOffForm.concepto.trim(),
            casillaAEAT: '0106',
            categoriaFiscal: 'reparacion-conservacion',
            total: amount,
            inmuebleId: propertyId,
            inmuebleAlias: propertyAlias || undefined,
            proveedorNIF: oneOffForm.proveedorNIF.trim(),
            proveedorNombre: oneOffForm.proveedorNombre.trim() || undefined,
            cuentaBancaria: accountLabel,
            origen: 'manual',
          });
          toast.success('Gasto de reparación actualizado');
        } else {
          await crearOperacionFiscal({
            fecha: date,
            concepto: oneOffForm.concepto.trim(),
            casillaAEAT: '0106',
            categoriaFiscal: 'reparacion-conservacion',
            total: amount,
            inmuebleId: propertyId,
            inmuebleAlias: propertyAlias || undefined,
            proveedorNIF: oneOffForm.proveedorNIF.trim(),
            proveedorNombre: oneOffForm.proveedorNombre.trim() || undefined,
            cuentaBancaria: accountLabel,
            origen: 'manual',
          });
          toast.success('Gasto de reparación registrado');
        }
      }

      if (selectedType === 'mejora') {
        const payload = {
          inmuebleId: propertyId,
          ejercicio: new Date(date).getFullYear(),
          fecha: date,
          descripcion: oneOffForm.concepto.trim(),
          tipo: 'mejora' as const,
          importe: amount,
          proveedorNIF: oneOffForm.proveedorNIF.trim(),
          proveedorNombre: oneOffForm.proveedorNombre.trim() || undefined,
          cuentaBancaria: accountLabel,
        };

        if (editingEntry?.source === 'mejoraActivo' && editingEntry.id) {
          await actualizarMejora(editingEntry.id, payload);
          toast.success('Mejora del activo actualizada');
        } else {
          await crearMejora(payload);
          toast.success('Mejora del activo registrada');
        }
      }

      if (selectedType === 'mobiliario') {
        const payload = {
          inmuebleId: propertyId,
          descripcion: oneOffForm.concepto.trim(),
          fechaAlta: date,
          importe: amount,
          vidaUtil: oneOffForm.vidaUtil || 10,
          proveedorNIF: oneOffForm.proveedorNIF.trim(),
          proveedorNombre: oneOffForm.proveedorNombre.trim() || undefined,
          cuentaBancaria: accountLabel,
        };

        if (editingEntry?.source === 'mobiliarioActivo' && editingEntry.id) {
          await actualizarMobiliario(editingEntry.id, payload);
          toast.success('Mobiliario actualizado');
        } else {
          await crearMobiliario(payload);
          toast.success('Mobiliario registrado');
        }
      }

      resetOneOffForm();
      await loadData();
    } catch (error) {
      console.error('Error al guardar:', error);
      toast.error('Error al guardar el gasto');
    }
  };

  const handleCancelRuleForm = () => {
    setShowRuleForm(false);
    setEditingRule(undefined);
  };

  const activeRules = rules.filter((r) => r.activo);
  const annualTotalsByType = {
    recurrente: activeRules.reduce((sum, rule) => sum + getAnnualAmount(rule), 0),
    reparacion: repairOperations.reduce((sum, op) => sum + op.total, 0),
    mejora: improvements.reduce((sum, mejora) => sum + mejora.importe, 0),
    mobiliario: furniture.filter((item) => item.activo).reduce((sum, item) => sum + item.importe, 0),
  };
  const annualTotal = Object.values(annualTotalsByType).reduce((sum, value) => sum + value, 0);

  const visibleRows = rows.filter((row) => activeFilter === 'todos' || row.businessType === activeFilter);

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

      {rows.length === 0 ? (
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
              {visibleRows.map((row) => (
                <tr key={`${row.source}-${row.id}`} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    {(() => {
                      const Icon = CATEGORY_ICONS[row.businessType] ?? CATEGORY_ICONS[(row.raw as OpexRule).categoria] ?? MoreHorizontal;
                      return (
                        <span className="inline-flex items-center gap-1.5 text-gray-700">
                          <Icon className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                          {row.categoryLabel}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{row.concept}</td>
                  <td className="px-4 py-3 text-gray-600">{BUSINESS_TYPE_LABELS[row.businessType]}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatEuroLocal(row.amount)}</td>
                  <td className="px-4 py-3 text-gray-600">{row.frequencyLabel}</td>
                  <td className="px-4 py-3 text-gray-600 text-sm">{row.accountLabel}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setSelectedExpense(row)}
                        className="p-1 text-gray-400 hover:text-atlas-blue transition-colors"
                        title="Ver detalle"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleEdit(row)} className="p-1 text-gray-400 hover:text-atlas-blue transition-colors" title="Editar gasto">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(row)} className="p-1 text-gray-400 hover:text-red-500 transition-colors" title="Eliminar gasto">
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
                {editingEntry?.id ? 'Editar gasto' : `Nuevo gasto de ${BUSINESS_TYPE_LABELS[selectedType].toLowerCase()}`}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">NIF proveedor *</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                  value={oneOffForm.proveedorNIF}
                  onChange={(e) => setOneOffForm((prev) => ({ ...prev, proveedorNIF: e.target.value }))}
                  placeholder="B12345678"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre proveedor</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                  value={oneOffForm.proveedorNombre}
                  onChange={(e) => setOneOffForm((prev) => ({ ...prev, proveedorNombre: e.target.value }))}
                  placeholder="Empresa reformas S.L."
                />
              </div>
              {selectedType === 'mobiliario' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vida útil (años)</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                    value={oneOffForm.vidaUtil}
                    onChange={(e) => setOneOffForm((prev) => ({ ...prev, vidaUtil: parseInt(e.target.value, 10) || 10 }))}
                    placeholder="10"
                  />
                  <span className="text-xs text-gray-500">Por defecto 10 años (amortización 10% lineal)</span>
                </div>
              )}
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
                      {acc.alias ?? acc.banco?.name ?? `Cuenta …${(acc.iban ?? '').slice(-4)}`} – {acc.ibanMasked ?? acc.iban ?? 'Sin IBAN'}
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

      {selectedExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--n-300)]/60 px-4">
          <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-5">
            <h3 className="text-base font-semibold text-gray-900">Detalle del gasto</h3>
            <div className="mt-4 space-y-2 text-sm">
              <p><span className="text-gray-500">Concepto:</span> <span className="text-gray-900 font-medium">{selectedExpense.concept}</span></p>
              <p><span className="text-gray-500">Tipo:</span> {BUSINESS_TYPE_LABELS[selectedExpense.businessType]}</p>
              <p><span className="text-gray-500">Categoría:</span> {selectedExpense.categoryLabel}</p>
              <p><span className="text-gray-500">Importe:</span> {formatEuroLocal(selectedExpense.amount)}</p>
              <p><span className="text-gray-500">Frecuencia:</span> {selectedExpense.frequencyLabel}</p>
              <p><span className="text-gray-500">Fecha:</span> {selectedExpense.dateLabel}</p>
              <p><span className="text-gray-500">Cuenta:</span> {selectedExpense.accountLabel}</p>
              <p><span className="text-gray-500">NIF proveedor:</span> {selectedExpense.providerNIF || '—'}</p>
              <p><span className="text-gray-500">Proveedor:</span> {selectedExpense.providerName || '—'}</p>
            </div>
            <div className="mt-4 text-right">
              <button onClick={() => setSelectedExpense(null)} className="px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-600">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InmueblePresupuestoTab;
