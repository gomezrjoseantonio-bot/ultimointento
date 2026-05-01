/**
 * ATLAS · DESIGN SYSTEM v5 · CompositionBar
 *
 * Barra de composición patrimonial reutilizable.
 * Ref: TAREA-22-dashboard-sidebar-topbar.md §3.3 · § Z.8
 *
 * DECISIÓN γ: solo segmentos activos (Inmuebles · Inversiones · Tesorería).
 * NO existe segmento Financiación en esta barra.
 *
 * Tokens · todos via --atlas-v5-* · cero hex hardcoded.
 * Colores admitidos: 'brand' | 'gold' | 'pos' | 'neg' | 'ink-3'
 */

import React from 'react';
import { MoneyValue } from './MoneyValue';
import styles from './CompositionBar.module.css';

export type CompositionBarColor = 'brand' | 'gold' | 'pos' | 'neg' | 'ink-3';

export interface CompositionBarSegment {
  key: string;
  label: string;
  value: number;
  color: CompositionBarColor;
  onClick?: () => void;
}

export interface CompositionBarProps {
  segments: CompositionBarSegment[];
  /** Si se omite se calcula como suma de segmentos > 0 */
  total?: number;
  /** Mostrar leyenda bajo la barra · default true */
  showLegend?: boolean;
}

const colorClass: Record<CompositionBarColor, string> = {
  brand: styles.brand,
  gold: styles.gold,
  pos: styles.pos,
  neg: styles.neg,
  'ink-3': styles.inkThree,
};

const CompositionBar: React.FC<CompositionBarProps> = ({
  segments,
  total,
  showLegend = true,
}) => {
  const activeSegments = segments.filter((s) => s.value > 0);
  const computedTotal = total ?? activeSegments.reduce((acc, s) => acc + s.value, 0);
  const safeTotal = computedTotal > 0 ? computedTotal : 1;

  return (
    <div className={styles.compBarra}>
      <div className={styles.compHead}>
        <div className={styles.compTitle}>COMPOSICIÓN DEL PATRIMONIO</div>
        <div className={styles.compSubtitle}>click en un segmento para ver detalle del módulo</div>
      </div>

      <div
        className={styles.compTrack}
        role="img"
        aria-label="Composición del patrimonio — haz clic en un segmento para ver el detalle del módulo"
      >
        {activeSegments.map((seg) => {
          const pct = (seg.value / safeTotal) * 100;
          return (
            <button
              key={seg.key}
              type="button"
              className={`${styles.compSeg} ${colorClass[seg.color]}`}
              style={{ width: `${pct}%` }}
              title={`${seg.label} · ${pct.toFixed(1)}%`}
              onClick={seg.onClick}
              aria-label={`${seg.label}: ${pct.toFixed(1)}%`}
            />
          );
        })}
      </div>

      {showLegend && (
        <div className={styles.compLeg}>
          {activeSegments.map((seg) => {
            const pct = (seg.value / safeTotal) * 100;
            return (
              <div key={seg.key} className={styles.compLegItem}>
                <div className={`${styles.compLegDot} ${colorClass[seg.color]}`} />
                <span className={styles.compLegNom}>{seg.label}</span>
                <span className={styles.compLegVal}>
                  <MoneyValue value={seg.value} decimals={0} tone="ink" />
                </span>
                <span className={styles.compLegPct}>{pct.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CompositionBar;
