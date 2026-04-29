// Hook v5 que resuelve los CSS variables de chart en valores hex/rgba
// reales para inyectarlos a Recharts (que no acepta `var(...)` en sus
// props `stroke`/`fill`).
//
// Centraliza el acceso · todos los charts del v5 deben usar este hook
// en lugar de hardcodear hex. Si un día cambian los tokens en
// `tokens.css` los charts se actualizan automáticamente.

import { useMemo } from 'react';

export interface ChartColors {
  ink: string;
  accent: string;
  grid: string;
  axis: string;
  border: string;
}

const FALLBACK: ChartColors = {
  ink: '#0E2A47',
  accent: '#1DA0BA',
  grid: 'rgba(200,208,220,0.4)',
  axis: '#6C757D',
  border: '#C8D0DC',
};

/**
 * Devuelve la paleta neutra de chart leyendo los CSS variables
 * `--atlas-v5-chart-*`. Memoizado a nivel de módulo (no cambia tras
 * el primer mount) para evitar recálculos en cada render.
 */
export const useChartColors = (): ChartColors => {
  return useMemo(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return FALLBACK;
    }
    const css = getComputedStyle(document.documentElement);
    const read = (k: string): string => css.getPropertyValue(k).trim();
    return {
      ink: read('--atlas-v5-chart-ink') || FALLBACK.ink,
      accent: read('--atlas-v5-chart-accent') || FALLBACK.accent,
      grid: read('--atlas-v5-chart-grid') || FALLBACK.grid,
      axis: read('--atlas-v5-chart-axis') || FALLBACK.axis,
      border: read('--atlas-v5-chart-border') || FALLBACK.border,
    };
  }, []);
};
