import React, { useState } from 'react';
import { X, Building, AlertCircle } from 'lucide-react';
import { Account } from '../../services/db';

interface AccountSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAccount: (accountId: number) => void;
  accounts: Account[];
  filename?: string;
  unrecognizedIBAN?: string;
}

const AccountSelectionModal: React.FC<AccountSelectionModalProps> = ({
  isOpen,
  onClose,
  onSelectAccount,
  accounts,
  filename,
  unrecognizedIBAN
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedAccountId) {
      return;
    }

    onSelectAccount(selectedAccountId);
    setSelectedAccountId(null);
  };

  const handleCancel = () => {
    setSelectedAccountId(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Seleccionar cuenta bancaria
          </h3>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-800">Cuenta no reconocida automáticamente</p>
              <p className="text-amber-700 mt-1">
                {filename && `Archivo: ${filename}`}
                {unrecognizedIBAN && (
                  <span className="block">IBAN: {unrecognizedIBAN}</span>
                )}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Selecciona la cuenta correcta *
            </label>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {accounts.map((account) => (
                <label
                  key={account.id}
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedAccountId === account.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="account"
                    value={account.id}
                    checked={selectedAccountId === account.id}
                    onChange={() => setSelectedAccountId(account.id!)}
                    className="sr-only"
                  />
                  <div className="flex items-center gap-2 flex-1">
                    <Building className="h-4 w-4 text-gray-500" />
                    <div>
                      <div className="font-medium text-gray-900">
                        {account.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {account.bank}
                        {account.iban && (
                          <span className="ml-2">
                            •••• {account.iban.slice(-4)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {selectedAccountId === account.id && (
                    <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                  )}
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!selectedAccountId}
              className="px-4 py-2 text-white rounded-lg hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#0D1B2A' }}
            >
              Confirmar selección
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AccountSelectionModal;