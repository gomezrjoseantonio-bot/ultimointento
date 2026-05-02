import React from 'react';
import { Icons } from '../../../../design-system/v5';
import styles from '../WizardNuevoObjetivo.module.css';
import type { StepKey } from '../types';

interface StepDef {
  key: StepKey;
  label: string;
}

const STEPS: StepDef[] = [
  { key: 1, label: 'Tipo' },
  { key: 2, label: 'Meta' },
  { key: 3, label: 'Plazo' },
  { key: 4, label: 'Vínculos' },
  { key: 5, label: 'Resumen' },
];

interface Props {
  current: StepKey;
  /** Step máximo que el usuario ha podido completar (para permitir saltar atrás). */
  maxReached: StepKey;
  onGoTo: (step: StepKey) => void;
  onClose: () => void;
}

const StepperHeader: React.FC<Props> = ({ current, maxReached, onGoTo, onClose }) => {
  return (
    <div className={styles.head}>
      <div className={styles.titleWrap}>
        <div className={styles.titleIcon}>
          <Icons.Objetivos size={16} strokeWidth={2} />
        </div>
        <div>
          <div className={styles.title}>Nuevo objetivo</div>
          <div className={styles.sub}>5 pasos · ~2 min</div>
        </div>
      </div>

      <div className={styles.steps} role="navigation" aria-label="Pasos del wizard">
        {STEPS.map((s, idx) => {
          const isActive = s.key === current;
          const isDone = s.key < current;
          const isReachable = s.key <= maxReached;
          const cls = [
            styles.stepInd,
            isActive ? styles.active : '',
            isDone ? styles.done : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <React.Fragment key={s.key}>
              <button
                type="button"
                className={cls}
                onClick={() => isReachable && onGoTo(s.key)}
                disabled={!isReachable}
                aria-current={isActive ? 'step' : undefined}
              >
                <span className={styles.stepNum}>{s.key}</span>
                <span>{s.label}</span>
              </button>
              {idx < STEPS.length - 1 && <div className={styles.stepSep} aria-hidden />}
            </React.Fragment>
          );
        })}
      </div>

      <button
        type="button"
        className={styles.close}
        onClick={onClose}
        aria-label="Cerrar wizard"
      >
        <Icons.Close size={16} strokeWidth={2} />
      </button>
    </div>
  );
};

export default StepperHeader;
