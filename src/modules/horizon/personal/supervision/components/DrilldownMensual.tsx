import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import KpiExcedente from './KpiExcedente';
import LateralDesglose from './LateralDesglose';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export interface DatoMensual {
  mes: number;
  label: string;
  neto: number;
  gastoVida: number;
  financiacion: number;
  excedente: number;
  nomina: number;
  autonomo: number;
}

interface DrilldownMensualProps {
  año: number;
  datos: DatoMensual[];
  onBack: () => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(v);

const fmtK = (v: number) => {
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}k`;
  return `${v}`;
};

const DrilldownMensual: React.FC<DrilldownMensualProps> = ({ año, datos, onBack }) => {
  const [mesActivo, setMesActivo] = useState(0); // 0-indexed

  const dm = datos[mesActivo] || {
    mes: mesActivo + 1, label: MESES[mesActivo], neto: 0, gastoVida: 0,
    financiacion: 0, excedente: 0, nomina: 0, autonomo: 0,
  };

  const netoMes = dm.neto;
  const gastoVidaMes = dm.gastoVida;
  const financiacionMes = dm.financiacion;
  const excedenteMes = dm.excedente;
  const tasaAhorroMes = netoMes > 0 ? Math.round((excedenteMes / netoMes) * 100) : null;

  const mesPrev = mesActivo > 0 ? datos[mesActivo - 1] : null;
  const deltaMes = mesPrev ? excedenteMes - mesPrev.excedente : null;
  const deltaPctMes = mesPrev && mesPrev.excedente !== 0
    ? Math.round(((excedenteMes - mesPrev.excedente) / Math.abs(mesPrev.excedente)) * 100)
    : null;

  const totalIngMes = dm.nomina + dm.autonomo;
  const totalGastosMes = gastoVidaMes + financiacionMes;

  // Estimate breakdown for expenses
  const alquilerMes = Math.round(gastoVidaMes * 0.45);
  const alimentacionMes = Math.round(gastoVidaMes * 0.30);
  const restoMes = gastoVidaMes - alquilerMes - alimentacionMes;

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 20,
      }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            color: 'var(--navy-900, #042C5E)',
            fontWeight: 500,
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          }}
        >
          <ArrowLeft size={14} />
          Historial Personal
        </button>
        <span style={{ color: 'var(--grey-400)', fontSize: 13 }}>/</span>
        <span style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--grey-900, #1A2332)',
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        }}>
          {año}
        </span>
      </div>

      {/* Month pills */}
      <div style={{
        display: 'flex',
        gap: 4,
        marginBottom: 20,
        flexWrap: 'wrap',
      }}>
        {MESES.map((m, i) => (
          <button
            key={m}
            onClick={() => setMesActivo(i)}
            style={{
              padding: '6px 12px',
              borderRadius: 16,
              border: 'none',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              background: i === mesActivo ? 'var(--navy-900, #042C5E)' : 'var(--grey-100, #EEF1F5)',
              color: i === mesActivo ? 'var(--white, #FFF)' : 'var(--grey-700, #303A4C)',
              transition: 'all 150ms ease',
            }}
          >
            {m}
          </button>
        ))}
      </div>

      {/* KPIs mensuales */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16,
        marginBottom: 20,
      }}>
        {/* KPI 1 - Ingresos netos mes */}
        <KpiStd
          barColor="var(--navy-900, #042C5E)"
          label={`INGRESOS NETOS ${MESES[mesActivo]}`}
          value={netoMes}
          sub="Estimación mensual"
          valueColor="var(--navy-900, #042C5E)"
          badgeLabel="Estimación mensual"
        />

        {/* KPI 2 - Gasto de vida mes */}
        <KpiStd
          barColor="var(--grey-300, #C8D0DC)"
          label={`GASTO DE VIDA ${MESES[mesActivo]}`}
          value={gastoVidaMes}
          prefix="~"
          sub="Gastos personales · mes"
          valueColor="var(--grey-900, #1A2332)"
          badgeLabel="Estimación mensual"
        />

        {/* KPI 3 - Financiación mes */}
        <KpiStd
          barColor="var(--teal-600, #1DA0BA)"
          label={`FINANCIACIÓN ${MESES[mesActivo]}`}
          value={financiacionMes}
          prefix="−"
          sub="Cuotas préstamos · mes"
          valueColor="var(--teal-600, #1DA0BA)"
          badgeLabel="Estimación mensual"
        />

        {/* KPI 4 - Excedente (KPI-D) */}
        <KpiExcedente
          año={año}
          excedente={excedenteMes}
          tasaAhorro={tasaAhorroMes}
          delta={deltaMes}
          deltaPct={deltaPctMes}
          añoAnterior={mesActivo > 0 ? mesActivo : año - 1}
        />
      </div>

      {/* Grid: chart + lateral */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 300px',
        gap: 16,
      }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Monthly bar chart */}
          <div style={{
            background: 'var(--white, #FFF)',
            border: '1px solid var(--grey-200, #DDE3EC)',
            borderRadius: 'var(--r-lg, 12px)',
            padding: 16,
          }}>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--grey-500)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 12,
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            }}>
              Excedente mensual · {año}
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={datos}>
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#6C757D' }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmtK}
                  tick={{ fontSize: 11, fill: '#6C757D' } as any}
                  width={36}
                />
                <Tooltip
                  formatter={(v: number) => [`${fmt(v)} €`, 'Excedente']}
                  contentStyle={{
                    background: '#FFF',
                    border: '1px solid var(--grey-200)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="excedente" radius={[3, 3, 0, 0]}>
                  {datos.map((_, i) => (
                    <Cell
                      key={i}
                      fill={i === mesActivo ? '#1DA0BA' : '#042C5E'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Detail cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Ingresos del mes */}
            <div style={{
              background: 'var(--navy-100, #E8EFF7)',
              borderRadius: 'var(--r-lg, 12px)',
              padding: 16,
            }}>
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--grey-500)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 12,
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              }}>
                Ingresos · {MESES[mesActivo]}
              </div>
              <DetailRow label="Nómina" value={dm.nomina} color="var(--navy-900)" />
              <DetailRow label="Autónomo" value={dm.autonomo} color="var(--navy-700, #142C50)" />
              <div style={{
                borderTop: '1px solid var(--grey-300)',
                marginTop: 8,
                paddingTop: 8,
              }}>
                <DetailRow label="Total" value={totalIngMes} color="var(--navy-900)" bold />
              </div>
            </div>

            {/* Gastos del mes */}
            <div style={{
              background: 'var(--grey-100, #EEF1F5)',
              borderRadius: 'var(--r-lg, 12px)',
              padding: 16,
            }}>
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--grey-500)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 12,
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              }}>
                Gastos · {MESES[mesActivo]} <span style={{ fontWeight: 400, fontStyle: 'italic' }}>(est.)</span>
              </div>
              <DetailRow label="Alquiler" value={alquilerMes} color="var(--grey-700)" />
              <DetailRow label="Alimentación" value={alimentacionMes} color="var(--grey-700)" />
              <DetailRow label="Resto" value={restoMes} color="var(--grey-700)" />
              <DetailRow label="Financiación" value={financiacionMes} color="var(--teal-600)" prefix="−" />
              <div style={{
                borderTop: '1px solid var(--grey-300)',
                marginTop: 8,
                paddingTop: 8,
              }}>
                <DetailRow label="Total" value={totalGastosMes} color="var(--grey-900)" bold />
              </div>
            </div>
          </div>
        </div>

        {/* Right column - Lateral */}
        <LateralDesglose
          año={año}
          fuentes={[
            {
              nombre: 'Nómina',
              importe: dm.nomina,
              porcentaje: totalIngMes > 0 ? Math.round((dm.nomina / totalIngMes) * 100) : 0,
              iconKey: 'nomina',
            },
            {
              nombre: 'Autónomo',
              importe: dm.autonomo,
              porcentaje: totalIngMes > 0 ? Math.round((dm.autonomo / totalIngMes) * 100) : 0,
              iconKey: 'autonomo',
            },
          ]}
          costesVida={[
            { nombre: 'Alquiler', importe: alquilerMes, iconKey: 'alquiler' },
            { nombre: 'Alimentación', importe: alimentacionMes, iconKey: 'alimentacion' },
            { nombre: 'Resto', importe: restoMes, iconKey: 'seguros' },
          ]}
          financiacion={financiacionMes}
          gastoVidaEstimado
        />
      </div>
    </div>
  );
};

// ── Helpers ──

const KpiStd: React.FC<{
  barColor: string;
  label: string;
  value: number | null;
  prefix?: string;
  sub: string;
  valueColor: string;
  badgeLabel: string;
}> = ({ barColor, label, value, prefix = '', sub, valueColor, badgeLabel }) => (
  <div style={{
    background: 'var(--white, #FFF)',
    border: '1px solid var(--grey-200, #DDE3EC)',
    borderRadius: 'var(--r-lg, 12px)',
    overflow: 'hidden',
  }}>
    <div style={{ height: 3, background: barColor }} />
    <div style={{ padding: '18px 16px 14px' }}>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--grey-500)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 10,
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 24,
        fontWeight: 700,
        color: valueColor,
        fontFamily: "'IBM Plex Mono', monospace",
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.2,
      }}>
        {value !== null ? `${prefix}${fmt(value)} €` : '—'}
      </div>
      <div style={{
        fontSize: 11,
        color: 'var(--grey-500)',
        marginTop: 4,
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      }}>
        {sub}
      </div>
      <span style={{
        display: 'inline-block',
        fontSize: 10,
        fontWeight: 500,
        padding: '2px 8px',
        borderRadius: 10,
        background: 'var(--grey-100, #EEF1F5)',
        color: 'var(--grey-400, #9CA3AF)',
        fontStyle: 'italic',
        marginTop: 8,
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      }}>
        {badgeLabel}
      </span>
    </div>
  </div>
);

const DetailRow: React.FC<{
  label: string;
  value: number;
  color: string;
  bold?: boolean;
  prefix?: string;
}> = ({ label, value, color, bold, prefix = '' }) => (
  <div style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '3px 0',
  }}>
    <span style={{
      fontSize: 12,
      color: 'var(--grey-700)',
      fontWeight: bold ? 600 : 400,
      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    }}>
      {label}
    </span>
    <span style={{
      fontSize: 12,
      fontWeight: bold ? 700 : 600,
      color,
      fontFamily: "'IBM Plex Mono', monospace",
      fontVariantNumeric: 'tabular-nums',
    }}>
      {prefix}{fmt(value)} €
    </span>
  </div>
);

export default DrilldownMensual;
