import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { PersonalExpense } from '../../../types/personal';
import { patronGastosPersonalesService } from '../../../services/patronGastosPersonalesService';
import PersonalExpenseForm from './PersonalExpenseForm';

export interface GastosManagerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  personalDataId: number;
  gasto?: PersonalExpense;
  onSuccess: () => void;
}

const DRAWER_WIDTH = 620;

const GastosManagerDrawer: React.FC<GastosManagerDrawerProps> = ({
  isOpen,
  onClose,
  personalDataId,
  gasto,
  onSuccess,
}) => {
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleSave = async (
    formData: Omit<PersonalExpense, 'id' | 'createdAt' | 'updatedAt'> & { id?: number },
  ) => {
    if (formData.id != null) {
      await patronGastosPersonalesService.updatePatron(formData.id, formData);
    } else {
      await patronGastosPersonalesService.savePatron(formData);
    }
    onSuccess();
    onClose();
  };

  return (
    <>
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
          transition: 'opacity 280ms ease',
        }}
      />

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
          maxWidth: '92vw',
          backgroundColor: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-10px 0 24px rgba(4, 44, 94, 0.12)',
          transform: isOpen ? 'translateX(0)' : `translateX(${DRAWER_WIDTH}px)`,
          transition: 'transform 360ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Cerrar panel"
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            zIndex: 3,
            display: 'grid',
            placeItems: 'center',
            height: 42,
            width: 42,
            borderRadius: 12,
            border: '1px solid #C8D0DC',
            background: '#fff',
            cursor: 'pointer',
            color: '#6B7483',
          }}
        >
          <X size={22} />
        </button>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <PersonalExpenseForm
            personalDataId={personalDataId}
            expense={gasto}
            onSave={handleSave}
            onCancel={onClose}
          />
        </div>
      </aside>
    </>
  );
};

export default GastosManagerDrawer;
