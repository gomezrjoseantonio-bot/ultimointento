// Footer del Modal ATLAS · info izq (icono oro + texto) + acciones der (Cancelar + Gold)
// Mockup vinculante · docs/specs/atlas-inversiones-v3 (2).html §6 · líneas 813-828
// Spec · TAREA-CC-T-INVERSIONES-V5 §6.1

import React from 'react';
import styles from '../../styles/atlas-inversiones.module.css';

export interface ModalAtlasFooterProps {
  /** Texto informativo a la izquierda · típicamente con icono oro pequeño. */
  info?: React.ReactNode;
  /** Botones de acción a la derecha · típicamente Cancelar (ghost) + Guardar (gold). */
  actions: React.ReactNode;
}

const ModalAtlasFooter: React.FC<ModalAtlasFooterProps> = ({ info, actions }) => (
  <footer className={styles.footer}>
    <div className={styles.footerInfo}>{info}</div>
    <div className={styles.footerActions}>{actions}</div>
  </footer>
);

/** Botón ghost · usado para "Cancelar". */
export const ModalAtlasButtonGhost: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement>
> = ({ children, className, ...rest }) => (
  <button
    type="button"
    className={`${styles.btn} ${styles.btnGhost} ${className ?? ''}`.trim()}
    {...rest}
  >
    {children}
  </button>
);

/** Botón gold (primario) · usado para "Guardar" / "Crear" / "Aportar" / etc. */
export const ModalAtlasButtonGold: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement>
> = ({ children, className, ...rest }) => (
  <button
    type="button"
    className={`${styles.btn} ${styles.btnGold} ${className ?? ''}`.trim()}
    {...rest}
  >
    {children}
  </button>
);

export default ModalAtlasFooter;
