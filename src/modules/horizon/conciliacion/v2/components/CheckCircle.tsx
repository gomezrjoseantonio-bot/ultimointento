import React from 'react';
import { Check } from 'lucide-react';

export type CheckState = 'empty' | 'checked' | 'indeterminate';

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
  const classes = ['cv2-check'];
  if (state === 'checked') classes.push('cv2-check--checked');
  if (state === 'indeterminate') classes.push('cv2-check--indeterminate');

  return (
    <button
      type="button"
      className={classes.join(' ')}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel ?? (state === 'checked' ? 'Desconciliar' : 'Puntear')}
    >
      {state === 'checked' && <Check strokeWidth={3} />}
    </button>
  );
};

export default CheckCircle;
