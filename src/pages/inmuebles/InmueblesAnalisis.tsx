// src/pages/inmuebles/InmueblesAnalisis.tsx
// Página de análisis de cartera inmobiliaria
// Tabs: Resumen · Evolución · Individual

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity,
  Home,
  Landmark,
  Building2,
  Wallet,
  ArrowUpRight,
  TrendingUp,
  Pencil,
  Receipt,
  LogOut,
  Plus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader, { HeaderPrimaryButton } from '../../components/shared/PageHeader';
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
import { Contract, Expense, FiscalSummary, initDB, OpexRule, Property, EjercicioFiscalCoord } from '../../services/db';
import type { PlanPagos, Prestamo } from '../../types/prestamos';
import type { ValoracionHistorica } from '../../types/valoraciones';
import { getCachedStoreRecords } from '../../services/indexedDbCacheService';
import { getAllocationFactor } from '../../services/prestamosService';
import { getTotalCapexHastaEjercicio } from '../../services/mejoraActivoService';

// ─── Tokens ───────────────────────────────────────────────────────────────────
const C = {
  blue: '#042C5E',
  teal: '#1DA0BA',
  c2: '#5B8DB8',
  c3: '#1DA0BA',
  c4: '#A8C4DE',
  c5: '#C8D0DC',
  pos: '#042C5E',      // navy-900 (v4: sin semáforo)
  posBg: '#E8EFF7',    // navy-100
  neg: '#303A4C',      // grey-700
  negBg: '#EEF1F5',    // grey-100
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
  costeVivienda: number;
  itp: number;
  otrosGastos: number;
  mejorasCapex: number;
  valor: number;
  revalTotal: number;
  revalAnual: number;
  yield: number;
  deudaPendiente: number;
  cuotaHipotecaMes: number;
  cashflowMes: number;
  gastosMes: number;
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

const mapToSnapshot = (
  property: Property,
  contracts: Contract[],
  expenses: Expense[],
  opexRules: OpexRule[],
  loans: Prestamo[],
  paymentPlansByLoanId: Map<string, PlanPagos>,
  valorActual: number,
  mejorasCapex: number,
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

  const getLoanAllocationFactor = (loan: Prestamo): number => {
    const directFactor = getAllocationFactor(loan, normalizedPropertyId);
    if (directFactor > 0 || loan.afectacionesInmueble?.length) {
      return directFactor;
    }

    return isLoanLinkedToProperty(loan) ? 1 : 0;
  };

  const propertyLoans = loans.filter(isLoanLinkedToProperty);
  const { acquisitionCosts } = property;
  const acqExtras = (acquisitionCosts.other || []).reduce((s, item) => s + (item.amount || 0), 0);
  const costeVivienda = (acquisitionCosts.price ?? 0) + (acquisitionCosts.iva ?? 0);
  const itp = acquisitionCosts.itp ?? 0;
  const otrosGastos =
    (acquisitionCosts.notary ?? 0) +
    (acquisitionCosts.registry ?? 0) +
    (acquisitionCosts.management ?? 0) +
    (acquisitionCosts.psi ?? 0) +
    (acquisitionCosts.realEstate ?? 0) +
    acqExtras;
  const costeAdquisicion = costeVivienda + itp + otrosGastos;
  const coste = costeAdquisicion + mejorasCapex;
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

  const deudaPendiente = propertyLoans.reduce((sum, loan) => {
    const allocationFactor = getLoanAllocationFactor(loan);
    return sum + parseAmount(loan.principalVivo) * allocationFactor;
  }, 0);

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
    costeVivienda,
    itp,
    otrosGastos,
    mejorasCapex,
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

/** Only keep FiscalSummaries that belong to years with real declared data (exclude projections) */
const filterDeclaredSummaries = (
  summaries: FiscalSummary[],
  declaredYears: Set<number>,
): FiscalSummary[] => {
  const currentYear = new Date().getFullYear();
  return summaries.filter(fs => fs.exerciseYear <= currentYear && declaredYears.has(fs.exerciseYear));
};

const DONUT_COLORS = [C.blue, C.c2, C.teal, C.c4, '#8FB0CC', C.c5];

// EVOLUCION_DATA removed — now computed from properties inside TabEvolucion

// CASHFLOW_DATA removed — now computed from yearlyData inside TabEvolucion

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

// buildIndividualCashflowSeries removed — now computed from propSummaries inside TabIndividual

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
        <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.3px', color: C.n500 }}>{label}</span>
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

function BenefitCard({ title, value, subtitle, teal }: { title: string; value: number; subtitle: string; teal?: boolean }) {
  const isPositive = value > 0;
  const color = teal && isPositive ? C.teal : C.blue;
  return (
    <div style={{ background: '#fff', border: '0.5px solid var(--grey-200, #DDE3EC)', borderRadius: 10, padding: '14px 18px' }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: C.n700 }}>{title}</div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 500, color, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>
        {value !== 0 ? fmt(value) : '—'}
      </div>
      <div style={{ fontSize: 11, color: C.n500, marginTop: 2 }}>{subtitle}</div>
    </div>
  );
}

// ─── Tab: Resumen ─────────────────────────────────────────────────────────────

function TabResumen({ properties, fiscalSummaries, loansCapitalAmortizado, declaredYears }: { properties: PropertySnapshot[]; fiscalSummaries: FiscalSummary[]; loansCapitalAmortizado: number; declaredYears: Set<number> }) {
  const totalCost = useMemo(() => properties.reduce((sum, property) => sum + property.coste, 0), [properties]);
  const totalVivienda = useMemo(() => properties.reduce((sum, p) => sum + p.costeVivienda, 0), [properties]);
  const totalItp = useMemo(() => properties.reduce((sum, p) => sum + p.itp, 0), [properties]);
  const totalOtros = useMemo(() => properties.reduce((sum, p) => sum + p.otrosGastos, 0), [properties]);
  const totalMejoras = useMemo(() => properties.reduce((sum, p) => sum + p.mejorasCapex, 0), [properties]);
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

  // Benefit cards from fiscal data — only declared exercises
  const realSummaries = useMemo(() => filterDeclaredSummaries(fiscalSummaries, declaredYears), [fiscalSummaries, declaredYears]);
  const totalRentas = useMemo(() => realSummaries.reduce((s, fs) => s + (fs.box0102 || 0), 0), [realSummaries]);
  const totalGastosOp = useMemo(() => realSummaries.reduce((s, fs) => s +
    (fs.box0109 || 0) + (fs.box0112 || 0) + (fs.box0113 || 0) +
    (fs.box0114 || 0) + (fs.box0115 || 0) + (fs.box0117 || 0), 0), [realSummaries]);
  const totalIntereses = useMemo(() => realSummaries.reduce((s, fs) => s + (fs.box0105 || 0), 0), [realSummaries]);
  const cashflowNeto = totalRentas - totalGastosOp - totalIntereses;
  const plusvalia = totalValue - totalCost;

  const cashflowAcumulado = totalRentas - totalGastosOp - totalIntereses;
  const beneficioTotalVenta = cashflowAcumulado + totalLatentGain;
  const multiploCapital = totalCost > 0 ? totalEquity / totalCost : 0;

  const donutData = properties.map(p => ({ name: p.alias, value: p.valor }));
  const yieldData = [...properties].sort((a, b) => b.yield - a.yield).map(p => ({ name: p.alias, yield: p.yield }));

  return (
    <div>
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 16 }}>
        <KpiCard label="Coste total" value={fmt(totalCost)} meta={
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, color: C.n500 }}>
            <span>Vivienda {fmt(totalVivienda)}</span>
            {totalItp > 0 && <span>ITP {fmt(totalItp)}</span>}
            {totalOtros > 0 && <span>Gastos y tributos de compra {fmt(totalOtros)}</span>}
            {totalMejoras > 0 && <span>Mejoras {fmt(totalMejoras)}</span>}
          </span>
        } accentColor={C.c2} icon={Landmark} iconBg="rgba(4,44,94,.06)" />
        <KpiCard
          label="Valor actual"
          value={fmt(totalValue)}
          meta={<><Chip color={totalLatentGain >= 0 ? C.pos : C.neg} bg={totalLatentGain >= 0 ? C.posBg : C.negBg}><TrendingUp size={10} /> {`${totalCost > 0 ? ((totalLatentGain / totalCost) * 100).toFixed(1) : '0.0'}%`}</Chip> sobre coste</>}
          accentColor={C.blue}
          icon={Building2}
          iconBg="rgba(4,44,94,.06)"
        />
        <KpiCard label="Cashflow acumulado" value={fmt(cashflowAcumulado)} meta="Rentas cobradas − gastos pagados" accentColor={C.pos} icon={Wallet} iconBg={C.posBg} valueColor={cashflowAcumulado >= 0 ? C.teal : C.pos} />
        <KpiCard label="Plusvalía latente" value={fmt(totalLatentGain)} meta="Si vendes hoy, antes de impuestos" accentColor={C.teal} icon={ArrowUpRight} iconBg="rgba(29,160,186,.1)" />
      </div>

      {/* 3 Benefit cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        <BenefitCard
          title="Cashflow neto"
          value={cashflowNeto}
          subtitle={`Rentas ${fmt(totalRentas)} − gastos ${fmt(totalGastosOp + totalIntereses)}`}
          teal={cashflowNeto > 0}
        />
        <BenefitCard
          title="Revalorización"
          value={plusvalia}
          subtitle={`Comprado ${fmt(totalCost)} · hoy ${fmt(totalValue)}`}
        />
        <BenefitCard
          title="Deuda amortizada"
          value={loansCapitalAmortizado}
          subtitle={`Intereses desgravados: ${fmt(totalIntereses)}`}
        />
      </div>

      {/* 3 Rentabilidades */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 16 }}>
        {[
          { label: 'Rentabilidad bruta', val: `${grossYield.toFixed(2)}%`, meta: '/ año · Ingresos anuales / Coste total' },
          { label: 'Rentabilidad neta s/ activo', val: `${netAssetYield.toFixed(2)}%`, meta: '/ año · Cashflow neto anual / Coste total' },
          { label: 'Rentabilidad neta s/ equity', val: `${netEquityYield.toFixed(2)}%`, meta: '/ año · Cashflow neto anual / Capital propio' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: `1px solid ${C.n300}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.3px', color: C.n500, marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 34, fontWeight: 600, color: C.blue, lineHeight: 1, marginBottom: 4 }}>{k.val}</div>
            <div style={{ fontSize: 12, color: C.n500 }}>{k.meta}</div>
          </div>
        ))}
      </div>

      {/* Charts: Donut + Yield */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
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

      {/* Resultado global y equity */}
      <div style={{ background: '#fff', border: `1px solid ${C.n300}`, borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.n700, marginBottom: 16 }}>Resultado global y equity</div>
        <ResultRow label="Cashflow neto acumulado" value={fmt(cashflowAcumulado)} valueColor={cashflowAcumulado >= 0 ? C.teal : C.pos} />
        <ResultRow label="Beneficio total si vendes hoy" value={fmt(beneficioTotalVenta)} valueColor={beneficioTotalVenta >= 0 ? C.teal : C.pos} />
        <ResultRow label="Múltiplo sobre capital" value={`× ${multiploCapital.toFixed(2)}`} />
        <ResultRow label="Rentabilidad anualizada" value={`${(weightedRevalRate * 100).toFixed(2)}%`} valueColor={C.blue} />
        <ResultRow label="Tasa media revalorización" value={`${(weightedRevalRate * 100).toFixed(2)}% / año`} />
        <div style={{ height: 1, background: C.n300, margin: '8px 0' }} />
        <ResultRow label="Deuda pendiente" value={(totalDebt == null || totalDebt === 0 || Object.is(totalDebt, -0)) ? '0 €' : fmt(-totalDebt)} valueColor={C.n700} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.n700 }}>Equity actual</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 17, fontWeight: 600, color: C.blue }}>{fmt(totalEquity)}</span>
        </div>
      </div>
    </div>
  );
}


// ─── Tab: Evolución general ───────────────────────────────────────────────────

function TabEvolucion({ properties, fiscalSummaries, declaredYears, ejercicios }: { properties: PropertySnapshot[]; fiscalSummaries: FiscalSummary[]; declaredYears: Set<number>; ejercicios: EjercicioFiscalCoord[] }) {
  const [horizon, setHorizon] = useState(10);

  const totalCost = useMemo(() => properties.reduce((s, p) => s + p.coste, 0), [properties]);
  const totalValue = useMemo(() => properties.reduce((s, p) => s + p.valor, 0), [properties]);
  const totalDebt = useMemo(() => properties.reduce((s, p) => s + p.deudaPendiente, 0), [properties]);
  const totalEquity = totalValue - totalDebt;
  const weightedRevalRate = totalCost > 0
    ? properties.reduce((s, p) => s + ((p.revalAnual / 100) * p.coste), 0) / totalCost
    : 0;

  const proyData = useMemo(
    () => buildProyeccion(horizon, totalValue, totalEquity, weightedRevalRate),
    [horizon, totalValue, totalEquity, weightedRevalRate]
  );

  // Year-by-year fiscal table — only declared exercises
  const realSummaries = useMemo(() => filterDeclaredSummaries(fiscalSummaries, declaredYears), [fiscalSummaries, declaredYears]);
  const yearlyData = useMemo(() => {
    const byYear: Record<number, { ing: number; gas: number; int: number; neto: number; imp: number }> = {};
    realSummaries.forEach(fs => {
      const y = fs.exerciseYear;
      if (!byYear[y]) byYear[y] = { ing: 0, gas: 0, int: 0, neto: 0, imp: 0 };
      byYear[y].ing += fs.box0102 || 0;
      byYear[y].gas += (fs.box0109 || 0) + (fs.box0112 || 0) + (fs.box0113 || 0) + (fs.box0114 || 0) + (fs.box0115 || 0) + (fs.box0117 || 0);
      byYear[y].int += fs.box0105 || 0;
      byYear[y].neto += fs.rendimientoNetoReducido || 0;
    });
    // Add IRPF from ejerciciosFiscalesCoord
    ejercicios.forEach(ej => {
      const y = ej.año;
      if (byYear[y] && ej.aeat?.resumen?.resultado != null) {
        byYear[y].imp = ej.aeat.resumen.resultado;
      }
    });
    return Object.entries(byYear)
      .map(([y, d]) => ({ year: Number(y), ...d, cf: d.ing - d.gas - d.int }))
      .sort((a, b) => a.year - b.year);
  }, [realSummaries, ejercicios]);

  // Cashflow chart data — from real yearlyData (guard against offset years)
  const cashflowChartData = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return yearlyData
      .filter(d => (d.ing > 0 || d.gas > 0) && d.year <= currentYear)
      .map(d => ({
        year: String(d.year),
        cashflow: Math.round(d.cf),
      }));
  }, [yearlyData]);

  // Evolution chart data — from real properties
  // Only coste acumulado is a real historical series; valor mercado is only known for the current year
  const evolucionChartData = useMemo(() => {
    if (!properties.length) return [];

    const purchaseYears = properties
      .map(p => parseYear(p.purchaseDate))
      .filter(Boolean) as number[];

    if (purchaseYears.length === 0) return [];

    const minYear = Math.min(...purchaseYears);
    const currentYear = new Date().getFullYear();

    const totalValorActual = properties.reduce((sum, p) => sum + p.valor, 0);

    const data = [];
    for (let y = minYear; y <= currentYear; y++) {
      const costeAcum = properties.reduce((sum, p) => {
        const py = parseYear(p.purchaseDate);
        return (py && py <= y) ? sum + p.coste : sum;
      }, 0);

      if (costeAcum > 0) {
        data.push({
          year: String(y),
          coste: Math.round(costeAcum),
          // valor mercado: only the current year has real data
          valor: y === currentYear ? Math.round(totalValorActual) : null,
        });
      }
    }

    return data;
  }, [properties]);

  const totals = useMemo(() => yearlyData.reduce(
    (acc, r) => ({ ing: acc.ing + r.ing, gas: acc.gas + r.gas, int: acc.int + r.int, neto: acc.neto + r.neto, imp: acc.imp + r.imp, cf: acc.cf + r.cf }),
    { ing: 0, gas: 0, int: 0, neto: 0, imp: 0, cf: 0 }
  ), [yearlyData]);

  // Yield comparison by property — only declared years (guard against offset years)
  const yieldComparison = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [...new Set(realSummaries.map(fs => fs.exerciseYear))].filter(y => y <= currentYear).sort((a, b) => b - a).slice(0, 2);
    if (years.length < 2) return [];
    const [latest, prev] = years;
    return properties.map(p => {
      const getYieldForYear = (year: number) => {
        const fs = realSummaries.find(f => f.propertyId === Number(p.id) && f.exerciseYear === year);
        return fs?.box0102 && p.coste > 0 ? (fs.box0102 / p.coste) * 100 : 0;
      };
      const yLatest = getYieldForYear(latest);
      const yPrev = getYieldForYear(prev);
      const trend = yLatest > yPrev + 0.5 ? '↑' : yLatest < yPrev - 0.5 ? '' : '→';
      const trendColor = trend === '↑' ? C.teal : trend === '→' ? C.n500 : C.n700;
      return { alias: p.alias, latest, prev, yLatest, yPrev, trend, trendColor };
    });
  }, [properties, realSummaries]);

  const thStyle: React.CSSProperties = { padding: '10px 14px', fontSize: 12, fontWeight: 500, letterSpacing: '0.3px', textTransform: 'uppercase', color: C.n500, textAlign: 'right', borderBottom: `1px solid ${C.n200}` };
  const tdStyle: React.CSSProperties = { padding: '10px 14px', fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", textAlign: 'right', color: C.n700, fontVariantNumeric: 'tabular-nums' };

  return (
    <div>
      {/* Charts row 1: Evolution + Cashflow */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <ChartCard title="Evolución del valor de cartera" sub="Valor total de mercado vs coste acumulado">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={evolucionChartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="rgba(200,208,220,.4)" />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: C.n500 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.n500 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [`${v.toLocaleString('es-ES')} €`]} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.n200}` }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="valor" name="Valor mercado" stroke={C.blue} strokeWidth={2} dot={{ r: 5 }} connectNulls={false} />
              <Line type="monotone" dataKey="coste" name="Coste acumulado" stroke={C.c2} strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Cashflow neto por año" sub="Evolución del cashflow anual">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={cashflowChartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="rgba(200,208,220,.4)" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: C.n500 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.n500 }} axisLine={false} tickLine={false} tickFormatter={v => `${v.toLocaleString('es-ES')} €`} />
              <Tooltip formatter={(v: number) => [`${v.toLocaleString('es-ES')} €`]} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.n200}` }} />
              <Bar dataKey="cashflow" name="Cashflow neto" fill="rgba(4,44,94,.7)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts row 2: Proyección + Yield comparison */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20, marginBottom: 20 }}>
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

        {/* Yield comparison mini-table */}
        <div style={{ background: '#fff', border: `1px solid ${C.n300}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.n200}` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.n700 }}>Comparativa yield por inmueble</div>
            <div style={{ fontSize: 12, color: C.n500, marginTop: 2 }}>Yield bruto interanual</div>
          </div>
          <div style={{ padding: '8px 0' }}>
            {yieldComparison.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, textAlign: 'left' }}>Inmueble</th>
                    <th style={thStyle}>{yieldComparison[0]?.prev}</th>
                    <th style={thStyle}>{yieldComparison[0]?.latest}</th>
                    <th style={{ ...thStyle, width: 50 }}>Tend.</th>
                  </tr>
                </thead>
                <tbody>
                  {yieldComparison.map(row => (
                    <tr key={row.alias}>
                      <td style={{ ...tdStyle, textAlign: 'left', fontFamily: "'IBM Plex Sans', system-ui", fontWeight: 500 }}>{row.alias}</td>
                      <td style={tdStyle}>{row.yPrev > 0 ? `${row.yPrev.toFixed(1)}%` : '—'}</td>
                      <td style={tdStyle}>{row.yLatest > 0 ? `${row.yLatest.toFixed(1)}%` : '—'}</td>
                      <td style={{ ...tdStyle, textAlign: 'center', color: row.trendColor, fontWeight: 600 }}>{row.trend}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: '20px 18px', fontSize: 13, color: C.n500, textAlign: 'center' }}>Se necesitan al menos 2 ejercicios fiscales</div>
            )}
          </div>
        </div>
      </div>

      {/* Year-by-year fiscal table */}
      <div style={{ background: '#fff', border: `1px solid ${C.n300}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.n200}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.n700 }}>Desglose fiscal año a año</div>
          <div style={{ fontSize: 12, color: C.n500, marginTop: 2 }}>Datos agregados de todos los inmuebles por ejercicio</div>
        </div>
        {yearlyData.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.n50 }}>
                <th style={{ ...thStyle, textAlign: 'left' }}>Año</th>
                <th style={thStyle}>Ingresos</th>
                <th style={thStyle}>Gastos op.</th>
                <th style={thStyle}>Intereses</th>
                <th style={thStyle}>Neto fiscal</th>
                <th style={thStyle}>IRPF</th>
                <th style={thStyle}>Cashflow real</th>
              </tr>
            </thead>
            <tbody>
              {yearlyData.map(row => (
                <tr key={row.year} style={{ borderBottom: `1px solid ${C.n100}` }}>
                  <td style={{ ...tdStyle, textAlign: 'left', fontFamily: "'IBM Plex Sans', system-ui", fontWeight: 600 }}>{row.year}</td>
                  <td style={tdStyle}>{row.ing ? fmt(row.ing) : '—'}</td>
                  <td style={tdStyle}>{row.gas ? fmt(row.gas) : '—'}</td>
                  <td style={tdStyle}>{row.int ? fmt(row.int) : '—'}</td>
                  <td style={tdStyle}>{row.neto ? fmt(row.neto) : '—'}</td>
                  <td style={tdStyle}>{row.imp ? fmt(row.imp) : '—'}</td>
                  <td style={{ ...tdStyle, color: row.cf > 0 ? C.teal : C.n700, fontWeight: 600 }}>{row.cf ? fmt(row.cf) : '—'}</td>
                </tr>
              ))}
              <tr style={{ borderTop: `1.5px solid ${C.n300}`, background: C.n50 }}>
                <td style={{ ...tdStyle, textAlign: 'left', fontFamily: "'IBM Plex Sans', system-ui", fontWeight: 600 }}>Total</td>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{fmt(totals.ing)}</td>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{fmt(totals.gas)}</td>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{fmt(totals.int)}</td>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{fmt(totals.neto)}</td>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{totals.imp ? fmt(totals.imp) : '—'}</td>
                <td style={{ ...tdStyle, fontWeight: 600, color: totals.cf > 0 ? C.teal : C.n700 }}>{fmt(totals.cf)}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <div style={{ padding: '30px 20px', fontSize: 13, color: C.n500, textAlign: 'center' }}>No hay datos fiscales disponibles</div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Individual ──────────────────────────────────────────────────────────

function TabIndividual({ selectedId, properties, fiscalSummaries, loansCapitalAmortizado, declaredYears }: { selectedId: string; properties: PropertySnapshot[]; fiscalSummaries: FiscalSummary[]; loansCapitalAmortizado: number; declaredYears: Set<number> }) {
  const navigate = useNavigate();
  const [propId, setPropId] = useState(selectedId || 'acevedo');
  const prop = properties.find(p => p.id === propId) ?? properties[0];
  const indivData = useMemo(() => buildIndividualValueSeries(prop), [prop]);
  // cashflowData, cashflowLabel, cashflowColor, cashflowMeta now computed from propSummaries below
  const projectionRate = Math.max(0.004, prop.revalAnual / 100);

  // Fiscal data for this property — only declared exercises, with robust ID matching
  const propSummaries = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return fiscalSummaries.filter(fs =>
      fs.exerciseYear <= currentYear && (String(fs.propertyId) === prop.id || Number(fs.propertyId) === Number(prop.id)) && declaredYears.has(fs.exerciseYear)
    );
  }, [fiscalSummaries, prop.id, declaredYears]);
  const propRentas = useMemo(() => propSummaries.reduce((s, fs) => s + (fs.box0102 || 0), 0), [propSummaries]);
  const propGastosOp = useMemo(() => propSummaries.reduce((s, fs) => s + (fs.box0109 || 0) + (fs.box0112 || 0) + (fs.box0113 || 0) + (fs.box0114 || 0) + (fs.box0115 || 0) + (fs.box0117 || 0), 0), [propSummaries]);
  const propIntereses = useMemo(() => propSummaries.reduce((s, fs) => s + (fs.box0105 || 0), 0), [propSummaries]);
  const propCashflowNeto = propRentas - propGastosOp - propIntereses;
  // Cashflow acumulado = solo datos reales de FiscalSummaries declarados
  const cashflowAcumulado = propCashflowNeto;

  // Individual cashflow chart — from real propSummaries
  const cashflowData = useMemo(() => {
    if (!propSummaries.length) return [];
    return propSummaries
      .filter(fs => (fs.box0102 || 0) > 0 || (fs.box0105 || 0) > 0 || (fs.box0106 || 0) > 0)
      .sort((a, b) => a.exerciseYear - b.exerciseYear)
      .map(fs => {
        const ingresos = fs.box0102 || 0;
        const gastos = (fs.box0109 || 0) + (fs.box0112 || 0) + (fs.box0113 || 0) +
                       (fs.box0114 || 0) + (fs.box0115 || 0) + (fs.box0117 || 0) +
                       (fs.box0105 || 0) + (fs.box0106 || 0);
        return {
          year: String(fs.exerciseYear),
          ing: Math.round(ingresos),
          gas: Math.round(gastos),
        };
      });
  }, [propSummaries]);

  // Yield bruto with fallback to FiscalSummary
  const yieldBrutoCalc = useMemo(() => {
    if (prop.yield > 0) return prop.yield;
    const lastFs = propSummaries
      .filter(fs => (fs.box0102 || 0) > 0)
      .sort((a, b) => b.exerciseYear - a.exerciseYear)[0];
    if (lastFs && prop.coste > 0) {
      return ((lastFs.box0102 || 0) / prop.coste) * 100;
    }
    return null;
  }, [prop.yield, prop.coste, propSummaries]);

  // Cashflow/mes with fallback to FiscalSummary
  const cashflowMesCalc = useMemo(() => {
    if (prop.cashflowMes !== 0) return prop.cashflowMes;
    const lastFs = propSummaries
      .filter(fs => (fs.box0102 || 0) > 0)
      .sort((a, b) => b.exerciseYear - a.exerciseYear)[0];
    if (lastFs) {
      const ingresos = lastFs.box0102 || 0;
      const gastos = (lastFs.box0109 || 0) + (lastFs.box0112 || 0) + (lastFs.box0113 || 0) +
                     (lastFs.box0114 || 0) + (lastFs.box0115 || 0) + (lastFs.box0117 || 0) +
                     (lastFs.box0105 || 0);
      return Math.round((ingresos - gastos) / 12);
    }
    return null;
  }, [prop.cashflowMes, propSummaries]);

  const cashflowLabel = cashflowMesCalc != null && cashflowMesCalc !== 0
    ? (cashflowMesCalc > 0 ? `+${fmt(cashflowMesCalc)}` : `-${fmt(Math.abs(cashflowMesCalc))}`)
    : '—';
  const cashflowColor = cashflowMesCalc != null && cashflowMesCalc > 0 ? C.teal : cashflowMesCalc != null && cashflowMesCalc < 0 ? C.n700 : C.n500;
  const cashflowMeta = cashflowMesCalc != null ? `Neto tras gastos (${fmt(prop.gastosMes)} / mes)` : 'Sin datos de contrato';

  // Fiscal year breakdown
  const availableYears = useMemo(() => [...new Set(propSummaries.map(fs => fs.exerciseYear))].sort((a, b) => b - a), [propSummaries]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const activeYear = selectedYear ?? availableYears[0] ?? null;
  const selectedFs = activeYear ? propSummaries.find(s => s.exerciseYear === activeYear) : null;

  const fmtVal = (v: number | undefined | null) => v ? fmt(v) : '—';

  return (
    <div>
      {/* Selector with action icons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.n700 }}>Inmueble</label>
        <select value={propId} onChange={e => setPropId(e.target.value)} style={{ padding: '7px 12px', border: `1.5px solid ${C.n300}`, borderRadius: 8, fontSize: 13, color: C.n700, background: '#fff', cursor: 'pointer', minWidth: 260, fontFamily: 'inherit' }}>
          {properties.map(p => <option key={p.id} value={p.id}>{p.alias} · {p.addr}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => navigate(`/inmuebles/cartera/${prop.id}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }} title="Ver / editar ficha"><Pencil size={18} color="var(--grey-500)" /></button>
          <button onClick={() => navigate(`/inmuebles/cartera/${prop.id}?tab=presupuesto`)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }} title="Gastos del inmueble"><Receipt size={18} color="var(--grey-500)" /></button>
          <button onClick={() => toast('Venta: disponible desde la ficha del inmueble')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }} title="Simular venta"><LogOut size={18} color="var(--grey-500)" /></button>
        </div>
      </div>

      {/* Timeline — Compra card with cost breakdown */}
      <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.3px', color: C.n500, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        Foto pasado · presente · proyección
        <div style={{ flex: 1, height: 1, background: C.n200 }} />
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Compra', val: fmt(prop.coste), sub: 'Coste total adquisición', cls: 'past' },
          { label: 'Hoy', val: fmt(prop.valor), sub: 'Valor estimado actual', cls: 'present' },
          { label: 'Proyección 5 años', val: `~${fmt(Math.round(prop.valor * Math.pow(1 + projectionRate, 5)))}`, sub: `A ${(projectionRate * 100).toFixed(2)}% anual`, cls: 'future' },
          { label: 'Proyección 10 años', val: `~${fmt(Math.round(prop.valor * Math.pow(1 + projectionRate, 10)))}`, sub: `A ${(projectionRate * 100).toFixed(2)}% anual`, cls: 'future' },
        ].map(t => (
          <div key={t.label} style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: `1px solid ${t.cls === 'present' ? C.blue : t.cls === 'future' ? C.teal : C.n200}`, background: t.cls === 'present' ? 'rgba(4,44,94,.04)' : t.cls === 'future' ? 'rgba(29,160,186,.04)' : C.n50 }}>
            <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.3px', color: C.n500, marginBottom: 4 }}>{t.label}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 17, fontWeight: 600, color: C.n700 }}>{t.val}</div>
            <div style={{ fontSize: 11, color: C.n500, marginTop: 2 }}>{t.sub}</div>
          </div>
        ))}
      </div>

      {/* KPI Strip — max 4 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Plusvalía latente', val: `+${fmt(prop.valor - prop.coste)}`, meta: `+${prop.revalTotal.toFixed(2)}% total`, color: C.pos },
          { label: 'Yield bruto', val: yieldBrutoCalc != null ? `${yieldBrutoCalc.toFixed(2)}%` : '—', meta: 'Ingresos / coste', color: C.blue },
          { label: 'Cashflow / mes', val: cashflowLabel, meta: cashflowMeta, color: cashflowColor },
          {
            label: 'Deuda pendiente',
            val: (prop.deudaPendiente == null || prop.deudaPendiente === 0 || Object.is(prop.deudaPendiente, -0)) ? '0 €' : `-${fmt(prop.deudaPendiente)}`,
            meta: prop.deudaPendiente > 0 ? 'Hipoteca activa' : 'Sin hipoteca activa',
            color: prop.deudaPendiente > 0 ? C.n700 : C.n500,
          },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: `1px solid ${C.n300}`, borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.3px', color: C.n500, marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 20, fontWeight: 600, color: k.color }}>{k.val}</div>
            <div style={{ fontSize: 11, color: C.n500, marginTop: 2 }}>{k.meta}</div>
          </div>
        ))}
      </div>

      {/* 3 Benefit cards for this asset */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <BenefitCard
          title="Cashflow neto"
          value={propCashflowNeto}
          subtitle={`${fmt(propRentas)} rentas − ${fmt(propGastosOp + propIntereses)} gastos`}
          teal={propCashflowNeto > 0}
        />
        <BenefitCard
          title="Revalorización"
          value={prop.valor - prop.coste}
          subtitle={`Compra ${fmt(prop.coste)} · hoy ${fmt(prop.valor)}`}
        />
        <BenefitCard
          title="Deuda amortizada"
          value={loansCapitalAmortizado}
          subtitle={`Intereses desgravados: ${fmt(propIntereses)}`}
        />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>
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
            <ResultRow label="Cashflow acumulado" value={`${cashflowAcumulado >= 0 ? '+' : '-'}${fmt(Math.abs(cashflowAcumulado))}`} valueColor={cashflowAcumulado >= 0 ? C.teal : C.n700} />
            <ResultRow label="Beneficio total" value={`${(prop.valor - prop.coste + cashflowAcumulado) >= 0 ? '+' : '-'}${fmt(Math.abs(prop.valor - prop.coste + cashflowAcumulado))}`} valueColor={(prop.valor - prop.coste + cashflowAcumulado) >= 0 ? C.teal : C.n700} />
            <div style={{ height: 1, background: C.n300, margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.n700 }}>Múltiplo s/ capital</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 20, fontWeight: 600, color: C.blue }}>× {prop.coste > 0 ? ((prop.valor + cashflowAcumulado) / prop.coste).toFixed(2) : '—'}</span>
            </div>
          </div>

          <ChartCard title="Cashflow mensual histórico" sub="Ingresos vs gastos por año">
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={cashflowData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: C.n500 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: C.n500 }} axisLine={false} tickLine={false} tickFormatter={v => `${v / 1000}k`} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Bar dataKey="ing" name="Ingresos" fill="rgba(4,44,94,.7)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="gas" name="Gastos" fill="rgba(200,208,220,.8)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

      {/* Fiscal breakdown by exercise year */}
      {availableYears.length > 0 && (
        <div style={{ background: '#fff', border: `1px solid ${C.n300}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.n200}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.n700 }}>Desglose por ejercicio fiscal</div>
              <div style={{ fontSize: 12, color: C.n500, marginTop: 2 }}>Datos del FiscalSummary de {prop.alias}</div>
            </div>
            {/* Rectangular year selector (V4 period-selector pattern) */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 0 }}>
              {availableYears.map((y, i) => (
                <button
                  key={y}
                  onClick={() => setSelectedYear(y)}
                  style={{
                    padding: '8px 16px',
                    fontSize: 14,
                    fontWeight: activeYear === y ? 700 : 400,
                    color: activeYear === y ? 'var(--grey-900, #1A2332)' : 'var(--grey-700, #303A4C)',
                    background: activeYear === y ? 'var(--grey-100, #EEF1F5)' : 'var(--white, #fff)',
                    border: '1.5px solid var(--grey-300, #C8D0DC)',
                    borderLeft: i > 0 ? 'none' : '1.5px solid var(--grey-300, #C8D0DC)',
                    borderRadius: i === 0 ? '8px 0 0 8px' : i === availableYears.length - 1 ? '0 8px 8px 0' : 0,
                    cursor: 'pointer',
                    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                  }}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
          {selectedFs ? (
            <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 40px' }}>
              {[
                { label: 'Ingresos brutos', val: selectedFs.box0102 },
                { label: 'Días arrendado', val: selectedFs.aeatAmortization?.daysRented, isCurrency: false },
                { label: 'Comunidad', val: selectedFs.box0109 },
                { label: 'Suministros', val: selectedFs.box0113 },
                { label: 'Seguros', val: selectedFs.box0114 },
                { label: 'IBI y tasas', val: selectedFs.box0115 },
                { label: 'Intereses préstamo', val: selectedFs.box0105 },
                { label: 'Reparación', val: selectedFs.box0106 },
                { label: 'Gestión delegada', val: selectedFs.box0112 },
                { label: 'Amort. inmueble', val: selectedFs.aeatAmortization?.propertyAmortization },
                { label: 'Amort. mobiliario', val: selectedFs.box0117 },
                { label: 'Reducción vivienda', val: selectedFs.reduccionVivienda },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 0', borderBottom: `1px solid ${C.n100}` }}>
                  <span style={{ fontSize: 13, color: C.n500 }}>{row.label}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 500, color: C.n700, fontVariantNumeric: 'tabular-nums' }}>
                    {row.isCurrency === false ? (row.val ?? '—') : fmtVal(row.val as number | undefined)}
                  </span>
                </div>
              ))}
              <div style={{ gridColumn: '1 / -1', borderTop: `1.5px solid ${C.n300}`, marginTop: 4, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.n700 }}>Rendimiento neto</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, fontWeight: 600, color: (selectedFs.rendimientoNeto ?? 0) >= 0 ? C.teal : C.n700 }}>
                  {fmtVal(selectedFs.rendimientoNeto)}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ padding: '30px 20px', fontSize: 13, color: C.n500, textAlign: 'center' }}>No hay datos para este ejercicio</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'resumen' | 'evolucion' | 'individual' | 'supervision';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'resumen',    label: 'Resumen',    icon: LayoutDashboard },
  { id: 'evolucion',  label: 'Evolución',  icon: Activity },
  { id: 'individual', label: 'Individual', icon: Home },
  { id: 'supervision', label: 'Supervisión', icon: Building2 },
];

export default function InmueblesAnalisis() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const currentTabParam = searchParams.get('tab');
  const refreshFlag = searchParams.get('refresh');
  const [activeTab, setActiveTab] = useState<Tab>('resumen');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [properties, setProperties] = useState<PropertySnapshot[]>([]);
  const [reloadCounter] = useState(0);
  const [fiscalSummaries, setFiscalSummaries] = useState<FiscalSummary[]>([]);
  const [ejercicios, setEjercicios] = useState<EjercicioFiscalCoord[]>([]);
  const [loansCapitalAmortizado, setLoansCapitalAmortizado] = useState(0);

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
        const [dbProperties, dbLoans, dbContracts, dbExpenses, dbOpexRules, dbValoraciones, keyvalKeys, dbFiscalSummaries, dbEjercicios] = await Promise.all([
          getCachedStoreRecords<Property>('properties'),
          getCachedStoreRecords<Prestamo>('prestamos'),
          getCachedStoreRecords<Contract>('contracts'),
          getCachedStoreRecords<Expense>('expenses'),
          getCachedStoreRecords<OpexRule>('opexRules'),
          getCachedStoreRecords<ValoracionHistorica>('valoraciones_historicas'),
          db.getAllKeys('keyval') as Promise<IDBValidKey[]>,
          getCachedStoreRecords<FiscalSummary>('fiscalSummaries', { forceRefresh: true }),
          getCachedStoreRecords<EjercicioFiscalCoord>('ejerciciosFiscalesCoord', { forceRefresh: true }),
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
        const latestInmuebleValorMap = getLatestValuationMap(dbValoraciones, 'inmueble');
        const currentYear = new Date().getFullYear();
        const mejorasPorPropiedad = await Promise.all(
          active.map((p) => getTotalCapexHastaEjercicio(p.id as number, currentYear))
        );
        const snapshots = active.map((property, idx) =>
          mapToSnapshot(
            property,
            dbContracts,
            dbExpenses,
            dbOpexRules,
            dbLoans,
            paymentPlansByLoanId,
            latestInmuebleValorMap.get(property.id as number) ?? property.acquisitionCosts.price,
            mejorasPorPropiedad[idx],
          )
        );
        setProperties(snapshots);
        setFiscalSummaries(dbFiscalSummaries);
        setEjercicios(dbEjercicios);
        // Capital amortizado from loans
        const totalCapAmort = dbLoans.reduce((s, l) => s + ((l as any).capitalAmortizado || 0), 0);
        setLoansCapitalAmortizado(totalCapAmort);
        setSelectedPropertyId((current) => current || snapshots[0]?.id || '');
      } catch {
        if (mounted) setProperties([]);
      }
    };

    void loadProperties();
    return () => {
      mounted = false;
    };
  }, [refreshFlag, reloadCounter]);

  const handleTabChange = (tabId: string) => {
    // Supervisión lives on its own route
    if (tabId === 'supervision') {
      navigate('/inmuebles/supervision');
      return;
    }
    setActiveTab(tabId as Tab);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', tabId);
    nextParams.delete('refresh');
    setSearchParams(nextParams, { replace: true });
  };

  // Compute declared years from ejerciciosFiscalesCoord
  // A year is "declared" if there's an ejercicio with AEAT data or fiscal summaries with real data
  const declaredYears = useMemo(() => {
    const years = new Set<number>();
    // Years from ejerciciosFiscalesCoord that have AEAT declarations
    ejercicios.forEach(ej => {
      if (ej.aeat || ej.estado === 'declarado' || ej.estado === 'prescrito') {
        years.add(ej.año);
      }
    });
    return years;
  }, [ejercicios]);

  if (!properties.length) {
    return (
      <div style={{ minHeight: '100vh', background: C.n50, fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, paddingBottom: 20 }}>
            <Building2 size={20} color="#6C757D" />
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.n700, letterSpacing: '-.02em', lineHeight: 1 }}>Cartera inmobiliaria</div>
              <div style={{ fontSize: 13, color: C.n500, marginTop: 3 }}>Análisis de rendimiento y evolución de tus propiedades</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
            <Building2 size={48} color={C.n300} />
            <p style={{ fontSize: 18, fontWeight: 600, color: C.n700, margin: 0 }}>No hay inmuebles en tu cartera</p>
            <p style={{ fontSize: 14, color: C.n500, margin: 0, textAlign: 'center', maxWidth: 400 }}>
              Añade tu primer inmueble para empezar a gestionar tu patrimonio inmobiliario
            </p>
            <button
              onClick={() => navigate('/inmuebles/cartera/nuevo')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 8,
                padding: '10px 20px',
                fontSize: 14,
                fontWeight: 600,
                color: '#fff',
                background: C.blue,
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <Plus size={16} />
              Añadir inmueble
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.n50, fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div style={{ padding: 24 }}>
        {/* Page header */}
        <PageHeader
          icon={Building2}
          title="Cartera inmobiliaria"
          subtitle="Análisis de rendimiento y evolución"
          tabs={[
            { id: 'resumen', label: 'Resumen' },
            { id: 'evolucion', label: 'Evolución' },
            { id: 'individual', label: 'Individual' },
          ]}
          activeTab={activeTab}
          onTabChange={(id) => handleTabChange(id as Tab)}
          actions={<HeaderPrimaryButton icon={Plus} label="Nuevo inmueble" onClick={() => navigate('/inmuebles/cartera/nuevo')} />}
        />

        {/* Tab content */}
        {activeTab === 'resumen'    && <TabResumen properties={properties} fiscalSummaries={fiscalSummaries} loansCapitalAmortizado={loansCapitalAmortizado} declaredYears={declaredYears} />}
        {activeTab === 'evolucion'  && <TabEvolucion properties={properties} fiscalSummaries={fiscalSummaries} declaredYears={declaredYears} ejercicios={ejercicios} />}
        {activeTab === 'individual' && <TabIndividual selectedId={selectedPropertyId} properties={properties} fiscalSummaries={fiscalSummaries} loansCapitalAmortizado={loansCapitalAmortizado} declaredYears={declaredYears} />}
      </div>

    </div>
  );
}
