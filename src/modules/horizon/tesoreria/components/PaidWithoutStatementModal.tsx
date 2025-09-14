import React, { useState } from 'react';
import { X, CreditCard, Banknote, HelpCircle } from 'lucide-react';
import { markAsPaidWithoutStatement } from '../../../../services/treasuryCreationService';
import toast from 'react-hot-toast';

interface PaidWithoutStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  recordType: 'ingreso' | 'gasto' | 'capex';
  recordId: number;
  recordDescription: string;
  recordAmount: number;
  onSuccess: () => void;
}

const PaidWithoutStatementModal: React.FC<PaidWithoutStatementModalProps> = ({
  isOpen,
  onClose,
  recordType,
  recordId,
  recordDescription,
  recordAmount,
  onSuccess
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'Efectivo' | 'Tarjeta' | 'Otros'>('Efectivo');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!paymentDate) {
      toast.error('La fecha de pago es obligatoria');
      return;
    }

    setIsSubmitting(true);
    try {
      await markAsPaidWithoutStatement(
        recordType,
        recordId,
        paymentMethod,
        paymentDate,
        notes
      );
      onSuccess();
      onClose();
      
      // Reset form
      setPaymentMethod('Efectivo');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setNotes('');
    } catch (error) {
      console.error('Error marking as paid without statement:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRecordTypeLabel = () => {
    switch (recordType) {
      case 'ingreso': return 'Ingreso';
      case 'gasto': return 'Gasto';
      case 'capex': return 'CAPEX';
      default: return 'Registro';
    }
  };

  const getActionLabel = () => {
    switch (recordType) {
      case 'ingreso': return 'Marcar como cobrado';
      case 'gasto': return 'Marcar como pagado';
      case 'capex': return 'Marcar como pagado';
      default: return 'Marcar como procesado';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-200 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {getActionLabel()} sin extracto
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Record Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">{getRecordTypeLabel()}</div>
            <div className="font-medium text-gray-900">{recordDescription}</div>
            <div className="text-lg font-bold text-primary-600">
              {recordAmount.toLocaleString('es-ES', { 
                style: 'currency', 
                currency: 'EUR' 
              })}
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Método de pago *
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('Efectivo')}
                className={`flex items-center justify-center p-3 rounded-lg border-2 transition-colors ${
                  paymentMethod === 'Efectivo'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                <Banknote className="w-5 h-5 mr-2" />
                <span className="text-sm font-medium">Efectivo</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('Tarjeta')}
                className={`flex items-center justify-center p-3 rounded-lg border-2 transition-colors ${
                  paymentMethod === 'Tarjeta'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                <CreditCard className="w-5 h-5 mr-2" />
                <span className="text-sm font-medium">Tarjeta</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('Otros')}
                className={`flex items-center justify-center p-3 rounded-lg border-2 transition-colors ${
                  paymentMethod === 'Otros'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                <HelpCircle className="w-5 h-5 mr-2" />
                <span className="text-sm font-medium">Otros</span>
              </button>
            </div>
          </div>

          {/* Payment Date */}
          <div>
            <label htmlFor="paymentDate" className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de pago *
            </label>
            <input
              type="date"
              id="paymentDate"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notas adicionales
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Detalles del pago, lugar, etc. (opcional)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Info Note */}
          <div className="bg-warning-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-start">
              <HelpCircle className="w-5 h-5 text-warning-600 mt-0.5 mr-2 flex-shrink-0" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">¿Cuándo usar esta opción?</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Pagos en efectivo</li>
                  <li>Pagos con tarjeta personal</li>
                  <li>Transferencias sin aparecer en el extracto</li>
                  <li>Otros métodos sin movimiento bancario</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Procesando...' : getActionLabel()}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaidWithoutStatementModal;