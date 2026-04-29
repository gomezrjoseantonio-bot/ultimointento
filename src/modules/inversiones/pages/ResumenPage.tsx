import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
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
import { CardV5, MoneyValue, useChartColors } from '../../../design-system/v5';
import type { InversionesOutletContext } from '../InversionesContext';
import { buildProyInv, formatPercent } from '../helpers';
import styles from './ResumenPage.module.css';

const ResumenPage: React.FC = () => {
  const { positions } = useOutletContext<InversionesOutletContext>();
  const [horizon, setHorizon] = useState(10);
  const CHART_COLORS = useChartColors();

  const totalAportado = positions.reduce((s, p) => s + p.aportado, 0);
  const valorTotal = positions.reduce((s, p) => s + p.valor, 0);
  const ganancia = valorTotal - totalAportado;
  const rentabilidadTotal = totalAportado > 0 ? (ganancia / totalAportado) * 100 : 0;

  const rentAnualPonderada =
    valorTotal > 0
      ? positions.reduce((s, p) => s + p.rentAnual * (p.valor / valorTotal), 0)
      : 0;

  const proyData = useMemo(
    () => buildProyInv(horizon, valorTotal, totalAportado, rentAnualPonderada),
    [horizon, valorTotal, totalAportado, rentAnualPonderada],
  );

  const best = positions.reduce(
    (a, b) => (a && a.rentAnual > b.rentAnual ? a : b),
    positions[0],
  );

  const tiposRentaFija = ['prestamo_p2p', 'deposito_plazo', 'deposito', 'cuenta_remunerada'];
  const posicionEstable = (() => {
    if (positions.length === 0) return null;
    const fijas = positions.filter((p) => tiposRentaFija.includes(p.tipo));
    if (fijas.length) return fijas.reduce((a, b) => (a.rentAnual > b.rentAnual ? a : b));
    return positions.reduce((a, b) =>
      Math.abs(a.rentPct - a.rentAnual) <= Math.abs(b.rentPct - b.rentAnual) ? a : b,
    );
  })();

  const multiplo = totalAportado > 0 ? valorTotal / totalAportado : 0;

  if (positions.length === 0) {
    return (
      <CardV5>
        <CardV5.Body>
          <div style={{ padding: '24px 8px', textAlign: 'center', color: 'var(--atlas-v5-ink-4)' }}>
            Aún no tienes posiciones registradas. Crea tu primera posición desde
            el botón <strong>Nueva posición</strong>.
          </div>
        </CardV5.Body>
      </CardV5>
    );
  }

  return (
    <>
      {best && (
        <div className={styles.heroBest}>
          <div style={{ flex: 1 }}>
            <div className={styles.label}>Mejor posición</div>
            <div className={styles.alias}>{best.alias}</div>
            <div className={styles.meta}>
              {best.rentAnual >= 0 ? '+' : ''}
              {best.rentAnual.toFixed(2)}% / año · {best.broker}
            </div>
          </div>
        </div>
      )}

      <div className={styles.kpiRow}>
        <div className={styles.kpiCard}>
          <div className={styles.label}>Valor total portfolio</div>
          <div className={styles.value}>
            <MoneyValue value={valorTotal} decimals={0} tone="ink" />
          </div>
          <div className={styles.meta}>
            {formatPercent(rentabilidadTotal)} sobre aportado
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.label}>Capital aportado</div>
          <div className={styles.value}>
            <MoneyValue value={totalAportado} decimals={0} tone="ink" />
          </div>
          <div className={styles.meta}>Inversión acumulada total</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.label}>Ganancia no realizada</div>
          <div className={styles.value}>
            <MoneyValue
              value={ganancia}
              decimals={0}
              showSign
              tone={ganancia >= 0 ? 'pos' : 'neg'}
            />
          </div>
          <div className={styles.meta}>Si liquidas hoy · antes de impuestos</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.label}>Posiciones activas</div>
          <div className={styles.value}>{positions.length}</div>
          <div className={styles.meta}>En cartera</div>
        </div>
      </div>

      <div className={styles.kpiRow3}>
        <div className={styles.kpiCard}>
          <div className={styles.label}>Rentabilidad total</div>
          <div className={styles.value}>{formatPercent(rentabilidadTotal)}</div>
          <div className={styles.meta}>Desde primera aportación</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.label}>Rentabilidad anualizada</div>
          <div className={styles.value}>{formatPercent(rentAnualPonderada)}</div>
          <div className={styles.meta}>/ año · media ponderada</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.label}>Múltiplo sobre capital</div>
          <div className={styles.value}>
            {totalAportado > 0 ? `× ${multiplo.toFixed(2).replace('.', ',')}` : '—'}
          </div>
          <div className={styles.meta}>Valor / aportado</div>
        </div>
      </div>

      <div className={styles.chartRow}>
        <CardV5>
          <CardV5.Head>
            <div>
              <CardV5.Title>Proyección del portfolio</CardV5.Title>
              <CardV5.Subtitle>
                Valor proyectado a {formatPercent(rentAnualPonderada)} / año
              </CardV5.Subtitle>
            </div>
            <div className={styles.horizonGroup} role="group" aria-label="Horizonte proyección">
              {[5, 10, 20].map((y) => (
                <button
                  key={y}
                  type="button"
                  className={horizon === y ? styles.active : ''}
                  aria-pressed={horizon === y}
                  onClick={() => setHorizon(y)}
                >
                  {y}a
                </button>
              ))}
            </div>
          </CardV5.Head>
          <CardV5.Body>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={proyData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={CHART_COLORS.grid} />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 11, fill: CHART_COLORS.axis }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: CHART_COLORS.axis }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) =>
                    v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${(v / 1000).toFixed(0)}k`
                  }
                />
                <Tooltip
                  formatter={(v: number) => [`${v.toLocaleString('es-ES')} €`]}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: `1px solid ${CHART_COLORS.border}`,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Line
                  type="monotone"
                  dataKey="valor"
                  name="Valor estimado"
                  stroke={CHART_COLORS.ink}
                  strokeWidth={2}
                  dot={{ r: 3, fill: CHART_COLORS.ink }}
                />
                <Line
                  type="monotone"
                  dataKey="coste"
                  name="Capital aportado"
                  stroke={CHART_COLORS.accent}
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={{ r: 3, fill: CHART_COLORS.accent }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardV5.Body>
        </CardV5>

        <CardV5>
          <CardV5.Title>Resumen del portfolio</CardV5.Title>
          <CardV5.Body>
            <div className={styles.summaryRow}>
              <span className={styles.lab}>Total aportado</span>
              <span className={styles.val}>
                <MoneyValue value={totalAportado} decimals={0} />
              </span>
            </div>
            <div className={styles.summaryRow}>
              <span className={styles.lab}>Valor actual</span>
              <span className={styles.val}>
                <MoneyValue value={valorTotal} decimals={0} />
              </span>
            </div>
            <div className={styles.summaryRow}>
              <span className={styles.lab}>Ganancia no realizada</span>
              <span className={`${styles.val} ${ganancia >= 0 ? styles.pos : ''}`}>
                <MoneyValue
                  value={ganancia}
                  decimals={0}
                  showSign
                  tone={ganancia >= 0 ? 'pos' : 'neg'}
                />
              </span>
            </div>
            <div className={styles.summaryRow}>
              <span className={styles.lab}>Rentabilidad total</span>
              <span className={`${styles.val} ${rentabilidadTotal >= 0 ? styles.pos : ''}`}>
                {formatPercent(rentabilidadTotal)}
              </span>
            </div>
            {best && (
              <div className={styles.summaryRow}>
                <span className={styles.lab}>Mejor posición</span>
                <span className={styles.val}>{best.alias}</span>
              </div>
            )}
            {posicionEstable && (
              <div className={styles.summaryRow}>
                <span className={styles.lab}>Posición más estable</span>
                <span className={styles.val}>{posicionEstable.alias}</span>
              </div>
            )}
            <div className={styles.divider} />
            <div className={styles.totalRow}>
              <span className={styles.lab}>Múltiplo sobre capital</span>
              <span className={styles.val}>
                {totalAportado > 0 ? `× ${multiplo.toFixed(2).replace('.', ',')}` : '—'}
              </span>
            </div>
          </CardV5.Body>
        </CardV5>
      </div>
    </>
  );
};

export default ResumenPage;
