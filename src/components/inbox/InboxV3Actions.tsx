import React, { useState } from 'react';
import { MoreVertical, Trash2 } from 'lucide-react';

interface InboxV3ActionsProps {
  onProcessOCR: () => void;
  onAssign: () => void;
  onDelete: () => void;
  disableActions?: boolean;
}

const InboxV3Actions: React.FC<InboxV3ActionsProps> = ({ onProcessOCR, onAssign, onDelete, disableActions }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex items-center gap-2 relative">
      <button type="button" className="atlas-btn-primary atlas-btn-sm" onClick={onProcessOCR} disabled={disableActions}>
        Procesar con OCR
      </button>
      <button type="button" className="atlas-btn-secondary atlas-btn-sm" onClick={onAssign} disabled={disableActions}>
        Asignar
      </button>
      <button
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
        disabled={disableActions}
        className="atlas-btn-ghost atlas-btn-sm"
        aria-label="Abrir menú de acciones"
      >
        <MoreVertical size={16} />
      </button>

      {menuOpen && (
        <div
          className="absolute right-0 top-10 p-1 border"
          style={{
            background: 'var(--surface-card)',
            borderColor: 'var(--n-200)',
            borderRadius: 'var(--r-md)',
            boxShadow: 'var(--shadow-1)'
          }}
        >
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-2 text-sm"
            style={{ color: 'var(--s-negative)', fontFamily: 'var(--font-base)' }}
            onClick={() => {
              setMenuOpen(false);
              onDelete();
            }}
          >
            <Trash2 size={14} />
            Eliminar
          </button>
        </div>
      )}
    </div>
  );
};

export default InboxV3Actions;
