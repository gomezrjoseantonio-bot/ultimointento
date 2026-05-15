/**
 * AmortizacionAcumuladaTable · tabla año a año desde compra · vista para
 * venta futura. Sub-tarea 4 §6.6.
 */

import React from 'react';
import type { AmortRow } from './helpers/amortizacionAcumuladaService';
import styles from './FiscalInmueblePage.module.css';

export interface AmortizacionAcumuladaTableProps {
  rows: AmortRow[];
  acumuladoCierre: number;
  añoCorte: number;
}

function fmtEuros(n: number): string {
  if (n === 0) return '0,00 €';
  return `${new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)} €`;
}

function fmtInt(n: number): string {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(n);
}

const AmortizacionAcumuladaTable: React.FC<AmortizacionAcumuladaTableProps> = ({
  rows,
  acumuladoCierre,
  añoCorte,
}) => {
  if (rows.length === 0) {
    return (
      <div className={styles.card}>
        <div className={styles.cardHd}>
          <div>
            <div className={styles.cardTitle}>Amortización acumulada · vista para venta futura</div>
            <div className={styles.cardSub}>sin datos de amortización · falta base o años de actividad</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHd}>
        <div>
          <div className={styles.cardTitle}>Amortización acumulada · vista para venta futura</div>
          <div className={styles.cardSub}>
            año a año desde compra · se restará del valor adquisición si vendes
          </div>
        </div>
      </div>
      <div className={styles.tableContainer}>
        <table className={`${styles.tbl} ${styles.amortTbl}`}>
          <thead>
            <tr>
              <th>Año</th>
              <th>Días arr.</th>
              <th className={styles.tdRight}>Base amort.</th>
              <th className={styles.tdRight}>Inmueble</th>
              <th className={styles.tdRight}>Mobiliario</th>
              <th className={styles.tdRight}>Acumulado total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.año}
                className={row.esFuturo ? styles.futureRow : undefined}
              >
                <td className={styles.yearCell}>{row.año}</td>
                <td className={styles.mono}>{fmtInt(row.diasArrendado)}</td>
                <td className={`${styles.tdRight} ${styles.mono}`}>
                  {fmtEuros(row.baseAmortizacion)}
                </td>
                <td className={`${styles.tdRight} ${styles.mono}`}>
                  {fmtEuros(row.amortInmueble)}
                </td>
                <td className={`${styles.tdRight} ${styles.mono}`}>
                  {fmtEuros(row.amortMobiliario)}
                </td>
                <td className={`${styles.tdRight} ${styles.mono}`}>
                  <strong>{fmtEuros(row.acumuladoTotal)}</strong>
                </td>
              </tr>
            ))}
            <tr className={styles.totalRow}>
              <td colSpan={5} className={styles.tdRight}>
                Acumulado a 31/12/{añoCorte}
              </td>
              <td className={`${styles.tdRight} ${styles.mono}`}>
                <strong>{fmtEuros(acumuladoCierre)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AmortizacionAcumuladaTable;
