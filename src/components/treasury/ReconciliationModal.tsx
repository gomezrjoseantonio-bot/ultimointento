import React from 'react';
import { X, Check } from 'lucide-react';
import { formatEuro, formatDate } from '../../utils/formatUtils';
import './treasury-reconciliation.css';

interface Movement {
  id: string;
  concept: string;
  amount: number;
  date: string;
  type: 'income' | 'expense' | 'financing';
  status: 'previsto' | 'confirmado' | 'vencido';
  category?: string;
}

interface ReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  accountName: string;
  month: string; // 'YYYY-MM'
  movements: Movement[];
  onConfirm: (movementId: string, realAmount?: number) => void;
  onCancel: (movementId: string) => void;
  onConfirmAll: () => void;
}

/**
 * ATLAS HORIZON - Reconciliation Modal
 * 
 * Modal que se abre al hacer click en una AccountCard.
 * Permite conciliar movimientos previstos vs reales.
 */
const ReconciliationModal: React.FC<ReconciliationModalProps> = ({
  isOpen,
  onClose,
  accountId,
  accountName,
  month,
  movements,
  onConfirm,
  onCancel,
  onConfirmAll
}) => {
  if (!isOpen) return null;

  const formatMonthYear = (monthStr: string): string => {
    const [year, month] = monthStr.split('-');
    const monthNames = [
      'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
      'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
    ];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const pendingMovements = movements.filter(m => m.status === 'previsto');

  return (
    <div className="reconciliation-modal-overlay" onClick={handleOverlayClick}>
      <div className="reconciliation-modal">
        {/* Header */}
        <div className="reconciliation-modal__header">
          <div>
            <h2 className="reconciliation-modal__title">
              Conciliación - {accountName}
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-gray)', marginTop: '4px' }}>
              {formatMonthYear(month)}
            </p>
          </div>
          <button 
            className="reconciliation-modal__close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="reconciliation-modal__content">
          {movements.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-gray)' }}>
              No hay movimientos para conciliar
            </div>
          ) : (
            <div className="movement-list">
              {movements.map((movement) => (
                <div key={movement.id} className="movement-item">
                  <div className="movement-item__header">
                    <span className="movement-item__concept">{movement.concept}</span>
                    <span className="movement-item__amount">
                      {formatEuro(movement.amount)}
                    </span>
                  </div>
                  <div className="movement-item__details">
                    <span>Fecha: {formatDate(movement.date)}</span>
                    {movement.category && <span>Categoría: {movement.category}</span>}
                    <span>
                      Estado: {
                        movement.status === 'previsto' ? 'Previsto' :
                        movement.status === 'confirmado' ? 'Confirmado' :
                        'Vencido'
                      }
                    </span>
                  </div>
                  {movement.status === 'previsto' && (
                    <div className="movement-item__actions">
                      <button
                        className="movement-item__action-button movement-item__action-button--confirm"
                        onClick={() => onConfirm(movement.id)}
                      >
                        <Check size={14} />
                        Confirmar
                      </button>
                      <button
                        className="movement-item__action-button movement-item__action-button--cancel"
                        onClick={() => onCancel(movement.id)}
                      >
                        <X size={14} />
                        Anular
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {pendingMovements.length > 0 && (
          <div className="reconciliation-modal__footer">
            <button 
              className="reconciliation-modal__button reconciliation-modal__button--secondary"
              onClick={onClose}
            >
              Cerrar
            </button>
            <button 
              className="reconciliation-modal__button reconciliation-modal__button--primary"
              onClick={onConfirmAll}
            >
              <Check size={16} />
              Confirmar Todos
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReconciliationModal;
