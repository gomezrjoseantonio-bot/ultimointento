import React from 'react';
import styles from './KPIStrip.module.css';

export type KPIValueTone = 'ink' | 'brand' | 'gold' | 'pos' | 'neg' | 'warn';

export interface KPIProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Etiqueta corta de cabecera. */
  label: string;
  /** Valor principal (string ya formateado o nodo · ej `<MoneyValue />`). */
  value: React.ReactNode;
  /** Subtítulo descriptivo · alineado al ras inferior por margin-top:auto. */
  sub?: React.ReactNode;
  /** Tono del valor cuando es texto plano. Si `value` es un nodo aplica solo
   *  al wrapper · útil para coherencia con la guía. */
  tone?: KPIValueTone;
  /** Variante "estrella" · 32px valor · borde superior por tipo · 130px alto. */
  star?: boolean;
  /** Color del borde superior cuando star=true. */
  starAccent?: 'brand' | 'gold' | 'pos' | 'neg' | 'warn' | 'neutral';
}

const starAccentClass = {
  brand: styles.starBrand,
  gold: styles.starGold,
  pos: styles.starPos,
  neg: styles.starNeg,
  warn: styles.starWarn,
  neutral: styles.starNeutral,
} as const;

/**
 * Celda KPI · usar dentro de `<KPIStrip>`.
 * Cumple las 4 reglas críticas §7.3 · flex column · min-height 92px (130 estrella) ·
 * line-height 1.15 en valor · margin-top:auto + padding-top:6px en sub.
 */
const KPI: React.FC<KPIProps> = ({
  label,
  value,
  sub,
  tone = 'ink',
  star = false,
  starAccent = 'brand',
  className,
  ...rest
}) => {
  const wrapperClasses = [
    styles.kpi,
    star ? styles.starVariant : '',
    star ? starAccentClass[starAccent] : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const valueClasses = [
    styles.kpiValue,
    tone !== 'ink' ? styles[tone] : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapperClasses} {...rest}>
      <div className={styles.kpiLabel}>{label}</div>
      <div className={valueClasses}>{value}</div>
      {sub != null && <div className={styles.kpiSub}>{sub}</div>}
    </div>
  );
};

export default KPI;
export { KPI };
