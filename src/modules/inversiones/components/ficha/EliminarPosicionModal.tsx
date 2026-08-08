// INVERSIONES V1 · Fase 3 · confirmación destructiva "Eliminar posición".
// Mockup atlas-inversiones-v10.html · openEliminar() + .el-warn (l.1181, l.395).
//
// Regla de oro §3 · el borrado es lógico (`deletePosicion` → activo=false):
// la posición pasa a "Posiciones cerradas" y NO se tocan los movimientos ya
// conciliados en Tesorería. El copy lo deja explícito.

import React, { useEffect } from 'react';
import styles from './fichaDetalleV5.module.css';

interface Props {
  /** Qué se elimina · p.ej. "este préstamo" · "esta posición". */
  what: string;
  onConfirm: () => void;
  onClose: () => void;
}

const EliminarPosicionModal: React.FC<Props> = ({ what, onConfirm, onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className={styles.elBackdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Confirmar eliminación"
    >
      <div className={styles.elModal}>
        <div className={styles.elWarn}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          </svg>
        </div>
        <div className={styles.elTitle}>¿Eliminar {what}?</div>
        <div className={styles.elBody}>
          Hazlo solo si la creaste por error. La posición pasa a{' '}
          <strong>Posiciones cerradas</strong> y <strong>no se borran</strong> los
          movimientos ya conciliados en Tesorería.
        </div>
        <div className={styles.elActs}>
          <button type="button" className={styles.elCancel} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className={styles.elConfirm} onClick={onConfirm}>
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
};

export default EliminarPosicionModal;
