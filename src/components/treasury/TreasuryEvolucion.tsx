/**
 * TreasuryEvolucion.tsx
 *
 * Vista principal de Tesorería — evolución histórica multi-año.
 * Reads directly from source stores via treasuryOverviewService.
 * No dependency on treasuryEvents or historicalTreasuryService.
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

const fmtK = (v: number): string => {
  const k = v / 1000;
  return k.toFixed(0) + 'K €';
};

const fmtSign = (v: number): string =>
  (v >= 0 ? '+' : '') +
  v.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';

const cssVar = (name: string, fallback: string): string => {
  if (typeof window === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
};

const CURRENT_YEAR = new Date().getFullYear();

// ─── Sub-components ───────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, sub, positive }) => (
  <div
    style={{
      padding: '12px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
    }}
  >
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '.08em',
        textTransform: 'uppercase',
        color: 'var(--grey-400)',
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontSize: 18,
        fontWeight: 700,
        fontFamily: 'IBM Plex Mono, monospace',
        fontVariantNumeric: 'tabular-nums',
        color: positive === false ? 'var(--teal-600)' : 'var(--grey-900)',
        lineHeight: 1.2,
      }}
    >
      {value}
    </div>
    {sub && (
      <div style={{ fontSize: 11, color: 'var(--grey-400)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
        {sub}
      </div>
    )}
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const TreasuryEvolucion: React.FC = () => {
  const navigate = useNavigate();
  const chartRef = useRef<any>(null);

  const [summaries, setSummaries] = useState<TreasuryYearSummary[]>([]);
  const [saldoActual, setSaldoActual] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [data, saldo] = await Promise.all([
          treasuryOverviewService.getTreasuryOverview(),
          treasuryOverviewService.getSaldoActual(),
        ]);
        if (!cancelled) {
          setSummaries(data);
          setSaldoActual(saldo);
        }
      } catch (err) {
        console.error('TreasuryEvolucion load error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // ── Derived KPIs ──────────────────────────────────────────────────────────
  const cashflowAcumulado = summaries.reduce((s, y) => s + y.cashflowNeto, 0);
  const añosCargados = summaries.filter((y) => y.fuente === 'xml_aeat').length;

  // ── Chart data ────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const labels = summaries.map((y) => String(y.año));
    return {
      labels,
      datasets: [
        {
          type: 'bar' as const,
          label: 'Ingresos',
          data: summaries.map((y) => y.totalIngresos),
          backgroundColor: cssVar('--navy-900', '#042C5E'),
          barPercentage: 0.6,
          categoryPercentage: 0.7,
          order: 2,
          yAxisID: 'y',
        },
        {
          type: 'bar' as const,
          label: 'Gastos',
          data: summaries.map((y) => y.totalGastos),
          backgroundColor: cssVar('--grey-300', '#C8D0DC'),
          barPercentage: 0.6,
          categoryPercentage: 0.7,
          order: 2,
          yAxisID: 'y',
        },
        {
          type: 'line' as const,
          label: 'Cashflow neto',
          data: summaries.map((y) => y.cashflowNeto),
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
    };
  }, [summaries]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: any) => `${ctx.dataset.label}: ${fmtEur(ctx.parsed?.y ?? 0)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { family: "'IBM Plex Sans', system-ui, sans-serif", size: 11 },
            color: 'var(--grey-500)',
          },
        },
        y: {
          grid: { color: 'var(--grey-100)' },
          ticks: {
            font: { family: 'IBM Plex Mono, monospace', size: 10 },
            color: 'var(--grey-500)',
            callback: (v: any) => fmtK(v),
          },
        },
      },
    }),
    [],
  );

  // ── Column year badge ─────────────────────────────────────────────────────
  const getBadge = (s: TreasuryYearSummary): React.ReactNode => {
    if (s.fuente === 'xml_aeat') {
      return (
        <span
          style={{
            display: 'inline-block',
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: 10,
            background: 'var(--navy-100)',
            color: 'var(--navy-900)',
            letterSpacing: '.03em',
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          }}
        >
          xml
        </span>
      );
    }
    if (s.año === CURRENT_YEAR) {
      return (
        <span
          style={{
            display: 'inline-block',
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: 10,
            background: 'var(--teal-100)',
            color: 'var(--teal-600)',
            letterSpacing: '.03em',
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          }}
        >
          en curso
        </span>
      );
    }
    return (
      <span style={{ color: 'var(--grey-400)', fontSize: 12 }}>—</span>
    );
  };

  // ── Amount cell ───────────────────────────────────────────────────────────
  const fmtCell = (v: number, opts?: { dim?: boolean; estimated?: boolean; signed?: boolean }): React.ReactNode => {
    const color = opts?.estimated
      ? 'var(--grey-400)'
      : opts?.signed && v < 0
      ? 'var(--teal-600)'
      : 'var(--grey-900)';
    const text = opts?.signed ? fmtSign(v) : fmtEur(Math.abs(v));
    return (
      <span
        style={{
          fontFamily: 'IBM Plex Mono, monospace',
          fontVariantNumeric: 'tabular-nums',
          fontSize: 12,
          color,
        }}
      >
        {v === 0 && !opts?.signed ? '—' : text}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="tv4-page">
        <PageHeader icon={BarChart3} title="Tesorería" subtitle="Evolución histórica" />
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--grey-400)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
          Cargando datos…
        </div>
      </div>
    );
  }

  const hasData = summaries.length > 0;

  // ── Table section label ───────────────────────────────────────────────────
  const SectionLabel: React.FC<{ children: string }> = ({ children }) => (
    <td
      colSpan={summaries.length + 1}
      style={{
        padding: '10px 12px 4px',
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '.05em',
        color: 'var(--grey-500)',
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        background: 'var(--grey-50)',
      }}
    >
      {children}
    </td>
  );

  const tdStyle: React.CSSProperties = {
    padding: '8px 12px',
    textAlign: 'right',
    borderBottom: '1px solid var(--grey-100)',
    whiteSpace: 'nowrap',
  };

  const tdLabelStyle: React.CSSProperties = {
    ...tdStyle,
    textAlign: 'left',
    fontSize: 13,
    color: 'var(--grey-700)',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
  };

  return (
    <div className="tv4-page">

      {/* ══ PAGE HEADER ══ */}
      <PageHeader
        icon={BarChart3}
        title="Tesorería"
        subtitle="Evolución histórica"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={14} strokeWidth={1.5} style={{ color: 'var(--grey-500)' }} />
            <span style={{ fontSize: 12, color: 'var(--grey-500)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
              Vista multi-año
            </span>
          </div>
        }
      />

      {!hasData ? (
        <div style={{ padding: '40px 28px', textAlign: 'center', color: 'var(--grey-400)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
          No hay datos de ejercicios fiscales. Importa tus declaraciones XML desde Fiscalidad.
        </div>
      ) : (
        <div style={{ padding: '0 0 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* ══ KPI GRID ══ */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              border: '1px solid var(--grey-200)',
              borderRadius: 8,
              background: '#fff',
              overflow: 'hidden',
              margin: '0 0',
              borderRight: 'none',
            }}
          >
            {[
              {
                label: 'Cashflow acumulado',
                value: fmtSign(cashflowAcumulado),
                sub: `${summaries.length} años`,
                positive: cashflowAcumulado >= 0,
              },
              {
                label: 'Saldo actual',
                value: fmtEur(saldoActual),
                sub: 'Suma de cuentas',
                positive: true,
              },
              {
                label: 'Años cargados',
                value: String(añosCargados),
                sub: 'Con XML AEAT',
                positive: true,
              },
            ].map((kpi, i) => (
              <div
                key={i}
                style={{
                  borderRight: '1px solid var(--grey-200)',
                }}
              >
                <KpiCard
                  label={kpi.label}
                  value={kpi.value}
                  sub={kpi.sub}
                  positive={kpi.positive}
                />
              </div>
            ))}
          </div>

          {/* ══ CHART ══ */}
          <div
            style={{
              background: '#fff',
              border: '1px solid var(--grey-200)',
              borderRadius: 8,
              padding: '16px 20px 12px',
            }}
          >
            {/* Legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 2, background: 'var(--navy-900)' }} />
                <span style={{ fontSize: 11, color: 'var(--grey-500)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>Ingresos</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 2, background: 'var(--grey-300)' }} />
                <span style={{ fontSize: 11, color: 'var(--grey-500)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>Gastos</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-block', width: 24, height: 2, borderRadius: 1, background: 'var(--teal-600)', marginTop: 1 }} />
                <span style={{ fontSize: 11, color: 'var(--grey-500)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>Cashflow neto</span>
              </div>
            </div>
            <div style={{ height: 240 }}>
              <Chart ref={chartRef} type="bar" data={chartData as any} options={chartOptions as any} />
            </div>
          </div>

          {/* ══ TABLE ══ */}
          <div
            style={{
              background: '#fff',
              border: '1px solid var(--grey-200)',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--grey-200)', background: 'var(--grey-50)' }}>
                  <th
                    style={{
                      padding: '10px 12px',
                      textAlign: 'left',
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '.05em',
                      color: 'var(--grey-500)',
                      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                      width: 180,
                    }}
                  >
                    Concepto
                  </th>
                  {summaries.map((s) => (
                    <th
                      key={s.año}
                      style={{
                        padding: '10px 12px',
                        textAlign: 'right',
                        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                        whiteSpace: 'nowrap',
                      }}
                      onClick={s.año === CURRENT_YEAR ? () => navigate(`/tesoreria?año=${s.año}`) : undefined}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: s.año === CURRENT_YEAR ? 500 : 400,
                            color: s.año === CURRENT_YEAR ? 'var(--navy-900)' : 'var(--grey-700)',
                            cursor: s.año === CURRENT_YEAR ? 'pointer' : 'default',
                            textDecoration: 'none',
                          }}
                          onMouseEnter={(e) => {
                            if (s.año === CURRENT_YEAR) (e.currentTarget as HTMLElement).style.textDecoration = 'underline';
                          }}
                          onMouseLeave={(e) => {
                            if (s.año === CURRENT_YEAR) (e.currentTarget as HTMLElement).style.textDecoration = 'none';
                          }}
                        >
                          {s.año}
                        </span>
                        {getBadge(s)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>

                {/* INGRESOS section */}
                <tr><SectionLabel>Ingresos</SectionLabel></tr>

                <tr>
                  <td style={tdLabelStyle}>Nómina neta</td>
                  {summaries.map((s) => <td key={s.año} style={tdStyle}>{fmtCell(s.nominaNeta)}</td>)}
                </tr>
                <tr>
                  <td style={tdLabelStyle}>Autónomo neto</td>
                  {summaries.map((s) => <td key={s.año} style={tdStyle}>{fmtCell(s.autonomoNeto)}</td>)}
                </tr>
                <tr>
                  <td style={tdLabelStyle}>Rentas alquiler</td>
                  {summaries.map((s) => <td key={s.año} style={tdStyle}>{fmtCell(s.rentasAlquiler)}</td>)}
                </tr>
                <tr>
                  <td style={tdLabelStyle}>Devolución IRPF</td>
                  {summaries.map((s) => <td key={s.año} style={tdStyle}>{fmtCell(s.devolucionIrpf)}</td>)}
                </tr>

                {/* GASTOS section */}
                <tr><SectionLabel>Gastos</SectionLabel></tr>

                <tr>
                  <td style={tdLabelStyle}>Gastos inmuebles</td>
                  {summaries.map((s) => <td key={s.año} style={tdStyle}>{fmtCell(s.gastosInmuebles)}</td>)}
                </tr>
                <tr>
                  <td style={tdLabelStyle}>Cuotas préstamos</td>
                  {summaries.map((s) => <td key={s.año} style={tdStyle}>{fmtCell(s.cuotasPrestamos)}</td>)}
                </tr>
                <tr>
                  <td style={tdLabelStyle}>Pago IRPF</td>
                  {summaries.map((s) => <td key={s.año} style={tdStyle}>{fmtCell(s.pagoIrpf)}</td>)}
                </tr>
                <tr>
                  <td style={{ ...tdLabelStyle, color: 'var(--grey-400)' }}>
                    Gastos personales est.
                  </td>
                  {summaries.map((s) => (
                    <td key={s.año} style={tdStyle}>{fmtCell(s.gastosPersonales, { estimated: true })}</td>
                  ))}
                </tr>

                {/* Divider + Cashflow neto */}
                <tr>
                  <td
                    style={{
                      ...tdLabelStyle,
                      fontWeight: 600,
                      color: 'var(--grey-900)',
                      borderTop: '1.5px solid var(--grey-300)',
                      paddingTop: 10,
                    }}
                  >
                    Cashflow neto
                  </td>
                  {summaries.map((s) => (
                    <td
                      key={s.año}
                      style={{
                        ...tdStyle,
                        borderTop: '1.5px solid var(--grey-300)',
                        paddingTop: 10,
                        fontWeight: 600,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'IBM Plex Mono, monospace',
                          fontVariantNumeric: 'tabular-nums',
                          fontSize: 13,
                          fontWeight: 600,
                          color: s.cashflowNeto >= 0 ? 'var(--navy-900)' : 'var(--teal-600)',
                        }}
                      >
                        {fmtSign(s.cashflowNeto)}
                      </span>
                    </td>
                  ))}
                </tr>

              </tbody>
            </table>

            {/* Footer note */}
            <div
              style={{
                padding: '10px 12px',
                fontSize: 11,
                color: 'var(--grey-400)',
                borderTop: '1px solid var(--grey-100)',
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontStyle: 'italic',
              }}
            >
              * Gastos personales estimados. Amortización contable excluida de gastos inmuebles (no es salida de caja).
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default TreasuryEvolucion;
