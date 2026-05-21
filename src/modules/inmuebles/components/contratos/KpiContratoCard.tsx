import React from 'react';
import styles from './KpiContratoCard.module.css';

export type KpiAccent = 'neg' | 'warn' | 'muted' | 'plain';

export interface KpiContratoCardProps {
  label: string;
  value: React.ReactNode | null;
  hint?: React.ReactNode;
  accent: KpiAccent;
  onClick?: () => void;
  valueTone?: 'ink' | 'neg';
}

const KpiContratoCard: React.FC<KpiContratoCardProps> = ({
  label,
  value,
  hint,
  accent,
  onClick,
  valueTone = 'ink',
}) => {
  const isClickable = typeof onClick === 'function';
  const isPlaceholder = value === null || value === undefined;

  const classes = [
    styles.card,
    styles[`accent-${accent}`],
    isClickable ? styles.clickable : '',
  ]
    .filter(Boolean)
    .join(' ');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (!isClickable) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick!();
    }
  };

  return (
    <div
      className={classes}
      onClick={isClickable ? onClick : undefined}
      onKeyDown={isClickable ? handleKeyDown : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={isClickable ? `${label} · ver detalle` : undefined}
    >
      <div className={styles.label}>{label}</div>
      <div className={[styles.value, valueTone === 'neg' ? styles.valueNeg : ''].filter(Boolean).join(' ')}>
        {isPlaceholder ? '—' : value}
      </div>
      {hint != null && <div className={styles.hint}>{hint}</div>}
      {isClickable && (
        <div className={styles.cta}>Ver detalle →</div>
      )}
    </div>
  );
};

export default KpiContratoCard;
export { KpiContratoCard };
