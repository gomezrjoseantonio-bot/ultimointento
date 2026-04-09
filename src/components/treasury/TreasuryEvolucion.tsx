/**
 * TreasuryEvolucion.tsx
 *
 * Multi-year treasury historical overview — 3-block cash-flow table.
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

// Total inflows across all blocks (for chart)
const calcTotalInflows = (s: TreasuryYearSummary): number =>
  s.nominaNeta + s.autonomoNeto + s.rentasAlquiler + s.capitalMobiliario + s.devolucionIrpf
  + s.ventaInmuebles + s.recuperacionInversiones
  + s.hipotecasRecibidas + s.prestamosRecibidos;

// Total known outflows (excl. gastos personales, for chart)
const calcTotalOutflows = (s: TreasuryYearSummary): number =>
  s.gastosInmuebles + s.pagoIrpf
  + s.compraInmuebles + s.mejorasCapex + s.aportacionesInversiones
  + s.cuotasPrestamos + s.cancelacionesPrestamos;

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

  const totalGastosPersonales = summaries.reduce((s, y) => s + y.gastosPersonales, 0);
  const añosCargados = summaries.filter((y) => y.fuente === 'xml_aeat').length;

  const chartData = useMemo(() => ({
    labels: summaries.map((y) => String(y.año)),
    datasets: [
      {
        type: 'bar' as const,
        label: 'Entradas',
        data: summaries.map(calcTotalInflows),
        backgroundColor: cssVar('--navy-900', '#042C5E'),
        barPercentage: 0.6,
        categoryPercentage: 0.7,
        order: 2,
        yAxisID: 'y',
      },
      {
        type: 'bar' as const,
        label: 'Salidas conocidas',
        data: summaries.map(calcTotalOutflows),
        backgroundColor: cssVar('--grey-300', '#C8D0DC'),
        barPercentage: 0.6,
        categoryPercentage: 0.7,
        order: 2,
        yAxisID: 'y',
      },
      {
        type: 'line' as const,
        label: 'Gastos personales',
        data: summaries.map((y) => y.gastosPersonales),
        borderColor: cssVar('--teal-600', '#1DA0BA'),
        backgroundColor: cssVar('--teal-600', '#1DA0BA'),
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.3,
        borderWidth: 2,
        order: 1,
        yAxisID: 'y',
        fill: false,
      },
    ],
  }), [summaries]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx: any) => `${ctx.dataset.label}: ${fmtEur(ctx.parsed?.y ?? 0)}` } },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { family: "'IBM Plex Sans', system-ui, sans-serif", size: 11 }, color: 'var(--grey-500)' },
      },
      y: {
        grid: { color: 'var(--grey-100)' },
        ticks: { font: { family: 'IBM Plex Mono, monospace', size: 10 }, color: 'var(--grey-500)', callback: (v: any) => fmtK(v) },
      },
    },
  }), []);

  const getBadge = (s: TreasuryYearSummary): React.ReactNode => {
    if (s.fuente === 'xml_aeat') return <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 10, background: 'var(--navy-100)', color: 'var(--navy-900)', letterSpacing: '.03em', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>xml</span>;
    if (s.fuente === 'atlas_nativo') return <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 10, background: 'var(--teal-100)', color: 'var(--teal-700)', letterSpacing: '.03em', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>atlas</span>;
    if (s.año === CURRENT_YEAR) return <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 10, background: 'var(--teal-100)', color: 'var(--teal-600)', letterSpacing: '.03em', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>en curso</span>;
    return <span style={{ color: 'var(--grey-400)', fontSize: 12 }}>—</span>;
  };

  // Render a simple numeric cell (absolute value, 0 = "—")
  const fmtCell = (v: number): React.ReactNode => (
    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: 'var(--grey-900)' }}>
      {v === 0 ? '—' : fmtEur(Math.abs(v))}
    </span>
  );

  // Render a signed cell with explicit +/- (0 = "—")
  const fmtSigned = (v: number, opts?: { dim?: boolean }): React.ReactNode => {
    if (v === 0) return <span style={{ color: 'var(--grey-400)', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>—</span>;
    const color = opts?.dim ? 'var(--grey-400)' : v < 0 ? 'var(--teal-600)' : 'var(--grey-900)';
    return (
      <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontVariantNumeric: 'tabular-nums', fontSize: 12, color }}>
        {fmtSign(v)}
      </span>
    );
  };

  // Render a subtotal cell (bold, separator style)
  const fmtSubtotal = (v: number): React.ReactNode => (
    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 600, color: v < 0 ? 'var(--teal-600)' : 'var(--grey-900)' }}>
      {v === 0 ? '—' : fmtSign(v)}
    </span>
  );

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

  // ── Table style helpers ──────────────────────────────────────────────────────

  const tdBase: React.CSSProperties = {
    padding: '7px 12px',
    textAlign: 'right',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--grey-100)',
  };
  const tdLabel: React.CSSProperties = {
    ...tdBase,
    textAlign: 'left',
    fontSize: 13,
    color: 'var(--grey-700)',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
  };
  const tdSubtotalBase: React.CSSProperties = {
    padding: '8px 12px',
    textAlign: 'right',
    whiteSpace: 'nowrap',
    borderTop: '1px solid var(--grey-300)',
    borderBottom: '2px solid var(--grey-200)',
    background: 'var(--grey-50)',
  };
  const tdSubtotalLabel: React.CSSProperties = {
    ...tdSubtotalBase,
    textAlign: 'left',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--grey-700)',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
  };

  const SectionHeader: React.FC<{ children: string }> = ({ children }) => (
    <tr>
      <td
        colSpan={summaries.length + 1}
        style={{
          padding: '10px 12px 4px',
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '.07em',
          color: 'var(--grey-500)',
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          background: 'var(--grey-50)',
          borderTop: '2px solid var(--grey-200)',
        }}
      >
        {children}
      </td>
    </tr>
  );

  // Separator row between blocks
  const BlockSeparator: React.FC = () => (
    <tr>
      <td colSpan={summaries.length + 1} style={{ height: 4, background: 'var(--grey-50)', borderBottom: '1px solid var(--grey-100)' }} />
    </tr>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>

      {/* KPI GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', border: '1px solid var(--grey-200)', borderRadius: 8, background: '#fff', overflow: 'hidden' }}>
        {[
          { label: 'Gastos personales acumulados', value: fmtEur(totalGastosPersonales), sub: `${summaries.length} años`, positive: true },
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
            { color: 'var(--navy-900)', label: 'Entradas', bar: true },
            { color: 'var(--grey-300)', label: 'Salidas conocidas', bar: true },
            { color: 'var(--teal-600)', label: 'Gastos personales', bar: false },
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

      {/* TABLE — 3 blocks */}
      <div style={{ background: '#fff', border: '1px solid var(--grey-200)', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--grey-200)', background: 'var(--grey-50)' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--grey-500)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", width: 200 }}>
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

            {/* ── BLOQUE 1: OPERATIVO ────────────────────────────────────── */}
            <SectionHeader>Operativo</SectionHeader>

            <tr>
              <td style={tdLabel}>Nómina neta</td>
              {summaries.map((s) => <td key={s.año} style={tdBase}>{fmtCell(s.nominaNeta)}</td>)}
            </tr>
            <tr>
              <td style={tdLabel}>Autónomo neto</td>
              {summaries.map((s) => <td key={s.año} style={tdBase}>{fmtCell(s.autonomoNeto)}</td>)}
            </tr>
            <tr>
              <td style={tdLabel}>Rentas alquiler</td>
              {summaries.map((s) => <td key={s.año} style={tdBase}>{fmtCell(s.rentasAlquiler)}</td>)}
            </tr>
            <tr>
              <td style={tdLabel}>Capital mobiliario</td>
              {summaries.map((s) => <td key={s.año} style={tdBase}>{fmtCell(s.capitalMobiliario)}</td>)}
            </tr>
            <tr>
              <td style={tdLabel}>Devol. / Pago IRPF</td>
              {summaries.map((s) => (
                <td key={s.año} style={tdBase}>
                  {fmtSigned(s.devolucionIrpf > 0 ? s.devolucionIrpf : s.pagoIrpf > 0 ? -s.pagoIrpf : 0)}
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ ...tdLabel, color: 'var(--grey-500)' }}>Gastos inmuebles</td>
              {summaries.map((s) => (
                <td key={s.año} style={tdBase}>
                  {s.gastosInmuebles === 0
                    ? <span style={{ color: 'var(--grey-400)', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>—</span>
                    : <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: 'var(--teal-600)' }}>
                        {fmtSign(-s.gastosInmuebles)}
                      </span>
                  }
                </td>
              ))}
            </tr>

            {/* Subtotal operativo */}
            <tr>
              <td style={tdSubtotalLabel}>Subtotal operativo</td>
              {summaries.map((s) => <td key={s.año} style={tdSubtotalBase}>{fmtSubtotal(s.subtotalOperativo)}</td>)}
            </tr>

            <BlockSeparator />

            {/* ── BLOQUE 2: INVERSIÓN ───────────────────────────────────── */}
            <SectionHeader>Inversión</SectionHeader>

            <tr>
              <td style={{ ...tdLabel, color: 'var(--grey-500)' }}>Compra inmuebles</td>
              {summaries.map((s) => (
                <td key={s.año} style={tdBase}>
                  {s.compraInmuebles === 0
                    ? <span style={{ color: 'var(--grey-400)', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>—</span>
                    : <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: 'var(--teal-600)' }}>
                        {fmtSign(-s.compraInmuebles)}
                      </span>
                  }
                </td>
              ))}
            </tr>
            <tr>
              <td style={tdLabel}>Venta inmuebles</td>
              {summaries.map((s) => <td key={s.año} style={tdBase}>{fmtCell(s.ventaInmuebles)}</td>)}
            </tr>
            <tr>
              <td style={{ ...tdLabel, color: 'var(--grey-500)' }}>Mejoras / CAPEX</td>
              {summaries.map((s) => (
                <td key={s.año} style={tdBase}>
                  {s.mejorasCapex === 0
                    ? <span style={{ color: 'var(--grey-400)', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>—</span>
                    : <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: 'var(--teal-600)' }}>
                        {fmtSign(-s.mejorasCapex)}
                      </span>
                  }
                </td>
              ))}
            </tr>
            <tr>
              <td style={tdLabel}>Inversiones (neto)</td>
              {summaries.map((s) => (
                <td key={s.año} style={tdBase}>
                  {fmtSigned(s.recuperacionInversiones - s.aportacionesInversiones)}
                </td>
              ))}
            </tr>

            {/* Subtotal inversión */}
            <tr>
              <td style={tdSubtotalLabel}>Subtotal inversión</td>
              {summaries.map((s) => <td key={s.año} style={tdSubtotalBase}>{fmtSubtotal(s.subtotalInversion)}</td>)}
            </tr>

            <BlockSeparator />

            {/* ── BLOQUE 3: FINANCIACIÓN ───────────────────────────────── */}
            <SectionHeader>Financiación</SectionHeader>

            <tr>
              <td style={tdLabel}>Hipotecas recibidas</td>
              {summaries.map((s) => <td key={s.año} style={tdBase}>{fmtCell(s.hipotecasRecibidas)}</td>)}
            </tr>
            <tr>
              <td style={tdLabel}>Préstamos recibidos</td>
              {summaries.map((s) => <td key={s.año} style={tdBase}>{fmtCell(s.prestamosRecibidos)}</td>)}
            </tr>
            <tr>
              <td style={{ ...tdLabel, color: 'var(--grey-500)' }}>Cuotas préstamos</td>
              {summaries.map((s) => (
                <td key={s.año} style={tdBase}>
                  {s.cuotasPrestamos === 0
                    ? <span style={{ color: 'var(--grey-400)', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>—</span>
                    : <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: 'var(--teal-600)' }}>
                        {fmtSign(-s.cuotasPrestamos)}
                      </span>
                  }
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ ...tdLabel, color: 'var(--grey-500)' }}>Cancelaciones</td>
              {summaries.map((s) => (
                <td key={s.año} style={tdBase}>
                  {s.cancelacionesPrestamos === 0
                    ? <span style={{ color: 'var(--grey-400)', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>—</span>
                    : <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: 'var(--teal-600)' }}>
                        {fmtSign(-s.cancelacionesPrestamos)}
                      </span>
                  }
                </td>
              ))}
            </tr>

            {/* Subtotal financiación */}
            <tr>
              <td style={tdSubtotalLabel}>Subtotal financiación</td>
              {summaries.map((s) => <td key={s.año} style={tdSubtotalBase}>{fmtSubtotal(s.subtotalFinanciacion)}</td>)}
            </tr>

            {/* ── RESIDUO + CASHFLOW ───────────────────────────────────── */}
            <tr>
              <td
                colSpan={summaries.length + 1}
                style={{ height: 6, borderTop: '3px solid var(--grey-300)', background: 'var(--grey-50)' }}
              />
            </tr>

            {/* Gastos personales (residuo) */}
            <tr>
              <td style={{ ...tdLabel, fontStyle: 'italic', color: 'var(--grey-500)' }}>
                Gastos personales <span style={{ fontSize: 11 }}>(residuo)</span>
              </td>
              {summaries.map((s) => (
                <td key={s.año} style={{ ...tdBase, borderBottom: 'none' }}>
                  {s.gastosPersonales === 0
                    ? <span style={{ color: 'var(--grey-400)', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>—</span>
                    : <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontVariantNumeric: 'tabular-nums', fontSize: 12, fontStyle: 'italic', color: 'var(--grey-500)' }}>
                        {fmtSign(-s.gastosPersonales)}
                      </span>
                  }
                </td>
              ))}
            </tr>

            {/* Cashflow neto */}
            <tr>
              <td style={{ ...tdLabel, fontWeight: 600, fontSize: 13, color: 'var(--grey-900)', paddingTop: 10, paddingBottom: 10, borderTop: '1px solid var(--grey-200)' }}>
                Cashflow neto
              </td>
              {summaries.map((s) => (
                <td key={s.año} style={{ ...tdBase, fontWeight: 600, paddingTop: 10, paddingBottom: 10, borderTop: '1px solid var(--grey-200)', borderBottom: 'none' }}>
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 600, color: s.cashflowNeto >= 0 ? 'var(--navy-900)' : 'var(--teal-600)' }}>
                    {fmtSign(s.cashflowNeto)}
                  </span>
                </td>
              ))}
            </tr>

          </tbody>
        </table>

        <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--grey-400)', borderTop: '1px solid var(--grey-100)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontStyle: 'italic' }}>
          Amortización contable excluida de gastos inmuebles (no es salida de caja). Gastos personales = residuo del cuadre de flujos.
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
