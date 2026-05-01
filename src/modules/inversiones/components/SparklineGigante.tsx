// T23.3 · Sparkline gigante reutilizable para fichas detalle (§ Z.7).
// Variante más grande del sparkline inline de cartas · acepta puntos
// adicionales (markers) para resaltar dividendos / cobros sobre la línea.

import React, { useMemo } from 'react';
import styles from '../pages/FichaPosicion.module.css';

interface Punto {
  x: number;
  y: number;
}

interface Marker extends Punto {
  /** Texto para el `<title>` accesible. */
  label?: string;
  /** Color CSS · si se omite usa --atlas-v5-gold. */
  color?: string;
}

interface Props {
  data: Punto[];
  /** Color CSS de la línea principal. */
  color?: string;
  /** Markers opcionales (p.ej. cobros de dividendo). */
  markers?: Marker[];
  ariaLabel?: string;
}

const W = 800;
const H = 220;
const PAD = 12;

const SparklineGigante: React.FC<Props> = ({ data, color, markers, ariaLabel }) => {
  const { path, areaPath, sx, sy } = useMemo(() => {
    if (data.length < 2) return { path: '', areaPath: '', sx: () => 0, sy: () => 0 };
    const xs = data.map((p) => p.x);
    const ys = data.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const dx = maxX - minX || 1;
    const dy = maxY - minY || 1;
    const scaleX = (x: number) => PAD + ((x - minX) / dx) * (W - PAD * 2);
    const scaleY = (y: number) => H - PAD - ((y - minY) / dy) * (H - PAD * 2);
    const linePath = data
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.x).toFixed(1)} ${scaleY(p.y).toFixed(1)}`)
      .join(' ');
    const areaPath_ =
      `${linePath} L ${scaleX(maxX).toFixed(1)} ${(H - PAD).toFixed(1)} ` +
      `L ${scaleX(minX).toFixed(1)} ${(H - PAD).toFixed(1)} Z`;
    return { path: linePath, areaPath: areaPath_, sx: scaleX, sy: scaleY };
  }, [data]);

  if (!path) {
    return (
      <div className={styles.bigPlaceholder}>
        Aún no hay datos suficientes para dibujar la evolución.
      </div>
    );
  }

  const stroke = color || 'var(--atlas-v5-brand)';

  return (
    <svg
      className={styles.bigSparkline}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel || 'Evolución de valor'}
    >
      <defs>
        <linearGradient id="sparkArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.18" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#sparkArea)" />
      <path d={path} fill="none" stroke={stroke} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      {markers?.map((m, i) => (
        <circle
          key={i}
          cx={sx(m.x)}
          cy={sy(m.y)}
          r={4}
          fill={m.color || 'var(--atlas-v5-gold)'}
          stroke="var(--atlas-v5-card)"
          strokeWidth={1.5}
        >
          {m.label && <title>{m.label}</title>}
        </circle>
      ))}
    </svg>
  );
};

export default SparklineGigante;
