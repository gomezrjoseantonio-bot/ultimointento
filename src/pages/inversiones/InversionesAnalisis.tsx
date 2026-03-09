// src/pages/inversiones/InversionesAnalisis.tsx
// Página de análisis de portfolio de inversiones
// Tabs: Resumen · Cartera · Rendimientos · Individual

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Table2,
  BarChart2,
  TrendingUp,
  Wallet,
  ArrowUpRight,
  Eye,
  MoreHorizontal,
  SlidersHorizontal,
  Plus,
  Search,
  ChevronUp,
  ChevronDown,
  Star,
  Activity,
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
  ReferenceLine,
} from 'recharts';
import { inversionesService } from '../../services/inversionesService';
import { PosicionInversion } from '../../types/inversiones';
import PosicionForm from '../../modules/horizon/inversiones/components/PosicionForm';
import AportacionForm from '../../modules/horizon/inversiones/components/AportacionForm';
import ActualizarValorModal from '../../modules/horizon/inversiones/components/ActualizarValorModal';
import { importarAportacionesHistoricas } from '../../services/inversionesAportacionesImportService';
import toast from 'react-hot-toast';

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

const fmtPct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;

// ─── Data ─────────────────────────────────────────────────────────────────────
type PositionRow = {
  id: string;
  alias: string;
  broker: string;
  tipo: string;
  aportado: number;
  valor: number;
  rentPct: number;
  rentAnual: number;
  peso: number;
  color: string;
  tag: string | null;
};

const buildEvolucionInversiones = (positions: PositionRow[]) => {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 4, currentYear - 3, currentYear - 2, currentYear - 1, currentYear];
  const aportado = positions.reduce((sum, p) => sum + p.aportado, 0);
  const valor = positions.reduce((sum, p) => sum + p.valor, 0);

  return years.map((year, index) => {
    const progress = (index + 1) / years.length;
    return {
      year: String(year),
      aportado: Math.round(aportado * progress),
      valor: Math.round(aportado + (valor - aportado) * progress),
    };
  });
};

const buildProyInv = (years: number, base: number, aportado: number) => {
  const rate = 0.08;
  return Array.from({ length: years + 1 }, (_, i) => ({
    year: String(new Date().getFullYear() + i),
    valor: Math.round(base * Math.pow(1 + rate, i)),
    coste: Math.round(aportado * (1 + i * 0.03)),
  }));
};

const buildIndividualEvolucion = (position: PositionRow) => {
  const currentYear = new Date().getFullYear();
  const hist = Array.from({ length: 5 }, (_, i) => {
    const progress = (i + 1) / 5;
    return {
      year: String(currentYear - 4 + i),
      hist: Math.round(position.aportado + (position.valor - position.aportado) * progress),
      proy: null as number | null,
    };
  });

  const proy = Array.from({ length: 3 }, (_, i) => ({
    year: String(currentYear + (i + 1) * 2),
    hist: null as number | null,
    proy: Math.round(position.valor * Math.pow(1 + Math.max(0.01, position.rentAnual / 100), i + 1)),
  }));

  hist[hist.length - 1].proy = position.valor;
  return [...hist, ...proy];
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

function TabResumen({ positions }: { positions: PositionRow[] }) {
  const [horizon, setHorizon] = useState(10);
  const safePositions = positions.length ? positions : [{
    id: 'empty', alias: 'Sin datos', broker: '-', tipo: '-', aportado: 0, valor: 0, rentPct: 0, rentAnual: 0, peso: 0, color: C.blue, tag: null,
  }];
  const totalAportado = safePositions.reduce((sum, p) => sum + p.aportado, 0);
  const valorTotal = safePositions.reduce((sum, p) => sum + p.valor, 0);
  const ganancia = valorTotal - totalAportado;
  const rentabilidadTotal = totalAportado > 0 ? (ganancia / totalAportado) * 100 : 0;
  const proyData = useMemo(() => buildProyInv(horizon, valorTotal, totalAportado), [horizon, totalAportado, valorTotal]);
  const best = safePositions.reduce((a, b) => (a.rentPct > b.rentPct ? a : b), safePositions[0]);

  return (
    <div>
      {/* Hero banner */}
      <div style={{ background: `linear-gradient(135deg, ${C.blue} 0%, #0D4A8A 100%)`, borderRadius: 12, padding: '20px 24px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', opacity: .7, marginBottom: 6 }}>Mejor posición · {best.alias}</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 38, fontWeight: 600, lineHeight: 1, marginBottom: 4 }}>{fmtPct(best.rentPct)}</div>
          <div style={{ fontSize: 13, opacity: .75 }}>Rentabilidad total · {best.broker} · {best.tipo}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, opacity: .7, marginBottom: 4 }}>Valor posición</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 26, fontWeight: 600 }}>{fmt(best.valor)}</div>
          <div style={{ fontSize: 12, opacity: .65, marginTop: 2 }}>Aportado: {fmt(best.aportado)}</div>
        </div>
      </div>

      {/* KPI row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 16 }}>
        <KpiCard label="Valor total portfolio" value={fmt(valorTotal)} meta={<><Chip color={C.pos} bg={C.posBg}><TrendingUp size={10} /> {fmtPct(rentabilidadTotal)}</Chip> sobre aportado</>} accentColor={C.blue} icon={Wallet} />
        <KpiCard label="Capital aportado" value={fmt(totalAportado)} meta="Inversión acumulada total" accentColor={C.c2} icon={ArrowUpRight} />
        <KpiCard label="Ganancia no realizada" value={`${ganancia >= 0 ? '+' : ''}${fmt(ganancia)}`} meta="Si liquidas hoy (antes de impuestos)" accentColor={C.pos} valueColor={C.pos} icon={TrendingUp} iconBg={C.posBg} />
        <KpiCard label="Posiciones activas" value={`${positions.length}`} meta="Posiciones en cartera" accentColor={C.teal} icon={Activity} />
      </div>

      {/* KPI row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 16 }}>
        {[
          { label: 'Rentabilidad total portfolio', val: fmtPct(rentabilidadTotal), meta: 'Desde primera aportación' },
          { label: 'Rentabilidad anualizada', val: '+8,2%', meta: '/ año · CAGR estimado' },
          { label: 'Mejor posición', val: `${best.alias} +${best.rentPct.toFixed(1)}%`, meta: `${best.rentAnual.toFixed(2)}% / año · ${best.broker}` },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: `1px solid ${C.n300}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: C.n500, marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: k.val.length > 14 ? 20 : 30, fontWeight: 600, color: C.blue, lineHeight: 1, marginBottom: 4 }}>{k.val}</div>
            <div style={{ fontSize: 12, color: C.n500 }}>{k.meta}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <ChartCard
          title="Proyección del portfolio"
          sub="Valor proyectado a tasa histórica ~15%/año"
          right={
            <div style={{ display: 'inline-flex', gap: 2, background: C.n100, borderRadius: 8, padding: 3 }}>
              {[5, 10, 20].map(y => (
                <button key={y} onClick={() => setHorizon(y)} style={{ padding: '5px 12px', fontSize: 12, fontWeight: horizon === y ? 600 : 500, color: horizon === y ? C.blue : C.n500, background: horizon === y ? '#fff' : 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', boxShadow: horizon === y ? '0 1px 3px rgba(4,44,94,.08)' : 'none', fontFamily: 'inherit' }}>{y}a</button>
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
              <Line type="monotone" dataKey="valor" name="Valor estimado" stroke={C.blue} strokeWidth={2} dot={{ r: 3, fill: C.blue }} />
              <Line type="monotone" dataKey="coste" name="Capital aportado" stroke={C.c2} strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3, fill: C.c2 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <div style={{ background: '#fff', border: `1px solid ${C.n300}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.n700, marginBottom: 16 }}>Resumen del portfolio</div>
          <ResultRow label="Total aportado" value={fmt(totalAportado)} />
          <ResultRow label="Valor actual" value={fmt(valorTotal)} />
          <ResultRow label="Ganancia no realizada" value={`${ganancia >= 0 ? '+' : ''}${fmt(ganancia)}`} valueColor={C.pos} />
          <ResultRow label="Rentabilidad total" value={fmtPct(rentabilidadTotal)} valueColor={C.pos} />
          <ResultRow label="Mejor posición" value={`${best.alias}`} />
          <ResultRow label="Posición más estable" value="Smartflip P2P" />
          <div style={{ height: 1, background: C.n300, margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.n700 }}>Múltiplo sobre capital</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 20, fontWeight: 600, color: C.blue }}>× 1,31</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Cartera ─────────────────────────────────────────────────────────────

function TabCartera({
  onSelectPosition,
  onNewPosition,
  onEditPosition,
  onAddAportacion,
  onImportAportacionesHistoricas,
  onActualizarValor,
  onImportarValorHistorico,
  positions,
}: {
  onSelectPosition: (id: string) => void;
  onNewPosition: () => void;
  onEditPosition: (id: string) => void;
  onAddAportacion: (id: string) => void;
  onImportAportacionesHistoricas: (id: string) => void;
  onActualizarValor: (id: string) => void;
  onImportarValorHistorico: () => void;
  positions: PositionRow[];
}) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<keyof PositionRow>('alias');
  const [sortAsc, setSortAsc] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return positions
      .filter(p => p.alias.toLowerCase().includes(q) || p.broker.toLowerCase().includes(q) || p.tipo.toLowerCase().includes(q))
      .sort((a: any, b: any) => sortAsc ? (a[sortKey] > b[sortKey] ? 1 : -1) : (a[sortKey] < b[sortKey] ? 1 : -1));
  }, [query, sortKey, sortAsc, positions]);

  const handleSort = (key: keyof PositionRow) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const SortIcon = ({ k }: { k: keyof PositionRow }) =>
    sortKey === k ? (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : null;

  return (
    <div style={{ background: '#fff', border: `1px solid ${C.n300}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.n100}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, maxWidth: 360, padding: '7px 12px', border: `1.5px solid ${C.n200}`, borderRadius: 8, background: C.n50 }}>
          <Search size={14} color={C.n500} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por nombre, broker o tipo..." style={{ border: 'none', background: 'transparent', fontSize: 13, color: C.n700, width: '100%', outline: 'none', fontFamily: 'inherit' }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', fontSize: 12, background: 'transparent', border: `1.5px solid ${C.n200}`, borderRadius: 8, cursor: 'pointer', color: C.n500, fontFamily: 'inherit' }}>
            <SlidersHorizontal size={13} /> Filtros
          </button>
          <button
            onClick={onNewPosition}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', fontSize: 12, background: C.blue, border: 'none', borderRadius: 8, cursor: 'pointer', color: '#fff', fontFamily: 'inherit' }}
          >
            <Plus size={13} /> Nueva posición
          </button>
        </div>
      </div>

      <div style={{ padding: '8px 20px', fontSize: 11, color: C.n500, borderBottom: `1px solid ${C.n100}` }}>{filtered.length} posiciones</div>

      {/* Pos cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, padding: 20 }}>
        {filtered.map(p => (
          <div key={p.id} onClick={() => onSelectPosition(p.id)} style={{ border: `1.5px solid ${C.n200}`, borderRadius: 12, padding: 18, cursor: 'pointer', transition: 'box-shadow 120ms', position: 'relative', overflow: 'hidden' }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(4,44,94,.08)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: p.color }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.n700 }}>{p.alias}</div>
                <div style={{ fontSize: 12, color: C.n500, marginTop: 2 }}>{p.broker} · {p.tipo}</div>
              </div>
              {p.tag && (
                <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: 'rgba(4,44,94,.08)', color: C.blue, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Star size={10} />{p.tag}
                </span>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: C.n500, marginBottom: 2 }}>Valor actual</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 20, fontWeight: 600, color: C.n700 }}>{fmt(p.valor)}</div>
                <div style={{ fontSize: 11, color: C.n500, marginTop: 1 }}>Aportado: {fmt(p.aportado)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: C.n500, marginBottom: 2 }}>Rentabilidad</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 20, fontWeight: 600, color: p.rentPct > 0 ? C.pos : C.neg }}>
                  {fmtPct(p.rentPct)}
                </div>
                <div style={{ fontSize: 11, color: C.n500, marginTop: 1 }}>{p.rentAnual.toFixed(2)}% / año</div>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.n500, marginBottom: 4 }}>
                <span>Peso portfolio</span><span style={{ fontWeight: 600 }}>{p.peso}%</span>
              </div>
              <div style={{ background: C.n100, borderRadius: 4, height: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${p.peso}%`, background: p.color, borderRadius: 4, transition: 'width 600ms ease' }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ borderTop: `1px solid ${C.n100}`, padding: '0 0 0 0' }}>
        <div style={{ padding: '8px 20px', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: C.n500, background: C.n50 }}>Vista tabla</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {[
                { key: 'alias', label: 'Posición / Broker', align: 'left' },
                { key: 'aportado', label: 'Aportado', align: 'right' },
                { key: 'valor', label: 'Valor actual', align: 'right' },
                { key: 'rentPct', label: '% Rent. total', align: 'right' },
                { key: 'rentAnual', label: '% Rent. anual', align: 'right' },
                { key: 'peso', label: 'Peso %', align: 'right' },
              ].map(col => (
                <th key={col.key} onClick={() => handleSort(col.key as any)} style={{ padding: '9px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.n500, background: C.n50, borderBottom: `1px solid ${C.n200}`, textAlign: col.align as any, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{col.label}<SortIcon k={col.key as any} /></span>
                </th>
              ))}
              <th style={{ padding: '9px 16px', fontSize: 10, fontWeight: 700, background: C.n50, borderBottom: `1px solid ${C.n200}` }} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr key={p.id} onClick={() => onSelectPosition(p.id)} style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${C.n100}` : 'none', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(4,44,94,.015)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 600, color: C.n700, fontSize: 13 }}>{p.alias}</div>
                      <div style={{ fontSize: 11, color: C.n500, marginTop: 1 }}>{p.broker} · {p.tipo}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>{fmt(p.aportado)}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>{fmt(p.valor)}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <Chip color={p.rentPct > 5 ? C.pos : p.rentPct > 0 ? C.n500 : C.neg} bg={p.rentPct > 5 ? C.posBg : p.rentPct > 0 ? C.n100 : C.negBg}>{fmtPct(p.rentPct)}</Chip>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: C.pos, fontWeight: 600 }}>{p.rentAnual.toFixed(2)}%</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>{p.peso}%</td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                    <button onClick={e => { e.stopPropagation(); onSelectPosition(p.id); }} style={{ width: 28, height: 28, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.n500 }} title="Ver detalle" aria-label={`Ver detalle ${p.alias}`}><Eye size={14} /></button>
                    <div style={{ position: 'relative' }}>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setOpenMenuId((current) => current === p.id ? null : p.id);
                        }}
                        title="Más acciones"
                        aria-label={`Más acciones de ${p.alias}`}
                        style={{ width: 28, height: 28, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.n500 }}
                      ><MoreHorizontal size={14} /></button>

                      {openMenuId === p.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 6px)',
                            right: 0,
                            minWidth: 240,
                            background: '#fff',
                            border: `1px solid ${C.n200}`,
                            borderRadius: 8,
                            boxShadow: '0 8px 24px rgba(4,44,94,.12)',
                            zIndex: 30,
                            overflow: 'hidden',
                          }}
                        >
                          {[
                            { label: 'Editar posición', action: () => onEditPosition(p.id) },
                            { label: 'Añadir aportación', action: () => onAddAportacion(p.id) },
                            { label: 'Importar aportaciones históricas', action: () => onImportAportacionesHistoricas(p.id) },
                            { label: 'Actualizar valor', action: () => onActualizarValor(p.id) },
                            { label: 'Importar valor histórico', action: () => onImportarValorHistorico() },
                          ].map((item) => (
                            <button
                              key={item.label}
                              onClick={() => {
                                setOpenMenuId(null);
                                item.action();
                              }}
                              style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: '0.55rem 0.75rem',
                                border: 'none',
                                background: 'white',
                                cursor: 'pointer',
                                fontSize: 12,
                                color: C.n700,
                                fontFamily: 'inherit',
                              }}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab: Rendimientos ────────────────────────────────────────────────────────

function TabRendimientos({ positions }: { positions: PositionRow[] }) {
  const evolucionInv = useMemo(() => buildEvolucionInversiones(positions), [positions]);
  const donutData = positions.map(p => ({ name: p.alias, value: p.valor }));
  const donutColors = positions.map(p => p.color);
  const rentData = positions.map(p => ({ name: p.alias, rentPct: p.rentPct, rentAnual: p.rentAnual }));

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <ChartCard title="Evolución del portfolio" sub="Valor total vs capital aportado · 2017–2026">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={evolucionInv} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="rgba(200,208,220,.4)" />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: C.n500 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.n500 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [`${v.toLocaleString('es-ES')} €`]} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.n200}` }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="valor" name="Valor portfolio" stroke={C.blue} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="aportado" name="Capital aportado" stroke={C.c2} strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Rentabilidad por posición" sub="% total acumulado desde primera aportación">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={rentData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="rgba(200,208,220,.4)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.n500 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.n500 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(2)}%`]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <ReferenceLine y={0} stroke={C.n300} />
              <Bar dataKey="rentPct" name="Rentabilidad total %" radius={[4, 4, 0, 0]}>
                {rentData.map((_, i) => <Cell key={i} fill={donutColors[i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <ChartCard title="Distribución del portfolio" sub="% por valor actual de cada posición">
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <PieChart width={180} height={180}>
              <Pie data={donutData} dataKey="value" cx={90} cy={90} innerRadius={58} outerRadius={86} paddingAngle={1}>
                {donutData.map((_, i) => <Cell key={i} fill={donutColors[i]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => [`${v.toLocaleString('es-ES')} €`]} contentStyle={{ fontSize: 12 }} />
            </PieChart>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {positions.map((p, i) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.n700 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: donutColors[i], flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{p.alias}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>{p.peso}%</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Rentabilidad anualizada por posición" sub="% rent. anual estimada (CAGR)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={rentData} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="rgba(200,208,220,.4)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: C.n500 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: C.n500 }} axisLine={false} tickLine={false} width={110} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(2)}%/año`]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="rentAnual" name="Rent. anual %" radius={[0, 4, 4, 0]}>
                {rentData.map((_, i) => <Cell key={i} fill={donutColors[i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

// ─── Tab: Individual ──────────────────────────────────────────────────────────

function TabIndividual({ selectedId, positions }: { selectedId: string; positions: PositionRow[] }) {
  const [posId, setPosId] = useState(selectedId || '');
  const safePositions = positions.length ? positions : [{
    id: 'empty', alias: 'Sin datos', broker: '-', tipo: '-', aportado: 0, valor: 0, rentPct: 0, rentAnual: 0, peso: 0, color: C.blue, tag: null,
  }];
  const pos = safePositions.find(p => p.id === posId) ?? safePositions[0];
  const evolData = buildIndividualEvolucion(pos);

  return (
    <div>
      {/* Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.n700 }}>Posición</label>
        <select value={posId} onChange={e => setPosId(e.target.value)} style={{ padding: '7px 12px', border: `1.5px solid ${C.n300}`, borderRadius: 8, fontSize: 13, color: C.n700, background: '#fff', cursor: 'pointer', minWidth: 280, fontFamily: 'inherit' }}>
          {safePositions.map(p => <option key={p.id} value={p.id}>{p.alias} · {p.broker}</option>)}
        </select>
      </div>

      {/* Timeline */}
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: C.n500, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        Foto pasado · presente · proyección
        <div style={{ flex: 1, height: 1, background: C.n200 }} />
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Aportado', val: fmt(pos.aportado), sub: 'Capital invertido total', cls: 'past' },
          { label: 'Hoy', val: fmt(pos.valor), sub: 'Valor estimado · mar 2026', cls: 'present' },
          { label: 'Proyección 5 años', val: `~${fmt(Math.round(pos.valor * Math.pow(1 + pos.rentAnual / 100, 5)))}`, sub: `A ${pos.rentAnual.toFixed(2)}% anual`, cls: 'future' },
          { label: 'Proyección 10 años', val: `~${fmt(Math.round(pos.valor * Math.pow(1 + pos.rentAnual / 100, 10)))}`, sub: `A ${pos.rentAnual.toFixed(2)}% anual`, cls: 'future' },
        ].map(t => (
          <div key={t.label} style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: `1px solid ${t.cls === 'present' ? C.blue : t.cls === 'future' ? C.teal : C.n200}`, background: t.cls === 'present' ? 'rgba(4,44,94,.04)' : t.cls === 'future' ? 'rgba(29,160,186,.04)' : C.n50 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: C.n500, marginBottom: 4 }}>{t.label}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 17, fontWeight: 600, color: C.n700 }}>{t.val}</div>
            <div style={{ fontSize: 11, color: C.n500, marginTop: 2 }}>{t.sub}</div>
          </div>
        ))}
      </div>

      {/* KPI strip */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, overflowX: 'auto' }}>
        {[
          { label: 'Ganancia no realizada', val: `+${fmt(pos.valor - pos.aportado)}`, meta: 'Valor − aportado', color: C.pos },
          { label: 'Rentabilidad total', val: fmtPct(pos.rentPct), meta: 'Acumulada total', color: C.pos },
          { label: 'Rentabilidad anual', val: `${pos.rentAnual.toFixed(2)}%/a`, meta: 'CAGR estimado', color: C.blue },
          { label: 'Múltiplo s/ capital', val: `× ${(pos.valor / pos.aportado).toFixed(2)}`, meta: 'Valor / aportado', color: C.blue },
          { label: 'Peso portfolio', val: `${pos.peso}%`, meta: 'Del total', color: C.n500 },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: `1px solid ${C.n300}`, borderRadius: 12, padding: 14, flexShrink: 0, minWidth: 130 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: C.n500, marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, fontWeight: 600, color: k.color }}>{k.val}</div>
            <div style={{ fontSize: 11, color: C.n500, marginTop: 2 }}>{k.meta}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        <ChartCard title={`${pos.alias} — Evolución y proyección`} sub={`Valor histórico + proyección a tasa ${pos.rentAnual.toFixed(2)}%/año`}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={evolData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="rgba(200,208,220,.4)" />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: C.n500 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.n500 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [`${v.toLocaleString('es-ES')} €`]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="hist" name="Valor histórico" stroke={C.blue} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
              <Line type="monotone" dataKey="proy" name={`Proyección (${pos.rentAnual.toFixed(2)}%/a)`} stroke={C.teal} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <div style={{ background: '#fff', border: `1px solid ${C.n300}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.n700, marginBottom: 16 }}>Ficha de posición</div>
          <ResultRow label="Nombre" value={pos.alias} />
          <ResultRow label="Broker / Plataforma" value={pos.broker} />
          <ResultRow label="Tipo de activo" value={pos.tipo} />
          <ResultRow label="Capital aportado" value={fmt(pos.aportado)} />
          <ResultRow label="Valor actual" value={fmt(pos.valor)} />
          <ResultRow label="Ganancia no realizada" value={`+${fmt(pos.valor - pos.aportado)}`} valueColor={C.pos} />
          <div style={{ height: 1, background: C.n300, margin: '8px 0' }} />
          <ResultRow label="Rentabilidad total" value={fmtPct(pos.rentPct)} valueColor={C.pos} bold />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.n700 }}>CAGR estimado</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 20, fontWeight: 600, color: C.blue }}>{pos.rentAnual.toFixed(2)}%/a</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'resumen' | 'cartera' | 'rendimientos' | 'individual';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'resumen',       label: 'Resumen',      icon: LayoutDashboard },
  { id: 'cartera',       label: 'Cartera',       icon: Table2 },
  { id: 'rendimientos',  label: 'Rendimientos',  icon: BarChart2 },
  { id: 'individual',    label: 'Individual',    icon: Activity },
];

export default function InversionesAnalisis() {
  const [activeTab, setActiveTab] = useState<Tab>('resumen');
  const [selectedPositionId, setSelectedPositionId] = useState('');
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showAportacionForm, setShowAportacionForm] = useState(false);
  const [showActualizarValor, setShowActualizarValor] = useState(false);
  const [editingPosicion, setEditingPosicion] = useState<PosicionInversion | undefined>();
  const aportacionesInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadPosiciones = async () => {
      try {
        const data = await inversionesService.getPosiciones();
        if (!data.length) {
          setPositions([]);
          setSelectedPositionId('');
          return;
        }

        const mapped = mapPosicionesToRows(data);
        setPositions(mapped);
        if (!mapped.some((p) => p.id === selectedPositionId)) {
          setSelectedPositionId(mapped[0].id);
        }
      } catch (error) {
        console.error('Error cargando posiciones de inversiones:', error);
      }
    };

    loadPosiciones();
  }, [selectedPositionId]);

  if (!positions.length) {
    return (
      <div style={{ minHeight: '100vh', background: C.n50, display: 'grid', placeItems: 'center' }}>
        <p style={{ color: C.n500 }}>No hay posiciones de inversión activas en tus datos.</p>
      </div>
    );
  }

  const handleSelectPosition = (id: string) => {
    setSelectedPositionId(id);
    setActiveTab('individual');
  };


  const refreshPosiciones = async () => {
    const refreshed = await inversionesService.getPosiciones();
    setPositions(mapPosicionesToRows(refreshed));
  };

  const loadPosicionForAction = async (id: string): Promise<PosicionInversion | null> => {
    try {
      const posicion = await inversionesService.getPosicion(Number(id));
      if (!posicion) {
        toast.error('No se ha encontrado la posición');
        return null;
      }
      setEditingPosicion(posicion);
      return posicion;
    } catch (error) {
      console.error('Error cargando la posición:', error);
      toast.error('Error al cargar la posición');
      return null;
    }
  };

  const mapPosicionesToRows = (data: PosicionInversion[]) => {
    const colorPalette = [C.blue, C.c2, C.teal, C.c4, C.c5];
    const totalValor = data.reduce((sum, p) => sum + p.valor_actual, 0);
    const mapped: PositionRow[] = data.map((p: PosicionInversion, index) => {
      const rentabilidadAnual = Number((p as any).rendimiento || 0);
      const peso = totalValor > 0 ? (p.valor_actual / totalValor) * 100 : 0;
      return {
        id: String(p.id),
        alias: p.nombre,
        broker: p.entidad,
        tipo: p.tipo,
        aportado: p.total_aportado,
        valor: p.valor_actual,
        rentPct: p.rentabilidad_porcentaje,
        rentAnual: Number.isFinite(rentabilidadAnual) ? rentabilidadAnual : 0,
        peso: Number(peso.toFixed(1)),
        color: colorPalette[index % colorPalette.length],
        tag: null,
      };
    });

    if (mapped.length > 0) {
      const bestIdx = mapped.reduce((best, item, index, arr) => (item.rentPct > arr[best].rentPct ? index : best), 0);
      mapped[bestIdx] = { ...mapped[bestIdx], tag: 'Top performer' };
    }

    return mapped;
  };

  const handleNewPosition = () => {
    setEditingPosicion(undefined);
    setShowForm(true);
  };

  const handleEditPosition = async (id: string) => {
    const posicion = await loadPosicionForAction(id);
    if (!posicion) return;
    setShowForm(true);
  };

  const handleAddAportacion = async (id: string) => {
    const posicion = await loadPosicionForAction(id);
    if (!posicion) return;
    setShowAportacionForm(true);
  };

  const handleActualizarValorDesdeMenu = async (id: string) => {
    const posicion = await loadPosicionForAction(id);
    if (!posicion) return;
    setShowActualizarValor(true);
  };

  const handleImportAportacionesDesdeMenu = async (id: string) => {
    const posicion = await loadPosicionForAction(id);
    if (!posicion) return;
    aportacionesInputRef.current?.click();
  };

  const handleImportAportacionesHistoricas = async (file: File) => {
    if (!editingPosicion) return;
    try {
      const result = await importarAportacionesHistoricas(file, editingPosicion);
      await refreshPosiciones();
      const updated = await inversionesService.getPosicion(editingPosicion.id);
      if (updated) setEditingPosicion(updated);

      if (result.imported > 0) {
        toast.success(`Importadas ${result.imported} aportaciones históricas.`);
      } else {
        toast('No se detectaron filas para importar.', { icon: 'ℹ️' });
      }

      if (result.errors.length > 0) {
        toast(result.errors[0], { icon: '⚠️' });
      }
    } catch (error) {
      console.error('Error importing aportaciones:', error);
      toast.error('Error al importar aportaciones históricas');
    }
  };

  const handleAportacionFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleImportAportacionesHistoricas(file);
    event.target.value = '';
  };

  const handleGuardarAportacion = async (aportacion: any) => {
    if (!editingPosicion) return;
    try {
      await inversionesService.addAportacion(editingPosicion.id, aportacion);
      toast.success('Aportación añadida correctamente');
      setShowAportacionForm(false);
      await refreshPosiciones();
      const updated = await inversionesService.getPosicion(editingPosicion.id);
      if (updated) setEditingPosicion(updated);
    } catch (error) {
      console.error('Error adding aportacion:', error);
      toast.error('Error al añadir la aportación');
    }
  };

  const handleGuardarValor = async (nuevoValor: number, fechaValoracion: string) => {
    if (!editingPosicion) return;
    try {
      await inversionesService.updatePosicion(editingPosicion.id, {
        valor_actual: nuevoValor,
        fecha_valoracion: fechaValoracion,
      });
      toast.success('Valor actualizado correctamente');
      setShowActualizarValor(false);
      await refreshPosiciones();
      const updated = await inversionesService.getPosicion(editingPosicion.id);
      if (updated) setEditingPosicion(updated);
    } catch (error) {
      console.error('Error updating valor:', error);
      toast.error('Error al actualizar el valor');
    }
  };

  const handleImportarValorHistorico = () => {
    toast('Para importar valor histórico usa Cuenta > Migración > Valoraciones.', { icon: 'ℹ️' });
    window.location.href = '/account/migracion';
  };

  const handleSavePosition = async (data: Partial<PosicionInversion> & { importe_inicial?: number }) => {
    try {
      if (editingPosicion) {
        await inversionesService.updatePosicion(editingPosicion.id, data);
        toast.success('Posición actualizada correctamente');
      } else {
        await inversionesService.createPosicion(data as Omit<PosicionInversion, 'id' | 'created_at' | 'updated_at'> & { importe_inicial?: number });
        toast.success('Posición creada correctamente');
      }
      setShowForm(false);
      setEditingPosicion(undefined);

      await refreshPosiciones();
    } catch (error) {
      console.error('Error guardando posición:', error);
      toast.error('Error al guardar la posición');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.n50, fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>

      <div style={{ padding: 24 }}>
        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, paddingBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(4,44,94,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <TrendingUp size={20} color={C.blue} />
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: C.n700, letterSpacing: '-.02em', lineHeight: 1 }}>Portfolio de inversiones</div>
            <div style={{ fontSize: 13, color: C.n500, marginTop: 3 }}>Análisis de rendimiento y evolución de tus posiciones financieras</div>
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
        {activeTab === 'resumen'      && <TabResumen positions={positions} />}
        {activeTab === 'cartera'      && (
          <TabCartera
            onSelectPosition={handleSelectPosition}
            onNewPosition={handleNewPosition}
            onEditPosition={handleEditPosition}
            onAddAportacion={handleAddAportacion}
            onImportAportacionesHistoricas={handleImportAportacionesDesdeMenu}
            onActualizarValor={handleActualizarValorDesdeMenu}
            onImportarValorHistorico={handleImportarValorHistorico}
            positions={positions}
          />
        )}
        {activeTab === 'rendimientos' && <TabRendimientos positions={positions} />}
        {activeTab === 'individual'   && <TabIndividual selectedId={selectedPositionId} positions={positions} />}
      </div>

      {showForm && (
        <PosicionForm
          posicion={editingPosicion}
          onSave={handleSavePosition}
          onClose={() => {
            setShowForm(false);
            setEditingPosicion(undefined);
          }}
        />
      )}

      <input
        ref={aportacionesInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleAportacionFileSelected}
        style={{ display: 'none' }}
      />

      {showAportacionForm && editingPosicion && (
        <AportacionForm
          posicionNombre={editingPosicion.nombre}
          posicion={editingPosicion}
          onSave={handleGuardarAportacion}
          onClose={() => setShowAportacionForm(false)}
        />
      )}

      {showActualizarValor && editingPosicion && (
        <ActualizarValorModal
          posicionNombre={editingPosicion.nombre}
          valorActual={editingPosicion.valor_actual}
          onSave={handleGuardarValor}
          onClose={() => setShowActualizarValor(false)}
        />
      )}
    </div>
  );
}
