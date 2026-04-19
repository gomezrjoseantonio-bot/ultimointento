import React from 'react';
import { FileText, Landmark } from 'lucide-react';

export type DocIconState = 'attached' | 'missing' | 'not_applicable';
export type DocIconType = 'factura' | 'justificante';

interface DocIconProps {
  type: DocIconType;
  state: DocIconState;
  docName?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

const DocIcon: React.FC<DocIconProps> = ({ type, state, docName, onClick }) => {
  const Icon = type === 'factura' ? FileText : Landmark;
  const label = type === 'factura' ? 'Factura' : 'Justificante';

  const title = (() => {
    if (state === 'attached') return `${label}${docName ? ' · ' + docName : ''}`;
    if (state === 'missing') return `Click para asociar ${label.toLowerCase()}`;
    return `${label} no aplica`;
  })();

  const stateClass =
    state === 'attached'
      ? 'cv2-doc-icon--attached'
      : state === 'missing'
      ? 'cv2-doc-icon--missing'
      : 'cv2-doc-icon--not-applicable';

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (state === 'not_applicable') return;
    onClick?.(e);
  };

  return (
    <button
      type="button"
      className={`cv2-doc-icon ${stateClass}`}
      title={title}
      aria-label={title}
      onClick={handleClick}
      disabled={state === 'not_applicable'}
    >
      <Icon />
    </button>
  );
};

export default DocIcon;
