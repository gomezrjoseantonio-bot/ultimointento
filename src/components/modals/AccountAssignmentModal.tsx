import React, { useState } from 'react';
import { X, Building, CreditCard } from 'lucide-react';
import { ProcessedDocument } from '../../services/unifiedDocumentProcessor';

interface AccountAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: ProcessedDocument;
  onAssignAccount: (documentId: string, accountData: { iban?: string; accountNumber?: string; bankName?: string }) => void;
}

const AccountAssignmentModal: React.FC<AccountAssignmentModalProps> = ({
  isOpen,
  onClose,
  document,
  onAssignAccount
}) => {
  const [accountNumber, setAccountNumber] = useState('');
  const [iban, setIban] = useState('');
  const [bankName, setBankName] = useState('');
  const [assignmentType, setAssignmentType] = useState<'iban' | 'account'>('iban');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (assignmentType === 'iban' && !iban.trim()) {
      return;
    }
    
    if (assignmentType === 'account' && !accountNumber.trim()) {
      return;
    }

    onAssignAccount(document.id, {
      iban: assignmentType === 'iban' ? iban.trim() : undefined,
      accountNumber: assignmentType === 'account' ? accountNumber.trim() : undefined,
      bankName: bankName.trim() || undefined
    });

    // Reset form
    setAccountNumber('');
    setIban('');
    setBankName('');
    onClose();
  };

  const handleCancel = () => {
    setAccountNumber('');
    setIban('');
    setBankName('');
    onClose();
  };

  const formatIban = (value: string) => {
    // Remove spaces and convert to uppercase
    const cleaned = value.replace(/\s/g, '').toUpperCase();
    // Add spaces every 4 characters for readability
    return cleaned.replace(/(.{4})/g, '$1 ').trim();
  };

  const handleIbanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatIban(e.target.value);
    setIban(formatted);
  };

  return (
    <div className="fixed inset-0 bg-gray-200 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Asignar cuenta bancaria</h3>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Documento: <span className="font-medium">{document.filename}</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            El archivo no contiene información suficiente para detectar la cuenta automáticamente.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Assignment type selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Tipo de identificación
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="iban"
                  checked={assignmentType === 'iban'}
                  onChange={(e) => setAssignmentType(e.target.value as 'iban')}
                  className="mr-2"
                  style={{ accentColor: 'var(--horizon-primary)' }}
                />
                <CreditCard className="h-4 w-4 mr-1" />
                IBAN
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="account"
                  checked={assignmentType === 'account'}
                  onChange={(e) => setAssignmentType(e.target.value as 'account')}
                  className="mr-2"
                  style={{ accentColor: 'var(--horizon-primary)' }}
                />
                <Building className="h-4 w-4 mr-1" />
                Nº Cuenta
              </label>
            </div>
          </div>

          {/* IBAN input */}
          {assignmentType === 'iban' && (
            <div>
              <label htmlFor="iban" className="block text-sm font-medium text-gray-700 mb-1">
                IBAN *
              </label>
              <input
                type="text"
                id="iban"
                value={iban}
                onChange={handleIbanChange}
                placeholder="ES91 2100 0418 4502 0005 1332"
                maxLength={29} // IBAN max length with spaces
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2"
                style={{ 
                  '--tw-ring-color': 'var(--horizon-primary)',
                  borderColor: 'var(--hz-neutral-300)'
                } as React.CSSProperties}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--horizon-primary)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--hz-neutral-300)';
                }}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Introduce el IBAN completo (con ES y código)
              </p>
            </div>
          )}

          {/* Account number input */}
          {assignmentType === 'account' && (
            <div>
              <label htmlFor="accountNumber" className="block text-sm font-medium text-gray-700 mb-1">
                Número de cuenta *
              </label>
              <input
                type="text"
                id="accountNumber"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="12345678901234567890"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2"
                style={{ 
                  '--tw-ring-color': 'var(--horizon-primary)',
                  borderColor: 'var(--hz-neutral-300)'
                } as React.CSSProperties}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--horizon-primary)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--hz-neutral-300)';
                }}
                required
              />
            </div>
          )}

          {/* Bank name (optional) */}
          <div>
            <label htmlFor="bankName" className="block text-sm font-medium text-gray-700 mb-1">
              Banco (opcional)
            </label>
            <input
              type="text"
              id="bankName"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="Santander, BBVA, ING..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{ 
                '--tw-ring-color': 'var(--horizon-primary)',
                borderColor: 'var(--hz-neutral-300)'
              } as React.CSSProperties}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--horizon-primary)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--hz-neutral-300)';
              }}
            />
          </div>

          {/* Action buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-sm font-medium text-white rounded-md"
              style={{ backgroundColor: 'var(--horizon-primary)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--horizon-primary-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--horizon-primary)'}
            >
              Asignar cuenta
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AccountAssignmentModal;