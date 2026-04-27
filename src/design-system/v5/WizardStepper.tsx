import React from 'react';
import { Icons } from './icons';
import styles from './WizardStepper.module.css';

export interface WizardStep<TKey extends string = string> {
  key: TKey;
  title: React.ReactNode;
  /** Subtítulo opcional · "Paso 2" · "obligatorio" · etc. */
  sub?: React.ReactNode;
  /** Si true · marca paso como inválido (icono X). */
  error?: boolean;
}

export interface WizardStepperProps<TKey extends string = string> {
  steps: WizardStep<TKey>[];
  active: TKey;
  /** Si se omite · clic en steps deshabilitado. */
  onChange?: (key: TKey) => void;
  className?: string;
}

/**
 * Wizard stepper · §4.4 spec añadido en T20 Fase 3a.
 *
 * Pasos numerados con dots conectados. Estados ·
 *  - completed · pasos por delante del activo · dot pos · check
 *  - active · paso actual · dot oro · número
 *  - pending · pasos por venir · dot gris · número
 *  - error · invalido · dot neg · X
 *
 * Si se pasa `onChange` los steps son clickables (típicamente sólo permite
 * volver atrás · controlarlo desde el padre).
 */
function WizardStepper<TKey extends string = string>({
  steps,
  active,
  onChange,
  className,
}: WizardStepperProps<TKey>): React.ReactElement {
  const activeIndex = steps.findIndex((s) => s.key === active);

  const wrapClasses = [styles.wrap, className ?? ''].filter(Boolean).join(' ');

  return (
    <div className={wrapClasses} role="navigation" aria-label="Pasos del wizard">
      <div className={styles.steps}>
        {steps.map((step, idx) => {
          const isActive = idx === activeIndex;
          const isCompleted = idx < activeIndex;
          const isError = step.error === true;
          const status = isError
            ? 'error'
            : isActive
              ? 'active'
              : isCompleted
                ? 'completed'
                : 'pending';
          const stepCls = [
            styles.step,
            styles[status],
            onChange ? styles.clickable : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div
              key={step.key}
              className={stepCls}
              aria-current={isActive ? 'step' : undefined}
              onClick={onChange ? () => onChange(step.key) : undefined}
            >
              <span className={styles.dot} aria-hidden>
                {isError ? (
                  <Icons.Close size={14} strokeWidth={2.5} />
                ) : isCompleted ? (
                  <Icons.Check size={14} strokeWidth={2.5} />
                ) : (
                  idx + 1
                )}
              </span>
              <span className={styles.label}>
                <span className={styles.title}>{step.title}</span>
                {step.sub != null && <span className={styles.sub}>{step.sub}</span>}
              </span>
              <span className={styles.connector} aria-hidden />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default WizardStepper;
export { WizardStepper };
