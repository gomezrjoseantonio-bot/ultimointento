import React from 'react';
import styles from './HeroBanner.module.css';

export type HeroVariant = 'compact' | 'toggle' | 'progress' | 'chart';

interface BaseHeroProps {
  /** Etiqueta superior · ej "Estimada · al cierre de abr 2026". */
  tag?: React.ReactNode;
  /** Título narrativo principal. Acepta `<strong>` para énfasis. */
  title: React.ReactNode;
  /** Subtítulo descriptivo con cifras clave. */
  sub?: React.ReactNode;
  className?: string;
}

export interface HeroCompactStats {
  label: React.ReactNode;
  value: React.ReactNode;
}

export interface HeroCompactProps extends BaseHeroProps {
  variant: 'compact';
  /** 4 mini stats · 2 col x 2 row. */
  stats?: HeroCompactStats[];
  ctaLabel?: React.ReactNode;
  onCta?: () => void;
}

export interface HeroToggleOption<TKey extends string = string> {
  key: TKey;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

export interface HeroToggleProps<TKey extends string = string> extends BaseHeroProps {
  variant: 'toggle';
  /** Etiqueta del grupo de toggles · ej "Escenario". */
  toggleLabel?: React.ReactNode;
  options: HeroToggleOption<TKey>[];
  active: TKey;
  onChange: (key: TKey) => void;
  /** Texto contextual a la derecha del toggle. */
  toggleInfo?: React.ReactNode;
  children?: React.ReactNode;
}

export interface HeroProgressProps extends BaseHeroProps {
  variant: 'progress';
  /** Valor actual del progreso (0-100). */
  percent: number;
  /** Texto a izquierda del bar (label) y derecha (meta). */
  meta?: { left?: React.ReactNode; right?: React.ReactNode };
  /** Valor prominente arriba del bar. */
  prominent?: React.ReactNode;
  children?: React.ReactNode;
}

export interface HeroChartLegendItem {
  label: React.ReactNode;
  /** Color del dot (var(--...)). */
  colorVar: string;
}

export interface HeroChartProps extends BaseHeroProps {
  variant: 'chart';
  legend?: HeroChartLegendItem[];
  /** Contenido del gráfico · típicamente un SVG ancho. */
  children: React.ReactNode;
}

export type HeroBannerProps =
  | HeroCompactProps
  | HeroToggleProps
  | HeroProgressProps
  | HeroChartProps;

/**
 * Hero banner · §8 guía v5. 4 variantes canónicas.
 * Usar cada variante para un patrón concreto · no mezclar.
 */
const HeroBanner: React.FC<HeroBannerProps> = (props) => {
  const wrapper = [
    styles.hero,
    props.variant === 'compact' ? styles.compact : '',
    props.className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  if (props.variant === 'compact') {
    const { tag, title, sub, stats, ctaLabel, onCta } = props;
    return (
      <div className={wrapper}>
        <div className={styles.heroBlock}>
          {tag != null && <div className={styles.heroTag}>{tag}</div>}
          <h2 className={styles.heroTitle}>{title}</h2>
          {sub != null && <div className={styles.heroSub}>{sub}</div>}
          {ctaLabel != null && (
            <button type="button" className={styles.heroCta} onClick={onCta}>
              {ctaLabel}
            </button>
          )}
        </div>
        {stats && stats.length > 0 && (
          <div className={styles.heroStats}>
            {stats.slice(0, 4).map((stat, idx) => (
              <div key={`stat-${idx}`} className={styles.heroStat}>
                <div className={styles.heroStatLabel}>{stat.label}</div>
                <div className={styles.heroStatValue}>{stat.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (props.variant === 'toggle') {
    const { tag, title, sub, toggleLabel, options, active, onChange, toggleInfo, children } = props;
    return (
      <div className={wrapper}>
        <div className={styles.heroBlock}>
          {tag != null && <div className={styles.heroTag}>{tag}</div>}
          <h2 className={styles.heroTitle}>{title}</h2>
          {sub != null && <div className={styles.heroSub}>{sub}</div>}
        </div>
        <div className={styles.toggleBar}>
          {toggleLabel != null && <span className={styles.toggleLabel}>{toggleLabel}</span>}
          <div className={styles.toggleGroup} role="group">
            {options.map((opt) => {
              const isActive = opt.key === active;
              const cls = [styles.toggleBtn, isActive ? styles.toggleActive : '']
                .filter(Boolean)
                .join(' ');
              return (
                <button
                  key={opt.key}
                  type="button"
                  className={cls}
                  onClick={() => onChange(opt.key)}
                  aria-pressed={isActive}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              );
            })}
          </div>
          {toggleInfo != null && <span className={styles.toggleInfo}>{toggleInfo}</span>}
        </div>
        {children}
      </div>
    );
  }

  if (props.variant === 'progress') {
    const { tag, title, sub, percent, meta, prominent, children } = props;
    const clamped = Math.max(0, Math.min(100, percent));
    return (
      <div className={wrapper}>
        <div className={styles.heroBlock}>
          {tag != null && <div className={styles.heroTag}>{tag}</div>}
          <h2 className={styles.heroTitle}>{title}</h2>
          {sub != null && <div className={styles.heroSub}>{sub}</div>}
        </div>
        <div className={styles.progressBlock}>
          {prominent != null && <div className={styles.progressValue}>{prominent}</div>}
          <div
            className={styles.progressBar}
            role="progressbar"
            aria-valuenow={clamped}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className={styles.progressFill} style={{ width: `${clamped}%` }} />
          </div>
          {meta && (
            <div className={styles.progressMeta}>
              <span>{meta.left}</span>
              <span>{meta.right}</span>
            </div>
          )}
        </div>
        {children}
      </div>
    );
  }

  // chart
  const { tag, title, sub, legend, children } = props;
  return (
    <div className={wrapper}>
      <div className={styles.chartHeader}>
        <div className={styles.heroBlock}>
          {tag != null && <div className={styles.heroTag}>{tag}</div>}
          <h2 className={styles.heroTitle}>{title}</h2>
          {sub != null && <div className={styles.heroSub}>{sub}</div>}
        </div>
        {legend && legend.length > 0 && (
          <div className={styles.chartLegend}>
            {legend.map((item, idx) => (
              <span key={`leg-${idx}`} className={styles.chartLegendItem}>
                <span
                  className={styles.chartLegendDot}
                  style={{ background: `var(${item.colorVar})` }}
                />
                {item.label}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className={styles.chartWrap}>{children}</div>
    </div>
  );
};

export default HeroBanner;
export { HeroBanner };
