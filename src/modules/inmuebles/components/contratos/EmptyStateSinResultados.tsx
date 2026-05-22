import React from 'react';
import { Icons } from '../../../../design-system/v5';
import styles from './TablaActivos.module.css';

export interface EmptyStateSinResultadosProps {
  onLimpiar: () => void;
}

const EmptyStateSinResultados: React.FC<EmptyStateSinResultadosProps> = ({ onLimpiar }) => (
  <div className={styles.emptyResults}>
    <Icons.Search size={28} strokeWidth={1.6} />
    <h3>No hay contratos con esos filtros</h3>
    <p>
      Prueba a ajustar la búsqueda o limpiar los filtros para ver todos tus
      contratos activos.
    </p>
    <button type="button" className={styles.emptyResultsBtn} onClick={onLimpiar}>
      Limpiar filtros
    </button>
  </div>
);

export default EmptyStateSinResultados;
export { EmptyStateSinResultados };
