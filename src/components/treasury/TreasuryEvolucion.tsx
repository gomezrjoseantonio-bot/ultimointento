/**
 * TreasuryEvolucion.tsx
 *
 * Multi-year treasury historical overview — Personal / Inmuebles / Inversiones.
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
  type SaldoActual,
} from '../../services/treasuryOverviewService';
import { prestamosService } from '../../services/prestamosService';

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

interface KpiCardProps { label: string; value: string; sub?: string; }

const KpiCard: React.FC<KpiCardProps> = ({ label, value, sub }) => (
  <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--grey-400)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      {label}
    </div>
    <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', fontVariantNumeric: 'tabular-nums', color: 'var(--grey-900)', lineHeight: 1.2 }}>
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

  const [summaries, setSummaries]   = useState<TreasuryYearSummary[]>([]);
  const [saldo, setSaldo]           = useState<SaldoActual>({ cuentas: 0, inversiones: 0, total: 0 });
  const [prestamos, setPrestamos]   = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);

  const [expanded, setExpanded] = useState({
    personal:    false,
    inmuebles:   false,
    inversiones: false,
  });

  const toggle = (block: keyof typeof expanded) =>
    setExpanded((prev) => ({ ...prev, [block]: !prev[block] }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [data, s, ps] = await Promise.all([
          treasuryOverviewService.getTreasuryOverview(),
          treasuryOverviewService.getSaldoActual(),
          prestamosService.getAllPrestamos(),
        ]);
        if (!cancelled) { setSummaries(data); setSaldo(s); setPrestamos(ps as any[]); }
      } catch (err) {
        console.error('TreasuryEvolucion load error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Derived KPIs ─────────────────────────────────────────────────────────

  // KPI 1 — Gasto de vida: media mensual del gasto personal acumulado
  const gastoMensual = useMemo(() => {
    if (summaries.length === 0) return 0;
    const now       = new Date();
    const añoActual = now.getFullYear();
    const s0        = summaries[0];
    const mesesAño0 = s0.año < añoActual ? 12 : now.getMonth() + 1;
    return mesesAño0 > 0 ? s0.gastoPersonalEstimado / mesesAño0 : 0;
  }, [summaries]);

  // KPI 2 — Excedente mensual: (ingresos − cuotas − gasto personal) / meses del último año XML
  const excedentesMensual = useMemo(() => {
    if (summaries.length === 0) return null;
    const now      = new Date();
    const xmlYears = summaries.filter((s) => s.fuente === 'xml_aeat');
    if (xmlYears.length === 0) return null;
    const lastXml  = xmlYears[xmlYears.length - 1];
    const meses    = lastXml.año < now.getFullYear() ? 12 : now.getMonth() + 1;
    const cuotas   = lastXml.cuotasPrestamosPersonales + lastXml.cuotasHipotecas;
    return (lastXml.nominaNeta + lastXml.autonomoNeto - cuotas - lastXml.gastoPersonalEstimado) / meses;
  }, [summaries]);

  // KPI 3 — Patrimonio neto: saldo total − deuda viva de préstamos
  const patrimonioNeto = useMemo(() => {
    const deuda = prestamos.reduce((s: number, p: any) => s + (p.principalVivo ?? 0), 0);
    return saldo.total - deuda;
  }, [saldo.total, prestamos]);

  // KPI 4 — Tendencia: cambio relativo de variacionNeta entre los dos últimos años
  const tendencia = useMemo(() => {
    if (summaries.length < 2) return null;
    const recent = summaries[0].variacionNeta;
    const prior  = summaries[1].variacionNeta;
    if (prior === 0) return null;
    return (recent - prior) / Math.abs(prior) * 100;
  }, [summaries]);

  // ── Chart ─────────────────────────────────────────────────────────────────

  const chartData = useMemo(() => ({
    labels: summaries.map((y) => String(y.año)),
    datasets: [
      {
        type: 'bar' as const,
        label: 'Personal',
        data: summaries.map((s) => s.subtotalPersonal),
        backgroundColor: cssVar('--navy-900', '#042C5E'),
        barPercentage: 0.55,
        categoryPercentage: 0.7,
        order: 2,
        yAxisID: 'y',
      },
      {
        type: 'bar' as const,
        label: 'Inmuebles',
        data: summaries.map((s) => s.subtotalInmuebles),
        backgroundColor: cssVar('--grey-300', '#C8D0DC'),
        barPercentage: 0.55,
        categoryPercentage: 0.7,
        order: 2,
        yAxisID: 'y',
      },
      {
        type: 'bar' as const,
        label: 'Inversiones',
        data: summaries.map((s) => s.subtotalInversiones),
        backgroundColor: cssVar('--teal-200', '#A7E9F0'),
        barPercentage: 0.55,
        categoryPercentage: 0.7,
        order: 2,
        yAxisID: 'y',
      },
      {
        type: 'line' as const,
        label: 'Gasto personal estimado',
        data: summaries.map((s) => -s.gastoPersonalEstimado),
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
        stacked: false,
        grid: { display: false },
        ticks: { font: { family: "'IBM Plex Sans', system-ui, sans-serif", size: 11 }, color: 'var(--grey-500)' },
      },
      y: {
        stacked: false,
        grid: { color: (ctx: any) => ctx.tick.value === 0 ? 'rgba(0,0,0,0.15)' : 'transparent' },
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

  // ── Cell renderers ────────────────────────────────────────────────────────

  // Absolute value cell (0 = "—")
  const fmtCell = (v: number): React.ReactNode => (
    v === 0
      ? <span style={{ color: 'var(--grey-400)', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>—</span>
      : <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: 'var(--grey-900)' }}>{fmtEur(Math.abs(v))}</span>
  );

  // Outflow cell — shown with minus sign (0 = "—")
  const fmtSalida = (v: number): React.ReactNode => (
    v === 0
      ? <span style={{ color: 'var(--grey-400)', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>—</span>
      : <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: 'var(--navy-900)' }}>{fmtSign(-v)}</span>
  );

  // IRPF cell — devolución positive (+), pago negative (−)
  const fmtIrpf = (dev: number, pago: number): React.ReactNode => {
    if (dev > 0)  return <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: 'var(--grey-900)' }}>{fmtSign(dev)}</span>;
    if (pago > 0) return <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: 'var(--navy-900)' }}>{fmtSign(-pago)}</span>;
    return <span style={{ color: 'var(--grey-400)', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>—</span>;
  };

  // Subtotal bold cell
  const fmtSubtotal = (v: number): React.ReactNode => (
    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 700, color: v < 0 ? 'var(--navy-900)' : 'var(--grey-900)' }}>
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

  // ── Table style helpers ────────────────────────────────────────────────────

  const tdBase: React.CSSProperties = {
    padding: '6px 12px',
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
  const tdDetailLabel: React.CSSProperties = {
    ...tdLabel,
    paddingLeft: 28,
    fontSize: 12,
    color: 'var(--grey-600)',
  };
  const tdDetailBase: React.CSSProperties = {
    ...tdBase,
    fontSize: 12,
  };
  const tdToggleBase: React.CSSProperties = {
    padding: '8px 12px',
    textAlign: 'right',
    whiteSpace: 'nowrap',
    borderTop: '1px solid var(--grey-300)',
    borderBottom: '2px solid var(--grey-200)',
    background: 'var(--grey-50)',
    cursor: 'pointer',
    userSelect: 'none',
  };
  const tdToggleLabel: React.CSSProperties = {
    ...tdToggleBase,
    textAlign: 'left',
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--grey-800)',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
  };

  const BlockSeparator: React.FC = () => (
    <tr>
      <td colSpan={summaries.length + 1} style={{ height: 4, background: 'var(--grey-50)', borderBottom: '1px solid var(--grey-100)' }} />
    </tr>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>

      {/* KPI GRID — 4 cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', border: '1px solid var(--grey-200)', borderRadius: 8, background: '#fff', overflow: 'hidden' }}>
        {[
          {
            label: 'Gasto de vida',
            value: gastoMensual > 0 ? fmtEur(Math.round(gastoMensual)) + '/mes' : '—',
            sub: 'Media mensual acumulada',
          },
          {
            label: 'Excedente mensual',
            value: excedentesMensual !== null ? fmtEur(Math.round(excedentesMensual)) + '/mes' : '—',
            sub: excedentesMensual !== null
              ? excedentesMensual >= 0 ? 'Ingresos − cuotas − gasto personal' : 'Déficit mensual estimado'
              : 'Importa XML AEAT para calcular',
          },
          {
            label: 'Patrimonio neto',
            value: fmtEur(Math.round(patrimonioNeto)),
            sub: saldo.cuentas === 0 ? 'Introduce saldo en cuentas' : 'Activos − deuda viva',
          },
          {
            label: 'Tendencia',
            value: tendencia !== null ? (tendencia >= 0 ? '+' : '') + tendencia.toFixed(0) + '%' : '—',
            sub: tendencia !== null ? 'Variación neta vs año anterior' : 'Necesita al menos 2 años',
          },
        ].map((kpi, i) => (
          <div key={i} style={{ borderRight: i < 3 ? '1px solid var(--grey-200)' : 'none' }}>
            <KpiCard label={kpi.label} value={kpi.value} sub={kpi.sub} />
          </div>
        ))}
      </div>

      {/* CHART */}
      <div style={{ background: '#fff', border: '1px solid var(--grey-200)', borderRadius: 8, padding: '16px 20px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 12 }}>
          {[
            { color: 'var(--navy-900)', label: 'Personal', bar: true },
            { color: 'var(--grey-300)', label: 'Inmuebles', bar: true },
            { color: 'var(--teal-200)', label: 'Inversiones', bar: true },
            { color: 'var(--teal-600)', label: 'Gasto personal estimado', bar: false },
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

      {/* TABLE — Personal / Inmuebles / Inversiones (colapsable) */}
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

            {/* ── PERSONAL ──────────────────────────────────────────────── */}

            <tr
              role="button"
              tabIndex={0}
              aria-expanded={expanded.personal}
              onClick={() => toggle('personal')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle('personal'); } }}
              style={{ cursor: 'pointer' }}
            >
              <td style={tdToggleLabel}>
                <span style={{ display: 'inline-block', width: 16, marginRight: 4, fontSize: 10, verticalAlign: 'middle' }}>
                  {expanded.personal ? '▾' : '▸'}
                </span>
                Personal
              </td>
              {summaries.map((s) => (
                <td key={s.año} style={tdToggleBase}>
                  {fmtSubtotal(s.subtotalPersonal - s.gastoPersonalEstimado - s.gastoPersonalReal)}
                </td>
              ))}
            </tr>

            {expanded.personal && (
              <>
                <tr>
                  <td style={tdDetailLabel}>Nómina neta</td>
                  {summaries.map((s) => <td key={s.año} style={tdDetailBase}>{fmtCell(s.nominaNeta)}</td>)}
                </tr>
                <tr>
                  <td style={tdDetailLabel}>Autónomo neto</td>
                  {summaries.map((s) => <td key={s.año} style={tdDetailBase}>{fmtCell(s.autonomoNeto)}</td>)}
                </tr>
                <tr>
                  <td style={tdDetailLabel}>Devol. / Pago IRPF</td>
                  {summaries.map((s) => (
                    <td key={s.año} style={tdDetailBase}>{fmtIrpf(s.devolucionIrpf, s.pagoIrpf)}</td>
                  ))}
                </tr>
                <tr>
                  <td style={tdDetailLabel}>Préstamos recibidos</td>
                  {summaries.map((s) => <td key={s.año} style={tdDetailBase}>{fmtCell(s.prestamosPersonalesRecibidos)}</td>)}
                </tr>
                <tr>
                  <td style={tdDetailLabel}>Cuotas préstamos</td>
                  {summaries.map((s) => <td key={s.año} style={tdDetailBase}>{fmtSalida(s.cuotasPrestamosPersonales)}</td>)}
                </tr>
                {/* Gasto personal — inside Personal block */}
                <tr>
                  <td style={{ ...tdDetailLabel, fontStyle: 'italic', color: 'var(--grey-400)' }}>
                    Gasto personal est.
                  </td>
                  {summaries.map((s) => (
                    <td key={s.año} style={tdDetailBase}>
                      {s.gastoPersonalEstimado === 0
                        ? <span style={{ color: 'var(--grey-400)', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>—</span>
                        : <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontVariantNumeric: 'tabular-nums', fontSize: 12, fontStyle: 'italic', color: 'var(--grey-400)' }}>
                            {fmtSign(-s.gastoPersonalEstimado)}
                          </span>
                      }
                    </td>
                  ))}
                </tr>
                {summaries.some((s) => s.gastoPersonalReal > 0) && (
                  <tr>
                    <td style={{ ...tdDetailLabel, color: 'var(--grey-500)' }}>
                      Gasto personal real
                    </td>
                    {summaries.map((s) => (
                      <td key={s.año} style={tdDetailBase}>
                        {s.gastoPersonalReal === 0
                          ? <span style={{ color: 'var(--grey-400)', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>—</span>
                          : <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: 'var(--navy-900)' }}>
                              {fmtSign(-s.gastoPersonalReal)}
                            </span>
                        }
                      </td>
                    ))}
                  </tr>
                )}
              </>
            )}

            <BlockSeparator />

            {/* ── INMUEBLES ─────────────────────────────────────────────── */}

            <tr
              role="button"
              tabIndex={0}
              aria-expanded={expanded.inmuebles}
              onClick={() => toggle('inmuebles')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle('inmuebles'); } }}
              style={{ cursor: 'pointer' }}
            >
              <td style={tdToggleLabel}>
                <span style={{ display: 'inline-block', width: 16, marginRight: 4, fontSize: 10, verticalAlign: 'middle' }}>
                  {expanded.inmuebles ? '▾' : '▸'}
                </span>
                Inmuebles
              </td>
              {summaries.map((s) => (
                <td key={s.año} style={tdToggleBase}>{fmtSubtotal(s.subtotalInmuebles)}</td>
              ))}
            </tr>

            {expanded.inmuebles && (
              <>
                <tr>
                  <td style={tdDetailLabel}>Rentas alquiler</td>
                  {summaries.map((s) => <td key={s.año} style={tdDetailBase}>{fmtCell(s.rentasAlquiler)}</td>)}
                </tr>
                <tr>
                  <td style={tdDetailLabel}>Gastos operativos</td>
                  {summaries.map((s) => <td key={s.año} style={tdDetailBase}>{fmtSalida(s.gastosInmuebles)}</td>)}
                </tr>
                <tr>
                  <td style={tdDetailLabel}>Compra inmuebles</td>
                  {summaries.map((s) => <td key={s.año} style={tdDetailBase}>{fmtSalida(s.compraInmuebles)}</td>)}
                </tr>
                <tr>
                  <td style={tdDetailLabel}>Venta inmuebles</td>
                  {summaries.map((s) => <td key={s.año} style={tdDetailBase}>{fmtCell(s.ventaInmuebles)}</td>)}
                </tr>
                <tr>
                  <td style={tdDetailLabel}>Hipotecas recibidas</td>
                  {summaries.map((s) => <td key={s.año} style={tdDetailBase}>{fmtCell(s.hipotecasRecibidas)}</td>)}
                </tr>
                <tr>
                  <td style={tdDetailLabel}>Cuotas hipotecas</td>
                  {summaries.map((s) => <td key={s.año} style={tdDetailBase}>{fmtSalida(s.cuotasHipotecas)}</td>)}
                </tr>
                <tr>
                  <td style={tdDetailLabel}>Mejoras / CAPEX</td>
                  {summaries.map((s) => <td key={s.año} style={tdDetailBase}>{fmtSalida(s.mejorasCapex)}</td>)}
                </tr>
                <tr>
                  <td style={tdDetailLabel}>Cancelaciones hipotecas</td>
                  {summaries.map((s) => <td key={s.año} style={tdDetailBase}>{fmtSalida(s.cancelacionesHipotecas)}</td>)}
                </tr>
              </>
            )}

            <BlockSeparator />

            {/* ── INVERSIONES ───────────────────────────────────────────── */}

            <tr
              role="button"
              tabIndex={0}
              aria-expanded={expanded.inversiones}
              onClick={() => toggle('inversiones')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle('inversiones'); } }}
              style={{ cursor: 'pointer' }}
            >
              <td style={tdToggleLabel}>
                <span style={{ display: 'inline-block', width: 16, marginRight: 4, fontSize: 10, verticalAlign: 'middle' }}>
                  {expanded.inversiones ? '▾' : '▸'}
                </span>
                Inversiones
              </td>
              {summaries.map((s) => (
                <td key={s.año} style={tdToggleBase}>{fmtSubtotal(s.subtotalInversiones)}</td>
              ))}
            </tr>

            {expanded.inversiones && (
              <>
                <tr>
                  <td style={tdDetailLabel}>Capital mobiliario</td>
                  {summaries.map((s) => <td key={s.año} style={tdDetailBase}>{fmtCell(s.capitalMobiliario)}</td>)}
                </tr>
                <tr>
                  <td style={tdDetailLabel}>Aportaciones</td>
                  {summaries.map((s) => <td key={s.año} style={tdDetailBase}>{fmtSalida(s.aportacionesInversiones)}</td>)}
                </tr>
                <tr>
                  <td style={tdDetailLabel}>Recuperaciones</td>
                  {summaries.map((s) => <td key={s.año} style={tdDetailBase}>{fmtCell(s.recuperacionInversiones)}</td>)}
                </tr>
              </>
            )}

            {/* ── VARIACIÓN NETA ────────────────────────────────────────── */}
            <tr>
              <td colSpan={summaries.length + 1} style={{ height: 6, borderTop: '3px solid var(--grey-300)', background: 'var(--grey-50)' }} />
            </tr>

            {/* Variación neta */}
            <tr>
              <td style={{ ...tdLabel, fontWeight: 700, fontSize: 13, color: 'var(--grey-900)', paddingTop: 10, paddingBottom: 10, borderTop: '2px solid var(--grey-300)' }}>
                Variación neta
              </td>
              {summaries.map((s) => (
                <td key={s.año} style={{ ...tdBase, fontWeight: 700, paddingTop: 10, paddingBottom: 10, borderTop: '2px solid var(--grey-300)', borderBottom: 'none' }}>
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 700, color: 'var(--navy-900)' }}>
                    {fmtSign(s.variacionNeta)}
                  </span>
                </td>
              ))}
            </tr>

          </tbody>
        </table>

        <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--grey-400)', borderTop: '1px solid var(--grey-100)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontStyle: 'italic' }}>
          Amortización contable (0117) excluida. Gasto personal estimado = residuo acumulado distribuido como media mensual. Click en ▸ para ver detalle.
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
