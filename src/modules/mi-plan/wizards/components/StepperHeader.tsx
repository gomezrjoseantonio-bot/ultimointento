import React from 'react';
import { Icons } from '../../../../design-system/v5';
import type { StepKey } from '../types';

// T27.3 · parametrizado para reuso entre wizard objetivo y wizard fondo.
// El consumer pasa su CSS module y la lista de steps.
//
// `styles` debe exponer · head · titleWrap · titleIcon · title · sub · steps
// stepInd · active · done · stepNum · stepSep · close

export interface StepDef {
  key: StepKey;
  label: string;
}

type StylesShape = Readonly<Record<string, string>>;

interface Props {
  current: StepKey;
  /** Step máximo que el usuario ha podido completar (para permitir saltar atrás). */
  maxReached: StepKey;
  steps: StepDef[];
  title: string;
  sub: string;
  /** Componente del icono Lucide (ej · Icons.Objetivos · Icons.Fondos). */
  Icon: React.ComponentType<{ size?: number | string; strokeWidth?: number | string }>;
  styles: StylesShape;
  onGoTo: (step: StepKey) => void;
  onClose: () => void;
}

const StepperHeader: React.FC<Props> = ({
  current,
  maxReached,
  steps,
  title,
  sub,
  Icon,
  styles,
  onGoTo,
  onClose,
}) => {
  return (
    <div className={styles.head}>
      <div className={styles.titleWrap}>
        <div className={styles.titleIcon}>
          <Icon size={16} strokeWidth={2} />
        </div>
        <div>
          <div className={styles.title}>{title}</div>
          <div className={styles.sub}>{sub}</div>
        </div>
      </div>

      <div className={styles.steps} role="navigation" aria-label="Pasos del wizard">
        {steps.map((s, idx) => {
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
              {idx < steps.length - 1 && <div className={styles.stepSep} aria-hidden />}
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
