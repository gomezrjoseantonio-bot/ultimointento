import React, { useState } from 'react';
import { X, ArrowRightLeft, Calendar } from 'lucide-react';
import { Transfer } from '../../../../types/unifiedTreasury';
import { formatEuro } from '../../../../services/aeatClassificationService';

interface NewTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransferCreated: (transfer: Transfer) => void;
  preselectedFromAccount?: number;
}

const NewTransferModal: React.FC<NewTransferModalProps> = ({
  isOpen,
  onClose,
  onTransferCreated,
  preselectedFromAccount
}) => {
  const [formData, setFormData] = useState({
    fromAccountId: preselectedFromAccount || '',
    toAccountId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    note: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  // Mock accounts for selection
  const accounts = [
    { id: 1, name: 'Cuenta Principal', bank: 'BBVA', iban: '***7891', balance: 15420.50 },
    { id: 2, name: 'Gastos Inmuebles', bank: 'Santander', iban: '***7892', balance: -420.30 },
    { id: 3, name: 'Cuenta Personal', bank: 'ING', iban: '***7893', balance: 5200.00 }
  ];

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.fromAccountId) {
      newErrors.fromAccountId = 'Selecciona la cuenta de origen';
    }
    
    if (!formData.toAccountId) {
      newErrors.toAccountId = 'Selecciona la cuenta de destino';
    }
    
    if (formData.fromAccountId === formData.toAccountId) {
      newErrors.toAccountId = 'La cuenta de destino debe ser diferente a la de origen';
    }
    
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Introduce un importe válido';
    }
    
    if (!formData.date) {
      newErrors.date = 'Selecciona una fecha';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setCreating(true);
    
    try {
      // Mock transfer creation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const transfer: Transfer = {
        id: Math.random().toString(36).substr(2, 9),
        fromAccountId: parseInt(formData.fromAccountId as string),
        toAccountId: parseInt(formData.toAccountId as string),
        amount: parseFloat(formData.amount),
        date: formData.date,
        note: formData.note,
        status: 'previsto',
        movements: [] as any // Will be populated by the service
      };
      
      onTransferCreated(transfer);
      onClose();
      resetForm();
    } catch (error) {
      console.error('Transfer creation failed:', error);
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setFormData({
      fromAccountId: preselectedFromAccount || '',
      toAccountId: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      note: ''
    });
    setErrors({});
    setCreating(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const getAccountBalance = (accountId: string | number) => {
    const account = accounts.find(a => a.id.toString() === accountId.toString());
    return account?.balance || 0;
  };

  const getAvailableToAccounts = () => {
    return accounts.filter(account => 
      account.id.toString() !== formData.fromAccountId
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-200 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-hz-primary" />
            <h3 className="text-lg font-semibold text-gray-900">Nueva transferencia</h3>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* From Account */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Cuenta de origen
            </label>
            <select
              value={formData.fromAccountId}
              onChange={(e) => setFormData(prev => ({ ...prev, fromAccountId: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-hz-primary focus:border-transparent ${
                errors.fromAccountId ? 'border-error-500' : 'border-gray-300'
              }`}
            >
              <option value="">Seleccionar cuenta de origen...</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} - {account.bank} {account.iban} ({formatEuro(account.balance)})
                </option>
              ))}
            </select>
            {errors.fromAccountId && (
              <p className="text-sm text-error-600">{errors.fromAccountId}</p>
            )}
          </div>

          {/* Transfer Arrow */}
          <div className="flex justify-center">
            <div className="p-2 bg-gray-100 rounded-full">
              <ArrowRightLeft className="h-4 w-4 text-gray-600" />
            </div>
          </div>

          {/* To Account */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Cuenta de destino
            </label>
            <select
              value={formData.toAccountId}
              onChange={(e) => setFormData(prev => ({ ...prev, toAccountId: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-hz-primary focus:border-transparent ${
                errors.toAccountId ? 'border-error-500' : 'border-gray-300'
              }`}
              disabled={!formData.fromAccountId}
            >
              <option value="">Seleccionar cuenta de destino...</option>
              {getAvailableToAccounts().map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} - {account.bank} {account.iban} ({formatEuro(account.balance)})
                </option>
              ))}
            </select>
            {errors.toAccountId && (
              <p className="text-sm text-error-600">{errors.toAccountId}</p>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Importe
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                className={`w-full px-3 py-2 pr-8 border rounded-lg focus:ring-2 focus:ring-hz-primary focus:border-transparent ${
                  errors.amount ? 'border-error-500' : 'border-gray-300'
                }`}
                placeholder="0.00"
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                €
              </span>
            </div>
            {errors.amount && (
              <p className="text-sm text-error-600">{errors.amount}</p>
            )}
            
            {/* Balance warning */}
            {formData.fromAccountId && formData.amount && (
              <div className="text-sm">
                {parseFloat(formData.amount) > getAccountBalance(formData.fromAccountId) ? (
                  <p className="text-error-600 flex items-center gap-1">
                    <ArrowRightLeft className="h-3 w-3" />
                    Importe superior al saldo disponible
                  </p>
                ) : (
                  <p className="text-gray-600">
                    Saldo tras transferencia: {formatEuro(getAccountBalance(formData.fromAccountId) - parseFloat(formData.amount))}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Date */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Fecha
            </label>
            <div className="relative">
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className={`w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-hz-primary focus:border-transparent ${
                  errors.date ? 'border-error-500' : 'border-gray-300'
                }`}
              />
              <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
            {errors.date && (
              <p className="text-sm text-error-600">{errors.date}</p>
            )}
          </div>

          {/* Note */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Nota (opcional)
            </label>
            <textarea
              value={formData.note}
              onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-hz-primary focus:border-transparent resize-none"
              placeholder="Concepto de la transferencia..."
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            disabled={creating}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={creating}
            className="px-4 py-2 text-sm font-medium text-white bg-hz-primary rounded-lg hover:bg-hz-primary-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {creating && (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
            )}
            {creating ? 'Creando...' : 'Crear transferencia'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewTransferModal;