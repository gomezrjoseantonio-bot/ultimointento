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
  /** Aria-label del grupo · default "Sub-módulos". */
  ariaLabel?: string;
  className?: string;
}

/**
 * Tabs underline · §5 guía v5.
 *
 * Implementación · grupo de botones con `aria-pressed` · NO usa el patrón
 * ARIA `role="tablist"`/`role="tab"` porque no implementa los requisitos
 * completos del patrón (roving tabindex · navegación por flechas · Home/End ·
 * `aria-controls` a un panel). En la app las pestañas son sub-rutas URL-driven
 * sin un `tabpanel` real · el patrón "toggle button group" es semánticamente
 * más honesto.
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
    <div className={classes} role="group" aria-label={ariaLabel}>
      {items.map((item) => {
        const isActive = item.key === active;
        const tabClasses = [styles.tab, isActive ? styles.active : '']
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={isActive}
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
