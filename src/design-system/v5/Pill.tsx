import React from 'react';
import styles from './Pill.module.css';

export type PillVariant = 'brand' | 'gold' | 'pos' | 'warn' | 'neg' | 'gris';

export interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Variante de color por dominio · §11 guía v5. */
  variant?: PillVariant;
  /** Si true · usa familia mono + uppercase · estilo "tag" §12.6. */
  asTag?: boolean;
  /** Icono Lucide opcional a la izquierda del texto. */
  leadingIcon?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Pill / chip de estado o categoría.
 * Uso típico · estado de objetivo · tipo de fondo · etiqueta de cat.
 */
const Pill: React.FC<PillProps> = ({
  variant = 'gris',
  asTag = false,
  leadingIcon,
  className,
  children,
  ...rest
}) => {
  const classes = [
    styles.pill,
    styles[variant],
    asTag ? styles.tag : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} {...rest}>
      {leadingIcon}
      {children}
    </span>
  );
};

export default Pill;
export { Pill };
