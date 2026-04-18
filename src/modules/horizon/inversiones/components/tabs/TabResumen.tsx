// TabResumen.tsx
// ATLAS HORIZON: Resumen tab for investment portfolio dashboard

import React, { useState, useMemo } from 'react';
import { TrendingUp, Wallet, ArrowUpRight, Activity } from 'lucide-react';
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
import { TabResumenProps, PositionRow } from '../types';
import { KpiCard, ChartCard, Chip, ResultRow } from '../cards';
import {
  formatCurrency,
  formatPercent,
  buildProyInv,
  CHART_COLORS,
} from '../utils';

const TabResumen: React.FC<TabResumenProps> = ({ positions, planesPension }) => {
  const [horizon, setHorizon] = useState(10);
  
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
  const totalAportado = safePositions.reduce((sum, p) => sum + p.aportado, 0);
  const valorTotal = safePositions.reduce((sum, p) => sum + p.valor, 0);
  const ganancia = valorTotal - totalAportado;
  const rentabilidadTotal = totalAportado > 0 ? (ganancia / totalAportado) * 100 : 0;

  // Weighted annual return (calculated, not hardcoded)
  const rentAnualPonderada =
    valorTotal > 0
      ? safePositions.reduce(
          (sum, p) => sum + p.rentAnual * (p.valor / valorTotal),
          0
        )
      : 0;

  const proyData = useMemo(
    () => buildProyInv(horizon, valorTotal, totalAportado, rentAnualPonderada),
    [horizon, totalAportado, valorTotal, rentAnualPonderada]
  );

  // Best position: by annual return (not just capital gain)
  const best = safePositions.reduce(
    (a, b) => (a.rentAnual > b.rentAnual ? a : b),
    safePositions[0]
  );

  // Most stable position: fixed-income types first, then lowest |rentPct| variance
  const tiposRentaFija = [
    'prestamo_p2p',
    'deposito_plazo',
    'deposito',
    'cuenta_remunerada',
  ];
  const posicionEstable = (() => {
    const fijas = safePositions.filter((p) => tiposRentaFija.includes(p.tipo));
    if (fijas.length)
      return fijas.reduce((a, b) => (a.rentAnual > b.rentAnual ? a : b));
    // Fallback: position with lowest absolute volatility proxy (smallest |rentPct - rentAnual|)
    return safePositions.reduce((a, b) =>
      Math.abs(a.rentPct - a.rentAnual) <= Math.abs(b.rentPct - b.rentAnual)
        ? a
        : b
    );
  })();

  // Calculated multiple
  const multiplo = totalAportado > 0 ? valorTotal / totalAportado : 0;

  return (
    <div>
      {/* Mejor posición (card neutra, sin hero navy) */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #DDE3EC',
          borderRadius: 12,
          padding: 20,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          marginBottom: 16,
        }}
      >
        <p
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: '#6C757D',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            margin: 0,
            marginBottom: 6,
          }}
        >
          Mejor posición
        </p>
        <p
          style={{
            fontSize: 18,
            fontWeight: 700,
            fontFamily: "'IBM Plex Mono', monospace",
            color: '#042C5E',
            margin: 0,
            marginBottom: 2,
          }}
        >
          {best.alias}
        </p>
        <p
          style={{
            fontSize: 13,
            fontFamily: "'IBM Plex Mono', monospace",
            color: '#042C5E',
            fontWeight: 600,
            margin: 0,
          }}
        >
          {best.rentAnual >= 0 ? '+' : ''}
          {best.rentAnual.toFixed(2)}% / año
        </p>
      </div>

      {/* KPI row 1 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4,1fr)',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <KpiCard
          label="Valor total portfolio"
          value={formatCurrency(valorTotal)}
          meta={
            <>
              <Chip color="var(--s-pos)" bg="var(--s-pos-bg)">
                <TrendingUp size={10} /> {formatPercent(rentabilidadTotal)}
              </Chip>{' '}
              sobre aportado
            </>
          }
          accentColor={CHART_COLORS.navy900}
          icon={Wallet}
        />
        <KpiCard
          label="Capital aportado"
          value={formatCurrency(totalAportado)}
          meta="Inversión acumulada total"
          accentColor={CHART_COLORS.c2}
          icon={ArrowUpRight}
        />
        <KpiCard
          label="Ganancia no realizada"
          value={`${ganancia >= 0 ? '+' : ''}${formatCurrency(ganancia)}`}
          meta="Si liquidas hoy (antes de impuestos)"
          accentColor="var(--s-pos)"
          valueColor="var(--s-pos)"
          icon={TrendingUp}
          iconBg="var(--s-pos-bg)"
        />
        <KpiCard
          label="Posiciones activas"
          value={`${positions.length}`}
          meta="Posiciones en cartera"
          accentColor={CHART_COLORS.teal600}
          icon={Activity}
        />
      </div>

      {/* KPI row 2 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3,1fr)',
          gap: 16,
          marginBottom: 16,
        }}
      >
        {[
          {
            label: 'Rentabilidad total portfolio',
            val: formatPercent(rentabilidadTotal),
            meta: 'Desde primera aportación',
          },
          {
            label: 'Rentabilidad anualizada',
            val: formatPercent(rentAnualPonderada),
            meta: '/ año · media ponderada',
          },
          {
            label: 'Mejor posición',
            val: `${best.alias} ${formatPercent(best.rentAnual)}`,
            meta: `${best.rentAnual.toFixed(2)}% / año · ${best.broker}`,
          },
        ].map((k) => (
          <div
            key={k.label}
            style={{
              background: 'var(--white, #fff)',
              border: '1px solid var(--grey-300, #C8D0DC)',
              borderRadius: 12,
              padding: 20,
            }}
          >
            <div
              style={{
                fontSize: 11,
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
                fontSize: k.val.length > 14 ? 20 : 30,
                fontWeight: 600,
                color: CHART_COLORS.navy900,
                lineHeight: 1,
                marginBottom: 4,
              }}
            >
              {k.val}
            </div>
            <div style={{ fontSize: 12, color: 'var(--grey-500, #6C757D)' }}>
              {k.meta}
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <ChartCard
          title="Proyección del portfolio"
          sub={`Valor proyectado a ${formatPercent(rentAnualPonderada)}/año`}
          right={
            <div
              style={{
                display: 'inline-flex',
                gap: 2,
                background: 'var(--grey-100, #EEF1F5)',
                borderRadius: 8,
                padding: 3,
              }}
            >
              {[5, 10, 20].map((y) => (
                <button
                  key={y}
                  onClick={() => setHorizon(y)}
                  style={{
                    padding: '5px 12px',
                    fontSize: 12,
                    fontWeight: horizon === y ? 600 : 500,
                    color:
                      horizon === y
                        ? CHART_COLORS.navy900
                        : CHART_COLORS.grey500,
                    background: horizon === y ? '#fff' : 'transparent',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    boxShadow:
                      horizon === y ? '0 1px 3px rgba(4,44,94,.08)' : 'none',
                    fontFamily: 'inherit',
                  }}
                >
                  {y}a
                </button>
              ))}
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={proyData}
              margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
            >
              <CartesianGrid stroke="rgba(200,208,220,.4)" strokeDasharray="0" />
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
                tickFormatter={(v) =>
                  v >= 1e6
                    ? `${(v / 1e6).toFixed(1)}M`
                    : `${(v / 1000).toFixed(0)}k`
                }
              />
              <Tooltip
                formatter={(v: number) => [`${v.toLocaleString('es-ES')} €`]}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: `1px solid ${CHART_COLORS.grey300}`,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Line
                type="monotone"
                dataKey="valor"
                name="Valor estimado"
                stroke={CHART_COLORS.navy900}
                strokeWidth={2}
                dot={{ r: 3, fill: CHART_COLORS.navy900 }}
              />
              <Line
                type="monotone"
                dataKey="coste"
                name="Capital aportado"
                stroke={CHART_COLORS.c2}
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={{ r: 3, fill: CHART_COLORS.c2 }}
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
            Resumen del portfolio
          </div>
          <ResultRow label="Total aportado" value={formatCurrency(totalAportado)} />
          <ResultRow label="Valor actual" value={formatCurrency(valorTotal)} />
          <ResultRow
            label="Ganancia no realizada"
            value={`${ganancia >= 0 ? '+' : ''}${formatCurrency(ganancia)}`}
            valueColor="var(--s-pos)"
          />
          <ResultRow
            label="Rentabilidad total"
            value={formatPercent(rentabilidadTotal)}
            valueColor="var(--s-pos)"
          />
          <ResultRow label="Mejor posición" value={best.alias} />
          <ResultRow label="Posición más estable" value={posicionEstable.alias} />
          <div
            style={{
              height: 1,
              background: 'var(--grey-300, #C8D0DC)',
              margin: '8px 0',
            }}
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
              Múltiplo sobre capital
            </span>
            <span
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 20,
                fontWeight: 600,
                color: CHART_COLORS.navy900,
              }}
            >
              {totalAportado > 0
                ? `× ${multiplo.toFixed(2).replace('.', ',')}`
                : '—'}
            </span>
          </div>
        </div>
      </div>

    </div>
  );
};

export default TabResumen;
