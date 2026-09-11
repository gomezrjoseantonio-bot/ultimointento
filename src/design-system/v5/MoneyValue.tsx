import React from 'react';
import { intlOpts } from '../../utils/intlNumber';
import styles from './MoneyValue.module.css';

export type MoneyTone =
  | 'auto'
  | 'pos'
  | 'neg'
  | 'brand'
  | 'gold'
  | 'warn'
  | 'muted'
  | 'ink'
  | 'inherit';
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
  /** Tono de color. Default `ink` (regla de importes · guía v5 §2.2: los
   *  importes van en tinta; el color por signo hay que pedirlo con `auto`,
   *  `pos` o `neg`, y solo para deltas de rentabilidad o estados).
   *  `inherit` no pinta: toma el color del contenedor (héroes navy · cifras
   *  oro cuyo color pone el wrapper). */
  tone?: MoneyTone;
  /** Tamaño de tipografía · §2.4. */
  size?: MoneySize;
  /** Locale formato. Default 'es-ES'. */
  locale?: string;
}

/**
 * Importe formateado en JetBrains Mono · tinta por defecto · color por signo
 * SOLO si tone='auto' (decisión Jose 2026-09-11 · un mockup nuevo no debe
 * heredar el semáforo sin pedirlo). Siempre `tabular-nums`.
 */
const MoneyValue: React.FC<MoneyValueProps> = ({
  value,
  showCurrency = true,
  showSign = false,
  decimals = 2,
  tone = 'ink',
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

  const formatter = new Intl.NumberFormat(
    locale,
    // es-ES por defecto omite el separador para 4 cifras (minimumGroupingDigits=2)
    // Forzamos el agrupamiento para que "4396" se renderice como "4.396 €".
    intlOpts({
      style: showCurrency ? 'currency' : 'decimal',
      currency: 'EUR',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      signDisplay: showSign ? 'exceptZero' : 'auto',
      useGrouping: 'always',
    }),
  );

  const text = formatter.format(value);

  const classes = [
    styles.money,
    resolvedTone !== 'inherit' ? styles[resolvedTone] : '',
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
