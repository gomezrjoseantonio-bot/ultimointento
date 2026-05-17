// Header navy del Modal ATLAS · icono cuadrado oro + título + subtítulo + close X
// Mockup vinculante · docs/specs/atlas-inversiones-v3 (2).html §6 · líneas 589-615
// Spec · TAREA-CC-T-INVERSIONES-V5 §6.1

import React from 'react';
import { Icons } from '../../../../design-system/v5';
import styles from '../../styles/atlas-inversiones.module.css';

export interface ModalAtlasHeaderProps {
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  /** aria-label del botón de cierre · default 'Cerrar'. */
  closeLabel?: string;
}

const ModalAtlasHeader: React.FC<ModalAtlasHeaderProps> = ({
  icon,
  title,
  subtitle,
  onClose,
  closeLabel = 'Cerrar',
}) => (
  <header className={styles.header}>
    <div className={styles.headerIcon} aria-hidden="true">
      {icon}
    </div>
    <div className={styles.headerTitleWrap}>
      <div className={styles.headerTitle}>{title}</div>
      {subtitle != null && <div className={styles.headerSub}>{subtitle}</div>}
    </div>
    <button
      type="button"
      className={styles.headerClose}
      aria-label={closeLabel}
      onClick={onClose}
      data-testid="modal-atlas-close"
    >
      <Icons.Close size={18} strokeWidth={1.8} />
    </button>
  </header>
);

export default ModalAtlasHeader;
