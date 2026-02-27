import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
} from 'lucide-react';
import { ResumenPersonalMensual, PersonalModuleConfig } from '../../../types/personal';
import { generateProyeccionMensual } from '../proyeccion/mensual/services/proyeccionMensualService';
import { ProyeccionAnual } from '../proyeccion/mensual/types/proyeccionMensual';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (value: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);

const pct = (value: number) =>
  `${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)} %`;

// ─── Fallback / demo values (annual) ─────────────────────────────────────────

const DEFAULT_ANNUAL_INCOME = 5403.41 * 12;
const DEFAULT_ANNUAL_EXPENSES = 3150.0 * 12;

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
  { label: 'Nómina 1', amount: 2800.0 * 12 },
  { label: 'Nómina 2', amount: 1503.41 * 12 },
  { label: 'Autónomos', amount: 900.0 * 12 },
  { label: 'Otros Ingresos', amount: 200.0 * 12 },
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
      <p className="text-sm text-gray-400 mt-0.5">Por categoría — anual</p>
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
      <p className="text-sm text-gray-400 mt-0.5">Distribución anual</p>
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

// ─── Main component ───────────────────────────────────────────────────────────

interface PersonalResumenViewProps {
  resumen: ResumenPersonalMensual | null;
  config: PersonalModuleConfig | null;
}

const PersonalResumenView: React.FC<PersonalResumenViewProps> = ({ resumen }) => {
  const [proyeccion, setProyeccion] = useState<ProyeccionAnual | null>(null);

  useEffect(() => {
    const currentYear = new Date().getFullYear();
    generateProyeccionMensual()
      .then(data => setProyeccion(data.find(p => p.year === currentYear) ?? null))
      .catch(err => { console.error('[PersonalResumenView] Failed to load projection:', err); });
  }, []);

  // Annual totals: prefer projection data, fall back to resumen×12, then mock
  const totalIncome = proyeccion
    ? proyeccion.totalesAnuales.ingresosTotales
    : resumen && resumen.ingresos.total > 0
    ? resumen.ingresos.total * 12
    : DEFAULT_ANNUAL_INCOME;

  const totalExpenses = proyeccion
    ? proyeccion.totalesAnuales.gastosTotales
    : resumen && resumen.gastos.total > 0
    ? resumen.gastos.total * 12
    : DEFAULT_ANNUAL_EXPENSES;

  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

  // Build annual income sources
  const incomeSources = proyeccion
    ? (() => {
        const totals = { nomina: 0, autonomo: 0, pensiones: 0, rentas: 0, otros: 0 };
        for (const m of proyeccion.months) {
          totals.nomina += m.ingresos.nomina;
          totals.autonomo += m.ingresos.serviciosFreelance;
          totals.pensiones += m.ingresos.pensiones;
          totals.rentas += m.ingresos.rentasAlquiler;
          totals.otros += m.ingresos.otrosIngresos + m.ingresos.dividendosInversiones;
        }
        return [
          { label: 'Nóminas', amount: totals.nomina },
          { label: 'Autónomos', amount: totals.autonomo },
          { label: 'Pensiones', amount: totals.pensiones },
          { label: 'Rentas alquiler', amount: totals.rentas },
          { label: 'Otros ingresos', amount: totals.otros },
        ].filter(s => s.amount > 0);
      })()
    : resumen && resumen.ingresos.total > 0
    ? [
        { label: 'Nómina', amount: resumen.ingresos.nomina * 12 },
        { label: 'Autónomos', amount: resumen.ingresos.autonomo * 12 },
        { label: 'Otros Ingresos', amount: resumen.ingresos.otros * 12 },
      ].filter(s => s.amount > 0)
    : MOCK_INCOME_SOURCES;

  // Expense categories: use real totalExpenses for proportional bars
  const expenseTotal = totalExpenses > 0 ? totalExpenses : MOCK_EXPENSE_CATEGORIES.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="space-y-4">
      {/* ── Top Row: KPIs ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          title="Ingresos Anuales"
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
          title="Gastos Anuales"
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
          title="Ahorro Neto Anual"
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
    </div>
  );
};

export default PersonalResumenView;
