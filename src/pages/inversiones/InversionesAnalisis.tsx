// src/pages/inversiones/InversionesAnalisis.tsx
// Página de análisis de portfolio de inversiones
// Tabs: Resumen · Cartera · Rendimientos · Individual

import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  ChevronRight,
  Star,
  Activity,
  Archive,
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
import { PosicionInversion, Aportacion } from '../../types/inversiones';
import { planesInversionService } from '../../services/planesInversionService';
import type { PlanPensionInversion } from '../../types/personal';
import PosicionForm from '../../modules/horizon/inversiones/components/PosicionForm';
import PosicionDetailModal from '../../modules/horizon/inversiones/components/PosicionDetailModal';
import AportacionForm from '../../modules/horizon/inversiones/components/AportacionForm';
import toast from 'react-hot-toast';

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
  fechaCompra: string | null;
  duracionMeses: number | null;
};

const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25;

const parseDate = (value?: string): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const calculateEstimatedCagr = (position: PosicionInversion): number => {
  const totalAportado = Number(position.total_aportado || 0);
  const valorActual = Number(position.valor_actual || 0);
  if (totalAportado <= 0 || valorActual <= 0) return 0;

  const allDates = [
    parseDate(position.fecha_compra),
    parseDate(position.created_at),
    ...((position.aportaciones || []).map((a) => parseDate(a.fecha))),
  ].filter((date): date is Date => date instanceof Date);

  if (!allDates.length) return 0;

  const startDate = allDates.reduce((earliest, current) => (
    current.getTime() < earliest.getTime() ? current : earliest
  ));
  const endDate = parseDate(position.fecha_valoracion) ?? new Date();
  const elapsedYears = Math.max((endDate.getTime() - startDate.getTime()) / MS_PER_YEAR, 0);

  if (elapsedYears <= 0) return 0;

  return (Math.pow(valorActual / totalAportado, 1 / elapsedYears) - 1) * 100;
};

const resolveAnnualReturn = (position: PosicionInversion): number => {
  // For periodic-yield types (loans, deposits, remunerated accounts): use the configured interest rate
  const tiposRendimientoPeriodico = ['prestamo_p2p', 'deposito_plazo', 'deposito', 'cuenta_remunerada'];
  if (tiposRendimientoPeriodico.includes(position.tipo)) {
    const rendObj = (position as any).rendimiento;
    if (rendObj && typeof rendObj === 'object' && Number.isFinite(Number(rendObj.tasa_interes_anual))) {
      return Number(rendObj.tasa_interes_anual);
    }
  }

  // For market-valued assets: CAGR based on value appreciation
  const estimatedCagr = calculateEstimatedCagr(position);
  if (Number.isFinite(estimatedCagr) && Math.abs(estimatedCagr) > 0.0001) {
    return estimatedCagr;
  }

  // Fallback: try extracting rate from rendimiento object (any type)
  const rendObj = (position as any).rendimiento;
  if (rendObj && typeof rendObj === 'object' && Number.isFinite(Number(rendObj.tasa_interes_anual))) {
    return Number(rendObj.tasa_interes_anual);
  }

  return 0;
};

const buildEvolucionInversiones = (positions: PositionRow[]) => {
  const currentYear = new Date().getFullYear();

  // Find the earliest real purchase year from positions
  const fechasCompra = positions
    .map(p => p.fechaCompra ? new Date(p.fechaCompra).getFullYear() : NaN)
    .filter(y => y > 2000 && y <= currentYear);

  if (fechasCompra.length === 0 && positions.length > 0) {
    // No purchase dates available — show only the current year
    const totalAportado = positions.reduce((sum, p) => sum + p.aportado, 0);
    const totalValor = positions.reduce((sum, p) => sum + p.valor, 0);
    return [{ year: String(currentYear), aportado: totalAportado, valor: totalValor }];
  }

  const primerAño = Math.min(...fechasCompra);

  // Build real data points per year based on when positions were created
  const result: { year: string; aportado: number; valor: number }[] = [];
  let acumuladoAportado = 0;

  for (let año = primerAño; año <= currentYear; año++) {
    // Sum contributions from positions created in or before this year
    const aportadoAño = positions
      .filter(p => {
        if (!p.fechaCompra) return false;
        return new Date(p.fechaCompra).getFullYear() === año;
      })
      .reduce((sum, p) => sum + p.aportado, 0);

    acumuladoAportado += aportadoAño;

    result.push({
      year: String(año),
      aportado: acumuladoAportado,
      valor: año === currentYear
        ? positions.reduce((sum, p) => sum + p.valor, 0)
        : acumuladoAportado, // past years without stored valuations: use cost basis
    });
  }

  return result;
};

const buildProyInv = (years: number, base: number, aportado: number, portfolioRate: number) => {
  const rate = portfolioRate / 100;
  return Array.from({ length: years + 1 }, (_, i) => ({
    year: String(new Date().getFullYear() + i),
    valor: Math.round(base * Math.pow(1 + rate, i)),
    coste: aportado, // constant — we don't assume future contributions
  }));
};

const buildIndividualEvolucion = (position: PositionRow) => {
  const currentYear = new Date().getFullYear();
  const añoCompra = position.fechaCompra
    ? new Date(position.fechaCompra).getFullYear()
    : NaN;
  const añoInicio = (añoCompra > 2000 && añoCompra <= currentYear) ? añoCompra : currentYear;

  // Historical: only from actual purchase year to today
  const hist: { year: string; hist: number | null; proy: number | null }[] = [];
  for (let año = añoInicio; año <= currentYear; año++) {
    hist.push({
      year: String(año),
      hist: año === añoInicio ? position.aportado
        : año === currentYear ? position.valor
        : position.aportado, // past years without stored valuations: use cost basis
      proy: año === currentYear ? position.valor : null,
    });
  }

  // Projection: use real rentAnual (now includes interest rate for loans)
  const tasa = Math.max(0, position.rentAnual / 100);

  // For loans with a maturity, limit projection horizon
  const tiposConVencimiento = ['prestamo_p2p', 'deposito_plazo', 'deposito', 'cuenta_remunerada'];
  const esRentaFija = tiposConVencimiento.includes(position.tipo);
  const maxAñosProyeccion = esRentaFija && position.duracionMeses
    ? Math.ceil(position.duracionMeses / 12)
    : 10;

  const proy: { year: string; hist: number | null; proy: number | null }[] = [];
  for (let i = 1; i <= 3; i++) {
    const añoTarget = currentYear + i * 2;
    if (añoTarget > currentYear + maxAñosProyeccion) break;
    proy.push({
      year: String(añoTarget),
      hist: null,
      proy: esRentaFija
        ? position.valor // Loans/deposits: principal doesn't grow in market value
        : Math.round(position.valor * Math.pow(1 + tasa, i * 2)),
    });
  }

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

function TabResumen({ positions, planesPension }: { positions: PositionRow[]; planesPension: PlanPensionInversion[] }) {
  const [horizon, setHorizon] = useState(10);
  const emptyRow: PositionRow = {
    id: 'empty', alias: 'Sin datos', broker: '-', tipo: '-', aportado: 0, valor: 0,
    rentPct: 0, rentAnual: 0, peso: 0, color: C.blue, tag: null,
    fechaCompra: null, duracionMeses: null,
  };
  const safePositions = positions.length ? positions : [emptyRow];
  const totalAportado = safePositions.reduce((sum, p) => sum + p.aportado, 0);
  const valorTotal = safePositions.reduce((sum, p) => sum + p.valor, 0);
  const ganancia = valorTotal - totalAportado;
  const rentabilidadTotal = totalAportado > 0 ? (ganancia / totalAportado) * 100 : 0;

  // Weighted annual return (calculated, not hardcoded)
  const rentAnualPonderada = valorTotal > 0
    ? safePositions.reduce((sum, p) => sum + p.rentAnual * (p.valor / valorTotal), 0)
    : 0;

  const proyData = useMemo(
    () => buildProyInv(horizon, valorTotal, totalAportado, rentAnualPonderada),
    [horizon, totalAportado, valorTotal, rentAnualPonderada],
  );

  // Best position: by annual return (not just capital gain)
  const best = safePositions.reduce((a, b) => (a.rentAnual > b.rentAnual ? a : b), safePositions[0]);

  // Most stable position: fixed-income types first, then lowest |rentPct| variance
  const tiposRentaFija = ['prestamo_p2p', 'deposito_plazo', 'deposito', 'cuenta_remunerada'];
  const posicionEstable = (() => {
    const fijas = safePositions.filter(p => tiposRentaFija.includes(p.tipo));
    if (fijas.length) return fijas.reduce((a, b) => (a.rentAnual > b.rentAnual ? a : b));
    // Fallback: position with lowest absolute volatility proxy (smallest |rentPct - rentAnual|)
    return safePositions.reduce((a, b) =>
      Math.abs(a.rentPct - a.rentAnual) <= Math.abs(b.rentPct - b.rentAnual) ? a : b
    );
  })();

  // Calculated multiple
  const multiplo = totalAportado > 0 ? (valorTotal / totalAportado) : 0;

  return (
    <div>
      {/* Hero banner */}
      <div style={{ background: `linear-gradient(135deg, ${C.blue} 0%, #0D4A8A 100%)`, borderRadius: 12, padding: '20px 24px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', opacity: .7, marginBottom: 6 }}>Mejor posición · {best.alias}</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 38, fontWeight: 600, lineHeight: 1, marginBottom: 4 }}>{fmtPct(best.rentAnual)}</div>
          <div style={{ fontSize: 13, opacity: .75 }}>Rentabilidad anual · {best.broker} · {best.tipo}</div>
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
          { label: 'Rentabilidad anualizada', val: fmtPct(rentAnualPonderada), meta: '/ año · media ponderada' },
          { label: 'Mejor posición', val: `${best.alias} ${fmtPct(best.rentAnual)}`, meta: `${best.rentAnual.toFixed(2)}% / año · ${best.broker}` },
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
          sub={`Valor proyectado a ${fmtPct(rentAnualPonderada)}/año`}
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
          <ResultRow label="Mejor posición" value={best.alias} />
          <ResultRow label="Posición más estable" value={posicionEstable.alias} />
          <div style={{ height: 1, background: C.n300, margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.n700 }}>Múltiplo sobre capital</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 20, fontWeight: 600, color: C.blue }}>
              {totalAportado > 0 ? `× ${multiplo.toFixed(2).replace('.', ',')}` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Planes de pensión summary */}
      {planesPension.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginTop: 20 }}>
          {(() => {
            const totalPensionAportado = planesPension.reduce((sum, p) => sum + (p.aportacionesRealizadas || 0), 0);
            const totalPensionValor = planesPension.reduce((sum, p) => sum + ((p.unidades ? p.unidades * p.valorActual : p.valorActual) || 0), 0);
            const pensionGP = totalPensionValor - totalPensionAportado;
            return [
              { label: 'Planes de pensión acum.', val: fmt(totalPensionAportado), meta: `${planesPension.length} plan${planesPension.length > 1 ? 'es' : ''}` },
              { label: 'Valor actual pensiones', val: totalPensionValor > 0 ? fmt(totalPensionValor) : 'Sin actualizar', meta: 'Último valor conocido' },
              { label: 'Plusvalía / Minusvalía', val: `${pensionGP >= 0 ? '+' : ''}${fmt(pensionGP)}`, meta: 'Sobre aportaciones realizadas' },
            ];
          })().map(k => (
            <div key={k.label} style={{ background: '#fff', border: `1px solid ${C.n300}`, borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: C.n500, marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 600, color: C.blue, lineHeight: 1, marginBottom: 4 }}>{k.val}</div>
              <div style={{ fontSize: 12, color: C.n500 }}>{k.meta}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Cartera ─────────────────────────────────────────────────────────────

function TabCartera({
  onSelectPosition,
  onViewAportaciones,
  onNewPosition,
  onEditPosition,
  positions,
  closedPositions,
  planesPension,
}: {
  onSelectPosition: (id: string) => void;
  onViewAportaciones: (id: string) => void;
  onNewPosition: () => void;
  onEditPosition: (id: string) => void;
  positions: PositionRow[];
  closedPositions: PosicionInversion[];
  planesPension: PlanPensionInversion[];
}) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<keyof PositionRow>('alias');
  const [sortAsc, setSortAsc] = useState(true);
  const [showClosed, setShowClosed] = useState(false);
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

      {filtered.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', color: C.n500, borderBottom: `1px solid ${C.n100}` }}>
          No hay posiciones para mostrar.
        </div>
      )}

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
                    <button onClick={e => { e.stopPropagation(); onViewAportaciones(p.id); }} title="Ver historial aportaciones" aria-label={`Ver historial de ${p.alias}`} style={{ width: 28, height: 28, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.n500 }}><Eye size={14} /></button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onViewAportaciones(p.id);
                      }}
                      title="Gestionar aportaciones"
                      aria-label={`Gestionar aportaciones de ${p.alias}`}
                      style={{ width: 28, height: 28, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.n500 }}
                    ><MoreHorizontal size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Planes de pensión */}
      {planesPension.length > 0 && (
        <div style={{ background: '#fff', border: `1px solid ${C.n300}`, borderRadius: 12, overflow: 'hidden', marginTop: 20 }}>
          <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.n100}`, fontSize: 15, fontWeight: 700, color: C.n700 }}>
            Planes de pensión e inversión
          </div>
          <div style={{ padding: '8px 20px', fontSize: 11, color: C.n500, borderBottom: `1px solid ${C.n100}` }}>
            {planesPension.length} plan{planesPension.length > 1 ? 'es' : ''}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Nombre', 'Entidad', 'Tipo', 'Aportado acum.', 'Valor actual', 'Titularidad'].map(col => (
                  <th key={col} style={{ padding: '9px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.n500, background: C.n50, borderBottom: `1px solid ${C.n200}`, textAlign: col.startsWith('Aportado') || col.startsWith('Valor') ? 'right' : 'left' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {planesPension.map((plan, i) => (
                <tr key={plan.id ?? i} style={{ borderBottom: i < planesPension.length - 1 ? `1px solid ${C.n100}` : 'none' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: C.n700, fontSize: 13 }}>
                    {plan.nombre}
                    {plan.esHistorico && <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: C.n100, color: C.n500 }}>Histórico</span>}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: C.n500 }}>{plan.entidad || '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: C.n500 }}>{plan.tipo}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>{fmt(plan.aportacionesRealizadas || 0)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
                    {plan.valorActual > 0 ? fmt(plan.unidades ? plan.unidades * plan.valorActual : plan.valorActual) : <span style={{ color: C.n500, fontSize: 11 }}>Sin actualizar</span>}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: C.n500 }}>{plan.titularidad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Posiciones cerradas */}
      {closedPositions.length > 0 && (
        <div style={{ background: '#fff', border: `1px solid ${C.n300}`, borderRadius: 12, overflow: 'hidden', marginTop: 20 }}>
          <button
            onClick={() => setShowClosed(!showClosed)}
            style={{ width: '100%', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', borderBottom: showClosed ? `1px solid ${C.n100}` : 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <Archive size={14} color={C.n500} />
            <span style={{ fontSize: 14, fontWeight: 600, color: C.n700 }}>Posiciones cerradas</span>
            <span style={{ fontSize: 12, color: C.n500, marginLeft: 4 }}>({closedPositions.length})</span>
            <ChevronRight size={14} color={C.n500} style={{ marginLeft: 'auto', transform: showClosed ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }} />
          </button>
          {showClosed && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Posición', 'Tipo', 'Aportado', 'Último valor', 'G/P'].map(col => (
                    <th key={col} style={{ padding: '9px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.n500, background: C.n50, borderBottom: `1px solid ${C.n200}`, textAlign: col === 'Posición' || col === 'Tipo' ? 'left' : 'right' }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {closedPositions.map((p, i) => {
                  const gp = p.valor_actual - p.total_aportado;
                  return (
                    <tr key={p.id} style={{ borderBottom: i < closedPositions.length - 1 ? `1px solid ${C.n100}` : 'none' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: C.n700, fontSize: 13 }}>{p.nombre}</div>
                        <div style={{ fontSize: 11, color: C.n500, marginTop: 1 }}>{p.entidad}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: C.n500 }}>{p.tipo}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>{fmt(p.total_aportado)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>{fmt(p.valor_actual)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: gp >= 0 ? C.pos : C.neg, fontWeight: 600 }}>
                        {gp >= 0 ? '+' : ''}{fmt(gp)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Rendimientos ────────────────────────────────────────────────────────

function TabRendimientos({ positions }: { positions: PositionRow[] }) {
  const evolucionInv = useMemo(() => buildEvolucionInversiones(positions), [positions]);
  const donutData = positions.map(p => ({ name: p.alias, value: p.valor }));
  const donutColors = positions.map(p => p.color);
  const rentData = positions.map(p => ({ name: p.alias, rentPct: p.rentPct, rentAnual: p.rentAnual }));

  // Dynamic subtitle from actual chart data range
  const evolYears = evolucionInv.map(d => d.year);
  const evolSub = evolYears.length > 1
    ? `Valor total vs capital aportado · ${evolYears[0]}–${evolYears[evolYears.length - 1]}`
    : 'Valor total vs capital aportado';

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <ChartCard title="Evolución del portfolio" sub={evolSub}>
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
    id: 'empty', alias: 'Sin datos', broker: '-', tipo: '-', aportado: 0, valor: 0,
    rentPct: 0, rentAnual: 0, peso: 0, color: C.blue, tag: null,
    fechaCompra: null, duracionMeses: null,
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
          { label: 'Hoy', val: fmt(pos.valor), sub: `Valor estimado · ${new Date().toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}`, cls: 'present' },
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
  const [activeTab, setActiveTab] = useState<Tab>('cartera');
  const [selectedPositionId, setSelectedPositionId] = useState('');
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [closedPositions, setClosedPositions] = useState<PosicionInversion[]>([]);
  const [planesPension, setPlanesPension] = useState<PlanPensionInversion[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showAportacionForm, setShowAportacionForm] = useState(false);
  const [editingPosicion, setEditingPosicion] = useState<PosicionInversion | undefined>();
  const [detailPosicion, setDetailPosicion] = useState<PosicionInversion | undefined>();
  const [editingAportacion, setEditingAportacion] = useState<Aportacion | undefined>();

  const mapPosicionesToRows = (data: PosicionInversion[]) => {
    const colorPalette = [C.blue, C.c2, C.teal, C.c4, C.c5];
    if (!data.length) return [] as PositionRow[];

    const totalValor = data.reduce((sum, p) => sum + p.valor_actual, 0);
    const mapped: PositionRow[] = data.map((p: PosicionInversion, index) => {
      const rentabilidadAnual = resolveAnnualReturn(p);
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
        fechaCompra: p.fecha_compra || p.created_at || null,
        duracionMeses: p.duracion_meses ?? null,
      };
    });

    const bestIdx = mapped.reduce((best, item, index, arr) => (item.rentAnual > arr[best].rentAnual ? index : best), 0);
    mapped[bestIdx] = { ...mapped[bestIdx], tag: 'Top performer' };
    return mapped;
  };

  const refreshPosiciones = useCallback(async () => {
    const { activas, cerradas } = await inversionesService.getAllPosiciones();
    const mapped = mapPosicionesToRows(activas);
    setPositions(mapped);
    setClosedPositions(cerradas);
    if (mapped.length && !mapped.some((p) => p.id === selectedPositionId)) {
      setSelectedPositionId(mapped[0].id);
    }
    // Load pension plans (personalDataId=1 as default)
    try {
      const planes = await planesInversionService.getPlanes(1);
      setPlanesPension(planes);
    } catch {
      setPlanesPension([]);
    }
  }, [selectedPositionId]);

  useEffect(() => {
    const loadPosiciones = async () => {
      try {
        await refreshPosiciones();
      } catch (error) {
        console.error('Error cargando posiciones de inversiones:', error);
      }
    };

    loadPosiciones();
  }, [refreshPosiciones]);

  const handleSelectPosition = (id: string) => {
    setSelectedPositionId(id);
    setActiveTab('individual');
  };

  const handleNewPosition = () => {
    setEditingPosicion(undefined);
    setShowForm(true);
  };

  const handleEditPosition = async (id: string) => {
    try {
      const posicion = await inversionesService.getPosicion(Number(id));
      if (!posicion) {
        toast.error('No se ha encontrado la posición para editar');
        return;
      }
      setEditingPosicion(posicion);
      setShowForm(true);
    } catch (error) {
      console.error('Error cargando la posición para editar:', error);
      toast.error('Error al abrir la edición');
    }
  };

  const handleViewAportaciones = async (id: string) => {
    try {
      const posicion = await inversionesService.getPosicion(Number(id));
      if (!posicion) {
        toast.error('No se ha encontrado la posición');
        return;
      }
      setDetailPosicion(posicion);
      setShowDetail(true);
    } catch (error) {
      console.error('Error cargando detalle de posición:', error);
      toast.error('Error al abrir el detalle de aportaciones');
    }
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

  const refreshDetailPosicion = async () => {
    if (!detailPosicion) return;
    const updated = await inversionesService.getPosicion(detailPosicion.id);
    setDetailPosicion(updated);
  };

  const handleSaveAportacion = async (aportacion: Omit<Aportacion, 'id'>) => {
    if (!detailPosicion) return;
    try {
      if (editingAportacion) {
        await inversionesService.updateAportacion(detailPosicion.id, editingAportacion.id, aportacion);
        toast.success('Movimiento actualizado correctamente');
      } else {
        await inversionesService.addAportacion(detailPosicion.id, aportacion);
        toast.success('Aportación añadida correctamente');
      }
      setShowAportacionForm(false);
      setEditingAportacion(undefined);
      await refreshPosiciones();
      await refreshDetailPosicion();
    } catch (error) {
      console.error('Error guardando aportación:', error);
      toast.error('Error al guardar el movimiento');
    }
  };

  const handleDeleteAportacion = async (aportacionId: number) => {
    if (!detailPosicion) return;
    await inversionesService.deleteAportacion(detailPosicion.id, aportacionId);
    await refreshPosiciones();
    await refreshDetailPosicion();
  };


  return (
    <div style={{ minHeight: '100vh', background: C.n50, fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>

      <div style={{ padding: 24 }}>
        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, paddingBottom: 20 }}>
          <TrendingUp size={20} color="#6C757D" style={{ flexShrink: 0, marginTop: 4 }} />
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: C.n700, letterSpacing: '-.02em', lineHeight: 1 }}>Portfolio de inversiones</div>
            <div style={{ fontSize: 13, color: C.n500, marginTop: 3 }}>Análisis de rendimiento y evolución de tus posiciones financieras</div>
          </div>
        </div>

        {/* Underline tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.n200}`, marginBottom: 20 }}>
          {TABS.map(t => {
            const on = activeTab === t.id;
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                padding: '10px 0',
                marginRight: 32,
                fontSize: 14,
                fontWeight: on ? 500 : 400,
                color: on ? '#1A2332' : '#6C757D',
                background: 'transparent',
                border: 'none',
                borderBottom: on ? '2px solid #042C5E' : '2px solid transparent',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}>{t.label}</button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === 'resumen'      && <TabResumen positions={positions} planesPension={planesPension} />}
        {activeTab === 'cartera'      && (
          <TabCartera
            onSelectPosition={handleSelectPosition}
            onViewAportaciones={handleViewAportaciones}
            onNewPosition={handleNewPosition}
            onEditPosition={handleEditPosition}
            positions={positions}
            closedPositions={closedPositions}
            planesPension={planesPension}
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

      {showDetail && detailPosicion && (
        <PosicionDetailModal
          posicion={detailPosicion}
          onClose={() => {
            setShowDetail(false);
            setDetailPosicion(undefined);
            setEditingAportacion(undefined);
          }}
          onAddAportacion={() => {
            setEditingAportacion(undefined);
            setShowAportacionForm(true);
          }}
          onEditAportacion={(aportacionId) => {
            const aportacion = detailPosicion.aportaciones.find((a) => a.id === aportacionId);
            if (!aportacion) return;
            setEditingAportacion(aportacion);
            setShowAportacionForm(true);
          }}
          onDeleteAportacion={handleDeleteAportacion}
          onActualizarValor={async () => {
            toast('Actualiza el valor desde editar posición por ahora.', { icon: 'ℹ️' });
          }}
          onEditarPosicion={() => {
            setShowDetail(false);
            setEditingPosicion(detailPosicion);
            setShowForm(true);
          }}
        />
      )}

      {showAportacionForm && detailPosicion && (
        <AportacionForm
          posicionNombre={detailPosicion.nombre}
          posicion={detailPosicion}
          initialAportacion={editingAportacion}
          onSave={handleSaveAportacion}
          onClose={() => {
            setShowAportacionForm(false);
            setEditingAportacion(undefined);
          }}
        />
      )}
    </div>
  );
}
