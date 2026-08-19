// ============================================================================
// Tesorería V9 · confirmación destructiva del módulo
// ============================================================================
//
// El mismo lenguaje visual que el modal de CerrarElMes (velo + panel v5). El
// `ConfirmationModal` de `components/common` es legacy pre-v5 (Tailwind) y la
// guía manda no reintroducirlo en pantallas nuevas.
// ============================================================================

import React from 'react';
import styles from './ConfirmaV6.module.css';

interface Props {
  abierto: boolean;
  titulo: string;
  children: React.ReactNode;
  /** Rótulo del botón que confirma · ej "Dar de baja". */
  confirmar: string;
  trabajando?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

const ConfirmaV6: React.FC<Props> = ({
  abierto,
  titulo,
  children,
  confirmar,
  trabajando = false,
  onConfirmar,
  onCancelar,
}) => {
  if (!abierto) return null;
  return (
    <div className={styles.velo} role="dialog" aria-modal="true" aria-label={titulo}>
      <div className={styles.panel}>
        <div className={styles.titulo}>{titulo}</div>
        <div className={styles.cuerpo}>{children}</div>
        <div className={styles.botones}>
          <button type="button" className={styles.btn} disabled={trabajando} onClick={onCancelar}>
            Cancelar
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGold}`}
            disabled={trabajando}
            onClick={onConfirmar}
          >
            {confirmar}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmaV6;
