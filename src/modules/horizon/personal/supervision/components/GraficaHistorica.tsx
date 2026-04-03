import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

export interface DatoAnual {
  año: number;
  gastoVida: number;
  financiacion: number;
  excedente: number;
}

interface GraficaHistoricaProps {
  datos: DatoAnual[];
  añoActual: number;
}

const fmtK = (v: number) => {
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}k`;
  return `${v}`;
};

const fmtEur = (v: number) =>
  new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(v) + ' €';

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--white, #FFF)',
      border: '1px solid var(--grey-200, #DDE3EC)',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 12,
      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--grey-900)' }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.fill, flexShrink: 0 }} />
          <span style={{ color: 'var(--grey-700)' }}>{p.name}:</span>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontVariantNumeric: 'tabular-nums',
            fontWeight: 600,
            color: 'var(--grey-900)',
          }}>
            {fmtEur(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

const GraficaHistorica: React.FC<GraficaHistoricaProps> = ({ datos, añoActual }) => {
  if (!datos.length) return null;

  return (
    <div style={{
      background: 'var(--white, #FFFFFF)',
      border: '1px solid var(--grey-200, #DDE3EC)',
      borderRadius: 'var(--r-lg, 12px)',
      padding: '16px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
      }}>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--grey-500, #6C757D)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        }}>
          Evolución histórica
        </span>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {[
            { color: '#042C5E', label: 'Excedente' },
            { color: '#C8D0DC', label: 'Gasto vida' },
            { color: '#1DA0BA', label: 'Financiación' },
          ].map((l) => (
            <div key={l.label} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', background: l.color, display: 'inline-block',
              }} />
              <span style={{
                fontSize: 11,
                color: 'var(--grey-500)',
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              }}>
                {l.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={datos} barCategoryGap="20%">
          <XAxis
            dataKey="año"
            axisLine={false}
            tickLine={false}
            tick={({ x, y, payload }: any) => (
              <text
                x={x}
                y={y + 14}
                textAnchor="middle"
                style={{
                  fontSize: 12,
                  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                  fill: payload.value === añoActual ? '#1DA0BA' : '#303A4C',
                  fontWeight: payload.value === añoActual ? 600 : 400,
                }}
              >
                {payload.value}
              </text>
            )}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tickFormatter={fmtK}
            tick={{
              fontSize: 11,
              fill: '#6C757D',
              fontFamily: "'IBM Plex Mono', monospace",
            } as any}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--grey-50, #F8F9FA)' }} />
          {/* Stack order: bottom → top: gastoVida, financiacion, excedente */}
          <Bar dataKey="gastoVida" stackId="a" name="Gasto vida" radius={[0, 0, 0, 0]}>
            {datos.map((d) => (
              <Cell key={d.año} fill="#C8D0DC" />
            ))}
          </Bar>
          <Bar dataKey="financiacion" stackId="a" name="Financiación">
            {datos.map((d) => (
              <Cell key={d.año} fill="#1DA0BA" />
            ))}
          </Bar>
          <Bar dataKey="excedente" stackId="a" name="Excedente" radius={[4, 4, 0, 0]}>
            {datos.map((d) => (
              <Cell key={d.año} fill="#042C5E" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default GraficaHistorica;
