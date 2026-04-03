import React, { useState, useMemo } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import SupervisionCard from '../components/SupervisionCards';
import type { InmuebleSupervision, TotalesCartera, DatosAnuales } from '../hooks/useSupervisionData';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend);

// ── Helpers ──────────────────────────────────────────────────────────────

const fmt = (n: number): string =>
  n.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €';

const fmtPct = (n: number): string =>
  (n >= 0 ? '+' : '') + n.toFixed(2) + '%';

/** Aggregate year-by-year data across all properties */
const aggregateByYear = (inmuebles: InmuebleSupervision[]): DatosAnuales[] => {
  const map = new Map<number, DatosAnuales>();
  for (const inm of inmuebles) {
    for (const d of inm.datosPorAno) {
      const existing = map.get(d.ano);
      if (existing) {
        existing.rentas += d.rentas;
        existing.gastosOp += d.gastosOp;
        existing.intereses += d.intereses;
        existing.reparaciones += d.reparaciones;
        existing.cashflow += d.cashflow;
      } else {
        map.set(d.ano, { ...d });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.ano - b.ano);
};

// ── Component ────────────────────────────────────────────────────────────

interface RendimientoTabProps {
  inmuebles: InmuebleSupervision[];
  totales: TotalesCartera;
}

const RendimientoTab: React.FC<RendimientoTabProps> = ({ inmuebles, totales }) => {
  const [crecimientoPct, setCrecimientoPct] = useState(3);
  const [horizonte, setHorizonte] = useState(10);

  const datosAnuales = useMemo(() => aggregateByYear(inmuebles), [inmuebles]);
  const currentYear = new Date().getFullYear();

  // Current year data
  const datoAnoActual = datosAnuales.find((d) => d.ano === currentYear);
  const cfAnoActual = datoAnoActual?.cashflow ?? 0;

  // Projected cashflow
  const lastRentas = datoAnoActual?.rentas ?? totales.rentasUltimoAno;
  const lastGastos = datoAnoActual ? datoAnoActual.gastosOp : 0;
  const lastIntereses = datoAnoActual ? datoAnoActual.intereses : 0;

  const cfProyectado = useMemo(() => {
    let total = 0;
    for (let y = 1; y <= horizonte; y++) {
      const rentas = lastRentas * Math.pow(1 + crecimientoPct / 100, y);
      total += rentas - lastGastos - lastIntereses;
    }
    return total;
  }, [lastRentas, lastGastos, lastIntereses, crecimientoPct, horizonte]);

  // Yield medio
  const yieldMedio = useMemo(() => {
    const anosConRentas = datosAnuales.filter((d) => d.rentas > 0);
    if (anosConRentas.length === 0 || totales.costeAdquisicion === 0) return 0;
    const totalRentas = anosConRentas.reduce((s, d) => s + d.rentas, 0);
    return (totalRentas / anosConRentas.length / totales.costeAdquisicion) * 100;
  }, [datosAnuales, totales.costeAdquisicion]);

  // ── Stacked bar chart ────────────────────────────────────────────────
  const barChartData = useMemo(() => {
    // Real years
    const realYears = datosAnuales.map((d) => String(d.ano));
    // Projected years
    const projYears: string[] = [];
    for (let y = 1; y <= horizonte; y++) projYears.push(String(currentYear + y));

    const allLabels = [...realYears, ...projYears.filter((l) => !realYears.includes(l))];

    const realGastos = allLabels.map((l) => {
      const d = datosAnuales.find((x) => String(x.ano) === l);
      return d ? d.gastosOp : null;
    });
    const realIntereses = allLabels.map((l) => {
      const d = datosAnuales.find((x) => String(x.ano) === l);
      return d ? d.intereses : null;
    });
    const realCashflow = allLabels.map((l) => {
      const d = datosAnuales.find((x) => String(x.ano) === l);
      return d ? d.cashflow : null;
    });

    // Projected
    const projGastos = allLabels.map((l) => {
      return projYears.includes(l) ? lastGastos : null;
    });
    const projIntereses = allLabels.map((l) => {
      return projYears.includes(l) ? lastIntereses : null;
    });
    const projCashflow = allLabels.map((l) => {
      if (!projYears.includes(l)) return null;
      const y = Number(l) - currentYear;
      const rentas = lastRentas * Math.pow(1 + crecimientoPct / 100, y);
      return rentas - lastGastos - lastIntereses;
    });

    return {
      labels: allLabels,
      datasets: [
        {
          label: 'Gastos op.',
          data: realGastos,
          backgroundColor: 'var(--grey-300)',
          stack: 'real',
        },
        {
          label: 'Intereses',
          data: realIntereses,
          backgroundColor: '#5B8DB8',
          stack: 'real',
        },
        {
          label: 'Cashflow',
          data: realCashflow,
          backgroundColor: 'var(--teal-600)',
          stack: 'real',
        },
        {
          label: 'Gastos op. (proy.)',
          data: projGastos,
          backgroundColor: 'rgba(200, 208, 220, 0.35)',
          stack: 'proj',
        },
        {
          label: 'Intereses (proy.)',
          data: projIntereses,
          backgroundColor: 'rgba(91, 141, 184, 0.40)',
          stack: 'proj',
        },
        {
          label: 'Cashflow (proy.)',
          data: projCashflow,
          backgroundColor: 'rgba(29, 160, 186, 0.45)',
          stack: 'proj',
        },
      ],
    };
  }, [datosAnuales, horizonte, crecimientoPct, currentYear, lastRentas, lastGastos, lastIntereses]);

  const barChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: any) => ctx.dataset.label + ': ' + fmt(ctx.parsed?.y ?? 0),
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { font: { family: 'var(--font-base)', size: 11 }, color: 'var(--grey-500)' },
        },
        y: {
          stacked: true,
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

  // ── Yield line chart ─────────────────────────────────────────────────
  const yieldChartData = useMemo(() => {
    const realYears = datosAnuales.filter((d) => d.rentas > 0);
    const projYears: { ano: number; yield: number }[] = [];
    for (let y = 1; y <= horizonte; y++) {
      const rentas = lastRentas * Math.pow(1 + crecimientoPct / 100, y);
      projYears.push({
        ano: currentYear + y,
        yield: totales.costeAdquisicion > 0 ? (rentas / totales.costeAdquisicion) * 100 : 0,
      });
    }

    const allLabels = [
      ...realYears.map((d) => String(d.ano)),
      ...projYears.map((d) => String(d.ano)),
    ];
    const uniqueLabels = [...new Set(allLabels)].sort();

    return {
      labels: uniqueLabels,
      datasets: [
        {
          label: 'Yield bruto',
          data: uniqueLabels.map((l) => {
            const d = realYears.find((x) => String(x.ano) === l);
            return d && totales.costeAdquisicion > 0
              ? (d.rentas / totales.costeAdquisicion) * 100
              : null;
          }),
          borderColor: 'var(--navy-900)',
          backgroundColor: 'var(--navy-900)',
          pointRadius: 3,
          tension: 0.3,
          spanGaps: true,
        },
        {
          label: 'Yield proyectado',
          data: uniqueLabels.map((l) => {
            const d = projYears.find((x) => String(x.ano) === l);
            // Include current year as bridge
            if (l === String(currentYear)) {
              const curr = realYears.find((x) => x.ano === currentYear);
              return curr && totales.costeAdquisicion > 0
                ? (curr.rentas / totales.costeAdquisicion) * 100
                : null;
            }
            return d ? d.yield : null;
          }),
          borderColor: 'var(--teal-600)',
          borderDash: [6, 4],
          pointRadius: 0,
          tension: 0.3,
          spanGaps: true,
        },
      ],
    };
  }, [datosAnuales, horizonte, crecimientoPct, currentYear, lastRentas, totales.costeAdquisicion]);

  const yieldChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: any) => ctx.dataset.label + ': ' + (ctx.parsed?.y ?? 0).toFixed(2) + '%',
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: 'var(--font-base)', size: 11 }, color: 'var(--grey-500)' },
        },
        y: {
          grid: { color: 'var(--grey-100)' },
          ticks: {
            font: { family: 'var(--font-mono)', size: 11 },
            color: 'var(--grey-500)',
            callback: (v: any) => v.toFixed(1) + '%',
          },
        },
      },
    }),
    [],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* ── 5.1 — 3 Cards principales ─────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
        <SupervisionCard
          title="Cashflow acumulado"
          value={fmt(totales.cashflowAcumulado)}
          detail={`Rentas ${fmt(datosAnuales.reduce((s, d) => s + d.rentas, 0))} | Gastos+Int ${fmt(datosAnuales.reduce((s, d) => s + d.gastosOp + d.intereses, 0))} | Yield ${fmtPct(yieldMedio)}`}
        />
        <SupervisionCard
          title="Cashflow año en curso"
          value={fmt(cfAnoActual)}
          detail={`Rentas ${fmt(datoAnoActual?.rentas ?? 0)} | Gastos ${fmt((datoAnoActual?.gastosOp ?? 0) + (datoAnoActual?.intereses ?? 0))} | Yield ${fmtPct(totales.yieldCosteAdquisicion)}`}
        />
        <SupervisionCard
          title="Cashflow proyectado"
          value={fmt(cfProyectado)}
        >
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="range"
                min={0}
                max={10}
                step={0.5}
                value={crecimientoPct}
                onChange={(e) => setCrecimientoPct(Number(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--teal-600)' }}
                aria-label="Crecimiento rentas anual"
              />
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--t-sm)',
                color: 'var(--grey-700)',
                minWidth: 38,
              }}>
                {crecimientoPct}%
              </span>
            </div>
          </div>
        </SupervisionCard>
      </div>

      {/* ── 5.2 — Layout crow (1.4fr 1fr) ────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 'var(--space-4)' }}>
        {/* Izquierda: barras apiladas */}
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
            <h3 style={{ fontSize: 'var(--t-base)', fontWeight: 600, color: 'var(--grey-900)', margin: 0 }}>
              Cashflow anual
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 'var(--t-xs)', color: 'var(--grey-500)' }}>Crec.</span>
              <input
                type="range"
                min={0}
                max={10}
                step={0.5}
                value={crecimientoPct}
                onChange={(e) => setCrecimientoPct(Number(e.target.value))}
                style={{ width: 70, accentColor: 'var(--teal-600)' }}
                aria-label="Crecimiento rentas chart"
              />
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--t-xs)',
                color: 'var(--grey-500)',
              }}>
                {crecimientoPct}%
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
            <Bar data={barChartData} options={barChartOptions as any} />
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Gastos op.', color: 'var(--grey-300)' },
              { label: 'Intereses', color: '#5B8DB8' },
              { label: 'Cashflow', color: 'var(--teal-600)' },
            ].map((item) => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: item.color }} />
                <span style={{ fontSize: 'var(--t-xs)', color: 'var(--grey-500)' }}>{item.label}</span>
              </div>
            ))}
            <span style={{ fontSize: 'var(--t-xs)', color: 'var(--grey-400)' }}>| semitransparente = proyección</span>
          </div>
        </div>

        {/* Derecha: yield bruto */}
        <div style={{
          background: 'var(--white)',
          border: '1px solid var(--grey-200)',
          borderRadius: 'var(--r-lg)',
          padding: 'var(--space-6)',
        }}>
          <h3 style={{ fontSize: 'var(--t-base)', fontWeight: 600, color: 'var(--grey-900)', margin: '0 0 var(--space-4)' }}>
            Yield bruto s/adquisición
          </h3>
          <div style={{ height: 280 }}>
            <Line data={yieldChartData} options={yieldChartOptions as any} />
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 16, height: 2, background: 'var(--navy-900)' }} />
              <span style={{ fontSize: 'var(--t-xs)', color: 'var(--grey-500)' }}>Real</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 16, height: 2, background: 'var(--teal-600)', borderTop: '2px dashed var(--teal-600)' }} />
              <span style={{ fontSize: 'var(--t-xs)', color: 'var(--grey-500)' }}>Proyección</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 5.3 — Tabla "Ingresos y gastos por año" ──────────────────── */}
      <div style={{
        background: 'var(--white)',
        border: '1px solid var(--grey-200)',
        borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 16px 0' }}>
          <h3 style={{ fontSize: 'var(--t-base)', fontWeight: 600, color: 'var(--grey-900)', margin: 0 }}>
            Ingresos y gastos por año
          </h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 'var(--t-sm)',
            fontFamily: 'var(--font-base)',
            marginTop: 8,
          }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--grey-200)' }}>
                {['Año', 'Rentas', 'Gastos op.', 'Intereses', 'Reparaciones', 'Cashflow neto'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 16px',
                      textAlign: h === 'Año' ? 'left' : 'right',
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
              {datosAnuales.map((d) => (
                <tr key={d.ano} style={{ borderBottom: '1px solid var(--grey-100)' }}>
                  <td style={{ padding: '8px 16px', fontWeight: 500, color: 'var(--grey-900)' }}>{d.ano}</td>
                  <td style={{ padding: '8px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--grey-700)' }}>{fmt(d.rentas)}</td>
                  <td style={{ padding: '8px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--grey-700)' }}>{fmt(d.gastosOp)}</td>
                  <td style={{ padding: '8px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--grey-700)' }}>{fmt(d.intereses)}</td>
                  <td style={{ padding: '8px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--grey-700)' }}>{fmt(d.reparaciones)}</td>
                  <td style={{
                    padding: '8px 16px',
                    textAlign: 'right',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    color: d.cashflow >= 0 ? 'var(--navy-900)' : 'var(--grey-700)',
                  }}>
                    {fmt(d.cashflow)}
                  </td>
                </tr>
              ))}
              {/* Fila total */}
              <tr style={{ borderTop: '2px solid var(--grey-300)', background: 'var(--grey-50)' }}>
                <td style={{ padding: '8px 16px', fontWeight: 700, color: 'var(--grey-900)' }}>Total</td>
                <td style={{ padding: '8px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--grey-900)' }}>{fmt(datosAnuales.reduce((s, d) => s + d.rentas, 0))}</td>
                <td style={{ padding: '8px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--grey-900)' }}>{fmt(datosAnuales.reduce((s, d) => s + d.gastosOp, 0))}</td>
                <td style={{ padding: '8px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--grey-900)' }}>{fmt(datosAnuales.reduce((s, d) => s + d.intereses, 0))}</td>
                <td style={{ padding: '8px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--grey-900)' }}>{fmt(datosAnuales.reduce((s, d) => s + d.reparaciones, 0))}</td>
                <td style={{
                  padding: '8px 16px',
                  textAlign: 'right',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  color: totales.cashflowAcumulado >= 0 ? 'var(--navy-900)' : 'var(--grey-700)',
                }}>
                  {fmt(totales.cashflowAcumulado)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RendimientoTab;
