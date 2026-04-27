import React from 'react';
import styles from './DateLabel.module.css';

export type DateFormat = 'long' | 'short' | 'compact' | 'monthYear' | 'year';
export type DateLabelTone = 'default' | 'muted' | 'subtle';
export type DateLabelSize = 'sm' | 'md';

export interface DateLabelProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Date · ISO string · timestamp. */
  value: Date | string | number;
  /** Formato. Default 'short' · ej "30 jun 2026". */
  format?: DateFormat;
  /** Tono. */
  tone?: DateLabelTone;
  /** Tamaño · base 13.5px o subtítulo 12px. */
  size?: DateLabelSize;
  /** Si true · negrita + tinta principal. */
  bold?: boolean;
  /** Locale. Default 'es-ES'. */
  locale?: string;
}

const formatDate = (date: Date, format: DateFormat, locale: string): string => {
  switch (format) {
    case 'long':
      return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(date);
    case 'short':
      return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(date);
    case 'compact':
      return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
      }).format(date);
    case 'monthYear':
      return new Intl.DateTimeFormat(locale, {
        month: 'short',
        year: 'numeric',
      }).format(date);
    case 'year':
      return String(date.getFullYear());
    default:
      return date.toLocaleDateString(locale);
  }
};

/**
 * Fecha formateada en estándar ATLAS · familia mono · tabular-nums.
 * Ejemplos · "30 jun 2026" · "dic 2027" · "2040".
 */
const DateLabel: React.FC<DateLabelProps> = ({
  value,
  format = 'short',
  tone = 'default',
  size = 'md',
  bold = false,
  locale = 'es-ES',
  className,
  ...rest
}) => {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return (
      <span className={`${styles.date} ${styles.subtle}`} {...rest}>
        —
      </span>
    );
  }

  const classes = [
    styles.date,
    tone !== 'default' ? styles[tone] : '',
    styles[size],
    bold ? styles.bold : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} {...rest}>
      {formatDate(date, format, locale)}
    </span>
  );
};

export default DateLabel;
export { DateLabel };
