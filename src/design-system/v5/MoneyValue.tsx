import React from 'react';
import styles from './MoneyValue.module.css';

export type MoneyTone =
  | 'auto'
  | 'pos'
  | 'neg'
  | 'brand'
  | 'gold'
  | 'warn'
  | 'muted'
  | 'ink';
export type MoneySize = 'inline' | 'kpi' | 'kpiStar';

export interface MoneyValueProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Importe numérico en euros. */
  value: number;
  /** Si true · muestra el símbolo €. Default true. */
  showCurrency?: boolean;
  /** Si true · muestra siempre el signo · útil para deltas. */
  showSign?: boolean;
  /** Decimales. Default 2. Para KPIs grandes 0 puede ser más limpio. */
  decimals?: number;
  /** Tono de color · `auto` colorea por signo · `ink` mantiene tinta neutra. */
  tone?: MoneyTone;
  /** Tamaño de tipografía · §2.4. */
  size?: MoneySize;
  /** Locale formato. Default 'es-ES'. */
  locale?: string;
}

/**
 * Importe formateado en JetBrains Mono · color por signo si tone='auto'.
 * Siempre `tabular-nums` · alineación consistente en columnas.
 */
const MoneyValue: React.FC<MoneyValueProps> = ({
  value,
  showCurrency = true,
  showSign = false,
  decimals = 2,
  tone = 'auto',
  size = 'inline',
  locale = 'es-ES',
  className,
  ...rest
}) => {
  const isNegative = value < 0;
  const isPositive = value > 0;

  const resolvedTone =
    tone === 'auto'
      ? isNegative
        ? 'neg'
        : isPositive
          ? 'pos'
          : 'muted'
      : tone;

  const formatter = new Intl.NumberFormat(locale, {
    style: showCurrency ? 'currency' : 'decimal',
    currency: 'EUR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: showSign ? 'exceptZero' : 'auto',
  });

  const text = formatter.format(value);

  const classes = [
    styles.money,
    resolvedTone !== 'ink' ? styles[resolvedTone] : '',
    styles[size],
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} {...rest}>
      {text}
    </span>
  );
};

export default MoneyValue;
export { MoneyValue };
