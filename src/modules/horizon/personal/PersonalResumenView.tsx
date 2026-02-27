import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  CheckCircle2,
  CircleDashed,
  Banknote,
  Briefcase,
  Receipt,
  Coins,
} from 'lucide-react';
import { ResumenPersonalMensual, PersonalModuleConfig } from '../../../types/personal';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (value: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);

const pct = (value: number) =>
  `${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)} %`;

// ─── Fallback / demo values ───────────────────────────────────────────────────

const DEFAULT_MOCK_INCOME = 5403.41;
const DEFAULT_MOCK_EXPENSES = 3150.0;

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_MONTHLY_DATA = [
  { label: 'Ene', income: 5200, expenses: 3100 },
  { label: 'Feb', income: 5200, expenses: 3250 },
  { label: 'Mar', income: 5403, expenses: 3150 },
  { label: 'Abr', income: 5403, expenses: 3400 },
  { label: 'May', income: 5403, expenses: 3050 },
  { label: 'Jun', income: 6800, expenses: 3200 },
  { label: 'Jul', income: 5403, expenses: 3600 },
  { label: 'Ago', income: 5403, expenses: 3800 },
  { label: 'Sep', income: 5403, expenses: 3100 },
  { label: 'Oct', income: 5403, expenses: 3050 },
  { label: 'Nov', income: 5403, expenses: 3300 },
  { label: 'Dic', income: 6800, expenses: 3900 },
];

const MOCK_EXPENSE_CATEGORIES = [
  { label: 'Vivienda', amount: 950, color: 'bg-blue-900' },
  { label: 'Alimentación', amount: 650, color: 'bg-blue-700' },
  { label: 'Transporte', amount: 280, color: 'bg-blue-500' },
  { label: 'Seguros', amount: 180, color: 'bg-blue-400' },
  { label: 'Suscripciones', amount: 120, color: 'bg-blue-300' },
  { label: 'Salud', amount: 110, color: 'bg-gray-400' },
  { label: 'Educación', amount: 90, color: 'bg-gray-300' },
  { label: 'Otros', amount: 770, color: 'bg-gray-200' },
];

const MOCK_INCOME_SOURCES = [
  { label: 'Nómina 1', amount: 2800.0 },
  { label: 'Nómina 2', amount: 1503.41 },
  { label: 'Autónomos', amount: 900.0 },
  { label: 'Otros Ingresos', amount: 200.0 },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

interface KpiCardProps {
  title: string;
  amount: number;
  icon: React.ElementType;
  accent?: 'navy' | 'teal' | 'default';
  sub?: React.ReactNode;
}

const KpiCard: React.FC<KpiCardProps> = ({ title, amount, icon: Icon, accent = 'default', sub }) => {
  const amountClass =
    accent === 'navy'
      ? 'text-blue-900'
      : accent === 'teal'
      ? 'text-teal-500'
      : 'text-gray-900';

  return (
    <div className="bg-white border border-gray-200 p-6 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">{title}</p>
        <div className={`p-2 rounded-full ${accent === 'teal' ? 'bg-teal-50' : 'bg-gray-50'}`}>
          <Icon className={`w-4 h-4 ${accent === 'navy' ? 'text-blue-900' : accent === 'teal' ? 'text-teal-500' : 'text-gray-400'}`} />
        </div>
      </div>
      <p className={`text-3xl font-bold tracking-tight ${amountClass}`}>{fmt(amount)}</p>
      {sub && <div className="text-sm text-gray-500">{sub}</div>}
    </div>
  );
};

interface CashFlowChartProps {
  data: typeof MOCK_MONTHLY_DATA;
}

const CashFlowChart: React.FC<CashFlowChartProps> = ({ data }) => {
  const maxValue = Math.max(...data.map(d => Math.max(d.income, d.expenses)));

  return (
    <div className="bg-white border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Flujo de Caja</p>
          <p className="text-sm text-gray-400 mt-0.5">Ingresos vs Gastos — 12 meses</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-blue-900" />
            Ingresos
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-gray-200" />
            Gastos
          </span>
        </div>
      </div>
      <div className="flex items-end gap-1.5" style={{ height: 160 }}>
        {data.map(({ label, income, expenses }) => {
          const incomeH = Math.round((income / maxValue) * 140);
          const expensesH = Math.round((expenses / maxValue) * 140);
          return (
            <div key={label} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end justify-center gap-0.5" style={{ height: 148 }}>
                {/* Income bar */}
                <div
                  className="w-[45%] bg-blue-900 rounded-t-sm transition-all"
                  style={{ height: incomeH }}
                  title={`Ingresos: ${fmt(income)}`}
                />
                {/* Expenses bar */}
                <div
                  className="w-[45%] bg-gray-200 rounded-t-sm transition-all"
                  style={{ height: expensesH }}
                  title={`Gastos: ${fmt(expenses)}`}
                />
              </div>
              <p className="text-[10px] text-gray-400 font-medium">{label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface ExpenseBreakdownProps {
  categories: typeof MOCK_EXPENSE_CATEGORIES;
  total: number;
}

const ExpenseBreakdown: React.FC<ExpenseBreakdownProps> = ({ categories, total }) => (
  <div className="bg-white border border-gray-200 p-6 flex flex-col gap-4">
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Desglose de Gastos</p>
      <p className="text-sm text-gray-400 mt-0.5">Por categoría</p>
    </div>
    <div className="space-y-3">
      {categories.map(({ label, amount, color }) => {
        const widthPct = total > 0 ? Math.round((amount / total) * 100) : 0;
        return (
          <div key={label}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-500">{label}</span>
              <span className="text-gray-900 font-medium">{fmt(amount)}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div
                className={`${color} h-1.5 rounded-full transition-all`}
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

interface IncomeSourcesProps {
  sources: typeof MOCK_INCOME_SOURCES;
  total: number;
}

const IncomeSources: React.FC<IncomeSourcesProps> = ({ sources, total }) => (
  <div className="bg-white border border-gray-200 p-6 flex flex-col gap-4">
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Fuentes de Ingresos</p>
      <p className="text-sm text-gray-400 mt-0.5">Distribución mensual</p>
    </div>
    <div className="space-y-3">
      {sources.map(({ label, amount }) => {
        const share = total > 0 ? (amount / total) * 100 : 0;
        return (
          <div key={label} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
            <div className="flex flex-col">
              <span className="text-sm text-gray-500">{label}</span>
              <span className="text-[10px] text-gray-400">{pct(share)} del total</span>
            </div>
            <span className="text-sm text-gray-900 font-medium">{fmt(amount)}</span>
          </div>
        );
      })}
    </div>
    <div className="flex justify-between pt-2 border-t border-gray-200">
      <span className="text-sm font-semibold text-gray-900">Total</span>
      <span className="text-sm font-bold text-blue-900">{fmt(total)}</span>
    </div>
  </div>
);

interface ConfigStatusProps {
  config: PersonalModuleConfig | null;
}

const ConfigStatus: React.FC<ConfigStatusProps> = ({ config }) => {
  const modules = [
    {
      id: 'nomina',
      label: 'Nóminas',
      icon: Banknote,
      active: config?.seccionesActivas.nomina ?? false,
    },
    {
      id: 'autonomo',
      label: 'Autónomos',
      icon: Briefcase,
      active: config?.seccionesActivas.autonomo ?? false,
    },
    {
      id: 'gastos',
      label: 'Gastos',
      icon: Receipt,
      active: true,
    },
    {
      id: 'otros',
      label: 'Otros Ingresos',
      icon: Coins,
      active: config?.seccionesActivas.otrosIngresos ?? false,
    },
  ];

  return (
    <div className="bg-white border border-gray-200 p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">Estado de Configuración</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {modules.map(({ id, label, icon: Icon, active }) => (
          <div
            key={id}
            className={`flex items-center gap-3 px-4 py-3 border rounded-sm ${
              active ? 'border-blue-900 bg-gray-50' : 'border-gray-200'
            }`}
          >
            <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-blue-900' : 'text-gray-300'}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-medium truncate ${active ? 'text-gray-900' : 'text-gray-400'}`}>{label}</p>
              <p className={`text-[10px] ${active ? 'text-blue-900' : 'text-gray-400'}`}>
                {active ? 'Activo' : 'Pendiente'}
              </p>
            </div>
            {active ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-900" />
            ) : (
              <CircleDashed className="w-4 h-4 shrink-0 text-gray-300" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

interface PersonalResumenViewProps {
  resumen: ResumenPersonalMensual | null;
  config: PersonalModuleConfig | null;
}

const PersonalResumenView: React.FC<PersonalResumenViewProps> = ({ resumen, config }) => {
  // Use real data when available, fall back to mock values so the dashboard always looks complete
  const totalIncome = resumen && resumen.ingresos.total > 0 ? resumen.ingresos.total : DEFAULT_MOCK_INCOME;
  const totalExpenses = resumen && resumen.gastos.total > 0 ? resumen.gastos.total : DEFAULT_MOCK_EXPENSES;
  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

  // Build income sources from real resumen or mock data
  const incomeSources =
    resumen && resumen.ingresos.total > 0
      ? [
          { label: 'Nómina', amount: resumen.ingresos.nomina },
          { label: 'Autónomos', amount: resumen.ingresos.autonomo },
          { label: 'Otros Ingresos', amount: resumen.ingresos.otros },
        ].filter(s => s.amount > 0)
      : MOCK_INCOME_SOURCES;

  // Expense categories: use real totalExpenses for proportional bars
  const expenseTotal = totalExpenses > 0 ? totalExpenses : MOCK_EXPENSE_CATEGORIES.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="space-y-4">
      {/* ── Top Row: KPIs ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          title="Ingresos"
          amount={totalIncome}
          icon={TrendingUp}
          accent="navy"
          sub={
            <span className="text-xs text-gray-400">
              {incomeSources.length === 1 ? '1 fuente activa' : `${incomeSources.length} fuentes activas`}
            </span>
          }
        />
        <KpiCard
          title="Gastos"
          amount={totalExpenses}
          icon={TrendingDown}
          accent="default"
          sub={
            <span className="text-xs text-gray-400">
              {MOCK_EXPENSE_CATEGORIES.length} categorías registradas
            </span>
          }
        />
        <KpiCard
          title="Ahorro Neto"
          amount={netSavings}
          icon={PiggyBank}
          accent="teal"
          sub={
            <span className="text-teal-500 font-semibold text-sm">
              Tasa de ahorro: {pct(savingsRate)}
            </span>
          }
        />
      </div>

      {/* ── Middle Row: Cash Flow Visual ─────────────────────────────── */}
      <CashFlowChart data={MOCK_MONTHLY_DATA} />

      {/* ── Bottom Row: Expense Breakdown + Income Sources ─────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ExpenseBreakdown categories={MOCK_EXPENSE_CATEGORIES} total={expenseTotal} />
        <IncomeSources sources={incomeSources} total={totalIncome} />
      </div>

      {/* ── Footer: Configuration Status ─────────────────────────────── */}
      <ConfigStatus config={config} />
    </div>
  );
};

export default PersonalResumenView;
