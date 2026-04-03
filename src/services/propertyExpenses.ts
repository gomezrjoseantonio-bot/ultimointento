import { initDB } from './db';
import type { CAPEX, Expense, Gasto, OpexRule } from './db';
import type {
  PropertyExpense,
  PropertyExpenseDiagnostics,
} from '../types/propertyExpenses';

const getLast12MonthsThreshold = (): number => {
  const date = new Date();
  date.setMonth(date.getMonth() - 12);
  return date.getTime();
};

export const normalizeExpenseToAnnual = (expense: PropertyExpense): number => {
  if (!expense.isActive) return 0;

  switch (expense.frequency) {
    case 'semanal':
      return expense.amount * 52;
    case 'mensual':
      return expense.amount * 12;
    case 'bimestral':
      return expense.amount * 6;
    case 'trimestral':
      return expense.amount * 4;
    case 'semestral':
      return expense.amount * 2;
    case 'anual':
    case 'unico':
      return expense.amount;
    case 'meses_especificos':
      return expense.amount;
    default:
      return 0;
  }
};

const normalizeOpexRuleToAnnual = (rule: OpexRule): number => {
  if (!rule.activo) return 0;

  if (rule.frecuencia === 'meses_especificos') {
    if (rule.asymmetricPayments?.length) {
      return rule.asymmetricPayments.reduce((sum, item) => sum + (item.importe || 0), 0);
    }

    return (rule.mesesCobro?.length || 0) * (rule.importeEstimado || 0);
  }

  return normalizeExpenseToAnnual(mapOpexRule(rule));
};

const isWithinLastYear = (isoDate?: string): boolean => {
  if (!isoDate) return false;
  const ts = new Date(isoDate).getTime();
  return Number.isFinite(ts) && ts >= getLast12MonthsThreshold();
};

const mapOpexRule = (rule: OpexRule): PropertyExpense => {
  const monthsSpecificAmount = rule.frecuencia === 'meses_especificos'
    ? normalizeOpexRuleToAnnual(rule)
    : rule.importeEstimado;

  return {
    id: `opex_rule:${rule.id}`,
    propertyId: rule.propertyId,
    category: rule.categoria,
    concept: rule.concepto,
    amount: monthsSpecificAmount,
    frequency: rule.frecuencia,
    accountId: rule.accountId,
    casillaAEAT: rule.casillaAEAT,
    startDate: rule.mesInicio ? `${new Date().getFullYear()}-${String(rule.mesInicio).padStart(2, '0')}-01` : undefined,
    source: 'opex_rule',
    expenseClass: 'opex',
    isLegacy: false,
    isActive: rule.activo,
  };
};

const mapGasto = (gasto: Gasto): PropertyExpense | null => {
  if (gasto.destino !== 'inmueble_id' || !gasto.destino_id) return null;

  return {
    id: `gasto:${gasto.id}`,
    propertyId: gasto.destino_id,
    category: gasto.categoria_AEAT,
    concept: gasto.contraparte_nombre,
    amount: gasto.total,
    frequency: 'unico',
    startDate: gasto.fecha_emision,
    source: 'gasto',
    expenseClass: 'opex',
    isLegacy: true,
    isActive: true,
  };
};

const mapLegacyExpense = (expense: Expense): PropertyExpense => ({
  id: `legacy_expense:${expense.id}`,
  propertyId: expense.propertyId,
  category: expense.category,
  concept: expense.description,
  amount: expense.amount,
  frequency: 'unico',
  startDate: expense.date,
  source: 'legacy_expense',
  expenseClass: expense.isCapex ? 'capex' : 'opex',
  isLegacy: true,
  isActive: true,
});

const mapCapex = (capex: CAPEX): PropertyExpense => ({
  id: `capex:${capex.id}`,
  propertyId: capex.inmueble_id,
  category: capex.tipo,
  concept: capex.contraparte,
  amount: capex.total,
  frequency: 'unico',
  startDate: capex.fecha_emision,
  source: 'capex',
  expenseClass: 'capex',
  isLegacy: true,
  isActive: true,
});

const getPropertyExpensesSnapshot = async (propertyId: number): Promise<PropertyExpense[]> => {
  const db = await initDB();
  const [opexRules, gastos, expenses, capex] = await Promise.all([
    db.getAllFromIndex('opexRules', 'propertyId', propertyId),
    db.getAll('gastos'),
    db.getAllFromIndex('expenses', 'propertyId', propertyId),
    db.getAll('capex'),
  ]);

  const mappedGastos = gastos.map(mapGasto).filter(Boolean) as PropertyExpense[];

  return [
    ...opexRules.map(mapOpexRule),
    ...mappedGastos.filter((expense) => expense.propertyId === propertyId),
    ...expenses.map(mapLegacyExpense),
    ...capex.filter((item) => item.inmueble_id === propertyId).map(mapCapex),
  ];
};

export const getAllExpensesForProperty = async (propertyId: number): Promise<PropertyExpense[]> => {
  return getPropertyExpensesSnapshot(propertyId);
};

export const getAnnualOpexForProperty = async (propertyId: number): Promise<number> => {
  const all = await getPropertyExpensesSnapshot(propertyId);
  const rules = all.filter((expense) => expense.source === 'opex_rule' && expense.expenseClass === 'opex' && expense.isActive);

  if (rules.length > 0) {
    return rules.reduce((sum, expense) => sum + normalizeExpenseToAnnual(expense), 0);
  }

  return all
    .filter((expense) => expense.expenseClass === 'opex' && expense.isLegacy && isWithinLastYear(expense.startDate))
    .reduce((sum, expense) => sum + expense.amount, 0);
};

export const getExpenseDiagnosticsForProperty = async (propertyId: number): Promise<PropertyExpenseDiagnostics> => {
  const all = await getPropertyExpensesSnapshot(propertyId);
  const activeRules = all.filter((expense) => expense.source === 'opex_rule' && expense.isActive);
  const legacyOpex = all.filter((expense) => expense.expenseClass === 'opex' && expense.isLegacy);

  if (activeRules.length === 0 && legacyOpex.length === 0) {
    return {
      hasConfiguredExpenses: false,
      usingLegacyFallback: false,
      warning: 'No hay gastos OPEX configurados para este inmueble.',
    };
  }

  if (activeRules.length === 0 && legacyOpex.length > 0) {
    return {
      hasConfiguredExpenses: true,
      usingLegacyFallback: true,
      warning: 'Se están usando gastos legacy para el cálculo OPEX. Completa la migración a reglas OPEX.',
    };
  }

  return {
    hasConfiguredExpenses: true,
    usingLegacyFallback: false,
  };
};
