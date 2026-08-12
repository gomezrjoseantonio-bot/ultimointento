import React, { useMemo, useState } from 'react';
import { intlOpts } from '../../../utils/intlNumber';
import styles from './CarteraHero.module.css';

/** Agregados de cartera que alimentan el hero navy · calculados en ListadoPage. */
export interface CarteraAgregados {
  /** Suma de valoraciones más recientes (valor de mercado). */
  valorTotal: number;
  /** Base = suma de coste total de adquisición + mejoras acumuladas. */
  baseCoste: number;
  /** Revalorización absoluta · valorTotal − baseCoste. */
  revalorizacion: number;
  /** Revalorización media sobre coste · % · null si no hay base. */
  revalorizacionPct: number | null;
  /** Deuda pendiente total (principal vivo imputado). */
  deuda: number;
  /** Patrimonio neto · valorTotal − deuda. */
  patrimonioNeto: number;
  /** Loan-to-value · deuda / valorTotal · % · null si no hay valor. */
  ltv: number | null;
  /** Renta mensual agregada (contratos activos). */
  rentaMensualTotal: number;
  /** Nº de inmuebles con explotación activa. */
  enAlquiler: number;
}

interface CarteraHeroProps {
  agregados: CarteraAgregados;
}

const eur = (value: number, sign = false): string =>
  new Intl.NumberFormat(
    'es-ES',
    intlOpts({
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      signDisplay: sign ? 'exceptZero' : 'auto',
      useGrouping: 'always',
    }),
  ).format(value);

const pct = (value: number | null, sign = false): string => {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    signDisplay: sign ? 'exceptZero' : 'auto',
  }).format(Math.round(value))} %`;
};

// ── Proyección · +3 %/año · 20 años ──────────────────────────────────────────
// Honesto: NO hay histórico agregado que dibujar, así que la "realidad" es solo
// el punto de HOY (marcador sólido) y todo lo que sale hacia el futuro es
// proyección (línea discontinua) sobre el supuesto de Mi Plan.
const TASA = 0.03;
const YEARS = 20;
const W = 340;
const H = 150;
const PT = 10;
const PB = 16;
const PL = 6;
const PR = 8;

const CarteraHero: React.FC<CarteraHeroProps> = ({ agregados }) => {
  const {
    valorTotal,
    baseCoste,
    revalorizacion,
    revalorizacionPct,
    deuda,
    patrimonioNeto,
    ltv,
    rentaMensualTotal,
    enAlquiler,
  } = agregados;

  const anioHoy = useMemo(() => new Date().getFullYear(), []);
  const [hover, setHover] = useState<number | null>(null);

  const serie = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i <= YEARS; i++) out.push(valorTotal * Math.pow(1 + TASA, i));
    return out;
  }, [valorTotal]);

  const chart = useMemo(() => {
    if (valorTotal <= 0) return null;
    const maxY = serie[YEARS] * 1.1;
    const xAt = (i: number): number => PL + ((W - PL - PR) * i) / YEARS;
    const yAt = (v: number): number => PT + (H - PT - PB) * (1 - v / maxY);
    let line = '';
    for (let i = 0; i <= YEARS; i++) {
      line += (i === 0 ? 'M' : 'L') + xAt(i).toFixed(1) + ',' + yAt(serie[i]).toFixed(1);
    }
    const area =
      line +
      'L' + xAt(YEARS).toFixed(1) + ',' + (H - PB) +
      'L' + xAt(0).toFixed(1) + ',' + (H - PB) + 'Z';
    const grid = [0.25, 0.5, 0.75].map((f) => PT + (H - PT - PB) * f);
    return { xAt, yAt, line, area, grid };
  }, [serie, valorTotal]);

  const basePct = valorTotal > 0 ? Math.max(0, Math.min(100, (baseCoste / valorTotal) * 100)) : 0;
  const revPct = valorTotal > 0 ? Math.max(0, Math.min(100, (revalorizacion / valorTotal) * 100)) : 0;

  const onMove = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (!chart) return;
    const r = e.currentTarget.getBoundingClientRect();
    const rx = ((e.clientX - r.left) / r.width) * W;
    let i = Math.round((rx - PL) / ((W - PL - PR) / YEARS));
    i = Math.max(0, Math.min(YEARS, i));
    setHover(i);
  };

  return (
    <section className={styles.hero}>
      <div className={styles.heroGrid}>
        <div className={styles.heroL}>
          <div className={styles.kicker}>
            <span className={styles.kickerDot} />
            Mi cartera inmobiliaria
          </div>
          <div className={styles.bignum}>{eur(valorTotal)}</div>
          <div className={styles.heroNote}>
            valor de mercado · base coste + mejoras <b>{eur(baseCoste)}</b>
          </div>
          <div className={styles.stackbar}>
            <i style={{ width: `${basePct}%`, background: 'var(--atlas-v5-brand-2)' }} />
            <i style={{ width: `${revPct}%`, background: 'var(--atlas-v5-gold)' }} />
          </div>
          <div className={styles.legend}>
            <span>
              <i className={styles.legendDot} style={{ background: 'var(--atlas-v5-brand-2)' }} />
              Base coste <b>{eur(baseCoste)}</b>
            </span>
            <span>
              <i className={styles.legendDot} style={{ background: 'var(--atlas-v5-gold)' }} />
              Revalorización <b>{eur(revalorizacion, true)}</b>
            </span>
          </div>
          <div className={styles.subkpis}>
            <div className={styles.subk}>
              <div className={styles.subkL}>Patrimonio neto</div>
              <div className={styles.subkV}>{eur(patrimonioNeto)}</div>
              <div className={styles.subkS}>valor − deuda</div>
            </div>
            <div className={styles.subk}>
              <div className={styles.subkL}>Deuda</div>
              <div className={styles.subkV}>{deuda > 0 ? eur(-deuda) : eur(0)}</div>
              <div className={styles.subkS}>LTV {pct(ltv)}</div>
            </div>
            <div className={styles.subk}>
              <div className={styles.subkL}>Revalorización</div>
              <div className={`${styles.subkV} ${styles.gold}`}>{pct(revalorizacionPct, true)}</div>
              <div className={styles.subkS}>media · s/ coste</div>
            </div>
            <div className={`${styles.subk} ${styles.sec}`}>
              <div className={`${styles.subkL} ${styles.secLabel}`}>Renta adicional</div>
              <div className={`${styles.subkV} ${styles.gold}`}>{eur(rentaMensualTotal)}/m</div>
              <div className={styles.subkS}>
                {enAlquiler} {enAlquiler === 1 ? 'en alquiler' : 'en alquiler'}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.heroR}>
          <div className={styles.heroRhd}>
            <span className={styles.heroRhdT}>Proyección del valor · {YEARS} años</span>
            <span className={styles.lg}>
              <span>
                <i className={styles.lgReal} />
                realidad
              </span>
              <span>
                <i className={styles.lgProj} />
                proyección
              </span>
            </span>
          </div>

          {chart ? (
            <>
              <div
                className={styles.chart}
                onMouseMove={onMove}
                onMouseLeave={() => setHover(null)}
              >
                <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <linearGradient id="carteraFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="var(--atlas-v5-gold-soft)" stopOpacity="0.34" />
                      <stop offset="1" stopColor="var(--atlas-v5-gold-soft)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {chart.grid.map((y, i) => (
                    <line
                      key={i}
                      x1={PL}
                      y1={y}
                      x2={W - PR}
                      y2={y}
                      stroke="var(--atlas-v5-cartera-grid)"
                    />
                  ))}
                  <path d={chart.area} fill="url(#carteraFill)" />
                  <path
                    d={chart.line}
                    fill="none"
                    stroke="var(--atlas-v5-gold-soft)"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    strokeOpacity={0.85}
                  />
                  {/* Marcador sólido · HOY (única "realidad" honesta sin histórico agregado). */}
                  <line
                    x1={chart.xAt(0)}
                    y1={PT}
                    x2={chart.xAt(0)}
                    y2={H - PB}
                    stroke="var(--atlas-v5-cartera-hoy-line)"
                    strokeWidth={1}
                    strokeDasharray="2 3"
                  />
                  <circle
                    cx={chart.xAt(0)}
                    cy={chart.yAt(serie[0])}
                    r={4}
                    fill="var(--atlas-v5-white)"
                    stroke="var(--atlas-v5-gold-soft)"
                    strokeWidth={2.5}
                  />
                  {hover !== null && (
                    <>
                      <line
                        x1={chart.xAt(hover)}
                        y1={PT}
                        x2={chart.xAt(hover)}
                        y2={H - PB}
                        stroke="var(--atlas-v5-cartera-guide-line)"
                        strokeWidth={1}
                      />
                      <circle
                        cx={chart.xAt(hover)}
                        cy={chart.yAt(serie[hover])}
                        r={4}
                        fill="var(--atlas-v5-white)"
                        stroke="var(--atlas-v5-gold-soft)"
                        strokeWidth={2.5}
                      />
                    </>
                  )}
                </svg>
                {hover !== null && (
                  <div
                    className={styles.tip}
                    style={{
                      left: `${(chart.xAt(hover) / W) * 100}%`,
                      top: `${(chart.yAt(serie[hover]) / H) * 100}%`,
                    }}
                  >
                    <div className={styles.tipY}>
                      {anioHoy + hover}
                      {hover > 0 && <span className={styles.tipTag}>Proyección</span>}
                    </div>
                    <div className={styles.tipRow}>
                      <span>Valor</span>
                      <b>{eur(serie[hover])}</b>
                    </div>
                  </div>
                )}
              </div>
              <div className={styles.chartX}>
                <span>hoy · {anioHoy}</span>
                <span>{anioHoy + YEARS}</span>
              </div>
              <div className={styles.caption}>
                supuesto de <b>Mi Plan</b> · revalorización +3 %/año
              </div>
            </>
          ) : (
            <div className={styles.empty}>
              Sin valoraciones · añade una valoración para proyectar el valor de tu cartera.
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default CarteraHero;
export { CarteraHero };
