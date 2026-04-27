import React from 'react';
import styles from './EmptyState.module.css';

export interface EmptyStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Icono opcional Lucide · centrado arriba. */
  icon?: React.ReactNode;
  /** Título principal · una línea. */
  title: React.ReactNode;
  /** Subtítulo · descripción del vacío y siguiente paso. */
  sub?: React.ReactNode;
  /** Etiqueta del CTA opcional · ej "+ asigna una cuenta". */
  ctaLabel?: React.ReactNode;
  /** Click del CTA. */
  onCtaClick?: () => void;
  /** Padding compacto. */
  compact?: boolean;
}

/**
 * Bloque dashed centrado para estados vacíos · §9.3.
 * Iconito opcional · título · subtítulo · CTA en oro tinta.
 */
const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  sub,
  ctaLabel,
  onCtaClick,
  compact = false,
  className,
  ...rest
}) => {
  const classes = [
    styles.empty,
    compact ? styles.compact : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} {...rest}>
      {icon && <div className={styles.iconWrap}>{icon}</div>}
      <div className={styles.title}>{title}</div>
      {sub != null && <div className={styles.sub}>{sub}</div>}
      {ctaLabel != null && (
        <button type="button" className={styles.cta} onClick={onCtaClick}>
          {ctaLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
export { EmptyState };
