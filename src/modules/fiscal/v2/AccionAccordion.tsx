/**
 * AccionAccordion · acordeón genérico para F6 Acciones fiscales.
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 6 §8.2.
 */

import React, { useState } from 'react';
import styles from './FiscalAccionesPage.module.css';

export interface AccionAccordionProps {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const AccionAccordion: React.FC<AccionAccordionProps> = ({
  title,
  subtitle,
  defaultOpen = false,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = React.useId();

  return (
    <section className={styles.accItem} aria-labelledby={`${bodyId}-title`}>
      <button
        type="button"
        className={styles.accHd}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={bodyId}
      >
        <div>
          <div className={styles.accTitle} id={`${bodyId}-title`}>{title}</div>
          {subtitle && <div className={styles.accSub}>{subtitle}</div>}
        </div>
        <span className={`${styles.accChevron} ${open ? styles.accChevronOpen : ''}`}>›</span>
      </button>
      {open && (
        <div className={styles.accBd} id={bodyId}>
          <div className={styles.accBdContent}>{children}</div>
        </div>
      )}
    </section>
  );
};

export default AccionAccordion;
