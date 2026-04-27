import React from 'react';
import styles from './Toggle.module.css';

export interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
  disabled?: boolean;
}

/**
 * Toggle on/off del mockup Ajustes v2 · 40x22 · pin oro cuando on.
 */
const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  ariaLabel,
  disabled = false,
}) => {
  const cls = [styles.toggle, checked ? styles.on : '']
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cls}
    />
  );
};

export default Toggle;
export { Toggle };
