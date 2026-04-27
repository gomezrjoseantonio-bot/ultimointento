import React from 'react';
import styles from './IconButton.module.css';

export type IconButtonVariant = 'ghost' | 'primary' | 'danger' | 'plain';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Etiqueta accesible obligatoria · botones sin texto. */
  ariaLabel: string;
  /** Variante visual · §12.2 guía v5. */
  variant?: IconButtonVariant;
  /** Tamaño · 28px / 32px / 36px. */
  size?: IconButtonSize;
  /** Icono Lucide ya instanciado o cualquier nodo. */
  children: React.ReactNode;
}

/**
 * Botón con icono únicamente. Variantes · plain (default · transparente
 * con hover sutil) · ghost (con borde) · primary (oro) · danger (rojo).
 */
const IconButton: React.FC<IconButtonProps> = ({
  ariaLabel,
  variant = 'plain',
  size = 'md',
  className,
  type = 'button',
  children,
  ...rest
}) => {
  const classes = [
    styles.iconBtn,
    variant !== 'plain' ? styles[variant] : '',
    size !== 'md' ? styles[size] : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      aria-label={ariaLabel}
      className={classes}
      {...rest}
    >
      {children}
    </button>
  );
};

export default IconButton;
export { IconButton };
