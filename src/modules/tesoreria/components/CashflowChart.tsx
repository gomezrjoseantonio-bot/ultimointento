import React from 'react';
import { MoneyValue } from '../../../design-system/v5';
import styles from './CashflowChart.module.css';

export interface MonthFlow {
  month: number; // 1-12
  label: string; // "ENE", "FEB", ...
  saldoReal?: number;     // sólo meses cerrados/en curso
  saldoPrevisto: number;  // siempre disponible (proyección)
  isCurrent?: boolean;
}

export interface CashflowChartProps {
  year: number;
  months: MonthFlow[];
  /** Indice del mes "hoy" en `months` (0-based). Si no se pasa · se infiere por `isCurrent`. */
  todayIndex?: number;
  /** KPIs resumen anual. */
  saldoInicio: number;
  entradasAnuales: number;
  salidasAnuales: number;
  /** Línea horizontal de colchón emergencia · null la oculta. */
  colchonEmergencia?: number | null;
}

const VIEWBOX_W = 1200;
const VIEWBOX_H = 240;
const PAD_L = 60;
const PAD_R = 20;
const PAD_T = 30;
const PAD_B = 36;

const CashflowChart: React.FC<CashflowChartProps> = ({
  year,
  months,
  todayIndex,
  saldoInicio,
  entradasAnuales,
  salidasAnuales,
  colchonEmergencia = 10000,
}) => {
  const width = VIEWBOX_W - PAD_L - PAD_R;
  const height = VIEWBOX_H - PAD_T - PAD_B;
  const stepX = months.length > 1 ? width / (months.length - 1) : width;
  const valuesAll = months.flatMap((m) =>
    [m.saldoReal, m.saldoPrevisto].filter(
      (v): v is number => typeof v === 'number',
    ),
  );
  const maxY = Math.max(...valuesAll, colchonEmergencia ?? 0, 1);
  const minY = Math.min(...valuesAll, 0);
  const range = maxY - minY || 1;

  const xFor = (i: number) => PAD_L + stepX * i;
  const yFor = (v: number) =>
    PAD_T + height - ((v - minY) / range) * height;

  const balanceNeto = entradasAnuales + salidasAnuales;
  const saldoCierre =
    months.length > 0
      ? (months[months.length - 1].saldoPrevisto ?? saldoInicio + balanceNeto)
      : saldoInicio;

  const realIdx =
    todayIndex ??
    months.findIndex((m) => m.isCurrent);
  const realPoints =
    realIdx >= 0
      ? months
          .slice(0, realIdx + 1)
          .map((m, i) => `${xFor(i)} ${yFor(m.saldoReal ?? m.saldoPrevisto)}`)
      : [];
  const previstoPoints = months.map(
    (m, i) => `${xFor(i)} ${yFor(m.saldoPrevisto)}`,
  );

  return (
    <div className={styles.wrap}>
      <svg
        viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
        className={styles.svg}
        role="img"
        aria-label={`Flujo de caja anual ${year}`}
      >
        <defs>
          <linearGradient id="atlas-v5-cashflow-real" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--atlas-v5-brand)" stopOpacity="0.18" />
            <stop offset="1" stopColor="var(--atlas-v5-brand)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((frac) => {
          const y = PAD_T + height * frac;
          return (
            <line
              key={frac}
              x1={PAD_L}
              y1={y}
              x2={VIEWBOX_W - PAD_R}
              y2={y}
              stroke="var(--atlas-v5-line-2)"
              strokeDasharray={frac === 0.5 ? '2 3' : undefined}
            />
          );
        })}

        {colchonEmergencia != null && colchonEmergencia >= minY && (
          <>
            <line
              x1={PAD_L}
              y1={yFor(colchonEmergencia)}
              x2={VIEWBOX_W - PAD_R}
              y2={yFor(colchonEmergencia)}
              stroke="var(--atlas-v5-neg)"
              strokeWidth="1"
              strokeDasharray="3 4"
              opacity="0.5"
            />
            <text
              x={PAD_L + 8}
              y={yFor(colchonEmergencia) - 4}
              fill="var(--atlas-v5-neg)"
              fontSize="9"
              opacity="0.7"
            >
              colchón emergencia · {(colchonEmergencia / 1000).toFixed(0)}K
            </text>
          </>
        )}

        <path
          d={`M ${previstoPoints.join(' L ')}`}
          stroke="var(--atlas-v5-ink-4)"
          strokeWidth="1.8"
          strokeDasharray="5 4"
          fill="none"
        />

        {realPoints.length > 1 && (
          <>
            <path
              d={`M ${realPoints.join(' L ')}`}
              stroke="var(--atlas-v5-brand)"
              strokeWidth="2.6"
              fill="none"
            />
            <path
              d={`M ${realPoints.join(' L ')} L ${xFor(realIdx)} ${PAD_T + height} L ${xFor(0)} ${PAD_T + height} Z`}
              fill="url(#atlas-v5-cashflow-real)"
            />
          </>
        )}

        {realIdx >= 0 && (
          <>
            <line
              x1={xFor(realIdx)}
              y1={PAD_T - 10}
              x2={xFor(realIdx)}
              y2={PAD_T + height}
              stroke="var(--atlas-v5-gold)"
              strokeDasharray="2 3"
              strokeWidth="1"
            />
            <circle
              cx={xFor(realIdx)}
              cy={yFor(months[realIdx].saldoReal ?? months[realIdx].saldoPrevisto)}
              r="6"
              fill="var(--atlas-v5-brand)"
              stroke="var(--atlas-v5-white)"
              strokeWidth="2.5"
            />
          </>
        )}

        {months.map((m, i) => (
          <text
            key={m.month}
            x={xFor(i)}
            y={VIEWBOX_H - 6}
            textAnchor="middle"
            fill={m.isCurrent ? 'var(--atlas-v5-ink)' : 'var(--atlas-v5-ink-4)'}
            fontWeight={m.isCurrent ? 700 : 400}
            fontSize="10"
          >
            {m.label}
          </text>
        ))}
      </svg>

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} /> Real · meses cerrados + en curso
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.dashed}`} /> Previsto · proyección anual
        </span>
      </div>

      <div className={styles.kpis}>
        <div>
          <div className={styles['kpi-label']}>Saldo inicio año</div>
          <div className={`${styles['kpi-value']} ${styles.muted}`}>
            <MoneyValue value={saldoInicio} decimals={0} tone="muted" />
          </div>
        </div>
        <div>
          <div className={styles['kpi-label']}>Entradas previstas</div>
          <div className={`${styles['kpi-value']} ${styles.pos}`}>
            <MoneyValue value={entradasAnuales} decimals={0} showSign tone="pos" />
          </div>
        </div>
        <div>
          <div className={styles['kpi-label']}>Salidas previstas</div>
          <div className={`${styles['kpi-value']} ${styles.neg}`}>
            <MoneyValue value={salidasAnuales} decimals={0} showSign tone="neg" />
          </div>
        </div>
        <div>
          <div className={styles['kpi-label']}>Balance neto</div>
          <div
            className={`${styles['kpi-value']} ${balanceNeto >= 0 ? styles.pos : styles.neg}`}
          >
            <MoneyValue value={balanceNeto} decimals={0} showSign tone="auto" />
          </div>
        </div>
        <div>
          <div className={styles['kpi-label']}>Saldo cierre año</div>
          <div className={`${styles['kpi-value']} ${styles.gold}`}>
            <MoneyValue value={saldoCierre} decimals={0} tone="gold" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CashflowChart;
export { CashflowChart };
