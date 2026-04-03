import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
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
import type { InmuebleSupervision } from '../hooks/useSupervisionData';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend);

const fmt = (n: number): string =>
  n.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €';

interface Chart360Props {
  inmueble: InmuebleSupervision;
  tasaRev: number;
  crecRentas: number;
  horizonte: number;
}

const Chart360: React.FC<Chart360Props> = ({ inmueble, tasaRev, crecRentas, horizonte }) => {
  const currentYear = new Date().getFullYear();

  const chartData = useMemo(() => {
    const realYears = inmueble.datosPorAno
      .filter((d) => d.rentas > 0 || d.gastosOp > 0 || d.intereses > 0 || d.reparaciones > 0)
      .map((d) => d.ano);
    const projYears: number[] = [];
    for (let y = 1; y <= horizonte; y++) projYears.push(currentYear + y);

    const allYears = [...new Set([...realYears, ...projYears])].sort();
    const labels = allYears.map(String);

    const lastD = inmueble.datosPorAno[inmueble.datosPorAno.length - 1];
    const baseRentas = lastD?.rentas ?? 0;
    const baseGastos = lastD?.gastosOp ?? 0;
    const baseIntereses = lastD?.intereses ?? 0;

    // Bars: gastos op + intereses + cashflow (real stack + proj stack)
    const realGastos = labels.map((l) => {
      const d = inmueble.datosPorAno.find((x) => String(x.ano) === l);
      return d ? d.gastosOp : null;
    });
    const realIntereses = labels.map((l) => {
      const d = inmueble.datosPorAno.find((x) => String(x.ano) === l);
      return d ? d.intereses : null;
    });
    const realCf = labels.map((l) => {
      const d = inmueble.datosPorAno.find((x) => String(x.ano) === l);
      return d ? d.cashflow : null;
    });

    const projGastos = labels.map((l) => (projYears.includes(Number(l)) ? baseGastos : null));
    const projIntereses = labels.map((l) => (projYears.includes(Number(l)) ? baseIntereses : null));
    const projCf = labels.map((l) => {
      if (!projYears.includes(Number(l))) return null;
      const y = Number(l) - currentYear;
      return baseRentas * Math.pow(1 + crecRentas / 100, y) - baseGastos - baseIntereses;
    });

    // Line: valor (y2 axis)
    const valorReal = labels.map((l) => {
      const yr = Number(l);
      if (yr === inmueble.anoCompra) return inmueble.costeAdquisicion;
      if (yr === currentYear) return inmueble.valorActual;
      if (yr > inmueble.anoCompra && yr < currentYear && realYears.includes(yr)) {
        // Linear interpolation between costeAdq and valorActual
        const t = (yr - inmueble.anoCompra) / (currentYear - inmueble.anoCompra);
        return inmueble.costeAdquisicion + t * (inmueble.valorActual - inmueble.costeAdquisicion);
      }
      return null;
    });

    const valorProj = labels.map((l) => {
      const yr = Number(l);
      if (yr === currentYear) return inmueble.valorActual;
      if (projYears.includes(yr)) {
        const y = yr - currentYear;
        return inmueble.valorActual * Math.pow(1 + tasaRev / 100, y);
      }
      return null;
    });

    return {
      labels,
      datasets: [
        // Bars - real
        { label: 'Gastos op.', data: realGastos, backgroundColor: '#C8D0DC', stack: 'real', yAxisID: 'y', order: 2 },
        { label: 'Intereses', data: realIntereses, backgroundColor: '#5B8DB8', stack: 'real', yAxisID: 'y', order: 2 },
        { label: 'Cashflow', data: realCf, backgroundColor: '#1DA0BA', stack: 'real', yAxisID: 'y', order: 2 },
        // Bars - proj
        { label: 'Gastos op. proy.', data: projGastos, backgroundColor: 'rgba(200, 208, 220, 0.35)', stack: 'proj', yAxisID: 'y', order: 2 },
        { label: 'Intereses proy.', data: projIntereses, backgroundColor: 'rgba(91, 141, 184, 0.40)', stack: 'proj', yAxisID: 'y', order: 2 },
        { label: 'Cashflow proy.', data: projCf, backgroundColor: 'rgba(29, 160, 186, 0.45)', stack: 'proj', yAxisID: 'y', order: 2 },
        // Lines - valor
        {
          label: 'Valor real',
          data: valorReal,
          type: 'line' as const,
          borderColor: '#042C5E',
          backgroundColor: '#042C5E',
          pointRadius: 3,
          tension: 0.3,
          yAxisID: 'y2',
          order: 1,
          spanGaps: true,
        },
        {
          label: 'Valor proy.',
          data: valorProj,
          type: 'line' as const,
          borderColor: '#1DA0BA',
          borderDash: [6, 4],
          pointRadius: 0,
          tension: 0.3,
          yAxisID: 'y2',
          order: 1,
          spanGaps: true,
        },
      ],
    };
  }, [inmueble, tasaRev, crecRentas, horizonte, currentYear]);

  const options = useMemo(
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
          position: 'left' as const,
          title: { display: true, text: 'Cashflow €', font: { size: 11 }, color: 'var(--grey-500)' },
          grid: { color: 'var(--grey-100)' },
          ticks: {
            font: { family: 'var(--font-mono)', size: 10 },
            color: 'var(--grey-500)',
            callback: (v: any) => (v / 1000).toFixed(0) + 'k',
          },
        },
        y2: {
          position: 'right' as const,
          title: { display: true, text: 'Valor €', font: { size: 11 }, color: 'var(--grey-500)' },
          grid: { drawOnChartArea: false },
          ticks: {
            font: { family: 'var(--font-mono)', size: 10 },
            color: 'var(--grey-500)',
            callback: (v: any) => (v / 1000).toFixed(0) + 'k',
          },
        },
      },
    }),
    [],
  );

  return (
    <div style={{ height: 320 }}>
      <Bar data={chartData as any} options={options as any} />
    </div>
  );
};

export default Chart360;
