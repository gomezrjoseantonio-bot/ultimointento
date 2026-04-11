// TabIndividual.tsx
// ATLAS HORIZON: Individual position analysis tab

import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TabIndividualProps, PositionRow } from '../types';
import { ChartCard, ResultRow } from '../cards';
import {
  formatCurrency,
  formatPercent,
  buildIndividualEvolucion,
  CHART_COLORS,
} from '../utils';

const TabIndividual: React.FC<TabIndividualProps> = ({
  selectedId,
  positions,
}) => {
  const [posId, setPosId] = useState(selectedId || '');

  const emptyRow: PositionRow = {
    id: 'empty',
    alias: 'Sin datos',
    broker: '-',
    tipo: '-',
    aportado: 0,
    valor: 0,
    rentPct: 0,
    rentAnual: 0,
    peso: 0,
    color: CHART_COLORS.navy900,
    tag: null,
    fechaCompra: null,
    duracionMeses: null,
  };

  const safePositions = positions.length ? positions : [emptyRow];
  const pos = safePositions.find((p) => p.id === posId) ?? safePositions[0];
  const evolData = buildIndividualEvolucion(pos);

  return (
    <div>
      {/* Selector */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <label
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--grey-700, #303A4C)',
          }}
        >
          Posición
        </label>
        <select
          value={posId}
          onChange={(e) => setPosId(e.target.value)}
          style={{
            padding: '7px 12px',
            border: '1.5px solid var(--grey-300, #C8D0DC)',
            borderRadius: 8,
            fontSize: 13,
            color: 'var(--grey-700, #303A4C)',
            background: 'var(--white, #fff)',
            cursor: 'pointer',
            minWidth: 280,
            fontFamily: 'inherit',
          }}
        >
          {safePositions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.alias} · {p.broker}
            </option>
          ))}
        </select>
      </div>

      {/* Timeline */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '.1em',
          textTransform: 'uppercase',
          color: 'var(--grey-500, #6C757D)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 8,
        }}
      >
        Foto pasado · presente · proyección
        <div
          style={{
            flex: 1,
            height: 1,
            background: 'var(--grey-200, #DDE3EC)',
          }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 20,
        }}
      >
        {[
          {
            label: 'Aportado',
            val: formatCurrency(pos.aportado),
            sub: 'Capital invertido total',
            cls: 'past',
          },
          {
            label: 'Hoy',
            val: formatCurrency(pos.valor),
            sub: `Valor estimado · ${new Date().toLocaleDateString('es-ES', {
              month: 'short',
              year: 'numeric',
            })}`,
            cls: 'present',
          },
          {
            label: 'Proyección 5 años',
            val: `~${formatCurrency(
              Math.round(pos.valor * Math.pow(1 + pos.rentAnual / 100, 5))
            )}`,
            sub: `A ${pos.rentAnual.toFixed(2)}% anual`,
            cls: 'future',
          },
          {
            label: 'Proyección 10 años',
            val: `~${formatCurrency(
              Math.round(pos.valor * Math.pow(1 + pos.rentAnual / 100, 10))
            )}`,
            sub: `A ${pos.rentAnual.toFixed(2)}% anual`,
            cls: 'future',
          },
        ].map((t) => (
          <div
            key={t.label}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 8,
              border: `1px solid ${
                t.cls === 'present'
                  ? CHART_COLORS.navy900
                  : t.cls === 'future'
                  ? CHART_COLORS.teal600
                  : 'var(--grey-200, #DDE3EC)'
              }`,
              background:
                t.cls === 'present'
                  ? 'rgba(4,44,94,.04)'
                  : t.cls === 'future'
                  ? 'rgba(29,160,186,.04)'
                  : 'var(--grey-50, #F8F9FA)',
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '.08em',
                color: 'var(--grey-500, #6C757D)',
                marginBottom: 4,
              }}
            >
              {t.label}
            </div>
            <div
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 17,
                fontWeight: 600,
                color: 'var(--grey-700, #303A4C)',
              }}
            >
              {t.val}
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--grey-500, #6C757D)',
                marginTop: 2,
              }}
            >
              {t.sub}
            </div>
          </div>
        ))}
      </div>

      {/* KPI strip */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 20,
          overflowX: 'auto',
        }}
      >
        {[
          {
            label: 'Ganancia no realizada',
            val: `+${formatCurrency(pos.valor - pos.aportado)}`,
            meta: 'Valor − aportado',
            color: 'var(--s-pos, #042C5E)',
          },
          {
            label: 'Rentabilidad total',
            val: formatPercent(pos.rentPct),
            meta: 'Acumulada total',
            color: 'var(--s-pos, #042C5E)',
          },
          {
            label: 'Rentabilidad anual',
            val: `${pos.rentAnual.toFixed(2)}%/a`,
            meta: 'CAGR estimado',
            color: CHART_COLORS.navy900,
          },
          {
            label: 'Múltiplo s/ capital',
            val: `× ${(pos.valor / pos.aportado).toFixed(2)}`,
            meta: 'Valor / aportado',
            color: CHART_COLORS.navy900,
          },
          {
            label: 'Peso portfolio',
            val: `${pos.peso}%`,
            meta: 'Del total',
            color: 'var(--grey-500, #6C757D)',
          },
        ].map((k) => (
          <div
            key={k.label}
            style={{
              background: 'var(--white, #fff)',
              border: '1px solid var(--grey-300, #C8D0DC)',
              borderRadius: 12,
              padding: 14,
              flexShrink: 0,
              minWidth: 130,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                color: 'var(--grey-500, #6C757D)',
                marginBottom: 4,
              }}
            >
              {k.label}
            </div>
            <div
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 18,
                fontWeight: 600,
                color: k.color,
              }}
            >
              {k.val}
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--grey-500, #6C757D)',
                marginTop: 2,
              }}
            >
              {k.meta}
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: 20,
        }}
      >
        <ChartCard
          title={`${pos.alias} — Evolución y proyección`}
          sub={`Valor histórico + proyección a tasa ${pos.rentAnual.toFixed(
            2
          )}%/año`}
        >
          <ResponsiveContainer width="100%" height={260}>
            <LineChart
              data={evolData}
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
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="hist"
                name="Valor histórico"
                stroke={CHART_COLORS.navy900}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="proy"
                name={`Proyección (${pos.rentAnual.toFixed(2)}%/a)`}
                stroke={CHART_COLORS.teal600}
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={{ r: 3 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <div
          style={{
            background: 'var(--white, #fff)',
            border: '1px solid var(--grey-300, #C8D0DC)',
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--grey-700, #303A4C)',
              marginBottom: 16,
            }}
          >
            Ficha de posición
          </div>
          <ResultRow label="Nombre" value={pos.alias} />
          <ResultRow label="Broker / Plataforma" value={pos.broker} />
          <ResultRow label="Tipo de activo" value={pos.tipo} />
          <ResultRow label="Capital aportado" value={formatCurrency(pos.aportado)} />
          <ResultRow label="Valor actual" value={formatCurrency(pos.valor)} />
          <ResultRow
            label="Ganancia no realizada"
            value={`+${formatCurrency(pos.valor - pos.aportado)}`}
            valueColor="var(--s-pos, #042C5E)"
          />
          <div
            style={{
              height: 1,
              background: 'var(--grey-300, #C8D0DC)',
              margin: '8px 0',
            }}
          />
          <ResultRow
            label="Rentabilidad total"
            value={formatPercent(pos.rentPct)}
            valueColor="var(--s-pos, #042C5E)"
            bold
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              paddingTop: 10,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--grey-700, #303A4C)',
              }}
            >
              CAGR estimado
            </span>
            <span
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 20,
                fontWeight: 600,
                color: CHART_COLORS.navy900,
              }}
            >
              {pos.rentAnual.toFixed(2)}%/a
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TabIndividual;
