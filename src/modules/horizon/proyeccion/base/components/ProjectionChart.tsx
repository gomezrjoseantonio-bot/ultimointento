import React, { useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import type { YearlyProjectionData } from '../services/proyeccionService';
import { formatEuro } from '../../../../../utils/formatUtils';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ProjectionChartProps {
  data: YearlyProjectionData[];
}

const cssVar = (variable: string, fallback: string): string => {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable);
  return value?.trim() || fallback;
};

const hexToRgba = (hex: string, alpha: number): string => {
  const sanitized = hex.replace('#', '');
  if (sanitized.length !== 6) {
    return hex;
  }
  const intVal = parseInt(sanitized, 16);
  const r = (intVal >> 16) & 255;
  const g = (intVal >> 8) & 255;
  const b = intVal & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const ProjectionChart: React.FC<ProjectionChartProps> = ({ data }) => {
  const [timeHorizon, setTimeHorizon] = useState<5 | 10 | 20>(20);

  // Filter data based on selected time horizon
  const filteredData = data.slice(0, timeHorizon + 1);

  const palette = useMemo(() => ({
    success: cssVar('--ok', 'var(--ok)'),
    error: cssVar('--error', 'var(--error)'),
    warning: cssVar('--warn', 'var(--warn)'),
    primary: cssVar('--atlas-blue', 'var(--atlas-blue)'),
    text: cssVar('--text-gray', 'var(--text-gray)'),
    neutral100: cssVar('--hz-neutral-100', 'var(--bg)'),
  }), []);

  const chartData = {
    labels: filteredData.map(d => d.year.toString()),
    datasets: [
      {
        label: 'Ingresos de alquiler (netos)',
        data: filteredData.map(d => d.rentalIncome),
        borderColor: palette.success,
        backgroundColor: hexToRgba(palette.success, 0.15),
        fill: false,
        tension: 0.2,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
      {
        label: 'Gastos (operativos + impuestos + seguros + comunidad)',
        data: filteredData.map(d => -d.operatingExpenses), // Negative for visualization
        borderColor: palette.error,
        backgroundColor: hexToRgba(palette.error, 0.15),
        fill: false,
        tension: 0.2,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
      {
        label: 'Servicio de deuda',
        data: filteredData.map(d => -d.debtService), // Negative for visualization
        borderColor: palette.warning,
        backgroundColor: hexToRgba(palette.warning, 0.15),
        fill: false,
        tension: 0.2,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
      {
        label: 'Flujo neto',
        data: filteredData.map(d => d.netCashflow),
        borderColor: palette.primary,
        backgroundColor: hexToRgba(palette.primary, 0.15),
        fill: false,
        tension: 0.2,
        borderWidth: 3,
        pointRadius: 4,
        pointHoverRadius: 6,
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
    plugins: {
      title: {
        display: false
      },
      legend: {
        position: 'bottom' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            family: 'Inter',
            size: 12
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(48, 58, 76, 0.92)',
        titleColor: '#FFFFFF',
        bodyColor: '#FFFFFF',
        borderColor: palette.primary,
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          label: function(context: any) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `${label}: ${formatEuro(Math.abs(value))}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        border: {
          display: false
        },
        ticks: {
          color: palette.text,
          font: {
            family: 'Inter',
            size: 11
          }
        }
      },
      y: {
        grid: {
          color: palette.neutral100,
          borderDash: [2, 2]
        },
        border: {
          display: false
        },
        ticks: {
          color: palette.text,
          font: {
            family: 'Inter',
            size: 11
          },
          callback: function(value: any) {
            return formatEuro(value);
          }
        }
      }
    }
  };

  return (
    <div>
      {/* Time Horizon Selector */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-500">Horizonte temporal:</span>
          <div className="flex space-x-1">
            {[5, 10, 20].map((years) => (
              <button
                key={years}
                onClick={() => setTimeHorizon(years as 5 | 10 | 20)}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  timeHorizon === years
                    ? 'bg-primary-700 text-white'
                    : 'bg-hz-neutral-100 text-gray-500 hover:bg-hz-neutral-300'
                }`}
              >
                {years} años
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-96">
        <Line data={chartData} options={options} />
      </div>

      {/* Chart Legend Description */}
      <div className="mt-4 text-xs text-gray-500">
        <p>
          * Los gastos y servicio de deuda se muestran como valores negativos para mejor visualización del impacto en el flujo neto.
        </p>
      </div>
    </div>
  );
};

export default ProjectionChart;