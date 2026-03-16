// src/pages/inmuebles/InmueblesAnalisis.tsx
// Página de análisis de cartera inmobiliaria
// Tabs: Resumen · Cartera · Evolución general · Individual

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard,
  Table2,
  Activity,
  Home,
  Landmark,
  Building2,
  Wallet,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Shield,
  AlertTriangle,
  CircleCheck,
  CircleDollarSign,
  Eye,
  Pencil,
  SlidersHorizontal,
  Plus,
  Search,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Contract, Expense, initDB, OpexRule, Property } from '../../services/db';
import type { PlanPagos, Prestamo } from '../../types/prestamos';
import type { ValoracionHistorica } from '../../types/valoraciones';
import PropertySaleModal from '../../modules/horizon/inmuebles/components/PropertySaleModal';
import { cancelPropertySale, getLatestConfirmedSaleForProperty } from '../../services/propertySaleService';

// ─── Tokens ───────────────────────────────────────────────────────────────────
const C = {
  blue: '#042C5E',
  teal: '#1DA0BA',
  c2: '#5B8DB8',
  c3: '#1DA0BA',
  c4: '#A8C4DE',
  c5: '#C8D0DC',
  pos: '#1A7A3C',
  posBg: '#E8F5ED',
  neg: '#B91C1C',
  negBg: '#FEE9E9',
  n700: '#303A4C',
  n500: '#6C757D',
  n300: '#C8D0DC',
  n200: '#DDE3EC',
  n100: '#EEF1F5',
  n50: '#F8F9FA',
};

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + ' €';

// ─── Data ─────────────────────────────────────────────────────────────────────
type PropertySnapshot = {
  id: string;
  alias: string;
  addr: string;
  ccaa: string;
  purchaseDate: string;
  coste: number;
  valor: number;
  revalTotal: number;
  revalAnual: number;
  yield: number;
  deudaPendiente: number;
  cuotaHipotecaMes: number;
  cashflowMes: number;
  gastosMes: number;
};

const getAcquisitionCost = (property: Property): number => {
  const { acquisitionCosts } = property;
  const extras = (acquisitionCosts.other || []).reduce((sum, item) => sum + (item.amount || 0), 0);
  return (
    (acquisitionCosts.price ?? 0) +
    (acquisitionCosts.itp ?? 0) +
    (acquisitionCosts.iva ?? 0) +
    (acquisitionCosts.notary ?? 0) +
    (acquisitionCosts.registry ?? 0) +
    (acquisitionCosts.management ?? 0) +
    (acquisitionCosts.psi ?? 0) +
    (acquisitionCosts.realEstate ?? 0) +
    extras
  );
};

const getLatestValuationMap = (valoraciones: ValoracionHistorica[], tipo: 'inmueble' | 'inversion') => {
  const latest = new Map<number, number>();
  const sorted = valoraciones
    .filter((item) => item.tipo_activo === tipo)
    .sort((a, b) => String(a.fecha_valoracion).localeCompare(String(b.fecha_valoracion)));

  sorted.forEach((item) => {
    latest.set(item.activo_id, item.valor);
  });

  return latest;
};

const parseYear = (value?: string): number | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.getFullYear();
  }

  const yearMatch = value.match(/(19|20)\d{2}/);
  return yearMatch ? Number(yearMatch[0]) : null;
};

const getPurchaseYear = (purchaseDate?: string) => {
  const currentYear = new Date().getFullYear();
  const year = parseYear(purchaseDate);
  if (!year) return currentYear;
  return Math.min(year, currentYear);
};

const getElapsedYearsFromPurchase = (purchaseDate?: string) => {
  const purchaseYear = getPurchaseYear(purchaseDate);
  return Math.max(1, new Date().getFullYear() - purchaseYear);
};

const getElapsedMonthsFromPurchase = (purchaseDate?: string) => {
  if (!purchaseDate) return 12;
  const purchase = new Date(purchaseDate);
  if (Number.isNaN(purchase.getTime())) return 12;

  const now = new Date();
  const months = (now.getFullYear() - purchase.getFullYear()) * 12 + (now.getMonth() - purchase.getMonth());
  return Math.max(1, months);
};

const mapToSnapshot = (
  property: Property,
  contracts: Contract[],
  expenses: Expense[],
  opexRules: OpexRule[],
  loans: Prestamo[],
  paymentPlansByLoanId: Map<string, PlanPagos>,
  valorActual: number,
): PropertySnapshot => {
  const propertyId = property.id!;
  const normalizedPropertyId = String(propertyId).trim();

  const parseAmount = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'string') return 0;

    const raw = value.trim();
    if (!raw) return 0;

    const normalized = raw
      .replace(/€/g, '')
      .replace(/\s+/g, '')
      .replace(/\.(?=\d{3}(\D|$))/g, '')
      .replace(',', '.');

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const normalizeToken = (value: unknown): string =>
    String(value ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

  const isLoanLinkedToProperty = (loan: Prestamo): boolean => {
    const rawLoan = loan as Prestamo & {
      propertyId?: string | number;
      activoAsociadoId?: string | number;
      activoId?: string | number;
      assetId?: string | number;
      inmueble?: { id?: string | number };
      globalAlias?: string;
    };

    const ambito = String(rawLoan.ambito ?? '').toUpperCase().trim();
    if (rawLoan.activo === false) {
      return false;
    }

    const linkedId = String(
      rawLoan.inmuebleId
      ?? rawLoan.propertyId
      ?? rawLoan.activoAsociadoId
      ?? rawLoan.activoId
      ?? rawLoan.assetId
      ?? rawLoan.inmueble?.id
      ?? ''
    ).trim();

    if (!linkedId) {
      return false;
    }

    const normalizedLinkedId = linkedId.toLowerCase();
    if (['standalone', 'personal', 'sin_asociar', 'none', 'null', 'undefined'].includes(normalizedLinkedId)) {
      return false;
    }

    const hasInmuebleScope = ambito === 'INMUEBLE' || ambito === '' || ambito === 'HIPOTECA';
    if (!hasInmuebleScope) {
      return false;
    }

    if (linkedId === normalizedPropertyId) {
      return true;
    }

    const propertyGlobalAlias = String(property.globalAlias ?? '').trim();
    if (propertyGlobalAlias && linkedId === propertyGlobalAlias) {
      return true;
    }

    const normalizedLinkedIdToken = normalizeToken(linkedId);
    if (!normalizedLinkedIdToken) return false;

    const aliasToken = normalizeToken(property.alias);
    if (aliasToken && normalizedLinkedIdToken === aliasToken) {
      return true;
    }

    const globalAliasToken = normalizeToken(propertyGlobalAlias);
    if (globalAliasToken && normalizedLinkedIdToken === globalAliasToken) {
      return true;
    }

    return Number(linkedId) === Number(normalizedPropertyId);
  };

  const propertyLoans = loans.filter(isLoanLinkedToProperty);
  const coste = getAcquisitionCost(property);
  const valor = valorActual;

  const propertyContracts = contracts.filter((contract) => contract.inmuebleId === propertyId && contract.estadoContrato === 'activo');
  const ingresosMes = propertyContracts.reduce((sum, contract) => sum + (contract.rentaMensual || 0), 0);

  const propertyExpenses = expenses.filter((expense) => expense.propertyId === propertyId);
  const propertyOpexRules = opexRules.filter((rule) => rule.propertyId === propertyId && rule.activo);

  const opexRuleMonthly = (rule: OpexRule): number => {
    const amount = Number(rule.importeEstimado || 0);
    switch (rule.frecuencia) {
      case 'semanal':
        return (amount * 52) / 12;
      case 'mensual':
        return amount;
      case 'bimestral':
        return amount / 2;
      case 'trimestral':
        return amount / 3;
      case 'semestral':
        return amount / 6;
      case 'anual':
        return amount / 12;
      case 'meses_especificos':
        if (rule.asymmetricPayments?.length) {
          return rule.asymmetricPayments.reduce((sum, payment) => sum + Number(payment.importe || 0), 0) / 12;
        }
        return ((rule.mesesCobro?.length || 0) * amount) / 12;
      default:
        return 0;
    }
  };

  const gastosMes = propertyOpexRules.length > 0
    ? propertyOpexRules.reduce((sum, rule) => sum + opexRuleMonthly(rule), 0)
    : propertyExpenses.length
      ? propertyExpenses.reduce((sum, expense) => sum + expense.amount, 0) / Math.max(1, propertyExpenses.length)
      : 0;

  const deudaPendiente = propertyLoans.reduce((sum, loan) => sum + parseAmount(loan.principalVivo), 0);

  const getLoanMonthlyInstallment = (loan: Prestamo): number => {
    const rawLoan = loan as any;
    const planFromLoan = rawLoan?.planPagos;
    const planFromKeyval = paymentPlansByLoanId.get(String(loan.id));
    const plan = planFromLoan ?? planFromKeyval;

    const planPeriodoCuota = plan?.periodos?.find((periodo: any) => !periodo?.pagado)?.cuota
      ?? plan?.periodos?.[0]?.cuota
      ?? rawLoan?.cuadro_amortizacion?.find((cuota: any) => !cuota?.pagado)?.cuota_total
      ?? rawLoan?.cuadro_amortizacion?.[0]?.cuota_total;

    return parseAmount(
      rawLoan?.cuotaMensual
      ?? rawLoan?.cuota_mensual
      ?? rawLoan?.cuotaEstimada
      ?? rawLoan?.cuotaEstim
      ?? rawLoan?.cuota
      ?? planPeriodoCuota
      ?? 0
    );
  };

  const cuotaHipotecaMes = propertyLoans.reduce((sum, loan) => sum + getLoanMonthlyInstallment(loan), 0);

  const revalTotal = coste > 0 ? ((valor - coste) / coste) * 100 : 0;
  const elapsedYears = getElapsedYearsFromPurchase(property.purchaseDate);
  const revalAnual = coste > 0 ? (Math.pow(valor / coste, 1 / elapsedYears) - 1) * 100 : 0;
  const annualIncome = ingresosMes * 12;
  const yieldValue = coste > 0 ? (annualIncome / coste) * 100 : 0;

  return {
    id: String(propertyId),
    alias: property.alias,
    addr: property.address,
    ccaa: property.ccaa || 'Sin CCAA',
    purchaseDate: property.purchaseDate,
    coste,
    valor,
    revalTotal,
    revalAnual,
    yield: yieldValue,
    deudaPendiente,
    cuotaHipotecaMes,
    cashflowMes: ingresosMes - gastosMes,
    gastosMes,
  };
};

const DONUT_COLORS = [C.blue, C.c2, C.teal, C.c4, '#8FB0CC', C.c5];

const EVOLUCION_DATA = [
  { year: '2005', valor: 300000, coste: 128500 },
  { year: '2008', valor: 380000, coste: 222000 },
  { year: '2010', valor: 420000, coste: 300000 },
  { year: '2012', valor: 450000, coste: 322000 },
  { year: '2014', valor: 520000, coste: 380000 },
  { year: '2016', valor: 600000, coste: 430000 },
  { year: '2018', valor: 680000, coste: 480000 },
  { year: '2020', valor: 730000, coste: 520000 },
  { year: '2022', valor: 800000, coste: 540680 },
  { year: '2024', valor: 870000, coste: 540680 },
  { year: '2026', valor: 916000, coste: 540680 },
];

const CASHFLOW_DATA = [
  { year: '2010', cf: 400 }, { year: '2012', cf: 520 }, { year: '2014', cf: 780 },
  { year: '2016', cf: 1100 }, { year: '2018', cf: 1350 }, { year: '2020', cf: 1450 },
  { year: '2022', cf: 1600 }, { year: '2024', cf: 1750 }, { year: '2025', cf: 1820 },
  { year: '2026', cf: 1858 },
];

const buildProyeccion = (years: number, base: number, equity0: number, rate: number) => {
  const safeBase = Math.max(0, base);
  const safeEquity = Math.max(0, equity0);
  const safeRate = Number.isFinite(rate) ? Math.max(0, rate) : 0;
  const startYear = new Date().getFullYear();

  return Array.from({ length: years + 1 }, (_, i) => ({
    year: String(startYear + i),
    valor: Math.round(safeBase * Math.pow(1 + safeRate, i)),
    equity: Math.round(safeEquity * Math.pow(1 + safeRate * 0.75, i)),
  }));
};

const buildIndividualValueSeries = (property: PropertySnapshot) => {
  const purchaseYear = getPurchaseYear(property.purchaseDate);
  const currentYear = new Date().getFullYear();
  const pastYears = Array.from({ length: currentYear - purchaseYear + 1 }, (_, index) => String(purchaseYear + index));
  const growth = Math.max(0.004, property.revalAnual / 100);
  const past = pastYears.map((year, index) => {
    const progress = pastYears.length > 1 ? index / (pastYears.length - 1) : 1;
    const hist = Math.round(property.coste + (property.valor - property.coste) * progress);
    return { year, hist, proy: null as number | null };
  });

  const proyYears = Array.from({ length: 10 }, (_, index) => String(currentYear + index + 1));
  const projection = proyYears.map((year, index) => ({
    year,
    hist: null as number | null,
    proy: Math.round(property.valor * Math.pow(1 + growth, index + 1)),
  }));

  past[past.length - 1].proy = property.valor;
  return [...past, ...projection];
};

const buildIndividualCashflowSeries = (property: PropertySnapshot) => {
  const purchaseYear = getPurchaseYear(property.purchaseDate);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - purchaseYear + 1 }, (_, index) => String(purchaseYear + index));
  const yearlyIncome = Math.max(0, Math.round((property.cashflowMes + property.gastosMes) * 12));
  const yearlyExpenses = Math.max(0, Math.round(property.gastosMes * 12));

  return years.map((year, index) => {
    const ratio = 0.72 + index * 0.03;
    return {
      year,
      ing: Math.round(yearlyIncome * ratio),
      gas: Math.round(yearlyExpenses * (0.8 + index * 0.02)),
    };
  });
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label, value, meta, accentColor, iconBg, icon: Icon, valueColor,
}: {
  label: string; value: string; meta?: React.ReactNode;
  accentColor?: string; iconBg?: string; icon?: React.ElementType;
  valueColor?: string;
}) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.n300}`, borderRadius: 12, padding: 20, position: 'relative', overflow: 'hidden' }}>
      {accentColor && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accentColor }} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: C.n500 }}>{label}</span>
        {Icon && (
          <div style={{ width: 36, height: 36, borderRadius: 8, background: iconBg ?? 'rgba(4,44,94,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={16} />
          </div>
        )}
      </div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 32, fontWeight: 600, lineHeight: 1, marginBottom: 5, color: valueColor ?? C.n700 }}>{value}</div>
      {meta && <div style={{ fontSize: 12, color: C.n500 }}>{meta}</div>}
    </div>
  );
}

function Chip({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: bg, color }}>{children}</span>
  );
}

function ResultRow({ label, value, valueColor, bold }: { label: string; value: string; valueColor?: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '10px 0', borderBottom: `1px solid ${C.n100}` }}>
      <span style={{ fontSize: 13, color: bold ? C.n700 : C.n500, fontWeight: bold ? 700 : 400 }}>{label}</span>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600, color: valueColor ?? C.n700 }}>{value}</span>
    </div>
  );
}

function ChartCard({ title, sub, children, right }: { title: string; sub?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.n300}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.n100}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.n700 }}>{title}</div>
          {sub && <div style={{ fontSize: 12, color: C.n500, marginTop: 2 }}>{sub}</div>}
        </div>
        {right}
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

// ─── Tab: Resumen ─────────────────────────────────────────────────────────────

function TabResumen({ properties }: { properties: PropertySnapshot[] }) {
  const [horizon, setHorizon] = useState(10);
  const totalCost = useMemo(() => properties.reduce((sum, property) => sum + property.coste, 0), [properties]);
  const totalValue = useMemo(() => properties.reduce((sum, property) => sum + property.valor, 0), [properties]);
  const totalCashflowMes = useMemo(() => properties.reduce((sum, property) => sum + property.cashflowMes, 0), [properties]);
  const totalGastosMes = useMemo(() => properties.reduce((sum, property) => sum + property.gastosMes, 0), [properties]);
  const totalDebt = useMemo(() => properties.reduce((sum, property) => sum + property.deudaPendiente, 0), [properties]);

  const totalLatentGain = totalValue - totalCost;
  const totalEquity = totalValue - totalDebt;
  const weightedRevalRate = totalCost > 0
    ? properties.reduce((sum, property) => sum + ((property.revalAnual / 100) * property.coste), 0) / totalCost
    : 0;
  const grossYield = totalCost > 0 ? (((totalCashflowMes + totalGastosMes) * 12) / totalCost) * 100 : 0;
  const netAssetYield = totalCost > 0 ? ((totalCashflowMes * 12) / totalCost) * 100 : 0;
  const netEquityYield = totalEquity > 0 ? ((totalCashflowMes * 12) / totalEquity) * 100 : 0;
  const cashflowAcumulado = properties.reduce(
    (sum, property) => sum + (property.cashflowMes * getElapsedMonthsFromPurchase(property.purchaseDate)),
    0
  );
  const beneficioTotalVenta = cashflowAcumulado + totalLatentGain;
  const multiploCapital = totalCost > 0 ? totalEquity / totalCost : 0;

  const proyData = useMemo(
    () => buildProyeccion(horizon, totalValue, totalEquity, weightedRevalRate),
    [horizon, totalValue, totalEquity, weightedRevalRate]
  );

  return (
    <div>
      {/* KPI row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 16 }}>
        <KpiCard label="Coste total" value={fmt(totalCost)} meta="Inversión acumulada en inmuebles activos" accentColor={C.c2} icon={Landmark} iconBg="rgba(4,44,94,.06)" />
        <KpiCard
          label="Valor actual"
          value={fmt(totalValue)}
          meta={<><Chip color={totalLatentGain >= 0 ? C.pos : C.neg} bg={totalLatentGain >= 0 ? C.posBg : C.negBg}><TrendingUp size={10} /> {`${totalCost > 0 ? ((totalLatentGain / totalCost) * 100).toFixed(1) : '0.0'}%`}</Chip> sobre coste</>}
          accentColor={C.blue}
          icon={Building2}
          iconBg="rgba(4,44,94,.06)"
        />
        <KpiCard label="Cashflow neto / mes" value={fmt(totalCashflowMes)} meta="Ingresos − gastos − hipotecas" accentColor={C.pos} icon={Wallet} iconBg={C.posBg} valueColor={C.pos} />
        <KpiCard label="Plusvalía latente" value={fmt(totalLatentGain)} meta="Si vendes hoy (antes de impuestos)" accentColor={C.teal} icon={ArrowUpRight} iconBg="rgba(29,160,186,.1)" />
      </div>

      {/* KPI row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 16 }}>
        {[
          { label: 'Rentabilidad bruta', val: `${grossYield.toFixed(2)}%`, meta: '/ año · Ingresos anuales / Coste total' },
          { label: 'Rentabilidad neta s/ activo', val: `${netAssetYield.toFixed(2)}%`, meta: '/ año · Cashflow neto anual / Coste total' },
          { label: 'Rentabilidad neta s/ equity', val: `${netEquityYield.toFixed(2)}%`, meta: '/ año · Cashflow neto anual / Capital propio' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: `1px solid ${C.n300}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: C.n500, marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 34, fontWeight: 600, color: C.blue, lineHeight: 1, marginBottom: 4 }}>{k.val}</div>
            <div style={{ fontSize: 12, color: C.n500 }}>{k.meta}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <ChartCard
          title="Proyección de cartera"
          sub={`Valor de mercado y equity · Tasa media ${(weightedRevalRate * 100).toFixed(2)}%/año`}
          right={
            <div style={{ display: 'inline-flex', gap: 2, background: C.n100, borderRadius: 8, padding: 3 }}>
              {[5, 10, 20].map(y => (
                <button key={y} onClick={() => setHorizon(y)} style={{ padding: '5px 12px', fontSize: 12, fontWeight: horizon === y ? 600 : 500, color: horizon === y ? C.blue : C.n500, background: horizon === y ? '#fff' : 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', boxShadow: horizon === y ? '0 1px 3px rgba(4,44,94,.08)' : 'none' }}>{y}a</button>
              ))}
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={proyData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="rgba(200,208,220,.4)" strokeDasharray="0" />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: C.n500 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.n500 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [`${v.toLocaleString('es-ES')} €`]} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.n200}` }} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Line type="monotone" dataKey="valor" name="Valor cartera" stroke={C.blue} strokeWidth={2} dot={{ r: 3, fill: C.blue }} fill="rgba(4,44,94,.07)" />
              <Line type="monotone" dataKey="equity" name="Equity neto" stroke={C.teal} strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3, fill: C.teal }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <div style={{ background: '#fff', border: `1px solid ${C.n300}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.n700, marginBottom: 16 }}>Resultado global y equity</div>
          <ResultRow label="Cashflow neto acumulado" value={fmt(cashflowAcumulado)} valueColor={cashflowAcumulado >= 0 ? C.pos : C.neg} />
          <ResultRow label="Beneficio total si vendes hoy" value={fmt(beneficioTotalVenta)} valueColor={beneficioTotalVenta >= 0 ? C.pos : C.neg} />
          <ResultRow label="Múltiplo sobre capital" value={`× ${multiploCapital.toFixed(2)}`} />
          <ResultRow label="Rentabilidad anualizada" value={`${(weightedRevalRate * 100).toFixed(2)}%`} valueColor={C.blue} />
          <ResultRow label="Tasa media revalorización" value={`${(weightedRevalRate * 100).toFixed(2)}% / año`} />
          <div style={{ height: 1, background: C.n300, margin: '8px 0' }} />
          <ResultRow label="Deuda pendiente" value={fmt(-totalDebt)} valueColor={C.neg} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.n700 }}>Equity actual</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 17, fontWeight: 600, color: C.blue }}>{fmt(totalEquity)}</span>
          </div>
          <div style={{ fontSize: 11, color: C.n500, marginTop: 8 }}>Métricas calculadas automáticamente con los inmuebles activos y sus últimas valoraciones.</div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Cartera ─────────────────────────────────────────────────────────────

function TabCartera({
  onSelectProperty,
  onSellProperty,
  properties,
}: {
  onSelectProperty: (id: string) => void;
  onSellProperty: (id: string) => void;
  properties: PropertySnapshot[];
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<keyof PropertySnapshot>('alias');
  const [sortAsc, setSortAsc] = useState(true);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return properties
      .filter(p => p.alias.toLowerCase().includes(q) || p.addr.toLowerCase().includes(q))
      .sort((a, b) => {
        const va = a[sortKey], vb = b[sortKey];
        return sortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
      });
  }, [properties, query, sortKey, sortAsc]);

  const handleSort = (key: keyof PropertySnapshot) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const SortIcon = ({ k }: { k: keyof PropertySnapshot }) =>
    sortKey === k ? (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : null;

  const totalCost = filtered.reduce((sum, p) => sum + p.coste, 0);
  const totalValue = filtered.reduce((sum, p) => sum + p.valor, 0);
  const totalLatentGain = totalValue - totalCost;
  const totalDebt = filtered.reduce((sum, p) => sum + p.deudaPendiente, 0);
  const totalMortgage = filtered.reduce((sum, p) => sum + p.cuotaHipotecaMes, 0);
  const totalExpenses = filtered.reduce((sum, p) => sum + p.gastosMes, 0);
  const totalRent = filtered.reduce((sum, p) => sum + Math.max(0, p.cashflowMes + p.gastosMes), 0);
  const totalNetCf = filtered.reduce((sum, p) => sum + (p.cashflowMes - p.cuotaHipotecaMes), 0);
  const equity = Math.max(0, totalValue - totalDebt);
  const ltv = totalValue > 0 ? (totalDebt / totalValue) * 100 : 0;
  const occupiedUnits = filtered.filter((p) => Math.max(0, p.cashflowMes + p.gastosMes) > 0).length;
  const totalUnits = filtered.length;
  const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;
  const mortgageCoverage = totalMortgage > 0 ? totalRent / totalMortgage : 0;

  const rows = filtered.map((p) => {
    const rent = Math.max(0, p.cashflowMes + p.gastosMes);
    const netCf = p.cashflowMes - p.cuotaHipotecaMes;
    return {
      ...p,
      rent,
      netCf,
      status: rent <= 0 ? 'Vacío' : 'Alquilado',
    };
  });

  const distributionData = [...filtered]
    .sort((a, b) => b.valor - a.valor)
    .map((p) => ({ name: p.alias, value: p.valor, pct: totalValue > 0 ? (p.valor / totalValue) * 100 : 0 }));

  const geoData = useMemo(() => {
    const grouped = new Map<string, number>();
    filtered.forEach((p) => grouped.set(p.ccaa || 'Sin CCAA', (grouped.get(p.ccaa || 'Sin CCAA') ?? 0) + p.valor));
    return Array.from(grouped.entries())
      .map(([name, value]) => ({ name, value, pct: totalValue > 0 ? (value / totalValue) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [filtered, totalValue]);

  const cashflow6m = useMemo(() => {
    const months = ['Oct', 'Nov', 'Dic', 'Ene', 'Feb', 'Mar'];
    return months.map((month, i) => ({
      month,
      value: Math.max(0, totalNetCf * (0.9 + i * 0.02)),
      highlight: i === months.length - 1,
    }));
  }, [totalNetCf]);

  const currentCashflow = cashflow6m[cashflow6m.length - 1]?.value ?? 0;
  const arcLength = Math.PI * 50;
  const ltvProgress = Math.max(0, Math.min(100, ltv));

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        <KpiCard
          label="Plusvalía latente"
          value={`${totalLatentGain >= 0 ? '+' : '-'}${fmt(Math.abs(totalLatentGain))}`}
          meta={<Chip color={totalLatentGain >= 0 ? C.pos : C.neg} bg={totalLatentGain >= 0 ? C.posBg : C.negBg}>{totalCost > 0 ? `${totalLatentGain >= 0 ? '↗' : '↘'} ${Math.abs((totalLatentGain / totalCost) * 100).toFixed(1)}%` : '0,0%'}</Chip>}
          accentColor={C.pos}
          icon={ArrowUpRight}
          iconBg={C.posBg}
          valueColor={totalLatentGain >= 0 ? C.pos : C.neg}
        />
        <KpiCard
          label="Ocupación"
          value={`${occupancyRate.toFixed(1).replace('.', ',')}%`}
          meta={<><span>{occupiedUnits} de {totalUnits} unidades alquiladas</span><div style={{ marginTop: 4 }}><Chip color={occupiedUnits === totalUnits ? C.pos : '#A16207'} bg={occupiedUnits === totalUnits ? C.posBg : '#FEF3C7'}>{occupiedUnits === totalUnits ? <><CircleCheck size={10} /> Completa</> : <><AlertTriangle size={10} /> {totalUnits - occupiedUnits} unidad vacía</>}</Chip></div></>}
          accentColor={C.teal}
          icon={Home}
          iconBg="rgba(29,160,186,.1)"
        />
        <KpiCard
          label="Cobertura hipotecas"
          value={totalMortgage > 0 ? `${mortgageCoverage.toFixed(1).replace('.', ',')}x` : 'N/A'}
          meta={<><span>CF ingresos / CF financiación</span><div style={{ marginTop: 4 }}><Chip color={totalMortgage <= 0 || mortgageCoverage >= 1.2 ? C.pos : C.neg} bg={totalMortgage <= 0 || mortgageCoverage >= 1.2 ? C.posBg : C.negBg}>{totalMortgage <= 0 ? 'Sin deuda' : mortgageCoverage >= 1.2 ? <><CircleCheck size={10} /> Solvente</> : 'En riesgo'}</Chip></div></>}
          accentColor={C.blue}
          icon={Shield}
          iconBg="rgba(4,44,94,.06)"
        />
      </div>

      <div style={{ background: '#fff', border: `1px solid ${C.n300}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.n100}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, maxWidth: 480, padding: '10px 14px', border: `1.5px solid ${C.n200}`, borderRadius: 10, background: C.n50 }}>
            <Search size={16} color={C.n500} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por alias o dirección..." style={{ border: 'none', background: 'transparent', fontSize: 15, color: C.n700, width: '100%', outline: 'none', fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 14px', fontSize: 13, background: 'transparent', border: `1.5px solid ${C.n200}`, borderRadius: 10, cursor: 'pointer', color: C.n500, fontFamily: 'inherit' }}>
              <SlidersHorizontal size={14} /> Filtros
            </button>
            <button onClick={() => navigate('/inmuebles/cartera/nuevo')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 14px', fontSize: 13, background: C.blue, border: 'none', borderRadius: 10, cursor: 'pointer', color: '#fff', fontFamily: 'inherit', fontWeight: 600 }}>
              <Plus size={14} /> Nuevo inmueble
            </button>
          </div>
        </div>

        <div style={{ padding: '10px 20px', fontSize: 13, color: C.n500, borderBottom: `1px solid ${C.n100}` }}>{filtered.length} inmuebles</div>

        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '21%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '12%' }} />
          </colgroup>
          <thead>
            <tr>
              {[
                { key: 'alias', label: 'Propiedad', align: 'left' },
                { key: 'coste', label: 'Coste', align: 'right' },
                { key: 'valor', label: 'Valor actual', align: 'right' },
                { key: 'revalTotal', label: 'Plusvalía', align: 'right' },
                { key: 'cashflowMes', label: 'Renta/mes', align: 'right' },
                { key: 'yield', label: 'Yield bruto', align: 'right' },
                { key: 'cuotaHipotecaMes', label: 'Hipoteca/mes', align: 'right' },
                { key: 'deudaPendiente', label: 'CF neto', align: 'right' },
              ].map(col => (
                <th key={col.key} onClick={() => handleSort(col.key as any)} style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.n500, background: C.n50, borderBottom: `1px solid ${C.n200}`, textAlign: col.align as any, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{col.label}<SortIcon k={col.key as any} /></span>
                </th>
              ))}
              <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.n500, background: C.n50, borderBottom: `1px solid ${C.n200}`, textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={p.id} onClick={() => onSelectProperty(p.id)} style={{ borderBottom: i < rows.length - 1 ? `1px solid ${C.n100}` : 'none', cursor: 'pointer' }}>
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, maxWidth: '100%' }}>
                    <div style={{ fontWeight: 600, color: C.n700, fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.alias}</div>
                    <Chip color={p.status === 'Alquilado' ? C.pos : C.neg} bg={p.status === 'Alquilado' ? C.posBg : C.negBg}>{p.status}</Chip>
                  </div>
                  <div style={{ fontSize: 12, color: C.n500, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.addr}</div>
                </td>
                <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap', fontFamily: "'IBM Plex Mono', monospace", fontSize: 15 }}>{fmt(p.coste)}</td>
                <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap', fontFamily: "'IBM Plex Mono', monospace", fontSize: 15 }}>{fmt(p.valor)}</td>
                <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap', fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, color: p.revalTotal >= 0 ? C.pos : C.neg, fontWeight: 600 }}>{p.revalTotal >= 0 ? '+' : '-'}{fmt(Math.abs(p.valor - p.coste))}</td>
                <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap', fontFamily: "'IBM Plex Mono', monospace", fontSize: 15 }}>{fmt(p.rent)}</td>
                <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap', fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, color: p.yield > 0 ? C.pos : C.neg, fontWeight: 600 }}>{p.yield > 0 ? `${p.yield.toFixed(2).replace('.', ',')}%` : '0%'}</td>
                <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap', fontFamily: "'IBM Plex Mono', monospace", fontSize: 15 }}>{fmt(p.cuotaHipotecaMes)}</td>
                <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap', fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, color: p.netCf >= 0 ? C.pos : C.neg, fontWeight: 600 }}>{p.netCf >= 0 ? '+' : '-'}{fmt(Math.abs(p.netCf))}</td>
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <button onClick={e => { e.stopPropagation(); navigate(`/inmuebles/cartera/${p.id}`); }} style={{ width: 30, height: 30, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.n500 }} title="Ver detalle"><Eye size={15} /></button>
                    <button onClick={e => { e.stopPropagation(); navigate(`/inmuebles/gastos?propertyId=${p.id}`); }} style={{ width: 30, height: 30, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.n500 }} title="Pack gastos alquileres"><TrendingDown size={15} /></button>
                    <button onClick={e => { e.stopPropagation(); onSellProperty(p.id); }} style={{ width: 30, height: 30, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.n500 }} title="Vender inmueble"><CircleDollarSign size={15} /></button>
                    <button onClick={e => { e.stopPropagation(); navigate(`/inmuebles/cartera/${p.id}/editar`); }} style={{ width: 30, height: 30, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.n500 }} title="Editar inmueble"><Pencil size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
            <tr style={{ background: C.n50, borderTop: `1px solid ${C.n200}` }}>
              <td style={{ padding: '14px 16px', fontWeight: 700, color: C.n700, fontSize: 18 }}>Total cartera</td>
              <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', fontFamily: "'IBM Plex Mono', monospace", fontSize: 16 }}>{fmt(totalCost)}</td>
              <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', fontFamily: "'IBM Plex Mono', monospace", fontSize: 16 }}>{fmt(totalValue)}</td>
              <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', color: totalLatentGain >= 0 ? C.pos : C.neg, fontFamily: "'IBM Plex Mono', monospace", fontSize: 16 }}>{totalLatentGain >= 0 ? '+' : '-'}{fmt(Math.abs(totalLatentGain))}</td>
              <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', fontFamily: "'IBM Plex Mono', monospace", fontSize: 16 }}>{fmt(totalRent)}</td>
              <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', color: C.blue, fontFamily: "'IBM Plex Mono', monospace", fontSize: 16 }}>{totalCost > 0 ? `${((totalRent * 12 / totalCost) * 100).toFixed(2).replace('.', ',')}%` : '0%'}</td>
              <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', fontFamily: "'IBM Plex Mono', monospace", fontSize: 16 }}>{fmt(totalMortgage)}</td>
              <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', color: totalNetCf >= 0 ? C.pos : C.neg, fontFamily: "'IBM Plex Mono', monospace", fontSize: 16 }}>{totalNetCf >= 0 ? '+' : '-'}{fmt(Math.abs(totalNetCf))}</td>
              <td style={{ padding: '14px 16px' }} />
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 16 }}>
        <div style={{ background: '#fff', border: `1px solid ${C.n300}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.n200}`, fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.n500 }}>Apalancamiento (LTV)</div>
          <div style={{ padding: 18 }}>
            <div style={{ display: 'grid', placeItems: 'center', marginBottom: 8 }}>
              <svg width="230" height="132" viewBox="0 0 120 70">
                <path d="M 10 60 A 50 50 0 0 1 110 60" fill="none" stroke={C.n200} strokeWidth="10" strokeLinecap="round" />
                <path d="M 10 60 A 50 50 0 0 1 110 60" fill="none" stroke={C.pos} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(arcLength * ltvProgress) / 100} ${arcLength}`} />
              </svg>
              <div style={{ marginTop: -22, fontSize: 56, lineHeight: 1, color: C.pos, fontWeight: 700 }}>{ltv.toFixed(1).replace('.', ',')}%</div>
              <div style={{ fontSize: 18, color: C.n500 }}>Loan-to-Value global</div>
              <div style={{ fontSize: 13, color: '#8D97A9' }}>Objetivo recomendado: &lt; 50%</div>
            </div>
            <div style={{ height: 1, background: C.n200, margin: '14px 0' }} />
            <ResultRow label="Equity" value={`${fmt(equity)} · ${totalValue > 0 ? ((equity / totalValue) * 100).toFixed(1).replace('.', ',') : '0'}%`} valueColor={C.n700} />
            <ResultRow label="Deuda viva" value={`${fmt(totalDebt)} · ${ltv.toFixed(1).replace('.', ',')}%`} valueColor={C.n700} />
          </div>
        </div>

        <div style={{ background: '#fff', border: `1px solid ${C.n300}`, borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.n500, marginBottom: 12 }}>Distribución por propiedad</div>
          {distributionData.map((item, i) => (
            <div key={item.name} style={{ display: 'grid', gridTemplateColumns: '160px 1fr auto auto', alignItems: 'center', gap: 8, marginBottom: 9 }}>
              <div style={{ fontSize: 14, color: C.n700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
              <div style={{ height: 10, borderRadius: 999, background: C.n100, overflow: 'hidden' }}><div style={{ width: `${item.pct}%`, height: '100%', background: DONUT_COLORS[i % DONUT_COLORS.length] }} /></div>
              <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(item.value)}</div>
              <div style={{ fontSize: 13, color: C.n500, width: 45, textAlign: 'right' }}>{item.pct.toFixed(1).replace('.', ',')}%</div>
            </div>
          ))}
          <div style={{ height: 1, background: C.n200, margin: '12px 0' }} />
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.n500, marginBottom: 10 }}>Distribución geográfica (CCAA)</div>
          {geoData.map((item, i) => (
            <div key={item.name} style={{ display: 'grid', gridTemplateColumns: '160px 1fr auto auto', alignItems: 'center', gap: 8, marginBottom: 9 }}>
              <div style={{ fontSize: 14, color: C.n700 }}>{item.name}</div>
              <div style={{ height: 10, borderRadius: 999, background: C.n100, overflow: 'hidden' }}><div style={{ width: `${item.pct}%`, height: '100%', background: DONUT_COLORS[(i + 1) % DONUT_COLORS.length] }} /></div>
              <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(item.value)}</div>
              <div style={{ fontSize: 13, color: C.n500, width: 45, textAlign: 'right' }}>{item.pct.toFixed(1).replace('.', ',')}%</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: '#fff', border: `1px solid ${C.n300}`, borderRadius: 14, padding: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.n500, marginBottom: 12 }}>Cashflow últimos 6 meses</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 8, marginBottom: 16 }}>
          {cashflow6m.map((item) => (
            <div key={item.month} style={{ textAlign: 'center' }}>
              <div style={{ height: 86, borderRadius: 8, background: item.highlight ? C.blue : C.pos }} />
              <div style={{ marginTop: 8, fontSize: 13, color: item.highlight ? C.blue : C.n500, fontWeight: item.highlight ? 700 : 500 }}>{item.month}</div>
            </div>
          ))}
        </div>
        <div style={{ height: 1, background: C.n200, marginBottom: 12 }} />
        <ResultRow label="Cashflow neto · mes actual" value={`${currentCashflow >= 0 ? '+' : '-'}${fmt(Math.abs(currentCashflow))}`} valueColor={currentCashflow >= 0 ? C.pos : C.neg} />
        <ResultRow label="Ingresos por alquileres" value={`+${fmt(totalRent)}`} valueColor={C.pos} />
        <ResultRow label="Gastos de inmuebles" value={`-${fmt(totalExpenses)}`} valueColor={C.neg} />
        <ResultRow label="Cuotas hipotecarias" value={`-${fmt(totalMortgage)}`} valueColor={C.neg} />
        <ResultRow label="Total salidas" value={`-${fmt(totalExpenses + totalMortgage)}`} valueColor={C.neg} />
      </div>
    </div>
  );
}

// ─── Tab: Evolución general ───────────────────────────────────────────────────

function TabEvolucion({ properties }: { properties: PropertySnapshot[] }) {
  const donutData = properties.map(p => ({ name: p.alias, value: p.valor }));
  const yieldData = [...properties].sort((a, b) => b.yield - a.yield).map(p => ({ name: p.alias, yield: p.yield }));

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <ChartCard title="Evolución del valor de cartera" sub="Valor total de mercado vs coste acumulado · 2005–2026">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={EVOLUCION_DATA} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="rgba(200,208,220,.4)" />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: C.n500 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.n500 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [`${v.toLocaleString('es-ES')} €`]} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.n200}` }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="valor" name="Valor mercado" stroke={C.blue} strokeWidth={2} dot={{ r: 3 }} fill="rgba(4,44,94,.08)" />
              <Line type="monotone" dataKey="coste" name="Coste acumulado" stroke={C.c2} strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Cashflow neto mensual" sub="Evolución del cashflow por año">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={CASHFLOW_DATA} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="rgba(200,208,220,.4)" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: C.n500 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.n500 }} axisLine={false} tickLine={false} tickFormatter={v => `${v} €`} />
              <Tooltip formatter={(v: number) => [`${v} €/mes`]} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.n200}` }} />
              <Bar dataKey="cf" name="Cashflow neto €/mes" fill="rgba(26,122,60,.7)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <ChartCard title="Distribución del valor por inmueble" sub="% sobre valor total de cartera">
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <PieChart width={180} height={180}>
              <Pie data={donutData} dataKey="value" cx={90} cy={90} innerRadius={58} outerRadius={86} paddingAngle={1}>
                {donutData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => [`${v.toLocaleString('es-ES')} €`]} contentStyle={{ fontSize: 12 }} />
            </PieChart>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {donutData.map((d, i) => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.n700 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: DONUT_COLORS[i], flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{d.name}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>{(d.value / 1000).toFixed(0)}k €</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Rentabilidad bruta por inmueble" sub="% yield anual · Ingresos / Coste">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={yieldData} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="rgba(200,208,220,.4)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: C.n500 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: C.n500 }} axisLine={false} tickLine={false} width={90} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(2)}%`]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="yield" name="Yield %" radius={[0, 4, 4, 0]}>
                {yieldData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[Math.min(i, DONUT_COLORS.length - 1)]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

// ─── Tab: Individual ──────────────────────────────────────────────────────────

function TabIndividual({ selectedId, properties }: { selectedId: string; properties: PropertySnapshot[] }) {
  const [propId, setPropId] = useState(selectedId || 'acevedo');
  const prop = properties.find(p => p.id === propId) ?? properties[0];
  const indivData = useMemo(() => buildIndividualValueSeries(prop), [prop]);
  const cashflowData = useMemo(() => buildIndividualCashflowSeries(prop), [prop]);
  const cashflowLabel = prop.cashflowMes > 0 ? `+${fmt(prop.cashflowMes)}` : prop.cashflowMes < 0 ? `-${fmt(Math.abs(prop.cashflowMes))}` : '0 €';
  const cashflowColor = prop.cashflowMes > 0 ? C.pos : prop.cashflowMes < 0 ? C.neg : C.n500;
  const cashflowMeta = `Neto tras gastos (${fmt(prop.gastosMes)} / mes)`;
  const monthsFromPurchase = getElapsedMonthsFromPurchase(prop.purchaseDate);
  const cashflowAcumulado = prop.cashflowMes * monthsFromPurchase;
  const projectionRate = Math.max(0.004, prop.revalAnual / 100);

  return (
    <div>
      {/* Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.n700 }}>Inmueble</label>
        <select value={propId} onChange={e => setPropId(e.target.value)} style={{ padding: '7px 12px', border: `1.5px solid ${C.n300}`, borderRadius: 8, fontSize: 13, color: C.n700, background: '#fff', cursor: 'pointer', minWidth: 260, fontFamily: 'inherit' }}>
          {properties.map(p => <option key={p.id} value={p.id}>{p.alias} · {p.addr}</option>)}
        </select>
      </div>

      {/* Timeline */}
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: C.n500, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        Foto pasado · presente · proyección
        <div style={{ flex: 1, height: 1, background: C.n200 }} />
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Compra', val: fmt(prop.coste), sub: 'Coste total', cls: 'past' },
          { label: 'Hoy', val: fmt(prop.valor), sub: 'Valor estimado actual', cls: 'present' },
          { label: 'Proyección 5 años', val: `~${fmt(Math.round(prop.valor * Math.pow(1 + projectionRate, 5)))}`, sub: `A ${(projectionRate * 100).toFixed(2)}% anual`, cls: 'future' },
          { label: 'Proyección 10 años', val: `~${fmt(Math.round(prop.valor * Math.pow(1 + projectionRate, 10)))}`, sub: `A ${(projectionRate * 100).toFixed(2)}% anual`, cls: 'future' },
        ].map(t => (
          <div key={t.label} style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: `1px solid ${t.cls === 'present' ? C.blue : t.cls === 'future' ? C.teal : C.n200}`, background: t.cls === 'present' ? 'rgba(4,44,94,.04)' : t.cls === 'future' ? 'rgba(29,160,186,.04)' : C.n50 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: C.n500, marginBottom: 4 }}>{t.label}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 17, fontWeight: 600, color: C.n700 }}>{t.val}</div>
            <div style={{ fontSize: 11, color: C.n500, marginTop: 2 }}>{t.sub}</div>
          </div>
        ))}
      </div>

      {/* KPI Strip */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, overflowX: 'auto' }}>
        {[
          { label: 'Plusvalía latente', val: `+${fmt(prop.valor - prop.coste)}`, meta: `+${prop.revalTotal.toFixed(2)}% total`, color: C.pos },
          { label: 'Reval. anual', val: `${prop.revalAnual.toFixed(2)}%`, meta: 'Media desde compra', color: C.blue },
          { label: 'Yield bruto', val: prop.yield > 0 ? `${prop.yield.toFixed(2)}%` : '—', meta: 'Ingresos / coste', color: C.blue },
          { label: 'Cashflow / mes', val: cashflowLabel, meta: cashflowMeta, color: cashflowColor },
          {
            label: 'Deuda pendiente',
            val: prop.deudaPendiente > 0 ? `-${fmt(prop.deudaPendiente)}` : '0 €',
            meta: prop.deudaPendiente > 0 ? 'Hipoteca activa' : 'Sin hipoteca activa',
            color: prop.deudaPendiente > 0 ? C.neg : C.n500,
          },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: `1px solid ${C.n300}`, borderRadius: 12, padding: 14, flexShrink: 0, minWidth: 130 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: C.n500, marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 20, fontWeight: 600, color: k.color }}>{k.val}</div>
            <div style={{ fontSize: 11, color: C.n500, marginTop: 2 }}>{k.meta}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        <ChartCard title={`${prop.alias} — Evolución y proyección de valor`} sub="Valor histórico estimado + proyección a 10 años">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={indivData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="rgba(200,208,220,.4)" />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: C.n500 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.n500 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [`${v.toLocaleString('es-ES')} €`]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="hist" name="Valor histórico" stroke={C.blue} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
              <Line type="monotone" dataKey="proy" name={`Proyección (${(projectionRate * 100).toFixed(2)}%/a)`} stroke={C.teal} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: '#fff', border: `1px solid ${C.n300}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.n700, marginBottom: 16 }}>Rentabilidad acumulada</div>
            <ResultRow label="Inversión inicial" value={fmt(prop.coste)} />
            <ResultRow label="Valor actual" value={fmt(prop.valor)} />
            <ResultRow label="Cashflow acumulado" value={`${cashflowAcumulado >= 0 ? '+' : '-'}${fmt(Math.abs(cashflowAcumulado))}`} valueColor={cashflowAcumulado >= 0 ? C.pos : C.neg} />
            <ResultRow label="Beneficio total" value={`${(prop.valor - prop.coste + cashflowAcumulado) >= 0 ? '+' : '-'}${fmt(Math.abs(prop.valor - prop.coste + cashflowAcumulado))}`} valueColor={(prop.valor - prop.coste + cashflowAcumulado) >= 0 ? C.pos : C.neg} />
            <div style={{ height: 1, background: C.n300, margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.n700 }}>Múltiplo s/ capital</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 20, fontWeight: 600, color: C.blue }}>× {((prop.valor + cashflowAcumulado) / prop.coste).toFixed(2)}</span>
            </div>
          </div>

          <ChartCard title="Cashflow mensual histórico" sub="Ingresos vs gastos por año">
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={cashflowData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: C.n500 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: C.n500 }} axisLine={false} tickLine={false} tickFormatter={v => `${v / 1000}k`} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Bar dataKey="ing" name="Ingresos" fill="rgba(26,122,60,.7)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="gas" name="Gastos" fill="rgba(200,208,220,.8)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'resumen' | 'cartera' | 'evolucion' | 'individual';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'resumen',    label: 'Resumen',          icon: LayoutDashboard },
  { id: 'cartera',    label: 'Cartera',           icon: Table2 },
  { id: 'evolucion',  label: 'Evolución general', icon: Activity },
  { id: 'individual', label: 'Individual',        icon: Home },
];

export default function InmueblesAnalisis() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTabParam = searchParams.get('tab');
  const refreshFlag = searchParams.get('refresh');
  const [activeTab, setActiveTab] = useState<Tab>('resumen');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [properties, setProperties] = useState<PropertySnapshot[]>([]);
  const [activeProperties, setActiveProperties] = useState<Property[]>([]);
  const [soldProperties, setSoldProperties] = useState<Property[]>([]);
  const [latestSaleByPropertyId, setLatestSaleByPropertyId] = useState<Record<number, number>>({});
  const [saleModalProperty, setSaleModalProperty] = useState<Property | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);

  useEffect(() => {
    const requestedTab = currentTabParam;
    if (requestedTab && TABS.some((tab) => tab.id === requestedTab)) {
      setActiveTab(requestedTab as Tab);
    }
  }, [currentTabParam]);

  useEffect(() => {
    let mounted = true;

    const loadProperties = async () => {
      try {
        const db = await initDB();
        const [dbProperties, dbLoans, dbContracts, dbExpenses, dbOpexRules, dbValoraciones, keyvalKeys] = await Promise.all([
          db.getAll('properties') as Promise<Property[]>,
          db.getAll('prestamos') as Promise<Prestamo[]>,
          db.getAll('contracts') as Promise<Contract[]>,
          db.getAll('expenses') as Promise<Expense[]>,
          db.getAll('opexRules') as Promise<OpexRule[]>,
          db.getAll('valoraciones_historicas') as Promise<ValoracionHistorica[]>,
          db.getAllKeys('keyval') as Promise<IDBValidKey[]>,
        ]);

        if (!mounted) return;
        const paymentPlanKeys = keyvalKeys
          .map((key) => String(key))
          .filter((key) => key.startsWith('planpagos_'));

        const paymentPlans = await Promise.all(
          paymentPlanKeys.map((key) => db.get('keyval', key) as Promise<PlanPagos | undefined>)
        );

        const paymentPlansByLoanId = new Map<string, PlanPagos>();
        paymentPlans.forEach((plan, index) => {
          if (!plan?.periodos?.length) return;
          const key = paymentPlanKeys[index];
          const loanId = key.replace('planpagos_', '').trim();
          if (loanId) paymentPlansByLoanId.set(loanId, plan);
        });

        const active = dbProperties.filter((property) => property.state === 'activo' && property.id != null);
        const sold = dbProperties.filter((property) => property.state === 'vendido' && property.id != null);
        setActiveProperties(active);
        setSoldProperties(sold);

        const latestSales = await Promise.all(
          sold.map(async (soldProperty) => {
            const sale = await getLatestConfirmedSaleForProperty(soldProperty.id as number);
            if (!sale?.id) return null;
            return { propertyId: soldProperty.id as number, saleId: sale.id };
          })
        );
        setLatestSaleByPropertyId(
          latestSales.reduce<Record<number, number>>((acc, item) => {
            if (!item) return acc;
            acc[item.propertyId] = item.saleId;
            return acc;
          }, {})
        );
        const latestInmuebleValorMap = getLatestValuationMap(dbValoraciones, 'inmueble');
        const snapshots = active.map((property) =>
          mapToSnapshot(
            property,
            dbContracts,
            dbExpenses,
            dbOpexRules,
            dbLoans,
            paymentPlansByLoanId,
            latestInmuebleValorMap.get(property.id as number) ?? property.acquisitionCosts.price,
          )
        );
        setProperties(snapshots);
        if (!selectedPropertyId && snapshots.length) {
          setSelectedPropertyId(snapshots[0].id);
        }
      } catch {
        if (mounted) setProperties([]);
      }
    };

    void loadProperties();
    return () => {
      mounted = false;
    };
  }, [selectedPropertyId, refreshFlag, reloadCounter]);

  const handleTabChange = (tabId: Tab) => {
    setActiveTab(tabId);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', tabId);
    nextParams.delete('refresh');
    setSearchParams(nextParams, { replace: true });
  };

  if (!properties.length) {
    return (
      <div style={{ minHeight: '100vh', background: C.n50, display: 'grid', placeItems: 'center' }}>
        <p style={{ color: C.n500 }}>No hay inmuebles activos en tus datos.</p>
      </div>
    );
  }

  const handleSelectProperty = (id: string) => {
    setSelectedPropertyId(id);
    setActiveTab('individual');
  };

  const handleSellProperty = (id: string) => {
    const property = activeProperties.find((item) => String(item.id) === id);
    if (property) {
      setSaleModalProperty(property);
    }
  };

  const handleRevertSale = async (propertyId: number) => {
    const saleId = latestSaleByPropertyId[propertyId];
    if (!saleId) {
      window.alert('No se encontró una venta confirmada para este inmueble.');
      return;
    }
    const confirmed = window.confirm('¿Seguro que quieres anular la venta y reactivar el inmueble?');
    if (!confirmed) return;
    try {
      await cancelPropertySale(saleId);
      setReloadCounter((current) => current + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo anular la venta';
      window.alert(message);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.n50, fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div style={{ padding: 24 }}>
        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, paddingBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(4,44,94,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Building2 size={20} color={C.blue} />
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: C.n700, letterSpacing: '-.02em', lineHeight: 1 }}>Cartera inmobiliaria</div>
            <div style={{ fontSize: 13, color: C.n500, marginTop: 3 }}>Análisis de rendimiento y evolución de tus propiedades</div>
          </div>
        </div>

        {/* Pill tabs */}
        <div style={{ display: 'inline-flex', gap: 2, background: C.n100, borderRadius: 8, padding: 3, marginBottom: 20 }}>
          {TABS.map(t => {
            const Icon = t.icon;
            const on = activeTab === t.id;
            return (
              <button key={t.id} onClick={() => handleTabChange(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 13, fontWeight: on ? 600 : 500, color: on ? C.blue : C.n500, background: on ? '#fff' : 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', boxShadow: on ? '0 1px 3px rgba(4,44,94,.08)' : 'none', transition: 'all 150ms', fontFamily: 'inherit' }}>
                <Icon size={14} />{t.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === 'resumen'    && <TabResumen properties={properties} />}
        {activeTab === 'cartera'    && <TabCartera onSelectProperty={handleSelectProperty} onSellProperty={handleSellProperty} properties={properties} />}
        {activeTab === 'cartera' && soldProperties.length > 0 && (
          <div style={{ marginTop: 16, background: '#fff', border: `1px solid ${C.n300}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.n200}`, fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.n500 }}>
              Inmuebles vendidos
            </div>
            {soldProperties.map((property) => (
              <div key={property.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${C.n100}` }}>
                <div>
                  <div style={{ fontWeight: 600, color: C.n700 }}>{property.alias}</div>
                  <div style={{ fontSize: 12, color: C.n500 }}>{property.address}</div>
                </div>
                <button
                  onClick={() => handleRevertSale(property.id as number)}
                  disabled={!latestSaleByPropertyId[property.id as number]}
                  style={{ border: '1px solid #B91C1C', color: '#B91C1C', background: '#fff', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}
                >
                  Revertir venta
                </button>
              </div>
            ))}
          </div>
        )}
        {activeTab === 'evolucion'  && <TabEvolucion properties={properties} />}
        {activeTab === 'individual' && <TabIndividual selectedId={selectedPropertyId} properties={properties} />}
      </div>

      <PropertySaleModal
        open={Boolean(saleModalProperty)}
        property={saleModalProperty}
        source="analisis"
        onClose={() => setSaleModalProperty(null)}
        onConfirmed={() => {
          setReloadCounter((current) => current + 1);
        }}
      />
    </div>
  );
}
