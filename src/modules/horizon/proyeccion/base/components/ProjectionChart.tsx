import React, { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { YearlyProjectionData } from '../services/proyeccionService';
import { formatEuro } from '../../../../../utils/formatUtils';

interface ProjectionChartProps {
  data: YearlyProjectionData[];
}

const cssVar = (variable: string, fallback: string): string => {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable);
  return value?.trim() || fallback;
};

const ProjectionChart: React.FC<ProjectionChartProps> = ({ data }) => {
  const [timeHorizon, setTimeHorizon] = useState<5 | 10 | 20>(20);

  // Filter data based on selected time horizon
  const filteredData = data.slice(0, timeHorizon + 1);

  const palette = useMemo(() => ({
    success: cssVar('--ok', '#10b981'),
    error: cssVar('--error', '#ef4444'),
    warning: cssVar('--warn', '#f59e0b'),
    primary: cssVar('--atlas-blue', '#3b82f6'),
    text: cssVar('--text-gray', '#6b7280'),
    neutral100: cssVar('--hz-neutral-100', '#f3f4f6'),
  }), []);

  // Transform data for recharts format
  const chartData = filteredData.map(d => ({
    year: d.year.toString(),
    'Ingresos de alquiler (netos)': d.rentalIncome,
    'Gastos (operativos + impuestos + seguros + comunidad)': -d.operatingExpenses,
    'Servicio de deuda': -d.debtService,
    'Flujo neto': d.netCashflow,
  }));

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 text-white p-3 rounded-lg border border-gray-600 shadow-lg">
          <p className="font-semibold mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {formatEuro(Math.abs(entry.value))}
            </p>
          ))}
        </div>
      );
    }
    return null;
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
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={palette.neutral100} />
            <XAxis 
              dataKey="year" 
              stroke={palette.text}
              style={{ fontFamily: 'Inter', fontSize: 11 }}
            />
            <YAxis 
              stroke={palette.text}
              style={{ fontFamily: 'Inter', fontSize: 11 }}
              tickFormatter={(value) => formatEuro(value)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ fontFamily: 'Inter', fontSize: 12 }} 
              iconType="circle"
            />
            <Line 
              type="monotone" 
              dataKey="Ingresos de alquiler (netos)" 
              stroke={palette.success} 
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line 
              type="monotone" 
              dataKey="Gastos (operativos + impuestos + seguros + comunidad)" 
              stroke={palette.error} 
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line 
              type="monotone" 
              dataKey="Servicio de deuda" 
              stroke={palette.warning} 
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line 
              type="monotone" 
              dataKey="Flujo neto" 
              stroke={palette.primary} 
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
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