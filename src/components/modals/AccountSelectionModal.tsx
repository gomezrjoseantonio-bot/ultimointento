import React, { useState, useEffect } from 'react';
import { X, CreditCard, Plus, AlertCircle } from 'lucide-react';
import { Account } from '../../services/db';
import { getAvailableAccountsForImport } from '../../services/enhancedTreasuryCreationService';

interface AccountSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAccount: (accountId: number) => void;
  accounts?: Account[]; // Optional - will load if not provided
  filename?: string;
  unrecognizedIBAN?: string;
  title?: string;
  subtitle?: string;
}

const AccountSelectionModal: React.FC<AccountSelectionModalProps> = ({
  isOpen,
  onClose,
  onSelectAccount,
  accounts: providedAccounts,
  filename,
  unrecognizedIBAN,
  title = "Seleccionar cuenta bancaria",
  subtitle = "Elige la cuenta correspondiente a este extracto bancario"
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [accounts, setAccounts] = useState<Account[]>(providedAccounts || []);
  const [loading, setLoading] = useState(!providedAccounts);

  useEffect(() => {
    if (isOpen && !providedAccounts) {
      loadAccounts();
    } else if (providedAccounts) {
      setAccounts(providedAccounts);
      setLoading(false);
    }
  }, [isOpen, providedAccounts]);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const availableAccounts = await getAvailableAccountsForImport();
      setAccounts(availableAccounts);
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSelection = () => {
    if (selectedAccountId) {
      onSelectAccount(selectedAccountId);
      setSelectedAccountId(null);
      onClose();
    }
  };

  const handleCancel = () => {
    setSelectedAccountId(null);
    onClose();
  };

  const formatIBAN = (iban: string) => {
    if (!iban) return '';
    // Show last 4 digits with masking
    return iban.length > 4 
      ? `****${iban.slice(-4)}`
      : iban;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 transition-opacity" 
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={handleCancel}
        />

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold" style={{ 
                  color: '#303A4C',
                  fontFamily: 'Inter, sans-serif'
                }}>
                  {title}
                </h3>
                <p className="mt-1 text-sm" style={{ 
                  color: '#6C757D',
                  fontFamily: 'Inter, sans-serif'
                }}>
                  {subtitle}
                </p>
                {filename && (
                  <p className="mt-1 text-xs font-mono" style={{ 
                    color: '#6C757D',
                    fontFamily: 'Inter, sans-serif'
                  }}>
                    Archivo: {filename}
                  </p>
                )}
                {unrecognizedIBAN && (
                  <p className="mt-1 text-xs font-mono" style={{ 
                    color: '#DC3545',
                    fontFamily: 'Inter, sans-serif'
                  }}>
                    IBAN detectado: {unrecognizedIBAN}
                  </p>
                )}
              </div>
              <button
                onClick={handleCancel}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
                <span className="ml-3 text-sm" style={{ 
                  color: '#6C757D',
                  fontFamily: 'Inter, sans-serif'
                }}>
                  Cargando cuentas...
                </span>
              </div>
            ) : accounts.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" strokeWidth={1.5} />
                <h4 className="text-sm font-medium" style={{ 
                  color: '#303A4C',
                  fontFamily: 'Inter, sans-serif'
                }}>
                  No hay cuentas disponibles
                </h4>
                <p className="mt-2 text-sm" style={{ 
                  color: '#6C757D',
                  fontFamily: 'Inter, sans-serif'
                }}>
                  Configura al menos una cuenta bancaria para importar extractos.
                </p>
                <button
                  onClick={() => {
                    // TODO: Navigate to account configuration
                    console.log('Navigate to account configuration');
                  }}
                  className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-white rounded-md hover:opacity-90 transition-opacity"
                  style={{ 
                    backgroundColor: '#042C5E',
                    fontFamily: 'Inter, sans-serif'
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" strokeWidth={1.5} />
                  Configurar cuentas
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {unrecognizedIBAN && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center">
                      <AlertCircle className="h-5 w-5 text-amber-600 mr-2" strokeWidth={1.5} />
                      <div className="text-sm">
                        <p className="font-medium text-amber-800">IBAN no reconocido automáticamente</p>
                        <p className="text-amber-700 mt-1">
                          Selecciona manualmente la cuenta correspondiente
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                <p className="text-sm" style={{ 
                  color: '#303A4C',
                  fontFamily: 'Inter, sans-serif'
                }}>
                  Selecciona la cuenta bancaria correspondiente:
                </p>
                
                <div className="space-y-2">
                  {accounts.map((account) => (
                    <button
                      key={account.id}
                      onClick={() => setSelectedAccountId(account.id!)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        selectedAccountId === account.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                      style={{ 
                        fontFamily: 'Inter, sans-serif'
                      }}
                    >
                      <div className="flex items-center">
                        <CreditCard 
                          className={`w-5 h-5 mr-3 ${
                            selectedAccountId === account.id ? 'text-blue-600' : 'text-gray-400'
                          }`} 
                          strokeWidth={1.5} 
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className={`text-sm font-medium ${
                              selectedAccountId === account.id ? 'text-blue-900' : 'text-gray-900'
                            }`}>
                              {account.name || `${account.bank} ${formatIBAN(account.iban)}`}
                            </h4>
                            {selectedAccountId === account.id && (
                              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                            )}
                          </div>
                          <div className="mt-1 space-y-1">
                            <p className={`text-xs ${
                              selectedAccountId === account.id ? 'text-blue-700' : 'text-gray-600'
                            }`}>
                              {account.bank}
                            </p>
                            <p className={`text-xs font-mono ${
                              selectedAccountId === account.id ? 'text-blue-700' : 'text-gray-500'
                            }`}>
                              IBAN: {formatIBAN(account.iban)}
                            </p>
                            {account.current_balance !== undefined && (
                              <p className={`text-xs ${
                                selectedAccountId === account.id ? 'text-blue-700' : 'text-gray-500'
                              }`}>
                                Saldo: {account.current_balance.toLocaleString('es-ES', { 
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2 
                                })} €
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {!loading && accounts.length > 0 && (
            <div className="px-6 py-4 bg-gray-50 flex items-center justify-end space-x-3">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                style={{ 
                  color: '#6C757D',
                  fontFamily: 'Inter, sans-serif'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSelection}
                disabled={!selectedAccountId}
                className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-all ${
                  selectedAccountId 
                    ? 'hover:opacity-90 cursor-pointer' 
                    : 'opacity-50 cursor-not-allowed'
                }`}
                style={{ 
                  backgroundColor: selectedAccountId ? '#042C5E' : '#6C757D',
                  fontFamily: 'Inter, sans-serif'
                }}
              >
                Confirmar selección
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountSelectionModal;