import React from 'react';
import { MoneyValue } from '../../../design-system/v5';
import styles from './MonthGrid.module.css';

export interface MonthCard {
  key: string;
  month: number; // 1-12
  name: string;
  status: 'past' | 'current' | 'future';
  saldo: number;
  entradas: number;
  salidas: number;
}

export interface MonthGridProps {
  months: MonthCard[];
  onClick?: (m: MonthCard) => void;
}

const tagFor = (status: MonthCard['status']): string => {
  switch (status) {
    case 'past':
      return 'cerrado';
    case 'current':
      return 'en curso · hoy';
    case 'future':
      return 'previsto';
  }
};

const MonthGrid: React.FC<MonthGridProps> = ({ months, onClick }) => (
  <div className={styles.grid}>
    {months.map((m) => {
      const tagCls = m.status === 'current' ? styles.now : '';
      return (
        <button
          key={m.key}
          type="button"
          className={`${styles.card} ${styles[m.status]}`}
          onClick={() => onClick?.(m)}
          aria-label={`Mes ${m.name} · saldo ${m.saldo}`}
        >
          <div className={styles.name}>{m.name}</div>
          <div className={`${styles.tag} ${tagCls}`}>{tagFor(m.status)}</div>
          <div className={styles.saldo}>
            <MoneyValue value={m.saldo} decimals={0} tone="ink" />
          </div>
          <div className={styles.row}>
            <span>Entradas</span>
            <span className={styles.pos}>
              <MoneyValue
                value={m.entradas}
                decimals={0}
                showSign
                tone="pos"
              />
            </span>
          </div>
          <div className={styles.row}>
            <span>Salidas</span>
            <span className={styles.neg}>
              <MoneyValue
                value={m.salidas}
                decimals={0}
                showSign
                tone="neg"
              />
            </span>
          </div>
        </button>
      );
    })}
  </div>
);

export default MonthGrid;
export { MonthGrid };
