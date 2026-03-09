// src/pages/inmuebles/InmueblesAnalisis.tsx
// Página de análisis de cartera inmobiliaria
// Tabs: Resumen · Cartera · Evolución general · Individual

import React, { useEffect, useMemo, useState } from 'react';
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
  Eye,
  MoreHorizontal,
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
import { initDB, Property } from '../../services/db';
import type { Prestamo } from '../../types/prestamos';

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
const PROPERTIES = [
  { id: 'acevedo',      alias: 'Acevedo',        addr: 'Fuertes Acevedo, 32 2D',        coste: 128500, valor: 240000, revalTotal: 86.77, revalAnual: 19.84, yield: 17.68, deudaPendiente: 115400, cashflowMes: 620, gastosMes: 280 },
  { id: 'manresa',      alias: 'Manresa',        addr: "Sant Joan d'en Coll, 53 3-6",   coste: 93200,  valor: 135000, revalTotal: 44.85, revalAnual: 8.44,  yield: 0, deudaPendiente: 68400, cashflowMes: -90, gastosMes: 210 },
  { id: 'santfruitos',  alias: 'Sant Fruitós',   addr: 'Carles Buigas, 15-17 BJ 2',     coste: 114500, valor: 230000, revalTotal: 100.87,revalAnual: 3.48,  yield: 3.46, deudaPendiente: 0, cashflowMes: 310, gastosMes: 190 },
  { id: 'tenderina4d',  alias: 'Tenderina 64 4D', addr: 'Tenderina, 64 4D',             coste: 94920,  valor: 150000, revalTotal: 58.03, revalAnual: 19.70, yield: 15.87, deudaPendiente: 42100, cashflowMes: 540, gastosMes: 220 },
  { id: 'tenderina4i',  alias: 'Tenderina 64 4I', addr: 'Tenderina, 64 4I',             coste: 98760,  valor: 150000, revalTotal: 51.88, revalAnual: 12.86, yield: 19.68, deudaPendiente: 48021, cashflowMes: 585, gastosMes: 235 },
  { id: 'tenderina5d',  alias: 'Tenderina 64 5D', addr: 'Tenderina, 64 5D',             coste: 10800,  valor: 11000,  revalTotal: 1.85,  revalAnual: 0.75,  yield: 0, deudaPendiente: 0, cashflowMes: -15, gastosMes: 30 },
];

type PropertySnapshot = typeof PROPERTIES[number];

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const findMatchingProperty = (seed: PropertySnapshot, properties: Property[]): Property | undefined => {
  const seedAlias = normalize(seed.alias);
  const seedAddress = normalize(seed.addr);

  return properties.find((property) => {
    const alias = normalize(property.alias || '');
    const globalAlias = normalize(property.globalAlias || '');
    const address = normalize(property.address || '');

    return (
      alias.includes(seedAlias) ||
      seedAlias.includes(alias) ||
      globalAlias.includes(seedAlias) ||
      seedAddress.includes(address) ||
      address.includes(seedAddress)
    );
  });
};

const resolveLiveDebtByProperty = (seed: PropertySnapshot[], properties: Property[], loans: Prestamo[]) =>
  seed.map((property) => {
    const matched = findMatchingProperty(property, properties);
    if (!matched?.id) {
      return property;
    }

    const links = new Set(
      [String(matched.id), matched.globalAlias ? String(matched.globalAlias) : '']
        .map((value) => value.trim())
        .filter(Boolean)
    );

    const deudaPendiente = loans
      .filter((loan) => loan.ambito === 'INMUEBLE' && loan.activo && links.has(String(loan.inmuebleId ?? '').trim()))
      .reduce((sum, loan) => sum + (loan.principalVivo || 0), 0);

    return { ...property, deudaPendiente };
  });

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

const buildProyeccion = (years: number) => {
  const base = 916000, equity0 = 642079, rate = 0.1273;
  return Array.from({ length: years + 1 }, (_, i) => ({
    year: String(2026 + i),
    valor: Math.round(base * Math.pow(1 + rate, i)),
    equity: Math.round(equity0 * Math.pow(1.08, i)),
  }));
};

const buildIndividualValueSeries = (property: PropertySnapshot) => {
  const pastYears = ['2005', '2008', '2010', '2013', '2015', '2018', '2020', '2022', '2024', '2026'];
  const growth = Math.max(0.004, property.revalAnual / 100);
  const past = pastYears.map((year, index) => {
    const progress = index / (pastYears.length - 1);
    const hist = Math.round(property.coste + (property.valor - property.coste) * progress);
    return { year, hist, proy: null as number | null };
  });

  const proyYears = ['2028', '2030', '2032', '2034', '2036'];
  const projection = proyYears.map((year, index) => ({
    year,
    hist: null as number | null,
    proy: Math.round(property.valor * Math.pow(1 + growth, index + 1)),
  }));

  past[past.length - 1].proy = property.valor;
  return [...past, ...projection];
};

const buildIndividualCashflowSeries = (property: PropertySnapshot) => {
  const years = ['2006', '2008', '2010', '2012', '2014', '2016', '2018', '2020', '2022', '2024', '2026'];
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

function TabResumen() {
  const [horizon, setHorizon] = useState(10);
  const proyData = useMemo(() => buildProyeccion(horizon), [horizon]);

  return (
    <div>
      {/* KPI row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 16 }}>
        <KpiCard label="Coste total" value="540.680 €" meta="Inversión acumulada desde 2005" accentColor={C.c2} icon={Landmark} iconBg="rgba(4,44,94,.06)" />
        <KpiCard label="Valor actual" value="916.000 €" meta={<><Chip color={C.pos} bg={C.posBg}><TrendingUp size={10} /> +69,4%</Chip> sobre coste</>} accentColor={C.blue} icon={Building2} iconBg="rgba(4,44,94,.06)" />
        <KpiCard label="Cashflow neto / mes" value="1.857,76 €" meta="Ingresos − gastos − hipotecas" accentColor={C.pos} icon={Wallet} iconBg={C.posBg} valueColor={C.pos} />
        <KpiCard label="Plusvalía latente" value="375.320 €" meta="Si vendes hoy (antes de impuestos)" accentColor={C.teal} icon={ArrowUpRight} iconBg="rgba(29,160,186,.1)" />
      </div>

      {/* KPI row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 16 }}>
        {[
          { label: 'Rentabilidad bruta', val: '10,48%', meta: '/ año · Ingresos anuales / Coste total' },
          { label: 'Rentabilidad neta s/ activo', val: '4,12%', meta: '/ año · Cashflow neto anual / Coste total' },
          { label: 'Rentabilidad neta s/ equity', val: '3,47%', meta: '/ año · Cashflow neto anual / Capital propio' },
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
          sub={`Valor de mercado y equity · Tasa media 12,73%/año`}
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
          <ResultRow label="Cashflow neto acumulado" value="37.232,89 €" valueColor={C.pos} />
          <ResultRow label="Beneficio total si vendes hoy" value="412.552,89 €" valueColor={C.pos} />
          <ResultRow label="Múltiplo sobre capital" value="× 1,76" />
          <ResultRow label="Rentabilidad anualizada" value="16,85%" valueColor={C.blue} />
          <ResultRow label="Tasa media revalorización" value="12,73% / año" />
          <div style={{ height: 1, background: C.n300, margin: '8px 0' }} />
          <ResultRow label="Deuda pendiente" value="−273.921,30 €" valueColor={C.neg} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.n700 }}>Equity actual</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 17, fontWeight: 600, color: C.blue }}>642.078,70 €</span>
          </div>
          <div style={{ fontSize: 11, color: C.n500, marginTop: 8 }}>Histórico agregado desde primera compra: 15/10/2005</div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Cartera ─────────────────────────────────────────────────────────────

function TabCartera({
  onSelectProperty,
  properties,
}: {
  onSelectProperty: (id: string) => void;
  properties: PropertySnapshot[];
}) {
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

  return (
    <div style={{ background: '#fff', border: `1px solid ${C.n300}`, borderRadius: 12, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.n100}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, maxWidth: 360, padding: '7px 12px', border: `1.5px solid ${C.n200}`, borderRadius: 8, background: C.n50 }}>
          <Search size={14} color={C.n500} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por alias o dirección..." style={{ border: 'none', background: 'transparent', fontSize: 13, color: C.n700, width: '100%', outline: 'none', fontFamily: 'inherit' }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', fontSize: 12, background: 'transparent', border: `1.5px solid ${C.n200}`, borderRadius: 8, cursor: 'pointer', color: C.n500, fontFamily: 'inherit' }}>
            <SlidersHorizontal size={13} /> Filtros
          </button>
          <button style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', fontSize: 12, background: C.blue, border: 'none', borderRadius: 8, cursor: 'pointer', color: '#fff', fontFamily: 'inherit' }}>
            <Plus size={13} /> Nuevo inmueble
          </button>
        </div>
      </div>

      <div style={{ padding: '8px 20px', fontSize: 11, color: C.n500, borderBottom: `1px solid ${C.n100}` }}>{filtered.length} inmuebles</div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {[
              { key: 'alias', label: 'Dirección / Alias', align: 'left' },
              { key: 'coste', label: 'Coste inversión', align: 'right' },
              { key: 'valor', label: 'Valor actual', align: 'right' },
              { key: 'revalTotal', label: '% Reval. total', align: 'right' },
              { key: 'revalAnual', label: '% Reval. anual', align: 'right' },
              { key: 'yield', label: 'Yield (%)', align: 'right' },
            ].map(col => (
              <th key={col.key} onClick={() => handleSort(col.key as any)} style={{ padding: '9px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.n500, background: C.n50, borderBottom: `1px solid ${C.n200}`, textAlign: col.align as any, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{col.label}<SortIcon k={col.key as any} /></span>
              </th>
            ))}
            <th style={{ padding: '9px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.n500, background: C.n50, borderBottom: `1px solid ${C.n200}` }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((p, i) => (
            <tr key={p.id} onClick={() => onSelectProperty(p.id)} style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${C.n100}` : 'none', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(4,44,94,.015)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <td style={{ padding: '12px 16px' }}>
                <div style={{ fontWeight: 600, color: C.n700, fontSize: 13 }}>{p.alias}</div>
                <div style={{ fontSize: 11, color: C.n500, marginTop: 1 }}>{p.addr}</div>
              </td>
              <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>{fmt(p.coste)}</td>
              <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>{fmt(p.valor)}</td>
              <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                <Chip color={p.revalTotal > 10 ? C.pos : C.n500} bg={p.revalTotal > 10 ? C.posBg : C.n100}>{p.revalTotal > 0 ? '+' : ''}{p.revalTotal.toFixed(2)}%</Chip>
              </td>
              <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: C.pos, fontWeight: 600 }}>{p.revalAnual.toFixed(2)}%</td>
              <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: p.yield > 0 ? C.blue : C.n500, fontWeight: p.yield > 0 ? 600 : 400 }}>{p.yield > 0 ? `${p.yield.toFixed(2)}%` : '—'}</td>
              <td style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                  <button onClick={e => { e.stopPropagation(); onSelectProperty(p.id); }} style={{ width: 28, height: 28, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.n500 }} title="Ver detalle"><Eye size={14} /></button>
                  <button onClick={e => e.stopPropagation()} style={{ width: 28, height: 28, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.n500 }} title="Más"><MoreHorizontal size={14} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
  const cashflowAcumulado = prop.cashflowMes * 12 * 10;

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
          { label: 'Hoy', val: fmt(prop.valor), sub: 'Valor estimado · mar 2026', cls: 'present' },
          { label: 'Proyección 5 años', val: `~${fmt(Math.round(prop.valor * Math.pow(1.1273, 5)))}`, sub: 'A 12,73% anual', cls: 'future' },
          { label: 'Proyección 10 años', val: `~${fmt(Math.round(prop.valor * Math.pow(1.1273, 10)))}`, sub: 'A 12,73% anual', cls: 'future' },
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
              <Line type="monotone" dataKey="proy" name="Proyección (12,73%/a)" stroke={C.teal} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls={false} />
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
  const [activeTab, setActiveTab] = useState<Tab>('resumen');
  const [selectedPropertyId, setSelectedPropertyId] = useState(PROPERTIES[0].id);
  const [properties, setProperties] = useState<PropertySnapshot[]>(PROPERTIES);

  useEffect(() => {
    let mounted = true;

    const loadLiveDebt = async () => {
      try {
        const db = await initDB();
        const [dbProperties, dbLoans] = await Promise.all([
          db.getAll('properties') as Promise<Property[]>,
          db.getAll('prestamos') as Promise<Prestamo[]>,
        ]);

        if (!mounted) return;
        setProperties(resolveLiveDebtByProperty(PROPERTIES, dbProperties, dbLoans));
      } catch {
        if (mounted) setProperties(PROPERTIES);
      }
    };

    void loadLiveDebt();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSelectProperty = (id: string) => {
    setSelectedPropertyId(id);
    setActiveTab('individual');
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
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 13, fontWeight: on ? 600 : 500, color: on ? C.blue : C.n500, background: on ? '#fff' : 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', boxShadow: on ? '0 1px 3px rgba(4,44,94,.08)' : 'none', transition: 'all 150ms', fontFamily: 'inherit' }}>
                <Icon size={14} />{t.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === 'resumen'    && <TabResumen />}
        {activeTab === 'cartera'    && <TabCartera onSelectProperty={handleSelectProperty} properties={properties} />}
        {activeTab === 'evolucion'  && <TabEvolucion properties={properties} />}
        {activeTab === 'individual' && <TabIndividual selectedId={selectedPropertyId} properties={properties} />}
      </div>
    </div>
  );
}
