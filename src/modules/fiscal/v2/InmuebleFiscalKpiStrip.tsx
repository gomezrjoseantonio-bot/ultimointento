/**
 * InmuebleFiscalKpiStrip · 3 KPIs del F3 inmueble fiscal.
 *   1 · Ingresos íntegros (gold)
 *   2 · Σ gastos deducibles aplicados (neutral)
 *   3 · Rendimiento neto reducido (pos)
 *
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 4 §6.2.
 */

import React from 'react';
import styles from './FiscalEjercicioPage.module.css';

export interface InmuebleFiscalKpiStripProps {
  ingresos: number | null;
  gastosAplicados: number | null;
  rendimientoNetoReducido: number | null;
  porcentajeReduccion: number;
  diasArrendado: number;
  numContratos?: number;
}

function fmtEuros(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—';
  if (n === 0) return '0,00 €';
  const sign = n < 0 ? '−' : '';
  const abs = Math.abs(n);
  return `${sign}${new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs)} €`;
}

const InmuebleFiscalKpiStrip: React.FC<InmuebleFiscalKpiStripProps> = ({
  ingresos,
  gastosAplicados,
  rendimientoNetoReducido,
  porcentajeReduccion,
  diasArrendado,
  numContratos,
}) => {
  const tonoRendimiento = rendimientoNetoReducido === null
    ? styles.muted
    : rendimientoNetoReducido > 0
      ? styles.pos
      : rendimientoNetoReducido < 0
        ? styles.neg
        : '';

  return (
    <div className={styles.kpiStrip} role="group" aria-label="Indicadores del inmueble">
      <div className={`${styles.kpi} ${styles.kpiAccentGold}`}>
        <div className={styles.kpiLab}>Ingresos íntegros</div>
        <div className={`${styles.kpiVal} ${ingresos === null ? styles.muted : ''}`}>
          {fmtEuros(ingresos)}
        </div>
        <div className={styles.kpiHint}>
          {diasArrendado > 0
            ? `${diasArrendado} días arrendado${numContratos ? ` · ${numContratos} contrato${numContratos === 1 ? '' : 's'}` : ''}`
            : 'sin actividad de alquiler'}
        </div>
      </div>

      <div className={styles.kpi}>
        <div className={styles.kpiLab}>Σ gastos deducibles aplicados</div>
        <div className={`${styles.kpiVal} ${gastosAplicados === null ? styles.muted : ''}`}>
          {fmtEuros(gastosAplicados)}
        </div>
        <div className={styles.kpiHint}>incluye amortizaciones + arrastres aplicados</div>
      </div>

      <div className={`${styles.kpi} ${styles.kpiAccentPos}`}>
        <div className={styles.kpiLab}>Rendimiento neto reducido</div>
        <div className={`${styles.kpiVal} ${tonoRendimiento}`}>
          {fmtEuros(rendimientoNetoReducido)}
        </div>
        <div className={styles.kpiHint}>
          {porcentajeReduccion > 0
            ? `tras reducción del ${porcentajeReduccion}%`
            : 'sin reducción aplicada'}
        </div>
      </div>
    </div>
  );
};

export default InmuebleFiscalKpiStrip;
