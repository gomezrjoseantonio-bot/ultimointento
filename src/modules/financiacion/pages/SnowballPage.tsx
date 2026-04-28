import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { CardV5, Icons, MoneyValue, showToastV5 } from '../../../design-system/v5';
import type { FinanciacionOutletContext } from '../FinanciacionContext';
import type { LoanRow } from '../types';
import { formatPct, getBankPalette, labelKind } from '../helpers';
import styles from './SnowballPage.module.css';

type Strategy = 'avalancha' | 'bola' | 'no_dedu' | 'manual';

const STRATEGIES: { key: Strategy; title: string; desc: string }[] = [
  {
    key: 'avalancha',
    title: 'Avalancha',
    desc: 'atacar primero el préstamo con mayor tipo de interés · máximo ahorro matemático',
  },
  {
    key: 'bola',
    title: 'Bola de nieve',
    desc: 'atacar primero el préstamo con menor capital vivo · cierras antes préstamos enteros',
  },
  {
    key: 'no_dedu',
    title: 'No deducibles primero',
    desc: 'eliminar antes préstamos sin deducibilidad · mantiene el escudo fiscal más tiempo',
  },
  {
    key: 'manual',
    title: 'Manual',
    desc: 'elige tú el orden · arrastra préstamos para priorizar',
  },
];

const PRESETS = [250, 500, 1000, 1500];

const orderRows = (rows: LoanRow[], strategy: Strategy): LoanRow[] => {
  const arr = [...rows];
  switch (strategy) {
    case 'avalancha':
      return arr.sort((a, b) => b.tin - a.tin);
    case 'bola':
      return arr.sort((a, b) => a.capitalVivo - b.capitalVivo);
    case 'no_dedu':
      return arr.sort((a, b) => a.intDeducibles - b.intDeducibles);
    case 'manual':
    default:
      return arr;
  }
};

/**
 * Simulación simplificada · trata el portfolio como deuda agregada que se
 * amortiza al ritmo de cuota actual + extra/mes. Devuelve fecha estimada de
 * libertad y total de intereses pagados.
 */
const simulateSnowball = (
  rows: LoanRow[],
  extraMonthly: number,
): { totalIntereses: number; mesesHastaCero: number } => {
  if (rows.length === 0) return { totalIntereses: 0, mesesHastaCero: 0 };
  const baseCuota = rows.reduce((s, r) => s + r.cuotaMensual, 0);
  const tinPond = (() => {
    const totalVivo = rows.reduce((s, r) => s + r.capitalVivo, 0);
    return totalVivo > 0
      ? rows.reduce((s, r) => s + r.tin * r.capitalVivo, 0) / totalVivo
      : 0;
  })();
  let saldo = rows.reduce((s, r) => s + r.capitalVivo, 0);
  const tasaMensual = tinPond / 100 / 12;
  let totalIntereses = 0;
  let meses = 0;
  const maxMeses = 12 * 50;
  while (saldo > 1 && meses < maxMeses) {
    const interes = saldo * tasaMensual;
    const cuota = baseCuota + extraMonthly;
    const amort = Math.min(saldo, Math.max(0, cuota - interes));
    totalIntereses += interes;
    saldo = Math.max(0, saldo - amort);
    meses++;
  }
  return { totalIntereses, mesesHastaCero: meses };
};

const formatMonthsToDate = (months: number, from = new Date()): string => {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
};

const formatYearsAndMonths = (months: number): string => {
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m}m`;
  if (m === 0) return `${y}a`;
  return `${y}a · ${m}m`;
};

const SnowballPage: React.FC = () => {
  const { rows } = useOutletContext<FinanciacionOutletContext>();
  const [strategy, setStrategy] = useState<Strategy>('avalancha');
  const [extra, setExtra] = useState(500);

  const ordered = useMemo(() => orderRows(rows, strategy), [rows, strategy]);

  const baseSim = useMemo(() => simulateSnowball(rows, 0), [rows]);
  const planSim = useMemo(() => simulateSnowball(rows, extra), [rows, extra]);

  const ahorroMeses = Math.max(0, baseSim.mesesHastaCero - planSim.mesesHastaCero);
  const ahorroIntereses = Math.max(0, baseSim.totalIntereses - planSim.totalIntereses);
  const extraTotal = extra * planSim.mesesHastaCero;
  const roi = extraTotal > 0 ? (ahorroIntereses / extraTotal) * 100 : 0;

  if (rows.length === 0) {
    return (
      <CardV5>
        <CardV5.Body>
          <div className={styles.empty}>
            Aún no tienes préstamos · no hay deuda que simular.
          </div>
        </CardV5.Body>
      </CardV5>
    );
  }

  return (
    <>
      <div className={styles.hero}>
        <div>
          <div className={styles.heroLab}>Sin amortización extra</div>
          <div className={styles.heroFecha}>
            {formatMonthsToDate(baseSim.mesesHastaCero)}
          </div>
          <div className={styles.heroSub}>
            intereses totales · {Math.round(baseSim.totalIntereses).toLocaleString('es-ES')} €
          </div>
        </div>
        <div className={styles.heroArrow}>
          <Icons.ArrowRight size={28} strokeWidth={1.6} />
        </div>
        <div>
          <div className={`${styles.heroLab} ${styles.gold}`}>Con este plan snowball</div>
          <div className={styles.heroFecha}>
            {formatMonthsToDate(planSim.mesesHastaCero)}
          </div>
          <div className={styles.heroSub}>
            intereses totales · {Math.round(planSim.totalIntereses).toLocaleString('es-ES')} €
          </div>
        </div>
        <div className={styles.heroImpact}>
          <div className={styles.heroImpactLab}>Ahorras</div>
          <div className={styles.heroImpactVal}>
            −{formatYearsAndMonths(ahorroMeses)}
          </div>
          <div className={styles.heroSub} style={{ color: 'var(--atlas-v5-pos)', fontWeight: 700 }}>
            +<MoneyValue value={ahorroIntereses} decimals={0} tone="pos" /> en intereses
          </div>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.strat}>
          <div className={styles.stratTitle}>Estrategia de ataque</div>

          <div className={styles.stratOpts}>
            {STRATEGIES.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`${styles.opt} ${strategy === s.key ? styles.active : ''}`}
                onClick={() => setStrategy(s.key)}
                aria-pressed={strategy === s.key}
              >
                <div className={styles.optRadio} />
                <div>
                  <div className={styles.optTitle}>{s.title}</div>
                  <div className={styles.optDesc}>{s.desc}</div>
                </div>
              </button>
            ))}
          </div>

          <div>
            <div className={styles.extraHead}>
              <div className={styles.extraLab}>Cantidad extra al mes</div>
              <div className={styles.extraVal}>
                +<MoneyValue value={extra} decimals={0} tone="ink" />
              </div>
            </div>
            <input
              type="range"
              className={styles.slider}
              min={0}
              max={2000}
              step={50}
              value={extra}
              onChange={(e) => setExtra(parseInt(e.target.value, 10) || 0)}
              aria-label="Cantidad extra al mes"
            />
            <div className={styles.extraRange}>
              <span>0 €</span>
              <span>máx · 2.000 €</span>
            </div>
          </div>

          <div>
            <div className={styles.presetsLab}>Presets</div>
            <div className={styles.presets}>
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`${styles.preset} ${extra === p ? styles.active : ''}`}
                  onClick={() => setExtra(p)}
                  aria-pressed={extra === p}
                >
                  {p.toLocaleString('es-ES')} €
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.listCard}>
          <div className={styles.listHead}>
            <div className={styles.listTitle}>
              Orden de ataque · estrategia {STRATEGIES.find((s) => s.key === strategy)?.title.toLowerCase()}
            </div>
            <div className={styles.listSub}>
              {strategy === 'avalancha' && 'ordenado de mayor a menor TIN · primero recibe la amortización extra'}
              {strategy === 'bola' && 'ordenado de menor a mayor capital vivo · cierras antes préstamos pequeños'}
              {strategy === 'no_dedu' && 'ordenado por intereses deducibles ascendente · mantiene escudo fiscal'}
              {strategy === 'manual' && 'orden manual · próximamente arrastrar para priorizar'}
            </div>
          </div>

          {ordered.map((row, i) => {
            const palette = getBankPalette(row.banco);
            const attacked = i === 0;
            return (
              <div key={row.id} className={`${styles.row} ${attacked ? styles.attacked : ''}`}>
                <div className={styles.rowOrder}>{i + 1}</div>
                <div
                  className={styles.rowLogo}
                  style={{ background: palette.bg, color: palette.fg }}
                >
                  {palette.abbr}
                </div>
                <div>
                  <div className={styles.rowNom}>{row.alias}</div>
                  <div className={styles.rowMeta}>
                    {row.fechaVencimiento &&
                      `vence ${new Date(row.fechaVencimiento).getFullYear()}`}{' '}
                    · {labelKind(row.kind).toLowerCase()}
                  </div>
                </div>
                <div>
                  <span className={styles.cellLab}>TIN</span>
                  <span className={`${styles.cellVal} ${strategy === 'avalancha' && i === 0 ? styles.gold : ''}`}>
                    {formatPct(row.tin, 2)}
                  </span>
                </div>
                <div>
                  <span className={styles.cellLab}>Capital vivo</span>
                  <span className={`${styles.cellVal} ${styles.neg}`}>
                    <MoneyValue value={-row.capitalVivo} decimals={0} showSign tone="neg" />
                  </span>
                </div>
                <div className={styles.rowBar}>
                  <div className={styles.rowBarTop}>
                    <span>amortizado</span>
                    <span className={styles.rowBarPct}>
                      {formatPct(row.porcentajeAmortizado, 1)}
                    </span>
                  </div>
                  <div className={styles.rowBarTrack}>
                    <div
                      className={styles.rowBarFill}
                      style={{ width: `${row.porcentajeAmortizado}%` }}
                    />
                  </div>
                </div>
                <span className={`${styles.rowBadge} ${attacked ? styles.activo : styles.espera}`}>
                  {attacked ? 'En ataque' : 'En espera'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.summary}>
        <div className={styles.summaryCell}>
          <div className={styles.summaryLab}>Tiempo ahorrado</div>
          <div className={`${styles.summaryVal} ${styles.pos}`}>
            −{formatYearsAndMonths(ahorroMeses)}
          </div>
        </div>
        <div className={styles.summaryCell}>
          <div className={styles.summaryLab}>Intereses ahorrados</div>
          <div className={`${styles.summaryVal} ${styles.pos}`}>
            <MoneyValue value={ahorroIntereses} decimals={0} showSign tone="pos" />
          </div>
        </div>
        <div className={styles.summaryCell}>
          <div className={styles.summaryLab}>Extra aportado total</div>
          <div className={`${styles.summaryVal} ${styles.gold}`}>
            <MoneyValue value={extraTotal} decimals={0} tone="gold" />
          </div>
        </div>
        <div className={styles.summaryCell}>
          <div className={styles.summaryLab}>ROI del snowball</div>
          <div className={`${styles.summaryVal} ${styles.pos}`}>{formatPct(roi, 1)}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={() =>
            showToastV5('Guardar como escenario · pendiente de integración con Mi Plan')
          }
          style={{
            padding: '8px 16px',
            border: '1px solid var(--atlas-v5-line)',
            background: 'var(--atlas-v5-card)',
            color: 'var(--atlas-v5-ink-2)',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Guardar escenario
        </button>
        <button
          type="button"
          onClick={() =>
            showToastV5('Aplicar plan · genera amortizaciones programadas (follow-up)')
          }
          style={{
            padding: '8px 16px',
            border: 'none',
            background: 'var(--atlas-v5-gold)',
            color: '#fff',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Aplicar plan
        </button>
      </div>
    </>
  );
};

export default SnowballPage;
