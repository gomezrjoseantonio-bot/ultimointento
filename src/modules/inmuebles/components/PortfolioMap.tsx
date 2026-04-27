import React from 'react';
import styles from './PortfolioMap.module.css';

export interface PortfolioPin {
  /** Coordenadas relativas al mapa (0-100). */
  x: number;
  y: number;
  /** Color del pin · igual que estado del inmueble. */
  color: string;
  label?: string;
}

export interface PortfolioLegendItem {
  label: string;
  color: string;
  count: number;
}

export interface PortfolioMapProps {
  title?: React.ReactNode;
  sub?: React.ReactNode;
  pins?: PortfolioPin[];
  legend?: PortfolioLegendItem[];
}

/**
 * Mapa de cartera · placeholder visual con pins relativos.
 * NO usa biblioteca de mapas reales en MVP · futuro · integrar Mapbox/Leaflet.
 */
const PortfolioMap: React.FC<PortfolioMapProps> = ({
  title = 'Mapa cartera',
  sub,
  pins = [],
  legend = [],
}) => (
  <div className={styles.wrap}>
    <div className={styles.titleRow}>
      <div>
        <div className={styles.title}>{title}</div>
        {sub != null && <div className={styles.sub}>{sub}</div>}
      </div>
    </div>
    <div className={styles.map} role="img" aria-label="Mapa de cartera">
      {pins.map((p, i) => (
        <span
          key={`pin-${i}`}
          className={styles.pin}
          style={{ left: `${p.x}%`, top: `${p.y}%`, color: p.color }}
          aria-label={p.label}
        >
          <svg width="22" height="30" viewBox="0 0 22 30" fill="currentColor" aria-hidden>
            <path d="M11 0 C5 0 0 5 0 11 c0 7 11 19 11 19 s11-12 11-19 c0-6-5-11-11-11 z M11 15 a4 4 0 1 1 0-8 a4 4 0 0 1 0 8 z" />
          </svg>
        </span>
      ))}
    </div>
    {legend.length > 0 && (
      <div className={styles.legend}>
        {legend.map((item, i) => (
          <div key={`leg-${i}`} className={styles.legendRow}>
            <span className={styles.legendDot} style={{ background: item.color }} />
            <span>{item.label}</span>
            <span className={styles.legendCount}>{item.count}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default PortfolioMap;
export { PortfolioMap };
