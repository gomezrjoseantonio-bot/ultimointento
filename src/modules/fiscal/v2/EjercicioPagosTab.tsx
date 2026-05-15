/**
 * EjercicioPagosTab · tab "Pagos" (cuota diferencial + deudas vinculadas).
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 3 §5.2.
 */

import React from 'react';
import type { DeudaFiscal } from '../../../services/db';
import styles from './FiscalEjercicioPage.module.css';

export interface PagoRow {
  concepto: string;
  fecha?: string;
  importe: number;
  estado: 'pagado' | 'pendiente';
}

export interface EjercicioPagosTabProps {
  cuotaDiferencial: number | null;
  pagosCuota: PagoRow[];
  deudasVinculadas: DeudaFiscal[];
}

const ESTADO_LABEL: Record<DeudaFiscal['estado'], string> = {
  voluntario: 'Voluntario',
  ejecutivo: 'Ejecutivo',
  apremio: 'Apremio',
  embargo: 'Embargo',
  pagada: 'Pagada',
  aplazada: 'Aplazada',
};

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

const EjercicioPagosTab: React.FC<EjercicioPagosTabProps> = ({
  cuotaDiferencial,
  pagosCuota,
  deudasVinculadas,
}) => {
  const sinPagos = pagosCuota.length === 0;
  const sinDeudas = deudasVinculadas.length === 0;

  if (sinPagos && sinDeudas && cuotaDiferencial === null) {
    return (
      <div className={styles.card}>
        <div className={styles.cardHd}>
          <div>
            <div className={styles.cardTitle}>Pagos y deudas del ejercicio</div>
            <div className={styles.cardSub}>cuota diferencial · liquidaciones complementarias</div>
          </div>
        </div>
        <div className={styles.emptyState}>
          <div className={styles.emptyStateTitle}>Sin pagos registrados</div>
          <div>Cuando se registre el pago de la cuota diferencial o una deuda vinculada aparecerá aquí.</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={styles.card}>
        <div className={styles.cardHd}>
          <div>
            <div className={styles.cardTitle}>Cuota diferencial</div>
            <div className={styles.cardSub}>
              {cuotaDiferencial === null
                ? 'pendiente de cálculo'
                : cuotaDiferencial >= 0
                  ? 'a pagar a la AEAT'
                  : 'a devolver por la AEAT'}
            </div>
          </div>
        </div>
        <div>
          {sinPagos ? (
            <div className={styles.emptyState}>
              <div>Cuota: <span className={styles.mono}>{fmtEuros(cuotaDiferencial)}</span></div>
              <div className={styles.tMuted}>Sin pagos registrados todavía.</div>
            </div>
          ) : (
            <table className={styles.tbl}>
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Fecha</th>
                  <th style={{ textAlign: 'right' }}>Importe</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {pagosCuota.map((p, idx) => (
                  <tr key={`pago-${idx}`}>
                    <td className={styles.tStrong}>{p.concepto}</td>
                    <td>
                      <span className={styles.mono}>{fmtFecha(p.fecha)}</span>
                    </td>
                    <td className={styles.tdRight}>
                      <span className={`${styles.mono} ${styles.tStrong}`}>{fmtEuros(p.importe)}</span>
                    </td>
                    <td>{p.estado === 'pagado' ? 'Pagado' : 'Pendiente'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {!sinDeudas && (
        <div className={styles.card}>
          <div className={styles.cardHd}>
            <div>
              <div className={styles.cardTitle}>Deudas vinculadas a este ejercicio</div>
              <div className={styles.cardSub}>liquidaciones complementarias · recargos · apremios</div>
            </div>
          </div>
          <table className={styles.tbl}>
            <thead>
              <tr>
                <th>Modelo</th>
                <th>Periodo</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th>Estado</th>
                <th>Notificada</th>
              </tr>
            </thead>
            <tbody>
              {deudasVinculadas.map((d) => (
                <tr key={d.id ?? `${d.modelo}-${d.periodo}`}>
                  <td>
                    <span className={`${styles.mono} ${styles.tStrong}`}>{d.modelo}</span>
                  </td>
                  <td>{d.periodo === 'anual' ? 'Anual' : d.periodo}</td>
                  <td className={styles.tdRight}>
                    <span className={`${styles.mono} ${styles.tStrong}`}>
                      {fmtEuros(d.total)}
                    </span>
                  </td>
                  <td>{ESTADO_LABEL[d.estado] ?? d.estado}</td>
                  <td>
                    <span className={styles.mono}>{fmtFecha(d.notificada)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

export default EjercicioPagosTab;
