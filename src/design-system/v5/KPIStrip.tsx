import React from 'react';
import styles from './KPIStrip.module.css';

export interface KPIStripProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Número de columnas. Default · se infiere de `Children.count`. */
  columns?: 2 | 3 | 4 | 5;
  /** Hijos · normalmente `<KPI>`. */
  children: React.ReactNode;
}

/**
 * Banda horizontal de KPIs · separadores verticales · sin gap.
 * §7 guía v5. Si `columns` se omite · se cuentan los hijos directos.
 */
const KPIStrip: React.FC<KPIStripProps> = ({
  columns,
  className,
  children,
  ...rest
}) => {
  const childCount = React.Children.count(children);
  const cols = columns ?? (Math.min(Math.max(childCount, 2), 5) as 2 | 3 | 4 | 5);
  const colClass =
    cols === 2 ? styles.cols2
    : cols === 3 ? styles.cols3
    : cols === 4 ? styles.cols4
    : styles.cols5;

  const classes = [styles.strip, colClass, className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
};

export default KPIStrip;
export { KPIStrip };
