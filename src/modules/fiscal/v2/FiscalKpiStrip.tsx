/**
 * FiscalKpiStrip · 4 KPIs del F1 dashboard.
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 2 §4.2.
 * Datos · `fiscalResolverService.getResumenGlobal()` (sub-tarea 1).
 */

import React from 'react';
import styles from './FiscalDashboardPage.module.css';

export interface FiscalKpiStripProps {
  proyeccionAñoActual: number | null;
  borradorAñoPendiente: number | null;
  deudaAbierta: number;
  arrastresVivos: number;
  añoActual: number;
  añoPendiente: number;
  onClickProyeccion: () => void;
  onClickBorrador: () => void;
  onClickDeuda: () => void;
  onClickArrastres: () => void;
}

function formatEuros(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  const abs = Math.abs(n);
  return `${sign}${new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs)} €`;
}

function formatEurosNegPositive(n: number): string {
  return `${new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)} €`;
}

function tonoBorrador(n: number | null): string {
  if (n === null) return styles.muted;
  if (n > 0) return styles.pos;
  if (n < 0) return styles.warn;
  return '';
}

function tonoProyeccion(n: number | null): string {
  if (n === null) return styles.muted;
  if (n > 0) return styles.pos;
  if (n < 0) return styles.warn;
  return '';
}

const FiscalKpiStrip: React.FC<FiscalKpiStripProps> = ({
  proyeccionAñoActual,
  borradorAñoPendiente,
  deudaAbierta,
  arrastresVivos,
  añoActual,
  añoPendiente,
  onClickProyeccion,
  onClickBorrador,
  onClickDeuda,
  onClickArrastres,
}) => {
  return (
    <div className={styles.kpiStrip} role="group" aria-label="Indicadores fiscales">
      <button
        type="button"
        className={`${styles.kpi} ${styles.clickable} ${styles.kpiAccentGold}`}
        onClick={onClickProyeccion}
        aria-label={`${añoActual} proyección IRPF`}
      >
        <div className={styles.kpiLab}>{añoActual} · Proyección IRPF</div>
        <div className={`${styles.kpiVal} ${tonoProyeccion(proyeccionAñoActual)}`}>
          {formatEuros(proyeccionAñoActual)}
        </div>
        <div className={styles.kpiHint}>
          {proyeccionAñoActual === null
            ? 'sin datos suficientes'
            : proyeccionAñoActual >= 0
              ? 'a pagar estimado'
              : 'a devolver estimado'}
        </div>
        <div className={styles.kpiCta}>Ver detalle →</div>
      </button>

      <button
        type="button"
        className={`${styles.kpi} ${styles.clickable} ${styles.kpiAccentPos}`}
        onClick={onClickBorrador}
        aria-label={`${añoPendiente} borrador pendiente`}
      >
        <div className={styles.kpiLab}>{añoPendiente} · Borrador pendiente</div>
        <div className={`${styles.kpiVal} ${tonoBorrador(borradorAñoPendiente)}`}>
          {formatEuros(borradorAñoPendiente)}
        </div>
        <div className={styles.kpiHint}>
          {borradorAñoPendiente === null
            ? 'sin borrador disponible'
            : borradorAñoPendiente >= 0
              ? 'a pagar'
              : 'a devolver'}
        </div>
        <div className={styles.kpiCta}>Ir al borrador →</div>
      </button>

      <button
        type="button"
        className={`${styles.kpi} ${styles.clickable} ${styles.kpiAccentNeg}`}
        onClick={onClickDeuda}
        aria-label="Deuda abierta"
      >
        <div className={styles.kpiLab}>Deuda abierta</div>
        <div className={`${styles.kpiVal} ${deudaAbierta > 0 ? styles.neg : styles.muted}`}>
          {formatEurosNegPositive(deudaAbierta)}
        </div>
        <div className={styles.kpiHint}>
          {deudaAbierta > 0 ? 'pendiente con la AEAT' : 'sin deudas abiertas'}
        </div>
        <div className={styles.kpiCta}>Ver deuda →</div>
      </button>

      <button
        type="button"
        className={`${styles.kpi} ${styles.clickable} ${styles.kpiAccentNeutral}`}
        onClick={onClickArrastres}
        aria-label="Arrastres vivos"
      >
        <div className={styles.kpiLab}>Arrastres vivos</div>
        <div className={styles.kpiVal}>{formatEurosNegPositive(arrastresVivos)}</div>
        <div className={styles.kpiHint}>
          {arrastresVivos > 0 ? 'pendientes de compensar' : 'sin arrastres pendientes'}
        </div>
        <div className={styles.kpiCta}>Ver detalle →</div>
      </button>
    </div>
  );
};

export default FiscalKpiStrip;
