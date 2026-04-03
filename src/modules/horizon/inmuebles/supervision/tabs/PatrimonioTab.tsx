import React, { useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Home, Car, Warehouse } from 'lucide-react';
import SupervisionCard from '../components/SupervisionCards';
import EvoBarList from '../components/EvoBarList';
import type { InmuebleSupervision, TotalesCartera } from '../hooks/useSupervisionData';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

// ── Helpers ──────────────────────────────────────────────────────────────

const fmt = (n: number): string =>
  n.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €';

const fmtPct = (n: number): string =>
  (n >= 0 ? '+' : '') + n.toFixed(1) + '%';

const fmtMultiplo = (n: number): string => n.toFixed(2) + 'x';

const getIcon = (_alias: string) => {
  const lower = _alias.toLowerCase();
  if (lower.includes('parking') || lower.includes('garaje') || lower.includes('plaza')) return Car;
  if (lower.includes('trastero')) return Warehouse;
  return Home;
};

// ── Component ────────────────────────────────────────────────────────────

interface PatrimonioTabProps {
  inmuebles: InmuebleSupervision[];
  totales: TotalesCartera;
}

const PatrimonioTab: React.FC<PatrimonioTabProps> = ({ inmuebles, totales }) => {
  // Proyección sliders
  const [tasaPct, setTasaPct] = useState(3);
  const [horizonte, setHorizonte] = useState(10);

  // Proyección valor
  const proyeccionValor = useMemo(
    () => totales.valorCartera * Math.pow(1 + tasaPct / 100, horizonte),
    [totales.valorCartera, tasaPct, horizonte],
  );

  // Chart data: valor actual como punto real + proyección punteada
  const chartData = useMemo(() => {
    const currentYear = new Date().getFullYear();
    // Gather all unique purchase years across portfolio
    const minYear = inmuebles.length > 0
      ? Math.min(...inmuebles.map((i) => i.anoCompra))
      : currentYear;

    // Historical: aggregate valorActual per year (simplified: only current known value)
    const realLabels: string[] = [];
    const realValues: number[] = [];
    // Use costeAdquisicion as starting point, valorActual as today
    realLabels.push(String(minYear));
    realValues.push(totales.costeAdquisicion);
    if (minYear !== currentYear) {
      realLabels.push(String(currentYear));
      realValues.push(totales.valorCartera);
    }

    // Projected
    const projLabels: string[] = [String(currentYear)];
    const projValues: number[] = [totales.valorCartera];
    for (let y = 1; y <= horizonte; y++) {
      projLabels.push(String(currentYear + y));
      projValues.push(totales.valorCartera * Math.pow(1 + tasaPct / 100, y));
    }

    const allLabels = [...new Set([...realLabels, ...projLabels])].sort();

    return {
      labels: allLabels,
      datasets: [
        {
          label: 'Valor real',
          data: allLabels.map((l) => {
            const idx = realLabels.indexOf(l);
            return idx >= 0 ? realValues[idx] : null;
          }),
          borderColor: 'var(--navy-900)',
          backgroundColor: 'var(--navy-900)',
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.3,
          spanGaps: true,
        },
        {
          label: 'Proyección',
          data: allLabels.map((l) => {
            const idx = projLabels.indexOf(l);
            return idx >= 0 ? projValues[idx] : null;
          }),
          borderColor: 'var(--teal-600)',
          backgroundColor: 'rgba(29, 160, 186, 0.08)',
          borderDash: [6, 4],
          pointRadius: 0,
          tension: 0.3,
          fill: true,
          spanGaps: true,
        },
      ],
    };
  }, [inmuebles, totales, tasaPct, horizonte]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: any) => (ctx.parsed?.y != null ? fmt(ctx.parsed.y) : '—'),
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: 'var(--font-base)', size: 12 }, color: 'var(--grey-500)' },
        },
        y: {
          grid: { color: 'var(--grey-100)' },
          ticks: {
            font: { family: 'var(--font-mono)', size: 11 },
            color: 'var(--grey-500)',
            callback: (v: any) => (v / 1000).toFixed(0) + 'k',
          },
        },
      },
    }),
    [],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* ── 4.1 — 4 Cards superiores ──────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
        <SupervisionCard
          title="Valor actual"
          value={fmt(totales.valorCartera)}
          detail={`Coste adq. ${fmt(totales.costeAdquisicion)} | Plusv. ${fmt(totales.plusvaliaLatente)}`}
        />
        <SupervisionCard
          title="Plusvalía latente"
          value={fmt(totales.plusvaliaLatente)}
          detail={`${fmtPct(totales.revalorizacionPct)} | ${fmtMultiplo(totales.multiplo)}`}
        />
        <SupervisionCard
          title="Inversión total"
          value={fmt(totales.inversionTotal)}
          detail={`Adq. ${fmt(totales.costeAdquisicion)} | Rep+Mob ${fmt(totales.reparaciones + totales.mobiliario)}`}
        />
        <SupervisionCard
          title="Proyección valor"
          value={fmt(proyeccionValor)}
        >
          {/* Slider tasa */}
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="range"
                min={1}
                max={8}
                step={0.5}
                value={tasaPct}
                onChange={(e) => setTasaPct(Number(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--teal-600)' }}
                aria-label="Tasa de revalorización anual"
              />
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--t-sm)',
                color: 'var(--grey-700)',
                minWidth: 38,
              }}>
                {tasaPct}%
              </span>
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              {[5, 10, 20].map((h) => (
                <button
                  key={h}
                  onClick={() => setHorizonte(h)}
                  style={{
                    padding: '2px 10px',
                    borderRadius: 'var(--r-sm)',
                    border: '1px solid',
                    borderColor: horizonte === h ? 'var(--navy-900)' : 'var(--grey-300)',
                    background: horizonte === h ? 'var(--navy-900)' : 'var(--white)',
                    color: horizonte === h ? 'var(--white)' : 'var(--grey-700)',
                    fontSize: 'var(--t-xs)',
                    fontFamily: 'var(--font-base)',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  {h}a
                </button>
              ))}
            </div>
          </div>
        </SupervisionCard>
      </div>

      {/* ── 4.2 — Layout crow (1.4fr 1fr) ────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 'var(--space-4)' }}>
        {/* Izquierda: gráfico línea */}
        <div style={{
          background: 'var(--white)',
          border: '1px solid var(--grey-200)',
          borderRadius: 'var(--r-lg)',
          padding: 'var(--space-6)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-4)',
          }}>
            <h3 style={{
              fontSize: 'var(--t-base)',
              fontWeight: 600,
              color: 'var(--grey-900)',
              margin: 0,
            }}>
              Evolución patrimonial
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="range"
                min={1}
                max={8}
                step={0.5}
                value={tasaPct}
                onChange={(e) => setTasaPct(Number(e.target.value))}
                style={{ width: 80, accentColor: 'var(--teal-600)' }}
                aria-label="Tasa revalorización chart"
              />
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--t-xs)',
                color: 'var(--grey-500)',
              }}>
                {tasaPct}%
              </span>
              {[5, 10, 20].map((h) => (
                <button
                  key={h}
                  onClick={() => setHorizonte(h)}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 'var(--r-sm)',
                    border: '1px solid',
                    borderColor: horizonte === h ? 'var(--navy-900)' : 'var(--grey-300)',
                    background: horizonte === h ? 'var(--navy-900)' : 'var(--white)',
                    color: horizonte === h ? 'var(--white)' : 'var(--grey-700)',
                    fontSize: 11,
                    fontFamily: 'var(--font-base)',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  {h}a
                </button>
              ))}
            </div>
          </div>
          <div style={{ height: 280 }}>
            <Line data={chartData} options={chartOptions as any} />
          </div>
        </div>

        {/* Derecha: EvoBarList */}
        <div style={{
          background: 'var(--white)',
          border: '1px solid var(--grey-200)',
          borderRadius: 'var(--r-lg)',
          padding: 'var(--space-6)',
        }}>
          <h3 style={{
            fontSize: 'var(--t-base)',
            fontWeight: 600,
            color: 'var(--grey-900)',
            margin: '0 0 var(--space-4)',
          }}>
            Comparativa por inmueble
          </h3>
          <EvoBarList inmuebles={inmuebles} />
        </div>
      </div>

      {/* ── 4.3 — Tabla desglose ──────────────────────────────────────── */}
      <div style={{
        background: 'var(--white)',
        border: '1px solid var(--grey-200)',
        borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 'var(--t-sm)',
            fontFamily: 'var(--font-base)',
          }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--grey-200)' }}>
                {['Inmueble', 'Año', 'Coste de adquisición', 'Reparaciones / Mobiliario', 'Inversión total', 'Valor hoy', 'Plusvalía latente'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '12px 16px',
                      textAlign: h === 'Inmueble' ? 'left' : 'right',
                      fontWeight: 600,
                      color: 'var(--grey-500)',
                      fontSize: 'var(--t-xs)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inmuebles.map((inm) => {
                const Icon = getIcon(inm.alias);
                return (
                  <tr key={inm.id} style={{ borderBottom: '1px solid var(--grey-100)' }}>
                    <td style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icon size={16} style={{ color: 'var(--grey-500)', flexShrink: 0 }} />
                      <span style={{ fontWeight: 500, color: 'var(--grey-900)' }}>{inm.alias}</span>
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--grey-700)' }}>{inm.anoCompra}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--grey-700)' }}>{fmt(inm.costeAdquisicion)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--grey-700)' }}>{fmt(inm.reparaciones + inm.mobiliario)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--grey-900)' }}>{fmt(inm.inversionTotal)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--grey-900)' }}>{fmt(inm.valorActual)}</td>
                    <td style={{
                      padding: '10px 16px',
                      textAlign: 'right',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      color: inm.plusvaliaLatente >= 0 ? 'var(--navy-900)' : 'var(--grey-700)',
                    }}>
                      {fmt(inm.plusvaliaLatente)}
                    </td>
                  </tr>
                );
              })}
              {/* Fila total */}
              <tr style={{ borderTop: '2px solid var(--grey-300)', background: 'var(--grey-50)' }}>
                <td style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--grey-900)' }}>Total</td>
                <td style={{ padding: '10px 16px' }} />
                <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--grey-900)' }}>{fmt(totales.costeAdquisicion)}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--grey-900)' }}>{fmt(totales.reparaciones + totales.mobiliario)}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--grey-900)' }}>{fmt(totales.inversionTotal)}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--grey-900)' }}>{fmt(totales.valorCartera)}</td>
                <td style={{
                  padding: '10px 16px',
                  textAlign: 'right',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  color: totales.plusvaliaLatente >= 0 ? 'var(--navy-900)' : 'var(--grey-700)',
                }}>
                  {fmt(totales.plusvaliaLatente)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PatrimonioTab;
