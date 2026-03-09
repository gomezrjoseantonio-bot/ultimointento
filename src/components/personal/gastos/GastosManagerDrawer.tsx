import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { PersonalExpense } from '../../../types/personal';
import PersonalExpenseForm from './PersonalExpenseForm';

export interface GastosManagerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Si se pasa, el drawer abre en modo edición */
  gasto?: PersonalExpense;
  onSuccess: () => void;
}

const DRAWER_WIDTH = 400;

const GastosManagerDrawer: React.FC<GastosManagerDrawerProps> = ({
  isOpen,
  onClose,
  gasto,
  onSuccess,
}) => {
  // Bloquea scroll del body mientras el drawer está abierto
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleSuccess = () => {
    onSuccess();
    onClose();
  };

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 40,
          backgroundColor: 'rgba(3, 20, 43, 0.45)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 300ms ease',
        }}
      />

      {/* ── Panel ── */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={gasto ? 'Editar gasto' : 'Nuevo gasto'}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 50,
          width: DRAWER_WIDTH,
          backgroundColor: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-4px 0 24px rgba(4, 44, 94, 0.12)',
          transform: isOpen ? 'translateX(0)' : `translateX(${DRAWER_WIDTH}px)`,
          transition: 'transform 400ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderBottom: '1px solid #C8D0DC',
            flexShrink: 0,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 600,
              color: '#042C5E',
              fontFamily: 'IBM Plex Sans, Inter, sans-serif',
            }}
          >
            {gasto ? 'Editar gasto' : 'Nuevo gasto'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Cerrar panel"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 6,
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#303A4C',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
          }}
        >
          {/*
           * Reutiliza PersonalExpenseForm sin reimplementar el formulario.
           * onCancel cierra el drawer; onSuccess recarga la lista y lo cierra.
           */}
          <PersonalExpenseForm
            gasto={gasto}
            onSuccess={handleSuccess}
            onCancel={onClose}
          />
        </div>
      </aside>
    </>
  );
};

export default GastosManagerDrawer;
