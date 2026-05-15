/**
 * BoxRowCasilla · fila genérica de casilla del Modelo 100.
 *
 * Grid · número (70px) · concepto + subtítulo (1fr) · importe (140px).
 * Soporta subtotal · negative-sign · highlight (fila final destacada).
 *
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 3 §5.2.
 */

import React from 'react';
import type { BoxRow } from './helpers/ejercicioCasillasService';
import styles from './FiscalEjercicioPage.module.css';

export interface BoxRowCasillaProps {
  row: BoxRow;
}

function fmtAmount(row: BoxRow): string {
  const n = row.importe;
  if (n === null || !Number.isFinite(n)) return '—';

  // Unidad días · entero sin decimales · sin signo de euro
  if (row.unit === 'dias') {
    return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(n);
  }
  // Unidad porcentaje · 2 decimales · sufijo %
  if (row.unit === 'pct') {
    const fmt = new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(n));
    return `${fmt} %`;
  }

  // Default · euros
  if (n === 0) return '0,00 €';
  const fixed = Math.abs(n);
  const formatted = new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(fixed);
  const sign = row.negativeSign ? '−' : (n < 0 ? '−' : '');
  return `${sign}${formatted} €`;
}

const BoxRowCasilla: React.FC<BoxRowCasillaProps> = ({ row }) => {
  const classes = [
    styles.boxRow,
    row.subtotal ? styles.subtotal : '',
    row.highlight ? styles.highlight : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <div className={styles.boxRowNum}>{row.num}</div>
      <div>
        <div className={styles.boxRowConcept}>{row.concepto}</div>
        {row.subtitulo && (
          <div className={styles.boxRowConceptSub}>{row.subtitulo}</div>
        )}
      </div>
      <div className={`${styles.boxRowAmount} ${row.importe === null ? styles.muted : ''}`}>
        {fmtAmount(row)}
      </div>
    </div>
  );
};

export default BoxRowCasilla;
