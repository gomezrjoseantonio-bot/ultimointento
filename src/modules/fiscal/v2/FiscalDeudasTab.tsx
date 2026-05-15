/**
 * FiscalDeudasTab · tab "Deudas" del F1 dashboard.
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 2 §4.2 / §4.3.
 * Datos · `deudasFiscalesService.getDeudasAbiertas()` (sub-tarea 1 hueco 4).
 */

import React from 'react';
import type { DeudaFiscal } from '../../../services/db';
import styles from './FiscalDashboardPage.module.css';

export interface FiscalDeudasTabProps {
  deudas: DeudaFiscal[];
  onSelectDeuda?: (id: number) => void;
}

const ESTADO_LABEL: Record<DeudaFiscal['estado'], string> = {
  voluntario: 'Voluntario',
  ejecutivo: 'Ejecutivo',
  apremio: 'Apremio',
  embargo: 'Embargo',
  pagada: 'Pagada',
  aplazada: 'Aplazada',
};

const RECARGO_LABEL: Record<DeudaFiscal['recargoTipo'], string> = {
  voluntario: 'sin recargo',
  ejecutivo_5: 'ejecutivo 5%',
  ejecutivo_10: 'ejecutivo 10%',
  ejecutivo_15: 'ejecutivo 15%',
  apremio_20: 'apremio 20%',
  embargo: 'embargo',
};

function fmtMoneda(n: number, signo = false): string {
  const sign = signo && n > 0 ? '+' : '';
  return `${sign}${new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)} €`;
}

function fmtFechaIso(iso?: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function periodoLabel(d: DeudaFiscal): { titulo: string; sub: string } {
  if (d.periodo === 'anual') {
    return { titulo: `IRPF ${d.ejercicio}`, sub: 'declaración anual' };
  }
  const trimMap: Record<string, string> = {
    '1T': 'ene-mar', '2T': 'abr-jun', '3T': 'jul-sep', '4T': 'oct-dic',
  };
  const concept = d.modelo === '303' ? 'IVA' : d.modelo === '130' ? 'IRPF M130' : `M${d.modelo}`;
  return {
    titulo: `${concept} ${d.periodo}-${d.ejercicio}`,
    sub: `${trimMap[d.periodo] ?? d.periodo} ${d.ejercicio}`,
  };
}

const FiscalDeudasTab: React.FC<FiscalDeudasTabProps> = ({ deudas, onSelectDeuda }) => {
  return (
    <div className={styles.card}>
      <div className={styles.cardHd}>
        <div>
          <div className={styles.cardTitle}>Deudas fiscales abiertas</div>
          <div className={styles.cardSub}>pendientes de pago a la AEAT</div>
        </div>
      </div>
      <div>
        {deudas.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>Sin deudas abiertas</div>
            <div>Cuando registres una liquidación pendiente aparecerá aquí.</div>
          </div>
        ) : (
          <table className={styles.tbl}>
            <thead>
              <tr>
                <th>Modelo</th>
                <th>Periodo</th>
                <th style={{ textAlign: 'right' }}>Principal</th>
                <th style={{ textAlign: 'right' }}>Recargo</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th>Estado</th>
                <th>Notificada</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {deudas.map((d) => {
                const periodo = periodoLabel(d);
                return (
                  <tr
                    key={d.id ?? `${d.modelo}-${d.ejercicio}-${d.periodo}`}
                    className={onSelectDeuda ? styles.tblClickable : ''}
                    onClick={() => onSelectDeuda && d.id && onSelectDeuda(d.id)}
                  >
                    <td>
                      <span className={`${styles.mono} ${styles.tStrong}`}>{d.modelo}</span>
                    </td>
                    <td>
                      <div className={styles.tStrong}>{periodo.titulo}</div>
                      <div className={styles.tMuted}>{periodo.sub}</div>
                    </td>
                    <td className={styles.tdRight}>
                      <span className={styles.mono}>{fmtMoneda(d.principal)}</span>
                    </td>
                    <td className={styles.tdRight}>
                      <span className={styles.mono}>{fmtMoneda(d.recargoImporte, true)}</span>
                      <div className={styles.tMuted}>{RECARGO_LABEL[d.recargoTipo]}</div>
                    </td>
                    <td className={styles.tdRight}>
                      <span className={`${styles.tdAmount} ${styles.neg}`}>{fmtMoneda(d.total)}</span>
                    </td>
                    <td>
                      <span className={`${styles.pill} ${styles.pillDeuda}`}>
                        {ESTADO_LABEL[d.estado]}
                      </span>
                    </td>
                    <td>
                      <span className={styles.mono}>{fmtFechaIso(d.notificada)}</span>
                    </td>
                    <td className={styles.tdCenter}>
                      <span style={{ color: 'var(--atlas-v5-ink-3)' }}>›</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default FiscalDeudasTab;
