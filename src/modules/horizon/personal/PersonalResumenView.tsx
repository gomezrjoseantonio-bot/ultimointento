import React, { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
} from 'lucide-react';
import { ResumenPersonalMensual, PersonalModuleConfig } from '../../../types/personal';
import { generateProyeccionMensual } from '../proyeccion/mensual/services/proyeccionMensualService';
import { ProyeccionAnual, MonthlyProjectionRow } from '../proyeccion/mensual/types/proyeccionMensual';
import { personalDataService } from '../../../services/personalDataService';
import { personalExpensesService } from '../../../services/personalExpensesService';
import { gastosPersonalesService } from '../../../services/gastosPersonalesService';
import { autonomoService } from '../../../services/autonomoService';
import { prestamosService } from '../../../services/prestamosService';
import {
  getPersonalExpenseAmountForMonth,
  gastoRecurrenteAppliesToMonth,
} from '../proyeccion/mensual/services/forecastEngine';

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

// Annual amounts (monthly × 12)
const MOCK_EXPENSE_CATEGORIES = [
  { label: 'Vivienda', amount: 950 * 12, color: 'bg-blue-900' },
  { label: 'Alimentación', amount: 650 * 12, color: 'bg-blue-700' },
  { label: 'Transporte', amount: 280 * 12, color: 'bg-blue-500' },
  { label: 'Seguros', amount: 180 * 12, color: 'bg-blue-400' },
  { label: 'Suscripciones', amount: 120 * 12, color: 'bg-blue-300' },
  { label: 'Salud', amount: 110 * 12, color: 'bg-gray-400' },
  { label: 'Educación', amount: 90 * 12, color: 'bg-gray-300' },
  { label: 'Otros', amount: 770 * 12, color: 'bg-gray-200' },
];

const MOCK_INCOME_SOURCES = [
  { label: 'Nómina 1', amount: 2800.0 * 12 },
  { label: 'Nómina 2', amount: 1503.41 * 12 },
  { label: 'Autónomos', amount: 900.0 * 12 },
  { label: 'Otros Ingresos', amount: 200.0 * 12 },
];

// ─── Category config for expense breakdown ────────────────────────────────────

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  vivienda:      { label: 'Vivienda',      color: 'bg-blue-900' },
  alimentacion:  { label: 'Alimentación',  color: 'bg-blue-700' },
  transporte:    { label: 'Transporte',    color: 'bg-blue-500' },
  seguros:       { label: 'Seguros',       color: 'bg-blue-400' },
  suscripciones: { label: 'Suscripciones', color: 'bg-blue-300' },
  suministros:   { label: 'Suministros',   color: 'bg-blue-200' },
  ocio:          { label: 'Ocio',          color: 'bg-gray-500' },
  salud:         { label: 'Salud',         color: 'bg-gray-400' },
  educacion:     { label: 'Educación',     color: 'bg-gray-300' },
  otros:         { label: 'Otros',         color: 'bg-gray-200' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface KpiCardProps {
  title: string;
  amount: number;
  icon: React.ElementType;
  accent?: 'navy' | 'positive' | 'default' | 'danger';
  sub?: React.ReactNode;
}

const KpiCard: React.FC<KpiCardProps> = ({ title, amount, icon: Icon, accent = 'default', sub }) => {
  const amountClass =
    accent === 'navy'
      ? 'text-blue-900'
      : accent === 'positive'
      ? 'text-[var(--s-pos)]'
      : accent === 'danger'
      ? 'text-red-700'
      : 'text-gray-900';

  const accentBorder =
    accent === 'navy'
      ? 'border-t-blue-900'
      : accent === 'positive'
      ? 'border-t-[var(--s-pos)]'
      : accent === 'danger'
      ? 'border-t-red-600'
      : 'border-t-gray-300';

  return (
    <div className={`bg-white border border-gray-200 border-t-4 ${accentBorder} rounded-3xl p-6 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">{title}</p>
        <div className={`p-2 rounded-full ${accent === 'positive' ? 'bg-[var(--s-pos-bg)]' : 'bg-gray-50'}`}>
          <Icon className={`w-4 h-4 ${accent === 'navy' ? 'text-blue-900' : accent === 'positive' ? 'text-[var(--s-pos)]' : accent === 'danger' ? 'text-red-700' : 'text-gray-400'}`} />
        </div>
      </div>
      <p className={`text-3xl font-bold tracking-tight ${amountClass}`}>{fmt(amount)}</p>
      {sub && <div className="text-sm text-gray-500">{sub}</div>}
    </div>
  );
};

interface CashFlowChartProps {
  data: Array<{
    label: string;
    income: number;
    personalExpenses: number;
    loanExpenses: number;
    savings: number;
  }>;
}

const CashFlowChart: React.FC<CashFlowChartProps> = ({ data }) => {
  const [selectedMonth, setSelectedMonth] = useState(0);
  const maxValue = Math.max(...data.map(d => Math.max(d.income, d.personalExpenses + d.loanExpenses)));
  const activeMonth = data[selectedMonth] ?? data[0];

  return (
    <div className="bg-white border border-gray-200 rounded-3xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Flujo de Caja</p>
          <p className="text-sm text-gray-400 mt-0.5">Selecciona un mes para ver el detalle</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-blue-900" />
            Ingresos
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-gray-200" />
            Gastos totales
          </span>
        </div>
      </div>
      <div className="flex items-end gap-1.5" style={{ height: 160 }}>
        {data.map(({ label, income, personalExpenses, loanExpenses }, idx) => {
          const totalExpenses = personalExpenses + loanExpenses;
          const incomeH = Math.round((income / maxValue) * 140);
          const expensesH = Math.round((totalExpenses / maxValue) * 140);
          const selected = selectedMonth === idx;
          return (
            <button
              key={label}
              type="button"
              onClick={() => setSelectedMonth(idx)}
              className={`flex-1 flex flex-col items-center gap-1 rounded-lg transition-colors ${selected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
            >
              <div className="w-full flex items-end justify-center gap-0.5" style={{ height: 148 }}>
                <div
                  className="w-[45%] bg-blue-900 rounded-t-sm transition-all"
                  style={{ height: incomeH }}
                  title={`Ingresos: ${fmt(income)}`}
                />
                <div
                  className="w-[45%] bg-gray-200 rounded-t-sm transition-all"
                  style={{ height: expensesH }}
                  title={`Gastos totales: ${fmt(totalExpenses)}`}
                />
              </div>
              <p className={`text-[10px] font-medium ${selected ? 'text-blue-900' : 'text-gray-400'}`}>{label}</p>
            </button>
          );
        })}
      </div>
      {activeMonth && (
        <div className="mt-5 border-t border-gray-100 pt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-400">Ingresos ({activeMonth.label})</p>
            <p className="text-sm font-semibold text-blue-900">{fmt(activeMonth.income)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-400">Gastos personales</p>
            <p className="text-sm font-semibold text-gray-700">{fmt(activeMonth.personalExpenses)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-400">Préstamos</p>
            <p className="text-sm font-semibold text-red-700">{fmt(activeMonth.loanExpenses)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-400">Ahorro</p>
            <p className={`text-sm font-semibold ${activeMonth.savings >= 0 ? 'text-[var(--s-pos)]' : 'text-red-700'}`}>
              {fmt(activeMonth.savings)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

interface ExpenseBreakdownProps {
  categories: typeof MOCK_EXPENSE_CATEGORIES;
  incomeTotal: number;
}

const ExpenseBreakdown: React.FC<ExpenseBreakdownProps> = ({ categories, incomeTotal }) => {
  const totalExpenses = categories.reduce((sum, c) => sum + c.amount, 0);
  const groupedCategories = useMemo(() => {
    if (totalExpenses <= 0) return categories;
    const major = categories.filter(c => (c.amount / totalExpenses) * 100 >= 5);
    const restAmount = categories
      .filter(c => (c.amount / totalExpenses) * 100 < 5)
      .reduce((sum, c) => sum + c.amount, 0);
    return restAmount > 0
      ? [...major, { label: 'Resto', amount: restAmount, color: 'bg-gray-300' }]
      : major;
  }, [categories, totalExpenses]);

  const donutColors = ['#1e3a8a', '#1d4ed8', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#d1d5db'];
  const slices = groupedCategories.map((cat, idx) => {
    const share = totalExpenses > 0 ? cat.amount / totalExpenses : 0;
    return { ...cat, share, colorHex: donutColors[idx % donutColors.length] };
  });

  let cursor = 0;

  return (
    <div className="bg-white border border-gray-200 rounded-3xl p-6 flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Desglose de Gastos</p>
        <p className="text-sm text-gray-400 mt-0.5">Formato donut — categorías &lt; 5% agrupadas en Resto</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[180px,1fr] gap-5 items-center">
        <svg viewBox="0 0 42 42" className="w-40 h-40 mx-auto -rotate-90">
          <circle cx="21" cy="21" r="15.9155" fill="transparent" stroke="#eef2f7" strokeWidth="6" />
          {slices.map((slice) => {
            const dash = `${slice.share * 100} ${100 - slice.share * 100}`;
            const element = (
              <circle
                key={slice.label}
                cx="21"
                cy="21"
                r="15.9155"
                fill="transparent"
                stroke={slice.colorHex}
                strokeWidth="6"
                strokeDasharray={dash}
                strokeDashoffset={-cursor}
              />
            );
            cursor += slice.share * 100;
            return element;
          })}
        </svg>
        <div className="space-y-2">
          {slices.map((slice) => (
            <div key={slice.label} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-gray-600">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: slice.colorHex }} />
                {slice.label}
              </span>
              <span className="text-gray-900 font-medium">{pct(slice.share * 100)} · {fmt(slice.amount)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-between pt-2 border-t border-gray-200">
        <span className="text-sm font-semibold text-gray-900">Total gastos</span>
        <span className="text-sm font-bold text-blue-900">{fmt(totalExpenses)}</span>
      </div>
      <p className="text-[11px] text-gray-400">Referencia sobre ingresos: {pct(incomeTotal > 0 ? (totalExpenses / incomeTotal) * 100 : 0)}</p>
    </div>
  );
};

interface IncomeSourcesProps {
  sources: typeof MOCK_INCOME_SOURCES;
  total: number;
}

const IncomeSources: React.FC<IncomeSourcesProps> = ({ sources, total }) => {
  const palette = ['#1e3a8a', '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'];
  return (
    <div className="bg-white border border-gray-200 rounded-3xl p-6 flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Fuentes de Ingresos</p>
        <p className="text-sm text-gray-400 mt-0.5">Barra única 100% por fuente</p>
      </div>
      <div className="w-full h-7 rounded-full overflow-hidden bg-blue-50 border border-blue-100 flex">
        {sources.map(({ label, amount }, idx) => {
          const share = total > 0 ? (amount / total) * 100 : 0;
          return (
            <div
              key={label}
              className="h-full"
              style={{ width: `${share}%`, backgroundColor: palette[idx % palette.length] }}
              title={`${label}: ${pct(share)}`}
            />
          );
        })}
      </div>
      <div className="space-y-2">
        {sources.map(({ label, amount }, idx) => {
          const share = total > 0 ? (amount / total) * 100 : 0;
          return (
            <div key={label} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-gray-600">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: palette[idx % palette.length] }} />
                {label}
              </span>
              <span className="text-gray-900 font-medium">{pct(share)} · {fmt(amount)}</span>
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
};

// ─── Monthly row helpers (personal figures only) ──────────────────────────────

/** Net personal income for a single month (rental income excluded; autonomous shown net of business expenses). */
const monthPersonalIncome = (m: MonthlyProjectionRow): number =>
  m.ingresos.nomina
    + m.ingresos.serviciosFreelance - m.gastos.gastosAutonomo
    + m.ingresos.pensiones
    + m.ingresos.dividendosInversiones
    + m.ingresos.otrosIngresos;

/** Personal expenses for a single month (property OPEX excluded; gastosAutonomo already netted in income). */
const monthPersonalExpenses = (m: MonthlyProjectionRow): number =>
  m.gastos.gastosPersonales + m.gastos.irpfAPagar;

// ─── Main component ───────────────────────────────────────────────────────────

interface PersonalResumenViewProps {
  resumen: ResumenPersonalMensual | null;
  config: PersonalModuleConfig | null;
}

interface AutonomoAnnualData {
  rendimientoNeto: number;
  facturacionBruta: number;
  totalGastos: number;
}

interface AutonomoMonthlyData {
  mes: number;
  ingresos: number;
  gastos: number;
  neto: number;
}

const PersonalResumenView: React.FC<PersonalResumenViewProps> = ({ resumen }) => {
  const [proyeccion, setProyeccion] = useState<ProyeccionAnual | null>(null);
  const [expenseCategories, setExpenseCategories] = useState<typeof MOCK_EXPENSE_CATEGORIES | null>(null);
  const [autonomoAnual, setAutonomoAnual] = useState<AutonomoAnnualData | null>(null);
  const [autonomoMensual, setAutonomoMensual] = useState<AutonomoMonthlyData[] | null>(null);
  const [annualLoanCost, setAnnualLoanCost] = useState(0);

  useEffect(() => {
    const currentYear = new Date().getFullYear();
    generateProyeccionMensual()
      .then(data => setProyeccion(data.find(p => p.year === currentYear) ?? null))
      .catch(err => { console.error('[PersonalResumenView] Failed to load projection:', err); });
  }, []);

  useEffect(() => {
    async function loadAutonomoData() {
      try {
        const personalData = await personalDataService.getPersonalData();
        const personalDataId = personalData?.id ?? 1;
        const autonomo = await autonomoService.getActivoAutonomo(personalDataId);
        if (autonomo) {
          setAutonomoAnual(autonomoService.calculateEstimatedAnnual(autonomo));
          setAutonomoMensual(autonomoService.getMonthlyDistribution(autonomo));
        }
      } catch (err) {
        console.error('[PersonalResumenView] Failed to load autonomo data:', err);
      }
    }
    loadAutonomoData();
  }, []);

  useEffect(() => {
    async function loadAnnualPersonalLoanCost() {
      try {
        const year = new Date().getFullYear();
        const prestamos = await prestamosService.getAllPrestamos();
        const personalLoans = prestamos.filter((p) =>
          p.activo && p.ambito === 'PERSONAL',
        );

        const totals = await Promise.all(
          personalLoans.map(async (prestamo) => {
            const plan = await prestamosService.getPaymentPlan(prestamo.id);
            return (plan?.periodos ?? [])
              .filter((periodo) => Number(periodo.fechaCargo.substring(0, 4)) === year)
              .reduce((sum, periodo) => sum + periodo.cuota, 0);
          }),
        );

        setAnnualLoanCost(totals.reduce((sum, amount) => sum + amount, 0));
      } catch (err) {
        console.error('[PersonalResumenView] Failed to load annual loan cost:', err);
      }
    }
    loadAnnualPersonalLoanCost();
  }, []);

  useEffect(() => {
    async function loadExpenseCategories() {
      try {
        const personalData = await personalDataService.getPersonalData();
        const personalDataId = personalData?.id ?? 1;
        const [personalExpenses, gastosRecurrentes] = await Promise.all([
          personalExpensesService.getExpenses(personalDataId),
          gastosPersonalesService.getGastosRecurrentesActivos(personalDataId),
        ]);
        const activeExpenses = personalExpenses.filter(e => e.activo);

        // Compute annual total per category (frequency-aware)
        const categoryTotals: Record<string, number> = {};
        for (let m = 1; m <= 12; m++) {
          for (const exp of activeExpenses) {
            const amount = getPersonalExpenseAmountForMonth(exp, m);
            if (amount > 0) {
              categoryTotals[exp.categoria] = (categoryTotals[exp.categoria] ?? 0) + amount;
            }
          }
          for (const gasto of gastosRecurrentes) {
            if (gastoRecurrenteAppliesToMonth(gasto, m)) {
              categoryTotals[gasto.categoria] = (categoryTotals[gasto.categoria] ?? 0) + gasto.importe;
            }
          }
        }

        const categories = Object.entries(categoryTotals)
          .filter(([, amount]) => amount > 0)
          .sort((a, b) => b[1] - a[1])
          .map(([key, amount]) => ({
            label: CATEGORY_CONFIG[key]?.label ?? key,
            amount,
            color: CATEGORY_CONFIG[key]?.color ?? 'bg-gray-200',
          }));

        if (categories.length > 0) setExpenseCategories(categories);
      } catch (err) {
        console.error('[PersonalResumenView] Failed to load expense categories:', err);
      }
    }
    loadExpenseCategories();
  }, []);

  // Annual totals — strictly personal (no rental income, no property OPEX)
  // Autonomous net = serviciosFreelance - gastosAutonomo (business expenses already deducted)
  /** True when the projection has actual autónomo income data (used to decide fallback path). */
  const proyeccionHasAutonomo = proyeccion
    ? proyeccion.months.some(m => m.ingresos.serviciosFreelance > 0)
    : false;
  const autonomoNetInProyeccion = proyeccion
    ? proyeccion.months.reduce((s, m) => s + m.ingresos.serviciosFreelance - m.gastos.gastosAutonomo, 0)
    : 0;
  // Use directly-fetched autonomo net rendimiento when projection doesn't include autónomo income
  const autonomoNetAnual = proyeccionHasAutonomo
    ? autonomoNetInProyeccion
    : (autonomoAnual?.rendimientoNeto ?? 0);

  // Annual gastosAutonomo — already netted in autonomo income; not added to expense categories
  const totalIncome = proyeccion
    ? proyeccion.months.reduce((s, m) => s + monthPersonalIncome(m), 0)
      + (!proyeccionHasAutonomo ? autonomoNetAnual : 0)
    : resumen && resumen.ingresos.total > 0
    ? (resumen.ingresos.nomina + resumen.ingresos.otros) * 12 + autonomoNetAnual
    : DEFAULT_ANNUAL_INCOME;

  // Personal expenses (property OPEX excluded; gastosAutonomo already netted in income)
  const totalExpensesBase = proyeccion
    ? proyeccion.months.reduce((s, m) => s + monthPersonalExpenses(m), 0)
    : resumen && resumen.gastos.total > 0
    ? resumen.gastos.total * 12
    : DEFAULT_ANNUAL_EXPENSES;
  const annualLoanCostFromProyeccion = proyeccion
    ? proyeccion.months.reduce((s, m) => s + m.financiacion.cuotasPrestamos, 0)
    : annualLoanCost;

  const totalExpenses = totalExpensesBase + annualLoanCostFromProyeccion;

  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

  // Build annual income sources — no rental; autonomous shown as net (billing − business expenses)
  const incomeSources = proyeccion
    ? (() => {
        const totals = { nomina: 0, pensiones: 0, otros: 0 };
        for (const m of proyeccion.months) {
          totals.nomina += m.ingresos.nomina;
          totals.pensiones += m.ingresos.pensiones;
          totals.otros += m.ingresos.otrosIngresos + m.ingresos.dividendosInversiones;
        }
        return [
          { label: 'Nóminas', amount: totals.nomina },
          { label: 'Autónomos (neto anual)', amount: autonomoNetAnual },
          { label: 'Pensiones', amount: totals.pensiones },
          { label: 'Otros ingresos', amount: totals.otros },
        ].filter(s => s.amount > 0);
      })()
    : resumen && resumen.ingresos.total > 0
    ? [
        { label: 'Nómina', amount: resumen.ingresos.nomina * 12 },
        { label: 'Autónomos', amount: autonomoNetAnual },
        { label: 'Otros Ingresos', amount: resumen.ingresos.otros * 12 },
      ].filter(s => s.amount > 0)
    : MOCK_INCOME_SOURCES;

  // Expense categories: real data if loaded, else annualised mock.
  // gastosAutonomo is already netted in autonomo income; not re-added here.
  const expenseCatsToShow = expenseCategories ?? MOCK_EXPENSE_CATEGORIES;

  // Monthly cash-flow chart: real personal figures from projection, else mock
  const cashFlowData = proyeccion
    ? proyeccion.months.map((m, i) => {
        const income = monthPersonalIncome(m)
          + (!proyeccionHasAutonomo && autonomoMensual && autonomoMensual[i]
            ? autonomoMensual[i].neto
            : 0);
        const personalExpenses = monthPersonalExpenses(m);
        const loanExpenses = m.financiacion.cuotasPrestamos;
        return {
        label: MONTH_LABELS[i],
        income,
        personalExpenses,
        loanExpenses,
        savings: income - personalExpenses - loanExpenses,
      };
    })
    : autonomoMensual
    ? MONTH_LABELS.map((label, i) => ({
        label,
        income: autonomoMensual[i]?.neto ?? 0,
        personalExpenses: 0,
        loanExpenses: annualLoanCost / 12,
        savings: (autonomoMensual[i]?.neto ?? 0) - (annualLoanCost / 12),
      }))
    : MOCK_MONTHLY_DATA.map(({ label, income, expenses }) => ({
        label,
        income,
        personalExpenses: expenses,
        loanExpenses: 0,
        savings: income - expenses,
      }));

  return (
    <div className="space-y-3">
      {/* ── Top Row: KPIs ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
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
          title="Gastos personales/familiares"
          amount={totalExpensesBase}
          icon={TrendingDown}
          accent="default"
          sub={
            <span className="text-xs text-gray-400">
              Según tab de gastos personales
            </span>
          }
        />
        <KpiCard
          title="Gastos préstamos"
          amount={annualLoanCostFromProyeccion}
          icon={TrendingDown}
          accent="danger"
          sub={
            <span className="text-xs text-gray-400">
              Préstamos de ámbito PERSONAL
            </span>
          }
        />
        <KpiCard
          title="Cashflow anual"
          amount={netSavings}
          icon={Wallet}
          accent={netSavings >= 0 ? 'positive' : 'danger'}
          sub={
            <span className={`font-semibold text-sm ${netSavings >= 0 ? 'text-[var(--s-pos)]' : 'text-red-700'}`}>
              Tasa de ahorro: {pct(savingsRate)}
            </span>
          }
        />
      </div>

      {/* ── Middle Row: Cash Flow Visual ─────────────────────────────── */}
      <CashFlowChart data={cashFlowData} />

      {/* ── Bottom Row: Expense Breakdown + Income Sources ─────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ExpenseBreakdown categories={expenseCatsToShow} incomeTotal={totalIncome} />
        <IncomeSources sources={incomeSources} total={totalIncome} />
      </div>
    </div>
  );
};

export default PersonalResumenView;
