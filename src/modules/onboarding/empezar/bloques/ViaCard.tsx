/**
 * Tarjeta de "vía" (mockup · doble vía). Recomendada (oro) o manual (navy).
 */
import React from 'react';
import { Icons } from '../../../../design-system/v5';
import type { IconComponent } from '../../../../design-system/v5';
import styles from '../empezar.module.css';

interface Props {
  variant: 'recommended' | 'manual';
  badge?: string;
  Icon: IconComponent;
  title: string;
  desc: React.ReactNode;
  items: string[];
  time: string;
  onClick: () => void;
}

const ViaCard: React.FC<Props> = ({ variant, badge, Icon, title, desc, items, time, onClick }) => (
  <button
    type="button"
    className={`${styles.via} ${variant === 'recommended' ? styles.recommended : styles.manual}`}
    onClick={onClick}
  >
    {variant === 'recommended' && badge && <span className={styles.viaBadge}>{badge}</span>}
    <div className={styles.viaIcon}>
      <Icon size={19} strokeWidth={1.8} />
    </div>
    <div className={styles.viaTitle}>{title}</div>
    <div className={styles.viaDesc}>{desc}</div>
    <ul className={styles.viaList}>
      {items.map((it, i) => (
        <li key={i}>
          <Icons.Check size={12} strokeWidth={3} />
          {it}
        </li>
      ))}
    </ul>
    <div className={styles.viaTime}>
      <Icons.Clock size={12} strokeWidth={2} />
      {time}
    </div>
  </button>
);

export default ViaCard;
