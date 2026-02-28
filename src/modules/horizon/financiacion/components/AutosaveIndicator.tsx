import React from 'react';
import { Clock, Trash2 } from 'lucide-react';

interface AutosaveIndicatorProps {
  lastSaved: Date | null;
  onDiscard: () => void;
}

const AutosaveIndicator: React.FC<AutosaveIndicatorProps> = ({ lastSaved, onDiscard }) => {
  if (!lastSaved) return null;

  const hh = lastSaved.getHours().toString().padStart(2, '0');
  const mm = lastSaved.getMinutes().toString().padStart(2, '0');

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-gray)' }}>
        <Clock size={14} strokeWidth={1.5} />
        Guardado {hh}:{mm}
      </span>
      <button
        onClick={onDiscard}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--error)',
          fontSize: 13,
          padding: '2px 6px',
          borderRadius: 4,
        }}
      >
        <Trash2 size={13} strokeWidth={1.5} />
        Descartar borrador
      </button>
    </div>
  );
};

export default AutosaveIndicator;
