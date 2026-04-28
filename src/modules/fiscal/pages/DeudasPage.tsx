import React, { useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { CardV5, MoneyValue } from '../../../design-system/v5';
import type { FiscalOutletContext } from '../FiscalContext';
import { cuotaResultado, formatDateLong } from '../helpers';
import styles from './DeudasPage.module.css';

const DeudasPage: React.FC = () => {
  const navigate = useNavigate();
  const { ejercicios } = useOutletContext<FiscalOutletContext>();

  const deudas = useMemo(() => {
    return ejercicios
      .filter((e) => e.estado === 'declarado')
      .map((e) => ({ e, cuota: cuotaResultado(e) }))
      .filter(({ cuota }) => cuota < 0)
      .sort((a, b) => b.e.ejercicio - a.e.ejercicio);
  }, [ejercicios]);

  const total = deudas.reduce((s, x) => s + Math.abs(x.cuota), 0);

  if (deudas.length === 0) {
    return (
      <CardV5>
        <CardV5.Body>
          <div className={styles.empty}>
            <strong style={{ color: 'var(--atlas-v5-pos)' }}>Al día.</strong> No hay
            deudas fiscales pendientes registradas.
          </div>
        </CardV5.Body>
      </CardV5>
    );
  }

  return (
    <>
      <div className={styles.kpi}>
        <div className={styles.kpiLab}>Total deudas pendientes</div>
        <div className={styles.kpiVal}>
          <MoneyValue value={-total} decimals={2} showSign tone="neg" />
        </div>
      </div>

      <div className={styles.tableWrap}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--atlas-v5-line-2)' }}>
          <div className={styles.title}>Deudas por ejercicio</div>
          <div className={styles.sub}>{deudas.length} ejercicios con resultado a pagar</div>
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Ejercicio</th>
              <th>Declarado</th>
              <th className={styles.right}>Importe</th>
              <th className={styles.center}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {deudas.map(({ e, cuota }) => (
              <tr key={e.ejercicio} onClick={() => navigate(`/fiscal/ejercicio/${e.ejercicio}`)}>
                <td>
                  <span className={styles.year}>{e.ejercicio}</span>
                </td>
                <td>{formatDateLong(e.declaradoAt)}</td>
                <td className={styles.right}>
                  <MoneyValue value={cuota} decimals={2} showSign tone="neg" />
                </td>
                <td className={styles.center}>
                  <span style={{ fontSize: 11, color: 'var(--atlas-v5-ink-3)' }}>
                    pendiente · seguimiento manual
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default DeudasPage;
