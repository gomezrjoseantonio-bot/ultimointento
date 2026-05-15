/**
 * EjercicioVersionesTab · tab "Versiones" (v1 vs paralela v2).
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 3 §5.2.
 *
 * Sub-tarea 3 entrega solo el contenedor · el detalle completo de
 * comparación side-by-side llega en sub-tarea 6 (F6 Acciones).
 */

import React from 'react';
import styles from './FiscalEjercicioPage.module.css';

export interface VersionRow {
  version: 'v1' | 'v2';
  fecha?: string;
  origen: string;
  resultado: number | null;
  nota?: string;
}

export interface EjercicioVersionesTabProps {
  versiones: VersionRow[];
}

function fmtEuros(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  const abs = Math.abs(n);
  return `${sign}${new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs)} €`;
}

function fmtFecha(iso?: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

const EjercicioVersionesTab: React.FC<EjercicioVersionesTabProps> = ({ versiones }) => {
  return (
    <div className={styles.card}>
      <div className={styles.cardHd}>
        <div>
          <div className={styles.cardTitle}>Versiones de la declaración</div>
          <div className={styles.cardSub}>
            v1 · original presentada · v2 · corrección posterior por paralela AEAT
          </div>
        </div>
      </div>
      <div>
        {versiones.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateTitle}>Sin versiones registradas</div>
            <div>Cuando se importe una declaración o se aplique una paralela aparecerá aquí.</div>
          </div>
        ) : (
          <table className={styles.tbl}>
            <thead>
              <tr>
                <th>Versión</th>
                <th>Origen</th>
                <th>Fecha</th>
                <th style={{ textAlign: 'right' }}>Resultado</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              {versiones.map((v) => (
                <tr key={v.version}>
                  <td>
                    <span className={`${styles.mono} ${styles.tStrong}`}>{v.version}</span>
                  </td>
                  <td>{v.origen}</td>
                  <td>
                    <span className={styles.mono}>{fmtFecha(v.fecha)}</span>
                  </td>
                  <td className={styles.tdRight}>
                    <span className={`${styles.mono} ${styles.tStrong}`}>
                      {fmtEuros(v.resultado)}
                    </span>
                  </td>
                  <td>{v.nota ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default EjercicioVersionesTab;
