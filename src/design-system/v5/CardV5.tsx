import React from 'react';
import styles from './CardV5.module.css';

export type CardAccent =
  | 'none'
  | 'brand'
  | 'gold'
  | 'gold-soft'
  | 'pos'
  | 'neg'
  | 'warn'
  | 'neutral';

export interface CardV5Props extends React.HTMLAttributes<HTMLDivElement> {
  /** Borde superior por dominio · §11 guía v5. */
  accent?: CardAccent;
  /** Padding compacto (14/18 vs 16/20). */
  compact?: boolean;
  /** Si true · cursor pointer + hover transform · §15.2. */
  clickable?: boolean;
  children?: React.ReactNode;
}

const accentClass: Record<CardAccent, string> = {
  none: '',
  brand: styles.accentBrand,
  gold: styles.accentGold,
  'gold-soft': styles.accentGoldSoft,
  pos: styles.accentPos,
  neg: styles.accentNeg,
  warn: styles.accentWarn,
  neutral: styles.accentNeutral,
};

/**
 * Card v5 · contenedor base con variante de borde superior.
 * Soporta sub-componentes · CardHead · CardBody · CardFoot · CardTitle · CardSubtitle.
 */
const CardV5: React.FC<CardV5Props> & {
  Head: typeof CardHead;
  Body: typeof CardBody;
  Foot: typeof CardFoot;
  Title: typeof CardTitle;
  Subtitle: typeof CardSubtitle;
} = ({
  accent = 'none',
  compact = false,
  clickable = false,
  className,
  children,
  ...rest
}) => {
  const classes = [
    styles.card,
    accentClass[accent],
    compact ? styles.compact : '',
    clickable ? styles.clickable : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
};

const CardHead: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...rest
}) => (
  <div className={`${styles.cardHead} ${className ?? ''}`} {...rest}>
    {children}
  </div>
);

const CardBody: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...rest
}) => (
  <div className={`${styles.cardBody} ${className ?? ''}`} {...rest}>
    {children}
  </div>
);

const CardFoot: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...rest
}) => (
  <div className={`${styles.cardFoot} ${className ?? ''}`} {...rest}>
    {children}
  </div>
);

const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className,
  children,
  ...rest
}) => (
  <h3 className={`${styles.cardTitle} ${className ?? ''}`} {...rest}>
    {children}
  </h3>
);

const CardSubtitle: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...rest
}) => (
  <div className={`${styles.cardSubtitle} ${className ?? ''}`} {...rest}>
    {children}
  </div>
);

CardV5.Head = CardHead;
CardV5.Body = CardBody;
CardV5.Foot = CardFoot;
CardV5.Title = CardTitle;
CardV5.Subtitle = CardSubtitle;

export default CardV5;
export { CardV5, CardHead, CardBody, CardFoot, CardTitle, CardSubtitle };
