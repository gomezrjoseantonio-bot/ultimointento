import React from 'react';
import styles from './SetSection.module.css';

export interface SetSectionProps {
  title: React.ReactNode;
  sub?: React.ReactNode;
  /** Si true · variante peligrosa · borde + fondo neg-wash en cabecera. */
  danger?: boolean;
  /** Slot derecho de la cabecera (botón secundario · acción). */
  headerAction?: React.ReactNode;
  /** Hijos · normalmente filas SetRow. */
  children: React.ReactNode;
  className?: string;
}

/**
 * Card "set-section" del mockup atlas-ajustes-v2.html.
 * Cabecera con título + subtítulo opcional + acción a la derecha
 * · cuerpo con filas separadas por línea fina.
 */
const SetSection: React.FC<SetSectionProps> = ({
  title,
  sub,
  danger = false,
  headerAction,
  children,
  className,
}) => {
  const classes = [
    styles.section,
    danger ? styles.danger : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <div className={styles.head}>
        <div className={styles.headRow}>
          <div>
            <div className={styles.title}>{title}</div>
            {sub != null && <div className={styles.sub}>{sub}</div>}
          </div>
          {headerAction}
        </div>
      </div>
      {children}
    </div>
  );
};

export default SetSection;
export { SetSection };
