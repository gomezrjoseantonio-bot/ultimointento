import React, { useState, useEffect } from 'react';
import { X, Upload } from 'lucide-react';
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
  const [selectedAccountId, setSelectedAccountId] = useState<number | 'new' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [newAccount, setNewAccount] = useState({
    name: '',
    bank: '',
    iban: '',
    openingBalance: 0
  });

  // Load accounts when modal opens
  useEffect(() => {
    if (isOpen) {
      loadAccounts();
    }
  }, [isOpen]);

  const loadAccounts = async () => {
    try {
      const allAccounts = await treasuryAPI.accounts.getAccounts();
      setAccounts(allAccounts.filter(acc => acc.isActive));
    } catch (error) {
      console.error('Error loading accounts:', error);
      toast.error('Error al cargar las cuentas');
    }
  };

  const handleCreateAccount = async () => {
    if (!newAccount.name || !newAccount.bank) {
      toast.error('Por favor, completa todos los campos obligatorios');
      return;
    }

    try {
      setIsLoading(true);
      const createdAccount = await treasuryAPI.accounts.createAccount({
        alias: newAccount.name,
        bank: newAccount.bank,
        iban: newAccount.iban,
        includeInConsolidated: true,
        openingBalance: newAccount.openingBalance
      });

      await loadAccounts();
      if (createdAccount?.id) {
        setSelectedAccountId(createdAccount.id);
      }
      setNewAccount({ name: '', bank: '', iban: '', openingBalance: 0 });
      toast.success('Cuenta creada correctamente');
    } catch (error) {
      console.error('Error creating account:', error);
      toast.error('Error al crear la cuenta');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file || !selectedAccountId || selectedAccountId === 'new') {
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
        accountId: selectedAccountId as number,
        skipDuplicates: true,
        usuario: 'inbox_ui'
      };
      
      const result = await importBankStatement(options);
      
      if (!result.success && (result as any).requiresAccountSelection) {
        // This shouldn't happen since we pre-selected an account, but handle it
        toast.error('Error: se requiere selección de cuenta');
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
              onChange={(e) => setSelectedAccountId(e.target.value === 'new' ? 'new' : Number(e.target.value) || null)}
            >
              <option value="">Selecciona una cuenta...</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} - {account.bank} ({formatEuro(account.balance)})
                </option>
              ))}
              <option value="new">+ Crear nueva cuenta</option>
            </select>
          </div>

          {/* Create new account form */}
          {selectedAccountId === 'new' && (
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-gray-900">Nueva Cuenta</h4>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Nombre de la cuenta *</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                  value={newAccount.name}
                  onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                  placeholder="Ej: Cuenta corriente principal"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Banco *</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                  value={newAccount.bank}
                  onChange={(e) => setNewAccount({ ...newAccount, bank: e.target.value })}
                  placeholder="Ej: BBVA, Santander, ING..."
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">IBAN</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                  value={newAccount.iban}
                  onChange={(e) => setNewAccount({ ...newAccount, iban: e.target.value })}
                  placeholder="ES..."
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Saldo inicial</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                  value={newAccount.openingBalance}
                  onChange={(e) => setNewAccount({ ...newAccount, openingBalance: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <button
                onClick={handleCreateAccount}
                disabled={isLoading || !newAccount.name || !newAccount.bank}
                className="w-full px-4 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Creando...' : 'Crear Cuenta'}
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleImport}
              disabled={isLoading || !selectedAccountId || selectedAccountId === 'new'}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Importando...' : 'Importar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BankStatementModal;