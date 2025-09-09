import React, { useState, useEffect } from 'react';
import { X, Upload, Settings, AlertTriangle } from 'lucide-react';
import { Account } from '../../services/db';
import { treasuryAPI } from '../../services/treasuryApiService';
import { formatEuro } from '../../utils/formatUtils';
import { importBankStatement, ImportOptions } from '../../services/bankStatementImportService';
import toast from 'react-hot-toast';

interface BankStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: File | null;
  onImportComplete: (summary: {
    inserted: number;
    duplicates: number;
    failed: number;
    reconciled?: number;
    pendingReview?: number;
    batchId: string;
  }) => void;
}

const BankStatementModal: React.FC<BankStatementModalProps> = ({
  isOpen,
  onClose,
  file,
  onImportComplete
}) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showUnrecognizedIBAN, setShowUnrecognizedIBAN] = useState(false);
  const [detectedIBAN, setDetectedIBAN] = useState<string>('');

  // Load accounts when modal opens
  useEffect(() => {
    if (isOpen) {
      loadAccounts();
    }
  }, [isOpen]);

  const loadAccounts = async () => {
    try {
      const allAccounts = await treasuryAPI.accounts.getAccounts();
      setAccounts(allAccounts.filter(acc => 
        acc.isActive && 
        !acc.deleted_at &&
        !acc.name?.toLowerCase().includes('demo') &&
        !acc.name?.toLowerCase().includes('sample') &&
        !acc.name?.toLowerCase().includes('fake') &&
        !acc.bank?.toLowerCase().includes('demo') &&
        !acc.bank?.toLowerCase().includes('sample') &&
        !acc.bank?.toLowerCase().includes('fake')
      ));
    } catch (error) {
      console.error('Error loading accounts:', error);
      toast.error('Error al cargar las cuentas');
    }
  };

  const handleGoToSettings = () => {
    // Close modal and redirect to Settings > Accounts
    onClose();
    
    // Navigate to settings (this depends on your routing setup)
    // For a React Router setup, you would typically use navigate('/configuracion/cuentas')
    // Since I don't see the routing setup, I'll use window location
    const currentUrl = new URL(window.location.href);
    currentUrl.hash = '#/configuracion/cuentas';
    window.location.href = currentUrl.toString();
    
    toast.success('Crea la cuenta en Configuración y luego importa de nuevo el extracto');
  };

  const handleImport = async () => {
    if (!file || !selectedAccountId) {
      toast.error('Por favor, selecciona una cuenta de destino');
      return;
    }

    try {
      setIsLoading(true);
      
      // Validate that account exists
      const selectedAccount = accounts.find(acc => acc.id === selectedAccountId);
      if (!selectedAccount) {
        toast.error('Cuenta seleccionada no encontrada');
        return;
      }
      
      // Use the unified import service
      const options: ImportOptions = {
        file,
        destinationAccountId: selectedAccountId as number,
        usuario: 'inbox_ui'
      };
      
      const result = await importBankStatement(options);
      
      if (!result.success && (result as any).requiresAccountSelection) {
        // Show unrecognized IBAN modal
        setDetectedIBAN((result as any).unrecognizedIBAN || 'IBAN no detectado');
        setShowUnrecognizedIBAN(true);
        return;
      }
      
      if (result.success) {
        // Call the completion handler with the expected format
        onImportComplete({
          inserted: result.inserted,
          duplicates: result.duplicates,
          failed: result.errors,
          batchId: result.batchId
        });
      } else {
        toast.error('Error al importar el extracto');
      }
      
    } catch (error) {
      console.error('Import error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error al importar movimientos';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  // Unrecognized IBAN Modal
  if (showUnrecognizedIBAN) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Cuenta no reconocida
            </h2>
            <button
              onClick={() => setShowUnrecognizedIBAN(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-gray-900 mb-2">
                  No se encontró una cuenta para este IBAN
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  IBAN detectado: <span className="font-mono font-medium">{detectedIBAN}</span>
                </p>
                <p className="text-sm text-gray-600">
                  Para importar movimientos, necesitas crear primero la cuenta en Configuración &gt; Cuentas.
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={handleGoToSettings}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Settings className="w-4 h-4" />
                Ir a Configuración &gt; Cuentas
              </button>
              <button
                onClick={() => setShowUnrecognizedIBAN(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Importar Extracto Bancario
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* File info */}
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Upload className="w-5 h-5 text-primary-600" />
              <div>
                <div className="font-medium text-primary-900">{file?.name}</div>
                <div className="text-sm text-primary-600">
                  Extracto bancario detectado
                </div>
              </div>
            </div>
          </div>

          {/* Account selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seleccionar cuenta destino
            </label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
              value={selectedAccountId || ''}
              onChange={(e) => setSelectedAccountId(Number(e.target.value) || null)}
            >
              <option value="">Selecciona una cuenta...</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} - {account.bank} ({formatEuro(account.balance)})
                </option>
              ))}
            </select>
          </div>

          {/* Help text and no accounts warning */}
          {accounts.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-700 mb-2">
                ⚠️ No hay cuentas configuradas. Debes crear una cuenta antes de poder importar extractos.
              </p>
              <button
                onClick={handleGoToSettings}
                className="text-sm bg-amber-600 text-white px-3 py-1 rounded hover:bg-amber-700 transition-colors"
              >
                Ir a Configuración &gt; Cuentas
              </button>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-700">
                💡 ¿No ves tu cuenta? Ve a <strong>Configuración &gt; Cuentas</strong> para crear una nueva cuenta.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleImport}
              disabled={!selectedAccountId || isLoading || accounts.length === 0}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Importando...' : accounts.length === 0 ? 'Sin cuentas disponibles' : 'Importar Movimientos'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BankStatementModal;
