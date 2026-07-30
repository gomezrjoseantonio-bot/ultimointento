import React from 'react';
import { Check } from 'lucide-react';
// P5 punteo · un solo estilo de check para toda la app: las clases canónicas
// del Punteo (Registro v2). Se retira el cv2-check duplicado.
import punteo from '../../../../shared/components/Punteo/Punteo.module.css';

export type CheckState = 'empty' | 'checked' | 'conciliado' | 'indeterminate';

interface CheckCircleProps {
  state: CheckState;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

const CheckCircle: React.FC<CheckCircleProps> = ({
  state,
  onClick,
  disabled,
  ariaLabel,
}) => {
  const classes = [punteo.tick];
  if (state === 'empty') classes.push(punteo.tickPrevisto);
  if (state === 'checked' || state === 'indeterminate') classes.push(punteo.tickConfirmado);
  if (state === 'conciliado') classes.push(punteo.tickConciliado);
  if (state === 'indeterminate') classes.push('cv2-check--indeterminate');

  return (
    <button
      type="button"
      className={classes.join(' ')}
      onClick={onClick}
      // Conciliado = la palabra del banco · se deshace desde el movimiento.
      disabled={disabled || state === 'conciliado'}
      aria-label={
        ariaLabel ??
        (state === 'conciliado'
          ? 'Conciliado con el banco'
          : state === 'checked'
            ? 'Desconciliar'
            : 'Puntear')
      }
    >
      {(state === 'checked' || state === 'conciliado') && <Check size={11} strokeWidth={3} />}
    </button>
  );
};

export default CheckCircle;
