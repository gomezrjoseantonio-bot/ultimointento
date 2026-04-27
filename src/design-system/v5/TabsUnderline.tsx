import React from 'react';
import styles from './TabsUnderline.module.css';

export interface TabItem<TKey extends string = string> {
  key: TKey;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsUnderlineProps<TKey extends string = string> {
  items: TabItem<TKey>[];
  active: TKey;
  onChange: (key: TKey) => void;
  /** Aria-label del tablist · default "Sub-módulos". */
  ariaLabel?: string;
  className?: string;
}

/**
 * Tabs underline · §5 guía v5.
 * Solo UNA tab activa · border-bottom oro · iconos pequeños 14px junto al label.
 */
function TabsUnderline<TKey extends string = string>({
  items,
  active,
  onChange,
  ariaLabel = 'Sub-módulos',
  className,
}: TabsUnderlineProps<TKey>): React.ReactElement {
  const classes = [styles.tabs, className ?? ''].filter(Boolean).join(' ');

  return (
    <div className={classes} role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const isActive = item.key === active;
        const tabClasses = [styles.tab, isActive ? styles.active : '']
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={item.disabled}
            onClick={() => onChange(item.key)}
            className={tabClasses}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export default TabsUnderline;
export { TabsUnderline };
