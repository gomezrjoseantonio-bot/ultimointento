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
    c1: cssVar('--c1', '#042C5E'),
    c2: cssVar('--c2', '#5B8DB8'),
    c3: cssVar('--c3', '#1DA0BA'),
    c5: cssVar('--c5', '#C8D0DC'),
    text: cssVar('--n-500', '#6C757D'),
    neutral100: cssVar('--n-100', '#EEF1F5'),
    white: cssVar('--white', '#FFFFFF'),
    border: cssVar('--n-300', '#C8D0DC'),
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
        <div className="p-3 rounded-lg border shadow-lg" style={{ background: palette.white, borderColor: palette.border, color: 'var(--n-700)' }}>
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
          <span className="text-sm font-medium" style={{ color: 'var(--n-500)' }}>Horizonte temporal:</span>
          <div className="flex space-x-1">
            {[5, 10, 20].map((years) => (
              <button
                key={years}
                onClick={() => setTimeHorizon(years as 5 | 10 | 20)}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  timeHorizon === years
                    ? 'text-white'
                    : 'hover:opacity-90'
                }`}
              style={{
                background: timeHorizon === years ? 'var(--blue)' : 'var(--n-100)',
                color: timeHorizon === years ? 'var(--white)' : 'var(--n-500)',
              }}
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
              style={{ fontFamily: 'IBM Plex Sans, system-ui, sans-serif', fontSize: 11 }}
            />
            <YAxis 
              stroke={palette.text}
              style={{ fontFamily: 'IBM Plex Sans, system-ui, sans-serif', fontSize: 11 }}
              tickFormatter={(value) => formatEuro(value)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ fontFamily: 'IBM Plex Sans, system-ui, sans-serif', fontSize: 12 }} 
              iconType="circle"
            />
            <Line 
              type="monotone" 
              dataKey="Ingresos de alquiler (netos)" 
              stroke={palette.c1} 
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line 
              type="monotone" 
              dataKey="Gastos (operativos + impuestos + seguros + comunidad)" 
              stroke={palette.c5} 
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line 
              type="monotone" 
              dataKey="Servicio de deuda" 
              stroke={palette.c2} 
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line 
              type="monotone" 
              dataKey="Flujo neto" 
              stroke={palette.c3} 
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart Legend Description */}
      <div className="mt-4 text-xs" style={{ color: 'var(--n-500)' }}>
        <p>
          * Los gastos y servicio de deuda se muestran como valores negativos para mejor visualización del impacto en el flujo neto.
        </p>
      </div>
    </div>
  );
};

export default ProjectionChart;