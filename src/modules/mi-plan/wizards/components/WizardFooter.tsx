import React from 'react';
import { Icons } from '../../../../design-system/v5';
import type { StepKey } from '../types';

// T27.3 · parametrizado · `styles` prop expone · footer · footMeta · footActions
// btn · btnGhost · btnPrimary · btnPos. Texto del CTA final también prop.

type StylesShape = Readonly<Record<string, string>>;

interface Props {
  current: StepKey;
  totalSteps: number;
  canAdvance: boolean;
  isSubmitting: boolean;
  /** Texto del botón en el último paso · ej · "Crear objetivo" / "Crear fondo". */
  submitLabel: string;
  /** Texto mientras submitting · ej · "Creando…". */
  submitLoadingLabel?: string;
  styles: StylesShape;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
}

const WizardFooter: React.FC<Props> = ({
  current,
  totalSteps,
  canAdvance,
  isSubmitting,
  submitLabel,
  submitLoadingLabel = 'Creando…',
  styles,
  onPrev,
  onNext,
  onSubmit,
}) => {
  const isLast = current === totalSteps;

  return (
    <div className={styles.footer}>
      <div className={styles.footMeta}>
        Paso {current} de {totalSteps} · <strong>borrador autoguardado</strong>
      </div>
      <div className={styles.footActions}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnGhost}`}
          onClick={onPrev}
          disabled={current === 1 || isSubmitting}
        >
          <Icons.ChevronLeft size={13} strokeWidth={2} />
          Atrás
        </button>
        {isLast ? (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPos}`}
            onClick={onSubmit}
            disabled={!canAdvance || isSubmitting}
          >
            <Icons.Check size={13} strokeWidth={2} />
            {isSubmitting ? submitLoadingLabel : submitLabel}
          </button>
        ) : (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={onNext}
            disabled={!canAdvance || isSubmitting}
          >
            Continuar
            <Icons.ChevronRight size={13} strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  );
};

export default WizardFooter;
