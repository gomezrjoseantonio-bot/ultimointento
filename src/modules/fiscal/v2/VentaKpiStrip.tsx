/**
 * VentaKpiStrip · 4 KPIs del F4 venta.
 *   1 · Valor transmisión
 *   2 · Valor adquisición actualizado
 *   3 · Ganancia tributable estimada (warn)
 *   4 · Impuesto ahorro estimado (neg)
 *
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 5 §7.2.
 */

import React from 'react';
import styles from './FiscalEjercicioPage.module.css';

export interface VentaKpiStripProps {
  valorTransmision: number;
  valorAdquisicion: number;
  gananciaTributable: number;
  impuestoEstimado: number;
  gastosVentaConfirmados: boolean;
  arrastresCompensados: number;
  amortizacionAcumulada: number;
  precioAdquisicionOriginal: number;
}

function fmtEuros(n: number): string {
  if (n === 0) return '0 €';
  const sign = n < 0 ? '−' : '';
  const abs = Math.abs(n);
  return `${sign}${new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(abs)} €`;
}

const VentaKpiStrip: React.FC<VentaKpiStripProps> = ({
  valorTransmision,
  valorAdquisicion,
  gananciaTributable,
  impuestoEstimado,
  gastosVentaConfirmados,
  arrastresCompensados,
  amortizacionAcumulada,
  precioAdquisicionOriginal,
}) => {
  return (
    <div className={styles.kpiStrip} role="group" aria-label="Indicadores de la venta">
      <div className={styles.kpi}>
        <div className={styles.kpiLab}>Valor transmisión</div>
        <div className={styles.kpiVal}>{fmtEuros(valorTransmision)}</div>
        <div className={styles.kpiHint}>
          {gastosVentaConfirmados ? 'tras gastos venta deducibles' : 'gastos venta pendientes confirmar'}
        </div>
      </div>

      <div className={styles.kpi}>
        <div className={styles.kpiLab}>Valor adquisición actualizado</div>
        <div className={styles.kpiVal}>{fmtEuros(valorAdquisicion)}</div>
        <div className={styles.kpiHint}>
          {precioAdquisicionOriginal > 0 && amortizacionAcumulada > 0
            ? `original ${fmtEuros(precioAdquisicionOriginal)} − amort ${fmtEuros(amortizacionAcumulada)}`
            : 'precio compra + gastos − amortización'}
        </div>
      </div>

      <div className={`${styles.kpi} ${styles.kpiAccentWarn}`}>
        <div className={styles.kpiLab}>Ganancia tributable estimada</div>
        <div className={`${styles.kpiVal} ${styles.warn}`}>{fmtEuros(gananciaTributable)}</div>
        <div className={styles.kpiHint}>
          {arrastresCompensados > 0
            ? `tras compensar arrastres ${fmtEuros(arrastresCompensados)}`
            : 'sin arrastres aplicados'}
        </div>
      </div>

      <div className={`${styles.kpi} ${styles.kpiAccentNeg}`}>
        <div className={styles.kpiLab}>Impuesto ahorro estimado</div>
        <div className={`${styles.kpiVal} ${styles.neg}`}>{fmtEuros(impuestoEstimado)}</div>
        <div className={styles.kpiHint}>tramos base ahorro 2025</div>
      </div>
    </div>
  );
};

export default VentaKpiStrip;
