import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface FlujoCajaChartProps {
  data: { mes: string; flujo: number; caja: number }[];
  year: number;
}

interface TokenPalette {
  pos: string;
  neg: string;
  n300: string;
  n500: string;
  white: string;
  n200: string;
}

const fallbackPalette: TokenPalette = {
  pos: 'var(--s-pos)',
  neg: 'var(--s-neg)',
  n300: 'var(--n-300)',
  n500: 'var(--n-500)',
  white: 'var(--white)',
  n200: 'var(--n-200)',
};

const formatCurrency = (value: number) => new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
}).format(value);

export default function FlujoCajaChart({ data, year }: FlujoCajaChartProps) {
  const [palette, setPalette] = useState<TokenPalette>(fallbackPalette);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const styles = getComputedStyle(document.documentElement);
    setPalette({
      pos: styles.getPropertyValue('--s-pos').trim() || fallbackPalette.pos,
      neg: styles.getPropertyValue('--s-neg').trim() || fallbackPalette.neg,
      n300: styles.getPropertyValue('--n-300').trim() || fallbackPalette.n300,
      n500: styles.getPropertyValue('--n-500').trim() || fallbackPalette.n500,
      white: styles.getPropertyValue('--white').trim() || fallbackPalette.white,
      n200: styles.getPropertyValue('--n-200').trim() || fallbackPalette.n200,
    });
  }, []);

  const bars = useMemo(() => data.map((item) => ({
    ...item,
    fill: item.flujo >= 0 ? palette.pos : palette.neg,
  })), [data, palette.neg, palette.pos]);

  return (
    <section className="chart-container" aria-label="Gráfico de flujo de caja mensual">
      <div className="chart-header">
        <div>
          <h2 className="chart-title">Flujo de caja mensual</h2>
          <p className="chart-subtitle">Ingresos − Gastos − Financiación · {year}</p>
        </div>

        <div className="chart-legend" aria-hidden="true">
          <span className="chart-legend__item">
            <span className="chart-legend__swatch" style={{ background: 'var(--s-pos)' }} />
            Positivo
          </span>
          <span className="chart-legend__item">
            <span className="chart-legend__swatch" style={{ background: 'var(--s-neg)' }} />
            Negativo
          </span>
        </div>
      </div>

      <div style={{ height: 130 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bars} barSize={22}>
            <XAxis
              dataKey="mes"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: palette.n500, fontFamily: 'var(--font-base)' }}
            />
            <YAxis hide />
            <ReferenceLine y={0} stroke={palette.n300} strokeDasharray="3 3" />
            <Tooltip
              cursor={{ fill: 'var(--n-100)' }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const current = payload[0]?.payload as { flujo: number; caja: number } | undefined;
                if (!current) return null;

                const color = current.flujo >= 0 ? palette.pos : palette.neg;

                return (
                  <div style={{
                    background: palette.white,
                    border: `1px solid ${palette.n200}`,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    borderRadius: 'var(--r-md)',
                    padding: 'var(--s3)',
                  }}>
                    <p style={{ margin: 0, color: palette.n500, fontSize: 'var(--t-xs)' }}>{label} · Flujo</p>
                    <p style={{ margin: 'var(--s1) 0 0', color, fontSize: 'var(--t-sm)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(current.flujo)}
                    </p>
                    <p style={{ margin: 'var(--s1) 0 0', color: palette.n500, fontSize: 'var(--t-xs)' }}>
                      Caja final: <span style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(current.caja)}</span>
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="flujo" radius={[4, 4, 0, 0]} opacity={0.85}>
              {bars.map((entry) => (
                <Cell key={entry.mes} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
