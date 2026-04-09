/**
 * TreasuryEvolucion.tsx
 *
 * Multi-year treasury historical overview.
 * Exported in two forms:
 *  - TreasuryEvolucionContent  →  embeddable (no PageHeader), used as tab inside TesoreriaV4
 *  - TreasuryEvolucion         →  standalone page with PageHeader (kept for future use)
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, TrendingUp } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  LineController,
  BarController,
  Tooltip,
  Legend,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import PageHeader from '../shared/PageHeader';
import {
  treasuryOverviewService,
  type TreasuryYearSummary,
} from '../../services/treasuryOverviewService';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  LineController,
  BarController,
  Tooltip,
  Legend,
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtEur = (v: number): string =>
  v.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';

const fmtK = (v: number): string => (v / 1000).toFixed(0) + 'K €';

const fmtSign = (v: number): string =>
  (v >= 0 ? '+' : '') +
  v.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';

const cssVar = (name: string, fallback: string): string => {
  if (typeof window === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
};

const CURRENT_YEAR = new Date().getFullYear();

// ─── Sub-components ───────────────────────────────────────────────────────────

interface KpiCardProps { label: string; value: string; sub?: string; positive?: boolean; }

const KpiCard: React.FC<KpiCardProps> = ({ label, value, sub, positive }) => (
  <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--grey-400)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      {label}
    </div>
    <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', fontVariantNumeric: 'tabular-nums', color: positive === false ? 'var(--teal-600)' : 'var(--grey-900)', lineHeight: 1.2 }}>
      {value}
    </div>
    {sub && <div style={{ fontSize: 11, color: 'var(--grey-400)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>{sub}</div>}
  </div>
);

// ─── Content component (embeddable, no PageHeader) ────────────────────────────

export interface TreasuryEvolucionContentProps {
  /** Called when the user clicks the current year → switch to Flujo de caja tab */
  onGoToFlujo?: (año: number) => void;
}

export const TreasuryEvolucionContent: React.FC<TreasuryEvolucionContentProps> = ({ onGoToFlujo }) => {
  const navigate = useNavigate();
  const chartRef = useRef<any>(null);

  const [summaries, setSummaries] = useState<TreasuryYearSummary[]>([]);
  const [saldoActual, setSaldoActual] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [data, saldo] = await Promise.all([
          treasuryOverviewService.getTreasuryOverview(),
          treasuryOverviewService.getSaldoActual(),
        ]);
        if (!cancelled) { setSummaries(data); setSaldoActual(saldo); }
      } catch (err) {
        console.error('TreasuryEvolucion load error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const cashflowAcumulado = summaries.reduce((s, y) => s + y.cashflowNeto, 0);
  const añosCargados = summaries.filter((y) => y.fuente === 'xml_aeat').length;

  const chartData = useMemo(() => ({
    labels: summaries.map((y) => String(y.año)),
    datasets: [
      { type: 'bar' as const, label: 'Ingresos', data: summaries.map((y) => y.totalIngresos), backgroundColor: cssVar('--navy-900', '#042C5E'), barPercentage: 0.6, categoryPercentage: 0.7, order: 2, yAxisID: 'y' },
      { type: 'bar' as const, label: 'Gastos',   data: summaries.map((y) => y.totalGastos),   backgroundColor: cssVar('--grey-300', '#C8D0DC'), barPercentage: 0.6, categoryPercentage: 0.7, order: 2, yAxisID: 'y' },
      { type: 'line' as const, label: 'Cashflow neto', data: summaries.map((y) => y.cashflowNeto), borderColor: cssVar('--teal-600', '#1DA0BA'), backgroundColor: cssVar('--teal-600', '#1DA0BA'), pointRadius: 4, pointHoverRadius: 6, tension: 0.3, borderWidth: 2, order: 1, yAxisID: 'y', fill: false },
    ],
  }), [summaries]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: any) => `${ctx.dataset.label}: ${fmtEur(ctx.parsed?.y ?? 0)}` } } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { family: "'IBM Plex Sans', system-ui, sans-serif", size: 11 }, color: 'var(--grey-500)' } },
      y: { grid: { color: 'var(--grey-100)' }, ticks: { font: { family: 'IBM Plex Mono, monospace', size: 10 }, color: 'var(--grey-500)', callback: (v: any) => fmtK(v) } },
    },
  }), []);

  const getBadge = (s: TreasuryYearSummary): React.ReactNode => {
    if (s.fuente === 'xml_aeat') return <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 10, background: 'var(--navy-100)', color: 'var(--navy-900)', letterSpacing: '.03em', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>xml</span>;
    if (s.año === CURRENT_YEAR) return <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 10, background: 'var(--teal-100)', color: 'var(--teal-600)', letterSpacing: '.03em', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>en curso</span>;
    return <span style={{ color: 'var(--grey-400)', fontSize: 12 }}>—</span>;
  };

  const fmtCell = (v: number, opts?: { estimated?: boolean; signed?: boolean }): React.ReactNode => {
    const color = opts?.estimated ? 'var(--grey-400)' : opts?.signed && v < 0 ? 'var(--teal-600)' : 'var(--grey-900)';
    const text = opts?.signed ? fmtSign(v) : fmtEur(Math.abs(v));
    return <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontVariantNumeric: 'tabular-nums', fontSize: 12, color }}>{v === 0 && !opts?.signed ? '—' : text}</span>;
  };

  const handleYearClick = (año: number) => {
    if (onGoToFlujo) {
      onGoToFlujo(año);
    } else {
      navigate(`/tesoreria?año=${año}`);
    }
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--grey-400)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>Cargando datos…</div>;
  }

  if (summaries.length === 0) {
    return <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--grey-400)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>No hay datos de ejercicios fiscales. Importa tus declaraciones XML desde Fiscalidad.</div>;
  }

  const SectionLabel: React.FC<{ children: string }> = ({ children }) => (
    <td colSpan={summaries.length + 1} style={{ padding: '10px 12px 4px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--grey-500)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", background: 'var(--grey-50)' }}>
      {children}
    </td>
  );

  const tdStyle: React.CSSProperties = { padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid var(--grey-100)', whiteSpace: 'nowrap' };
  const tdLabelStyle: React.CSSProperties = { ...tdStyle, textAlign: 'left', fontSize: 13, color: 'var(--grey-700)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>

      {/* KPI GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', border: '1px solid var(--grey-200)', borderRadius: 8, background: '#fff', overflow: 'hidden' }}>
        {[
          { label: 'Cashflow acumulado', value: fmtSign(cashflowAcumulado), sub: `${summaries.length} años`, positive: cashflowAcumulado >= 0 },
          { label: 'Saldo actual', value: fmtEur(saldoActual), sub: 'Suma de cuentas', positive: true },
          { label: 'Años cargados', value: String(añosCargados), sub: 'Con XML AEAT', positive: true },
        ].map((kpi, i) => (
          <div key={i} style={{ borderRight: i < 2 ? '1px solid var(--grey-200)' : 'none' }}>
            <KpiCard label={kpi.label} value={kpi.value} sub={kpi.sub} positive={kpi.positive} />
          </div>
        ))}
      </div>

      {/* CHART */}
      <div style={{ background: '#fff', border: '1px solid var(--grey-200)', borderRadius: 8, padding: '16px 20px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 12 }}>
          {[
            { color: 'var(--navy-900)', label: 'Ingresos', bar: true },
            { color: 'var(--grey-300)', label: 'Gastos', bar: true },
            { color: 'var(--teal-600)', label: 'Cashflow neto', bar: false },
          ].map(({ color, label, bar }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {bar
                ? <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 2, background: color }} />
                : <span style={{ display: 'inline-block', width: 24, height: 2, borderRadius: 1, background: color, marginTop: 1 }} />}
              <span style={{ fontSize: 11, color: 'var(--grey-500)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>{label}</span>
            </div>
          ))}
        </div>
        <div style={{ height: 240 }}>
          <Chart ref={chartRef} type="bar" data={chartData as any} options={chartOptions as any} />
        </div>
      </div>

      {/* TABLE */}
      <div style={{ background: '#fff', border: '1px solid var(--grey-200)', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--grey-200)', background: 'var(--grey-50)' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--grey-500)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", width: 180 }}>
                Concepto
              </th>
              {summaries.map((s) => (
                <th key={s.año} style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                    {s.año === CURRENT_YEAR ? (
                      <button
                        type="button"
                        aria-label={`Ir al flujo de caja de ${s.año}`}
                        onClick={() => handleYearClick(s.año)}
                        style={{ fontSize: 13, fontWeight: 500, color: 'var(--navy-900)', cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontFamily: 'inherit', textAlign: 'right' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
                      >
                        {s.año}
                      </button>
                    ) : (
                      <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--grey-700)' }}>{s.año}</span>
                    )}
                    {getBadge(s)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr><SectionLabel>Ingresos</SectionLabel></tr>
            <tr><td style={tdLabelStyle}>Nómina neta</td>{summaries.map((s) => <td key={s.año} style={tdStyle}>{fmtCell(s.nominaNeta)}</td>)}</tr>
            <tr><td style={tdLabelStyle}>Autónomo neto</td>{summaries.map((s) => <td key={s.año} style={tdStyle}>{fmtCell(s.autonomoNeto)}</td>)}</tr>
            <tr><td style={tdLabelStyle}>Rentas alquiler</td>{summaries.map((s) => <td key={s.año} style={tdStyle}>{fmtCell(s.rentasAlquiler)}</td>)}</tr>
            <tr><td style={tdLabelStyle}>Devolución IRPF</td>{summaries.map((s) => <td key={s.año} style={tdStyle}>{fmtCell(s.devolucionIrpf)}</td>)}</tr>

            <tr><SectionLabel>Gastos</SectionLabel></tr>
            <tr><td style={tdLabelStyle}>Gastos inmuebles</td>{summaries.map((s) => <td key={s.año} style={tdStyle}>{fmtCell(s.gastosInmuebles)}</td>)}</tr>
            <tr><td style={tdLabelStyle}>Cuotas préstamos</td>{summaries.map((s) => <td key={s.año} style={tdStyle}>{fmtCell(s.cuotasPrestamos)}</td>)}</tr>
            <tr><td style={tdLabelStyle}>Pago IRPF</td>{summaries.map((s) => <td key={s.año} style={tdStyle}>{fmtCell(s.pagoIrpf)}</td>)}</tr>
            <tr>
              <td style={{ ...tdLabelStyle, color: 'var(--grey-400)' }}>Gastos personales est.</td>
              {summaries.map((s) => <td key={s.año} style={tdStyle}>{fmtCell(s.gastosPersonales, { estimated: true })}</td>)}
            </tr>

            <tr>
              <td style={{ ...tdLabelStyle, fontWeight: 600, color: 'var(--grey-900)', borderTop: '1.5px solid var(--grey-300)', paddingTop: 10 }}>Cashflow neto</td>
              {summaries.map((s) => (
                <td key={s.año} style={{ ...tdStyle, borderTop: '1.5px solid var(--grey-300)', paddingTop: 10, fontWeight: 600 }}>
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 600, color: s.cashflowNeto >= 0 ? 'var(--navy-900)' : 'var(--teal-600)' }}>
                    {fmtSign(s.cashflowNeto)}
                  </span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <div style={{ padding: '10px 12px', fontSize: 11, color: 'var(--grey-400)', borderTop: '1px solid var(--grey-100)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontStyle: 'italic' }}>
          * Gastos personales estimados. Amortización contable excluida de gastos inmuebles (no es salida de caja).
        </div>
      </div>
    </div>
  );
};

// ─── Standalone page (kept for potential direct-route use) ─────────────────────

const TreasuryEvolucion: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="tv4-page">
      <PageHeader
        icon={BarChart3}
        title="Tesorería"
        subtitle="Evolución histórica"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={14} strokeWidth={1.5} style={{ color: 'var(--grey-500)' }} />
            <span style={{ fontSize: 12, color: 'var(--grey-500)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>Vista multi-año</span>
          </div>
        }
      />
      <TreasuryEvolucionContent onGoToFlujo={(año) => navigate(`/tesoreria?año=${año}`)} />
    </div>
  );
};

export default TreasuryEvolucion;
