import React, { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
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
import { CardV5, useChartColors } from '../../../design-system/v5';
import type { InversionesOutletContext } from '../InversionesContext';
import { buildEvolucionInversiones } from '../helpers';
import styles from './RendimientosPage.module.css';

const RendimientosPage: React.FC = () => {
  const { positions } = useOutletContext<InversionesOutletContext>();
  const CHART = useChartColors();

  const evolucionInv = useMemo(() => buildEvolucionInversiones(positions), [positions]);
  const donutData = positions.map((p) => ({ name: p.alias, value: p.valor }));
  const donutColors = positions.map((p) => p.color);
  const rentData = positions.map((p) => ({
    name: p.alias,
    rentPct: p.rentPct,
    rentAnual: p.rentAnual,
  }));

  const evolYears = evolucionInv.map((d) => d.year);
  const evolSub =
    evolYears.length > 1
      ? `Valor total vs capital aportado · ${evolYears[0]}–${evolYears[evolYears.length - 1]}`
      : 'Valor total vs capital aportado';

  if (positions.length === 0) {
    return (
      <CardV5>
        <CardV5.Body>
          <div style={{ padding: '24px 8px', textAlign: 'center', color: 'var(--atlas-v5-ink-4)' }}>
            Aún no tienes posiciones para analizar rendimientos.
          </div>
        </CardV5.Body>
      </CardV5>
    );
  }

  return (
    <>
      <div className={styles.row}>
        <CardV5>
          <CardV5.Title>Evolución del portfolio</CardV5.Title>
          <CardV5.Subtitle>{evolSub}</CardV5.Subtitle>
          <CardV5.Body>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={evolucionInv} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={CHART.grid} />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 11, fill: CHART.axis }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: CHART.axis }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v: number) => [`${v.toLocaleString('es-ES')} €`]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${CHART.border}` }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="valor"
                  name="Valor portfolio"
                  stroke={CHART.ink}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="aportado"
                  name="Capital aportado"
                  stroke={CHART.accent}
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardV5.Body>
        </CardV5>

        <CardV5>
          <CardV5.Title>Rentabilidad por posición</CardV5.Title>
          <CardV5.Subtitle>% total acumulado desde primera aportación</CardV5.Subtitle>
          <CardV5.Body>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={rentData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: CHART.axis }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: CHART.axis }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  formatter={(v: number) => [`${v.toFixed(2)}%`]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <ReferenceLine y={0} stroke={CHART.border} />
                <Bar dataKey="rentPct" name="Rentabilidad total %" radius={[4, 4, 0, 0]}>
                  {rentData.map((_, i) => (
                    <Cell key={i} fill={donutColors[i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardV5.Body>
        </CardV5>
      </div>

      <div className={styles.row}>
        <CardV5>
          <CardV5.Title>Distribución del portfolio</CardV5.Title>
          <CardV5.Subtitle>% por valor actual de cada posición</CardV5.Subtitle>
          <CardV5.Body>
            <div className={styles.donutBox}>
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
              <ul className={styles.donutLegend}>
                {positions.map((p, i) => (
                  <li key={p.id}>
                    <span className={styles.dot} style={{ background: donutColors[i] }} />
                    <span className={styles.alias}>{p.alias}</span>
                    <span className={styles.pct}>{p.peso}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardV5.Body>
        </CardV5>

        <CardV5>
          <CardV5.Title>Rentabilidad anualizada</CardV5.Title>
          <CardV5.Subtitle>% rent. anual estimada · CAGR</CardV5.Subtitle>
          <CardV5.Body>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={rentData}
                layout="vertical"
                margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
              >
                <CartesianGrid stroke={CHART.grid} horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: CHART.axis }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: CHART.axis }}
                  axisLine={false}
                  tickLine={false}
                  width={110}
                />
                <Tooltip
                  formatter={(v: number) => [`${v.toFixed(2)}%/año`]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="rentAnual" name="Rent. anual %" radius={[0, 4, 4, 0]}>
                  {rentData.map((_, i) => (
                    <Cell key={i} fill={donutColors[i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardV5.Body>
        </CardV5>
      </div>
    </>
  );
};

export default RendimientosPage;
