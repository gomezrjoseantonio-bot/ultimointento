import React from 'react';
import { Icons, MoneyValue, showToastV5 } from '../../../../design-system/v5';
import type { StatsAgregados } from '../../utils/filtrosActivos';
import styles from './BarraFiltros.module.css';

export interface ToolbarTablaProps {
  stats: StatsAgregados;
}

const toast = (msg: string) => () => showToastV5(msg);

const ToolbarTabla: React.FC<ToolbarTablaProps> = ({ stats }) => (
  <div className={styles.toolbar}>
    <div className={styles.toolbarStats}>
      <span>
        <strong>{stats.total}</strong> {stats.total === 1 ? 'contrato' : 'contratos'}
      </span>
      <span className={styles.toolbarStatsDot}>·</span>
      <span>
        Renta mensual:{' '}
        <strong>
          <MoneyValue value={stats.rentaMensual} decimals={0} tone="ink" />
        </strong>
      </span>
      <span className={styles.toolbarStatsDot}>·</span>
      <span>
        Fianza acumulada:{' '}
        <strong>
          <MoneyValue value={stats.fianzaAcumulada} decimals={0} tone="ink" />
        </strong>
      </span>
    </div>
    <div className={styles.toolbarActions}>
      <button
        type="button"
        className={styles.tBtn}
        onClick={toast('Exportación a Excel próximamente · T3.1')}
      >
        <Icons.Download size={12} strokeWidth={1.8} /> Exportar Excel
      </button>
      <button
        type="button"
        className={styles.tBtn}
        onClick={toast('Vista de impresión próximamente · T3.1')}
      >
        <Icons.Help size={12} strokeWidth={1.8} /> Imprimir
      </button>
      <button
        type="button"
        className={styles.tBtn}
        onClick={toast('Personalización de columnas próximamente · T3.1')}
      >
        <Icons.Ajustes size={12} strokeWidth={1.8} /> Columnas
      </button>
    </div>
  </div>
);

export default ToolbarTabla;
export { ToolbarTabla };
