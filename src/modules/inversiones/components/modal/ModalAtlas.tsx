// ModalAtlas · shell común del patrón Modal ATLAS · T-INVERSIONES-V5
// Estructura · header navy + body 2-col (form + preview) + footer
// Mockup vinculante · docs/specs/atlas-inversiones-v3 (2).html §6
// Spec · TAREA-CC-T-INVERSIONES-V5 §6.1
//
// PR 1 · solo scaffolding · NO cableado al UI vivo. Se introduce sin
// imports desde galería/fichas/wizards para no producir cambios visibles
// en /inversiones. Se wireará en PR 3 (modales de alta) y siguientes.

import React, { useCallback, useEffect } from 'react';
import styles from '../../styles/atlas-inversiones.module.css';

export type ModalAtlasSize = 'default' | 'noPreview' | 'narrow';

export interface ModalAtlasProps {
  /** Cierre del modal · invocado en click backdrop, tecla Escape o click en X. */
  onClose: () => void;
  /**
   * Variante de tamaño:
   *  - `default` · 1020px con preview lateral 340px
   *  - `noPreview` · 720px sin preview
   *  - `narrow` · 560px (p.ej. Actualizar valoración)
   */
  size?: ModalAtlasSize;
  /**
   * Texto opcional para `aria-label` del modal · útil cuando el header
   * usa un nodo complejo y no un string puro.
   */
  ariaLabel?: string;
  /** Contenido · típicamente `<ModalAtlasHeader/>` + body + `<ModalAtlasFooter/>`. */
  children: React.ReactNode;
}

/**
 * Shell del modal ATLAS.
 *
 * - Renderiza overlay con backdrop oscuro semi-transparente.
 * - Cierra al pulsar Escape (`keydown` global mientras el modal vive).
 * - Cierra al click directo sobre el overlay (no propaga si el click es
 *   dentro del panel).
 * - No usa portal · sigue la convención del repo (ver
 *   `Dialog.module.css` en `src/modules/inversiones/components/`).
 */
const ModalAtlas: React.FC<ModalAtlasProps> = ({
  onClose,
  size = 'default',
  ariaLabel,
  children,
}) => {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  const sizeClass =
    size === 'noPreview'
      ? styles.noPreview
      : size === 'narrow'
        ? styles.narrow
        : '';

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={handleOverlayClick}
      data-testid="modal-atlas-overlay"
    >
      <div
        className={`${styles.modal} ${sizeClass}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        data-testid="modal-atlas"
        data-size={size}
      >
        {children}
      </div>
    </div>
  );
};

/** Body 2-col (form + preview). Para `narrow` o `noPreview`, usar
 *  `ModalAtlasBody` con un único hijo y el size apropiado. */
export const ModalAtlasBody: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <div className={styles.body}>{children}</div>;

/** Slot izquierdo del body · contiene secciones de formulario. */
export const ModalAtlasForm: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <div className={styles.form}>{children}</div>;

export default ModalAtlas;
