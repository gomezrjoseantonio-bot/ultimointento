import React from 'react';
import styles from './BarraFiltros.module.css';

export type ChipCountTone = 'plain' | 'ok' | 'warn' | 'neg' | 'brand';

export interface ChipBtnProps {
  active: boolean;
  count?: number;
  countTone?: ChipCountTone;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

const ChipBtn: React.FC<ChipBtnProps> = ({
  active,
  count,
  countTone = 'plain',
  onClick,
  disabled,
  children,
}) => {
  const classes = [
    styles.chip,
    active ? styles.chipActive : '',
    disabled ? styles.chipDisabled : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classes}
      onClick={!disabled ? onClick : undefined}
      disabled={disabled}
      role="radio"
      aria-checked={active}
    >
      {children}
      {count !== undefined && (
        <span
          className={[styles.chipCount, styles[`chipCount-${countTone}`]]
            .filter(Boolean)
            .join(' ')}
        >
          {count}
        </span>
      )}
    </button>
  );
};

export default ChipBtn;
export { ChipBtn };
