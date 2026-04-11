// TabRendimientos.tsx
// ATLAS HORIZON: Rendimientos tab with analytics charts

import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { TabRendimientosProps } from '../types';
import { ChartCard } from '../cards';
import { buildEvolucionInversiones, CHART_COLORS } from '../utils';

const TabRendimientos: React.FC<TabRendimientosProps> = ({ positions }) => {
  const evolucionInv = useMemo(
    () => buildEvolucionInversiones(positions),
    [positions]
  );
  const donutData = positions.map((p) => ({ name: p.alias, value: p.valor }));
  const donutColors = positions.map((p) => p.color);
  const rentData = positions.map((p) => ({
    name: p.alias,
    rentPct: p.rentPct,
    rentAnual: p.rentAnual,
  }));

  // Dynamic subtitle from actual chart data range
  const evolYears = evolucionInv.map((d) => d.year);
  const evolSub =
    evolYears.length > 1
      ? `Valor total vs capital aportado · ${evolYears[0]}–${
          evolYears[evolYears.length - 1]
        }`
      : 'Valor total vs capital aportado';

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 20,
          marginBottom: 20,
        }}
      >
        <ChartCard title="Evolución del portfolio" sub={evolSub}>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart
              data={evolucionInv}
              margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
            >
              <CartesianGrid stroke="rgba(200,208,220,.4)" />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 11, fill: CHART_COLORS.grey500 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: CHART_COLORS.grey500 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(v: number) => [`${v.toLocaleString('es-ES')} €`]}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: `1px solid ${CHART_COLORS.grey300}`,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="valor"
                name="Valor portfolio"
                stroke={CHART_COLORS.navy900}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="aportado"
                name="Capital aportado"
                stroke={CHART_COLORS.c2}
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Rentabilidad por posición"
          sub="% total acumulado desde primera aportación"
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={rentData}
              margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
            >
              <CartesianGrid stroke="rgba(200,208,220,.4)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: CHART_COLORS.grey500 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: CHART_COLORS.grey500 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                formatter={(v: number) => [`${v.toFixed(2)}%`]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <ReferenceLine y={0} stroke={CHART_COLORS.grey300} />
              <Bar
                dataKey="rentPct"
                name="Rentabilidad total %"
                radius={[4, 4, 0, 0]}
              >
                {rentData.map((_, i) => (
                  <Cell key={i} fill={donutColors[i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 20,
        }}
      >
        <ChartCard
          title="Distribución del portfolio"
          sub="% por valor actual de cada posición"
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 24,
            }}
          >
            <PieChart width={180} height={180}>
              <Pie
                data={donutData}
                dataKey="value"
                cx={90}
                cy={90}
                innerRadius={58}
                outerRadius={86}
                paddingAngle={1}
              >
                {donutData.map((_, i) => (
                  <Cell key={i} fill={donutColors[i]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number) => [`${v.toLocaleString('es-ES')} €`]}
                contentStyle={{ fontSize: 12 }}
              />
            </PieChart>
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {positions.map((p, i) => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    color: 'var(--grey-700, #303A4C)',
                  }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: donutColors[i],
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1 }}>{p.alias}</span>
                  <span
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontWeight: 600,
                    }}
                  >
                    {p.peso}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>

        <ChartCard
          title="Rentabilidad anualizada por posición"
          sub="% rent. anual estimada (CAGR)"
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={rentData}
              layout="vertical"
              margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
            >
              <CartesianGrid stroke="rgba(200,208,220,.4)" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: CHART_COLORS.grey500 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: CHART_COLORS.grey500 }}
                axisLine={false}
                tickLine={false}
                width={110}
              />
              <Tooltip
                formatter={(v: number) => [`${v.toFixed(2)}%/año`]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar
                dataKey="rentAnual"
                name="Rent. anual %"
                radius={[0, 4, 4, 0]}
              >
                {rentData.map((_, i) => (
                  <Cell key={i} fill={donutColors[i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
};

export default TabRendimientos;
