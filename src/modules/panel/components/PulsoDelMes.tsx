/**
 * ATLAS · Panel · PulsoDelMes
 *
 * Sección "Pulso del mes" · § Z.10 · TAREA 22.4
 * Ref: TAREA-22-dashboard-sidebar-topbar.md §5 · mockup §132-140
 *
 * Datos:
 *   ingresos  = sum treasuryEvents con amount > 0 del mes en curso
 *   gastos    = sum |treasuryEvents con amount < 0| del mes en curso
 *   cashflow  = ingresos - gastos
 *   saldo fin = saldoActual + cashflow pendiente de ejecutar en el mes
 *               (TODO: conectar con servicio de proyección cuando esté disponible)
 *
 * Tokens · todos via --atlas-v5-* · cero hex hardcoded.
 */

import React from 'react';
import styles from './PulsoDelMes.module.css';

export interface PulsoDelMesProps {
  /** Ingresos cobrados del mes (sum amount > 0) */
  ingresos: number;
  /** Gastos totales del mes (sum |amount < 0|) */
  gastos: number;
  /** Cashflow neto = ingresos - gastos */
  cashflow: number;
  /**
   * Saldo fin de mes previsto.
   * Si hay proyección se usa esa · si no se usa saldo actual de tesorería.
   * TODO: conectar con servicio de proyección cuando esté disponible.
   */
  saldoFin: number;
  /** Nombre del mes actual · p.ej. "mayo" */
  mesNombre: string;
  /** Año actual · p.ej. 2026 */
  año: number;
}

/**
 * Formatea un número como importe monetario con 0 decimales y símbolo €
 * usando JetBrains Mono + tabular-nums (§ Z.2).
 */
const formatMoney = (n: number): string =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

const PulsoDelMes: React.FC<PulsoDelMesProps> = ({
  ingresos,
  gastos,
  cashflow,
  saldoFin,
  mesNombre,
  año,
}) => {
  return (
    <div className={styles.pulso}>
      {/* Título con mes y año */}
      <div className={styles.pulsoTitle}>
        PULSO DEL MES
        <span className={styles.mes}>
          {mesNombre} {año}
        </span>
      </div>

      {/* Ingresos cobrados */}
      <div className={styles.pulsoItem}>
        <div className={styles.pulsoLab}>Ingresos cobrados</div>
        <div className={`${styles.pulsoVal} ${styles.pos}`}>{formatMoney(ingresos)}</div>
      </div>

      {/* Gastos totales */}
      <div className={styles.pulsoItem}>
        <div className={styles.pulsoLab}>Gastos totales</div>
        <div className={`${styles.pulsoVal} ${styles.neg}`}>{formatMoney(gastos)}</div>
      </div>

      {/* Cashflow neto */}
      <div className={styles.pulsoItem}>
        <div className={styles.pulsoLab}>Cashflow neto</div>
        <div className={`${styles.pulsoVal} ${cashflow >= 0 ? styles.pos : styles.neg}`}>
          {formatMoney(cashflow)}
        </div>
      </div>

      {/* Saldo fin mes previsto */}
      <div className={styles.pulsoItem}>
        <div className={styles.pulsoLab}>Saldo fin mes previsto</div>
        {/* TODO: conectar con servicio de proyección cuando esté disponible · por ahora saldo actual tesorería */}
        <div className={styles.pulsoVal}>{formatMoney(saldoFin)}</div>
      </div>
    </div>
  );
};

export default PulsoDelMes;
