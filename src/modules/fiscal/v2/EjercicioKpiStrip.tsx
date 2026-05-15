/**
 * EjercicioKpiStrip · 4 KPIs del detalle de ejercicio.
 *   1 · Resultado autoliquidación (casilla 0670)
 *   2 · Cuota líquida total (casilla 0587)
 *   3 · Σ retenciones aplicadas (casilla 0609)
 *   4 · Tipo medio efectivo
 *
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 3 §5.2.
 */

import React from 'react';
import styles from './FiscalEjercicioPage.module.css';

export interface EjercicioKpiStripProps {
  resultado: number | null;
  cuotaLiquida: number | null;
  retenciones: number | null;
  tipoMedio: number | null;
  estado: 'en_curso' | 'pendiente' | 'declarado';
}

function fmtEuros(n: number | null, options: { signo?: boolean } = {}): string {
  if (n === null || !Number.isFinite(n)) return '—';
  const sign = options.signo
    ? (n > 0 ? '+' : n < 0 ? '−' : '')
    : '';
  const abs = options.signo ? Math.abs(n) : n;
  const formatted = new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  return `${sign}${formatted} €`;
}

function fmtPercent(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—';
  return `${new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(n)} %`;
}

const EjercicioKpiStrip: React.FC<EjercicioKpiStripProps> = ({
  resultado,
  cuotaLiquida,
  retenciones,
  tipoMedio,
  estado,
}) => {
  const hintResultado = (() => {
    if (resultado === null) return 'sin resultado calculado';
    if (estado === 'en_curso') return 'estimación · refresca con datos del año';
    if (estado === 'pendiente') return resultado >= 0 ? 'a pagar · pendiente declarar' : 'a devolver · pendiente declarar';
    return resultado >= 0 ? 'a pagar' : 'a devolver';
  })();

  const tonoResultado = (() => {
    if (resultado === null) return styles.muted;
    if (resultado > 0) return styles.warn; // a pagar · amber
    if (resultado < 0) return styles.pos; // a devolver · verde
    return '';
  })();

  return (
    <div className={styles.kpiStrip} role="group" aria-label="Indicadores del ejercicio">
      <div className={`${styles.kpi} ${styles.kpiAccentWarn}`}>
        <div className={styles.kpiLab}>Resultado autoliquidación</div>
        <div className={`${styles.kpiVal} ${tonoResultado}`}>
          {fmtEuros(resultado, { signo: true })}
        </div>
        <div className={styles.kpiHint}>{hintResultado}</div>
      </div>

      <div className={styles.kpi}>
        <div className={styles.kpiLab}>Cuota líquida total</div>
        <div className={`${styles.kpiVal} ${cuotaLiquida === null ? styles.muted : ''}`}>
          {fmtEuros(cuotaLiquida)}
        </div>
        <div className={styles.kpiHint}>antes de retenciones · casilla 0587</div>
      </div>

      <div className={styles.kpi}>
        <div className={styles.kpiLab}>Σ retenciones aplicadas</div>
        <div className={`${styles.kpiVal} ${retenciones === null ? styles.muted : ''}`}>
          {fmtEuros(retenciones)}
        </div>
        <div className={styles.kpiHint}>trabajo + capital + actividades · casilla 0609</div>
      </div>

      <div className={styles.kpi}>
        <div className={styles.kpiLab}>Tipo medio efectivo</div>
        <div className={`${styles.kpiVal} ${tipoMedio === null ? styles.muted : ''}`}>
          {fmtPercent(tipoMedio)}
        </div>
        <div className={styles.kpiHint}>sobre base liquidable</div>
      </div>
    </div>
  );
};

export default EjercicioKpiStrip;
