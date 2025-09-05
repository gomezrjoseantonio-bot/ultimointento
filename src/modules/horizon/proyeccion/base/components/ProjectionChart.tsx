import React, { useState } from 'react';
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

const ProjectionChart: React.FC<ProjectionChartProps> = ({ data }) => {
  const [timeHorizon, setTimeHorizon] = useState<5 | 10 | 20>(20);

  // Filter data based on selected time horizon
  const filteredData = data.slice(0, timeHorizon + 1);
  
  const chartData = {
    labels: filteredData.map(d => d.year.toString()),
    datasets: [
      {
        label: 'Ingresos de alquiler (netos)',
        data: filteredData.map(d => d.rentalIncome),
        borderColor: '#0E9F6E',
        backgroundColor: 'rgba(14, 159, 110, 0.1)',
        fill: false,
        tension: 0.2,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
      {
        label: 'Gastos (operativos + impuestos + seguros + comunidad)',
        data: filteredData.map(d => -d.operatingExpenses), // Negative for visualization
        borderColor: '#DC2626',
        backgroundColor: 'rgba(220, 38, 38, 0.1)',
        fill: false,
        tension: 0.2,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
      {
        label: 'Servicio de deuda',
        data: filteredData.map(d => -d.debtService), // Negative for visualization
        borderColor: '#F59E0B',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        fill: false,
        tension: 0.2,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
      {
        label: 'Flujo neto',
        data: filteredData.map(d => d.netCashflow),
        borderColor: '#022D5E',
        backgroundColor: 'rgba(2, 45, 94, 0.1)',
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
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: '#022D5E',
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
          color: '#6B7280',
          font: {
            family: 'Inter',
            size: 11
          }
        }
      },
      y: {
        grid: {
          color: '#F3F4F6',
          borderDash: [2, 2]
        },
        border: {
          display: false
        },
        ticks: {
          color: '#6B7280',
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
          <span className="text-sm font-medium text-[#6B7280]">Horizonte temporal:</span>
          <div className="flex space-x-1">
            {[5, 10, 20].map((years) => (
              <button
                key={years}
                onClick={() => setTimeHorizon(years as 5 | 10 | 20)}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  timeHorizon === years
                    ? 'bg-[#022D5E] text-white'
                    : 'bg-[#F8F9FA] text-[#6B7280] hover:bg-[#E5E7EB]'
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
      <div className="mt-4 text-xs text-[#6B7280]">
        <p>
          * Los gastos y servicio de deuda se muestran como valores negativos para mejor visualización del impacto en el flujo neto.
        </p>
      </div>
    </div>
  );
};

export default ProjectionChart;