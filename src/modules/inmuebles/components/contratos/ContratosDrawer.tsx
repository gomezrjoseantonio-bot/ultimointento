import React, { useEffect } from 'react';
import { Icons } from '../../../../design-system/v5';
import styles from './ContratosDrawer.module.css';

export type DrawerTone = 'neg' | 'warn' | 'muted';

export interface ContratosDrawerProps {
  open: boolean;
  onClose: () => void;
  tone: DrawerTone;
  label: string;
  title: string;
  sub?: string;
  stats?: Array<{ label: string; value: React.ReactNode }>;
  footer?: React.ReactNode;
  /** Drawer más ancho (~780px) · usado por el análisis anual (T7). */
  wide?: boolean;
  children: React.ReactNode;
}

const TONE_CLASS: Record<DrawerTone, string> = {
  neg: styles.heroNeg,
  warn: styles.heroWarn,
  muted: styles.heroMuted,
};

const ContratosDrawer: React.FC<ContratosDrawerProps> = ({
  open,
  onClose,
  tone,
  label,
  title,
  sub,
  stats,
  footer,
  wide,
  children,
}) => {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className={styles.backdrop}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`${styles.drawer} ${wide ? styles.drawerWide : ''}`}
      >
        <div className={`${styles.hero} ${TONE_CLASS[tone]}`}>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Cerrar"
          >
            <Icons.Close size={16} strokeWidth={1.8} />
          </button>
          <div className={styles.heroLabel}>{label}</div>
          <h2 className={styles.heroTitle}>{title}</h2>
          {sub && <p className={styles.heroSub}>{sub}</p>}
          {stats && stats.length > 0 && (
            <div className={styles.heroStats}>
              {stats.map((s) => (
                <div className={styles.heroStat} key={s.label}>
                  <div className={styles.heroStatLabel}>{s.label}</div>
                  <div className={styles.heroStatValue}>{s.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </aside>
    </>
  );
};

export default ContratosDrawer;
export { ContratosDrawer };
