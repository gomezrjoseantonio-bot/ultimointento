import React, { useMemo } from 'react';
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
import { CardV5, MoneyValue } from '../../../design-system/v5';
import type { InversionesOutletContext } from '../InversionesContext';
import {
  buildIndividualEvolucion,
  calcularHorizonteProyeccion,
  formatPercent,
  labelTipo,
} from '../helpers';
import styles from './IndividualPage.module.css';

const CHART = {
  ink: '#0E2A47',
  accent: '#1DA0BA',
  grid: 'rgba(200,208,220,.4)',
  axis: '#6C757D',
};

const IndividualPage: React.FC = () => {
  const { positions, selectedPositionId, setSelectedPositionId } =
    useOutletContext<InversionesOutletContext>();

  const pos = useMemo(
    () =>
      positions.length > 0
        ? positions.find((p) => p.id === selectedPositionId) ?? positions[0]
        : null,
    [positions, selectedPositionId],
  );

  const evolData = useMemo(
    () => (pos ? buildIndividualEvolucion(pos) : []),
    [pos],
  );

  const proyeccionCards = useMemo(() => {
    if (!pos) return [];
    const horizonte = calcularHorizonteProyeccion(pos);
    const currentYear = new Date().getFullYear();
    const subMeta = `A ${pos.rentAnual.toFixed(2)}% anual`;
    const tasa = pos.rentAnual / 100;

    const labelFor = (años: number, meses: number | null) => {
      if (meses != null) return `En ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
      const a = Math.round(años);
      return `En ${a} ${a === 1 ? 'año' : 'años'} · ${currentYear + a}`;
    };

    if (horizonte.años <= 2) {
      const val = Math.round(pos.valor * Math.pow(1 + tasa, horizonte.años));
      return [
        {
          label: labelFor(horizonte.años, horizonte.meses),
          val,
          meta: subMeta,
        },
      ];
    }

    const mediaMeses = horizonte.meses != null ? Math.round(horizonte.meses / 2) : null;
    const mediaAños = mediaMeses != null ? mediaMeses / 12 : Math.round(horizonte.años / 2);
    const halfVal = Math.round(pos.valor * Math.pow(1 + tasa, mediaAños));
    const fullVal = Math.round(pos.valor * Math.pow(1 + tasa, horizonte.años));
    return [
      { label: labelFor(mediaAños, mediaMeses), val: halfVal, meta: subMeta },
      { label: labelFor(horizonte.años, horizonte.meses), val: fullVal, meta: subMeta },
    ];
  }, [pos]);

  if (!pos) {
    return (
      <CardV5>
        <CardV5.Body>
          <div className={styles.empty}>
            Aún no tienes posiciones. Crea tu primera desde <strong>Nueva posición</strong>.
          </div>
        </CardV5.Body>
      </CardV5>
    );
  }

  const ganancia = pos.valor - pos.aportado;
  const multiplo = pos.aportado > 0 ? pos.valor / pos.aportado : 0;

  return (
    <>
      <div className={styles.selector}>
        <label htmlFor="indiv-selector">Posición</label>
        <select
          id="indiv-selector"
          value={pos.id}
          onChange={(e) => setSelectedPositionId(e.target.value)}
        >
          {positions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.alias} · {p.broker}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.timelineLabel}>
        Foto pasado · presente · proyección
        <div className={styles.line} />
      </div>

      <div className={styles.timelineRow}>
        <div className={styles.timelineCard}>
          <div className={styles.label}>Aportado</div>
          <div className={styles.val}>
            <MoneyValue value={pos.aportado} decimals={0} tone="ink" />
          </div>
          <div className={styles.meta}>Capital invertido total</div>
        </div>
        <div className={`${styles.timelineCard} ${styles.present}`}>
          <div className={styles.label}>Hoy</div>
          <div className={styles.val}>
            <MoneyValue value={pos.valor} decimals={0} tone="ink" />
          </div>
          <div className={styles.meta}>
            Valor estimado ·{' '}
            {new Date().toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}
          </div>
        </div>
        {proyeccionCards.map((t) => (
          <div key={t.label} className={`${styles.timelineCard} ${styles.future}`}>
            <div className={styles.label}>{t.label}</div>
            <div className={styles.val}>
              ~ <MoneyValue value={t.val} decimals={0} tone="ink" />
            </div>
            <div className={styles.meta}>{t.meta}</div>
          </div>
        ))}
      </div>

      <div className={styles.kpiStrip}>
        <div className={`${styles.kpiCard} ${ganancia >= 0 ? styles.pos : styles.neg}`}>
          <div className={styles.label}>Ganancia no realizada</div>
          <div className={styles.val}>
            <MoneyValue
              value={ganancia}
              decimals={0}
              showSign
              tone={ganancia >= 0 ? 'pos' : 'neg'}
            />
          </div>
          <div className={styles.meta}>Valor − aportado</div>
        </div>
        <div className={`${styles.kpiCard} ${pos.rentPct >= 0 ? styles.pos : styles.neg}`}>
          <div className={styles.label}>Rentabilidad total</div>
          <div className={styles.val}>{formatPercent(pos.rentPct)}</div>
          <div className={styles.meta}>Acumulada total</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.label}>Rent. anual</div>
          <div className={styles.val}>{pos.rentAnual.toFixed(2)}%/a</div>
          <div className={styles.meta}>CAGR estimado</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.label}>Múltiplo s/ capital</div>
          <div className={styles.val}>
            {pos.aportado > 0 ? `× ${multiplo.toFixed(2).replace('.', ',')}` : '—'}
          </div>
          <div className={styles.meta}>Valor / aportado</div>
        </div>
        <div className={`${styles.kpiCard} ${styles.muted}`}>
          <div className={styles.label}>Peso portfolio</div>
          <div className={styles.val}>{pos.peso}%</div>
          <div className={styles.meta}>Del total</div>
        </div>
      </div>

      <div className={styles.chartGrid}>
        <CardV5>
          <CardV5.Title>{pos.alias} · evolución y proyección</CardV5.Title>
          <CardV5.Subtitle>
            Valor histórico + proyección a tasa {pos.rentAnual.toFixed(2)}% / año
          </CardV5.Subtitle>
          <CardV5.Body>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={evolData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
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
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="hist"
                  name="Valor histórico"
                  stroke={CHART.ink}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="proy"
                  name={`Proyección · ${pos.rentAnual.toFixed(2)}%/a`}
                  stroke={CHART.accent}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={{ r: 3 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardV5.Body>
        </CardV5>

        <CardV5>
          <CardV5.Title>Ficha de posición</CardV5.Title>
          <CardV5.Body>
            <div className={styles.fichaRow}>
              <span className="lab">Nombre</span>
              <span className="val">{pos.alias}</span>
            </div>
            <div className={styles.fichaRow}>
              <span className="lab">Broker / Plataforma</span>
              <span className="val">{pos.broker}</span>
            </div>
            <div className={styles.fichaRow}>
              <span className="lab">Tipo de activo</span>
              <span className="val">{labelTipo(pos.tipo)}</span>
            </div>
            <div className={styles.fichaRow}>
              <span className="lab">Capital aportado</span>
              <span className="val">
                <MoneyValue value={pos.aportado} decimals={0} tone="ink" />
              </span>
            </div>
            <div className={styles.fichaRow}>
              <span className="lab">Valor actual</span>
              <span className="val">
                <MoneyValue value={pos.valor} decimals={0} tone="ink" />
              </span>
            </div>
            <div className={styles.fichaRow}>
              <span className="lab">Ganancia no realizada</span>
              <span className="val" style={{ color: ganancia >= 0 ? 'var(--atlas-v5-pos)' : 'var(--atlas-v5-neg)' }}>
                <MoneyValue
                  value={ganancia}
                  decimals={0}
                  showSign
                  tone={ganancia >= 0 ? 'pos' : 'neg'}
                />
              </span>
            </div>
            <div className={styles.fichaRow}>
              <span className="lab">Rentabilidad total</span>
              <span className="val" style={{ color: pos.rentPct >= 0 ? 'var(--atlas-v5-pos)' : 'var(--atlas-v5-neg)' }}>
                {formatPercent(pos.rentPct)}
              </span>
            </div>
            <div className={styles.cagrRow}>
              <span className="lab">CAGR estimado</span>
              <span className="val">{pos.rentAnual.toFixed(2)}%/a</span>
            </div>
          </CardV5.Body>
        </CardV5>
      </div>
    </>
  );
};

export default IndividualPage;
